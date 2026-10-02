import type { DeviceStatus, DeviceType } from './models';
export type ValidationErrors = Record<string, string>;
import { deviceTypes, validDeviceNumber } from './deviceIdentity';
export const statuses: DeviceStatus[] = ['sprawne', 'wymaga_naprawy', 'wylaczone', 'archiwalne', 'do_ustalenia'];
export function validateStatusApproval(status: string, approvedForUse?: boolean): ValidationErrors {
    if (!statuses.includes(status as DeviceStatus)) return { status: 'Wybierz prawidłowy status.' };
    if (status === 'do_ustalenia' && approvedForUse === true) return { approvedForUse: 'Status Do ustalenia nie dopuszcza do użytkowania.' };
    return {};
}
export function validateScore(value: number) { return Number.isFinite(value) && Number.isInteger(value * 2) && value >= 0 && value <= 5; }
export function validateCoordinates(latitude: number, longitude: number) { return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180; }
export function validateDeviceInput(input: {
    name: string;
    number: string;
    type: string;
    status: string;
    approvedForUse?: boolean;
    conditionScore: number | null;
    conditionLabel?: string | null;
    inspectionDate?: Date | null;
    inventoryUpdatedAt?: Date | null;
    latitude: number | null;
    longitude: number | null;
    disabledReason?: string;
    hasSafetyIssue?: boolean;
}) {
    const errors: ValidationErrors = { ...validateInventoryDates(input), ...validateStatusApproval(input.status, input.approvedForUse) };
    if (input.conditionLabel != null && input.conditionLabel.length > 80)
        errors.conditionLabel = 'Opis oceny może mieć maksymalnie 80 znaków.';
    if (!input.name.trim())
        errors.name = 'Nazwa jest wymagana.';
    if (!validDeviceNumber(input.number))
        errors.number = 'Podaj numer (np. 31, 4A lub 4B), maksymalnie 32 znaki: cyfry, litery i łącznik.';
    if (!deviceTypes.includes(input.type as DeviceType))
        errors.type = 'Wybierz prawidłowy typ.';
    if (!statuses.includes(input.status as DeviceStatus))
        errors.status = 'Wybierz prawidłowy status.';
    if (input.conditionScore !== null && !validateScore(input.conditionScore))
        errors.conditionScore = 'Ocena musi być liczbą od 0 do 5 co 0,5.';
    if (!(input.latitude === null && input.longitude === null) && (input.latitude === null || input.longitude === null || !validateCoordinates(input.latitude, input.longitude)))
        errors.location = 'Podaj prawidłową szerokość i długość geograficzną.';
    if (input.status === 'wylaczone' && !input.disabledReason?.trim() && !input.hasSafetyIssue)
        errors.disabledReason = 'Wyłączenie wymaga uzasadnienia lub otwartej usterki bezpieczeństwa.';
    return errors;
}
export function validateInspectionInput(input: {
    description: string;
    conditionScore: number;
    inspectionDate?: Date;
}) { const errors: ValidationErrors = {}; if (!input.description.trim())
    errors.description = 'Opis jest wymagany.'; if (!validateScore(input.conditionScore))
    errors.conditionScore = 'Ocena musi być od 0 do 5 co 0,5.'; if (!input.inspectionDate || Number.isNaN(input.inspectionDate.getTime()))
    errors.inspectionDate = 'Data przeglądu jest wymagana.'; return errors; }
export function validateIssueInput(input: {
    title: string;
    description: string;
}) { const errors: ValidationErrors = {}; if (!input.title.trim())
    errors.title = 'Tytuł jest wymagany.'; if (!input.description.trim())
    errors.description = 'Opis jest wymagany.'; return errors; }
export function validateRepairInput(input: {
    description: string;
    cost: number | null;
    startedAt: Date | null;
    completedAt?: Date;
    conditionAfter: number;
    verifiedByUid: string;
}) { const errors: ValidationErrors = {}; if (!input.description.trim())
    errors.description = 'Opis jest wymagany.'; if (input.cost !== null && input.cost < 0)
    errors.cost = 'Koszt nie może być ujemny.'; if (!input.completedAt)
    errors.completedAt = 'Data zakończenia jest wymagana.'; if (input.startedAt && input.completedAt && input.completedAt < input.startedAt)
    errors.completedAt = 'Zakończenie nie może być wcześniejsze niż rozpoczęcie.'; if (!validateScore(input.conditionAfter))
    errors.conditionAfter = 'Ocena musi być od 0 do 5 co 0,5.'; if (!input.verifiedByUid)
    errors.verifiedByUid = 'Naprawa wymaga osoby zatwierdzającej.'; return errors; }
export function validateCommentInput(input: {
    content: string;
}) { return input.content.trim() ? {} : { content: 'Treść zgłoszenia jest wymagana.' }; }
export function validateMediaInput(input: {
    path: string;
}) { return input.path.trim() ? {} : { path: 'Ścieżka zdjęcia jest wymagana.' }; }
export function validateInventoryDates(input: {
    inspectionDate?: Date | null;
    inventoryUpdatedAt?: Date | null;
}) {
    const errors: ValidationErrors = {};
    for (const key of ['inspectionDate', 'inventoryUpdatedAt'] as const) {
        const value = input[key];
        if (value != null && (!(value instanceof Date) || !Number.isFinite(value.getTime())))
            errors[key] = 'Podaj prawidłową datę.';
    }
    return errors;
}
export function formatCondition(score: number | null, label?: string | null) {
    const numeric = score == null ? 'do ustalenia' : `${score.toLocaleString('pl-PL')}/5`;
    return label ? `${numeric} (${label})` : numeric;
}
