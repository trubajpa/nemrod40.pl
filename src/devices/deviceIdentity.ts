import type { DeviceType } from './models'

export const deviceTypes: DeviceType[] = ['ambona', 'zwyzka', 'pasnik', 'lizawka', 'inne']
export function normalizeDeviceNumber(value: string) { return value.trim().toUpperCase() }
export function validDeviceNumber(value: string) {
  return /^[0-9][A-Z0-9-]{0,31}$/.test(normalizeDeviceNumber(value))
}
export function deviceDocumentId(type: DeviceType, number: string) {
  if (!deviceTypes.includes(type) || !validDeviceNumber(number)) throw new Error('invalid_device_identity')
  return `${type}-${normalizeDeviceNumber(number).toLowerCase()}`
}

const collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' })
export function compareDeviceNumbers(a: { number: string; type: string; id: string }, b: { number: string; type: string; id: string }) {
  return collator.compare(a.number, b.number) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id)
}
