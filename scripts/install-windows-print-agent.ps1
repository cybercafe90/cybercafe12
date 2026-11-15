# Run in Windows PowerShell as the normal desktop user (not Administrator).
$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "BabaPrintAgent"
New-Item -ItemType Directory -Path $root -Force | Out-Null
Write-Host "BABA'S CYBER CAFE - Windows Print Agent setup" -ForegroundColor Cyan
Write-Host "This installs free SumatraPDF and a user-session background task."
$base = Read-Host "Supabase project URL (https://....supabase.co)"
$anon = Read-Host "Supabase anon/public key"
$secureToken = Read-Host "One-time desktop agent token from Print Admin" -AsSecureString
if (-not $base.StartsWith("https://") -or -not $anon -or $secureToken.Length -lt 40) { throw "The project URL, anon key or agent token is invalid." }
$printers = @(Get-Printer | Select-Object -ExpandProperty Name)
if (-not $printers.Count) { throw "No Windows printer found. Install the Brother DCP-T226 driver and connect USB first." }
Write-Host ""
Write-Host "Installed printers:"
$printers | ForEach-Object { Write-Host " - $_" }
$printerName = Read-Host "Enter the exact printer name shown above"
if ($printers -notcontains $printerName) { throw "That exact printer name was not found." }
$version = "3.6.1"
$zip = Join-Path $env:TEMP "SumatraPDF-$version-64.zip"
$download = "https://www.sumatrapdfreader.org/dl/rel/$version/SumatraPDF-$version-64.zip"
Write-Host "Downloading free SumatraPDF from its official website..."
Invoke-WebRequest -Uri $download -OutFile $zip
$extract = Join-Path $root "sumatra"
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
$sumatra = Get-ChildItem -Path $extract -Filter "SumatraPDF.exe" -Recurse | Select-Object -First 1
if (-not $sumatra) { throw "Could not locate SumatraPDF.exe in the official portable archive." }
$workerSource = Join-Path $PSScriptRoot "windows-print-agent.ps1"
if (-not (Test-Path $workerSource)) { throw "Keep windows-print-agent.ps1 in the same folder as this installer." }
$worker = Join-Path $root "windows-print-agent.ps1"
Copy-Item $workerSource $worker -Force
$config = @{ SupabaseUrl=$base.TrimEnd("/"); AnonKey=$anon; AgentTokenProtected=(ConvertFrom-SecureString $secureToken); PrinterName=$printerName; SumatraPath=$sumatra.FullName }
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root "config.json") -Encoding UTF8
$taskName = "BABA Cyber Cafe Print Agent"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $worker + '"')
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description "Secure BABA'S CYBER CAFE paid print-job agent" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host ""
Write-Host "Setup complete. The agent will start automatically when this Windows user signs in." -ForegroundColor Green
Write-Host "Logs: $root\agent.log"
Write-Host "Stop it in Task Scheduler using task name: $taskName"
