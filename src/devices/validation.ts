import type { DeviceStatus, DeviceType } from './models'

export type ValidationErrors = Record<string, string>
const deviceTypes: DeviceType[] = ['ambona', 'zwyzka', 'pasnik', 'lizawka', 'inne']
const statuses: DeviceStatus[] = ['sprawne', 'wymaga_naprawy', 'wylaczone', 'archiwalne']

export function validateScore(value: number) { return Number.isInteger(value) && value >= 1 && value <= 5 }
export function validateCoordinates(latitude: number, longitude: number) { return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 }
export function validateDeviceInput(input: { name: string; number: number; type: string; status: string; conditionScore: number; latitude: number; longitude: number; disabledReason?: string; hasSafetyIssue?: boolean }) {
  const errors: ValidationErrors = {}
  if (!input.name.trim()) errors.name = 'Nazwa jest wymagana.'
  if (!Number.isFinite(input.number)) errors.number = 'Numer jest wymagany.'
  if (!deviceTypes.includes(input.type as DeviceType)) errors.type = 'Wybierz prawidłowy typ.'
  if (!statuses.includes(input.status as DeviceStatus)) errors.status = 'Wybierz prawidłowy status.'
  if (!validateScore(input.conditionScore)) errors.conditionScore = 'Ocena musi być liczbą od 1 do 5.'
  if (!validateCoordinates(input.latitude, input.longitude)) errors.location = 'Podaj prawidłową szerokość i długość geograficzną.'
  if (input.status === 'wylaczone' && !input.disabledReason?.trim() && !input.hasSafetyIssue) errors.disabledReason = 'Wyłączenie wymaga uzasadnienia lub otwartej usterki bezpieczeństwa.'
  return errors
}
export function validateInspectionInput(input: { description: string; conditionScore: number; inspectionDate?: Date }) { const errors: ValidationErrors = {}; if (!input.description.trim()) errors.description = 'Opis jest wymagany.'; if (!validateScore(input.conditionScore)) errors.conditionScore = 'Ocena musi być od 1 do 5.'; if (!input.inspectionDate || Number.isNaN(input.inspectionDate.getTime())) errors.inspectionDate = 'Data przeglądu jest wymagana.'; return errors }
export function validateIssueInput(input: { title: string; description: string }) { const errors: ValidationErrors = {}; if (!input.title.trim()) errors.title = 'Tytuł jest wymagany.'; if (!input.description.trim()) errors.description = 'Opis jest wymagany.'; return errors }
export function validateRepairInput(input: { description: string; cost: number | null; startedAt: Date | null; completedAt?: Date; conditionAfter: number; verifiedByUid: string }) { const errors: ValidationErrors = {}; if (!input.description.trim()) errors.description = 'Opis jest wymagany.'; if (input.cost !== null && input.cost < 0) errors.cost = 'Koszt nie może być ujemny.'; if (!input.completedAt) errors.completedAt = 'Data zakończenia jest wymagana.'; if (input.startedAt && input.completedAt && input.completedAt < input.startedAt) errors.completedAt = 'Zakończenie nie może być wcześniejsze niż rozpoczęcie.'; if (!validateScore(input.conditionAfter)) errors.conditionAfter = 'Ocena musi być od 1 do 5.'; if (!input.verifiedByUid) errors.verifiedByUid = 'Naprawa wymaga osoby zatwierdzającej.'; return errors }
export function validateCommentInput(input: { content: string }) { return input.content.trim() ? {} : { content: 'Treść zgłoszenia jest wymagana.' } }
export function validateMediaInput(input: { path: string }) { return input.path.trim() ? {} : { path: 'Ścieżka zdjęcia jest wymagana.' } }
