param([string]$ConfigPath = "$env:LOCALAPPDATA\BabaPrintAgent\config.json")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $ConfigPath
$log = Join-Path $root "agent.log"
function Write-Log([string]$Message) { Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message) }
function Get-AgentToken($Config) {
  $secure = ConvertTo-SecureString $Config.AgentTokenProtected
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Invoke-AgentApi($Config, [string]$Action, $Extra = @{}) {
  $token = Get-AgentToken $Config
  $headers = @{ apikey=$Config.AnonKey; Authorization="Bearer $($Config.AnonKey)"; "x-print-agent-token"=$token }
  $body = @{ action=$Action }
  foreach ($key in $Extra.Keys) { $body[$key]=$Extra[$key] }
  Invoke-RestMethod -Method Post -Uri "$($Config.SupabaseUrl.TrimEnd('/'))/functions/v1/print-agent" -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6) -TimeoutSec 30
}
try {
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  if (-not $config.SupabaseUrl -or -not $config.AnonKey -or -not $config.AgentTokenProtected -or -not $config.PrinterName -or -not (Test-Path $config.SumatraPath)) { throw "Agent configuration is incomplete. Run the installer again." }
  Write-Log "Agent started for printer: $($config.PrinterName)"
} catch { Write-Log $_.Exception.Message; exit 1 }
while ($true) {
  try {
    $printer = Get-Printer -Name $config.PrinterName -ErrorAction SilentlyContinue
    if (-not $printer) { Write-Log "Configured printer is unavailable: $($config.PrinterName)"; Start-Sleep -Seconds 10; continue }
    $result = Invoke-AgentApi $config "poll"
    if (-not $result.job) { Start-Sleep -Seconds 5; continue }
    $job = $result.job
    $safeName = ([IO.Path]::GetFileNameWithoutExtension([string]$job.file_name) -replace '[^A-Za-z0-9_-]','_')
    $localPdf = Join-Path $root ("{0}_{1}.pdf" -f $job.job_number,$safeName)
    Write-Log "Received job $($job.job_number)"
    Invoke-WebRequest -Uri $job.downloadUrl -OutFile $localPdf -TimeoutSec 90
    if ((Get-Item $localPdf).Length -lt 100) { throw "Downloaded PDF is empty or invalid." }
    $colourSetting = if ($job.color_mode -eq "color") { "color" } else { "monochrome" }
    $settings = "{0}x,{1},fit,paper={2}" -f ([Math]::Max(1,[Math]::Min(100,[int]$job.copies))),$colourSetting,[string]$job.paper_size
    $arguments = '-print-to "' + ($config.PrinterName -replace '"','') + '" -print-settings "' + $settings + '" -silent "' + $localPdf + '"'
    $process = Start-Process -FilePath $config.SumatraPath -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -eq 0) {
      Invoke-AgentApi $config "sent" @{ jobId=$job.id } | Out-Null
      Write-Log "Job $($job.job_number) accepted by Windows print spooler. Physical output still needs checking."
    } else {
      $message = "SumatraPDF print error code $($process.ExitCode)"
      Invoke-AgentApi $config "fail" @{ jobId=$job.id; error=$message } | Out-Null
      Write-Log "Job $($job.job_number) failed: $message"
    }
    Remove-Item -LiteralPath $localPdf -Force -ErrorAction SilentlyContinue
  } catch { Write-Log ("Agent loop error: " + $_.Exception.Message); Start-Sleep -Seconds 8 }
}
