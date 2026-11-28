import type { ServiceCategory, ServiceRecord } from '../types'

export const SERVICE_CSV_HEADERS = [
  'name',
  'department',
  'category',
  'description',
  'required_documents',
  'eligibility',
  'official_portal_url',
  'search_keywords',
  'is_active',
  'is_featured',
] as const

export interface ServiceCsvRow {
  name: string
  department: string
  category: string
  description: string
  required_documents: string[]
  eligibility: string
  official_portal_url: string
  search_keywords: string[]
  is_active: boolean
  is_featured: boolean
}

export interface ParsedServiceCsv {
  rows: ServiceCsvRow[]
  errors: string[]
}

function parseCsvGrid(source: string): { grid: string[][]; errors: string[] } {
  const grid: string[][] = []
  const errors: string[] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let recordLine = 1

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
        if (character === '\n') line += 1
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field.replace(/\r$/, ''))
      if (row.some((value) => value.trim() !== '')) grid.push(row)
      row = []
      field = ''
      if (character === '\r' && source[index + 1] === '\n') index += 1
      line += 1
      recordLine = line
    } else {
      field += character
    }
  }

  if (quoted) errors.push(`The CSV has an unclosed quoted field starting near line ${recordLine}.`)
  row.push(field)
  if (row.some((value) => value.trim() !== '')) grid.push(row)
  return { grid, errors }
}

function parseBoolean(value: string, field: string, line: number, errors: string[]): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (['true', 'yes', '1', 'active'].includes(normalized)) return true
  if (['false', 'no', '0', 'inactive'].includes(normalized)) return false
  errors.push(`Line ${line}: ${field} must be true or false.`)
  return null
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[;|]/).map((part) => part.trim()).filter(Boolean))]
}

export function parseServiceCsv(source: string, categories: ServiceCategory[]): ParsedServiceCsv {
  const { grid, errors } = parseCsvGrid(source.replace(/^\uFEFF/, ''))
  if (grid.length === 0) return { rows: [], errors: ['The CSV file is empty.'] }

  const headers = grid[0].map((header) => header.trim().toLowerCase())
  const missing = SERVICE_CSV_HEADERS.filter((header) => !headers.includes(header))
  if (missing.length) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}.`] }
  }

  const positions = new Map(headers.map((header, index) => [header, index]))
  const categoryLookup = new Map<string, ServiceCategory>()
  for (const category of categories) {
    categoryLookup.set(category.slug.toLowerCase(), category)
    categoryLookup.set(category.name.trim().toLowerCase(), category)
  }
  const rows: ServiceCsvRow[] = []
  const keys = new Set<string>()

  for (let index = 1; index < grid.length; index += 1) {
    const line = index + 1
    const values = grid[index]
    const read = (key: typeof SERVICE_CSV_HEADERS[number]) => values[positions.get(key)!]?.trim() ?? ''
    const name = read('name')
    const departmentInput = read('department')
    const department = categoryLookup.get(departmentInput.toLowerCase())
    const category = read('category')
    const description = read('description')
    const eligibility = read('eligibility')
    const portal = read('official_portal_url')
    const active = parseBoolean(read('is_active'), 'is_active', line, errors)
    const featured = parseBoolean(read('is_featured'), 'is_featured', line, errors)

    if (!name || name.length > 200) errors.push(`Line ${line}: name is required and must be 200 characters or fewer.`)
    if (!department) errors.push(`Line ${line}: department "${departmentInput}" does not match a known department slug or name.`)
    if (!category || category.length > 100) errors.push(`Line ${line}: category is required and must be 100 characters or fewer.`)
    if (description.length > 2000) errors.push(`Line ${line}: description exceeds 2,000 characters.`)
    if (eligibility.length > 2000) errors.push(`Line ${line}: eligibility exceeds 2,000 characters.`)
    if (portal) {
      try {
        const parsed = new URL(portal)
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) errors.push(`Line ${line}: official_portal_url must be a public HTTPS URL.`)
      } catch {
        errors.push(`Line ${line}: official_portal_url is not a valid URL.`)
      }
    }
    const key = `${department?.id ?? departmentInput.toLowerCase()}\u0000${name.toLowerCase()}`
    if (keys.has(key)) errors.push(`Line ${line}: duplicate service "${name}" for this department.`)
    keys.add(key)

    if (name && department && category && active !== null && featured !== null) {
      rows.push({
        name,
        department: department.slug,
        category,
        description,
        required_documents: splitList(read('required_documents')),
        eligibility,
        official_portal_url: portal,
        search_keywords: splitList(read('search_keywords')),
        is_active: active,
        is_featured: featured,
      })
    }
  }

  if (rows.length === 0 && errors.length === 0) errors.push('The CSV does not contain any service records.')
  return { rows, errors }
}

function protectSpreadsheetCell(value: string): string {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
}

function escapeCsv(value: string): string {
  const safe = protectSpreadsheetCell(value)
  return `"${safe.replaceAll('"', '""')}"`
}

export function exportServicesCsv(services: ServiceRecord[]): string {
  const lines = [SERVICE_CSV_HEADERS.join(',')]
  for (const service of services) {
    const values = [
      service.name,
      service.service_categories?.slug ?? '',
      service.category,
      service.description ?? '',
      service.required_documents.join('; '),
      service.eligibility ?? '',
      service.official_portal_url ?? '',
      service.search_keywords.join('; '),
      String(service.is_active),
      String(service.is_featured),
    ]
    lines.push(values.map(escapeCsv).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
