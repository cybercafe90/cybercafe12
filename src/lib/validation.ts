export function normalizeMobileNumber(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidMobileNumber(value: string): boolean {
  return /^[0-9]{10,15}$/.test(value)
}
