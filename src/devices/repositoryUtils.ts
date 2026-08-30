import type { FirestoreError, QuerySnapshot, DocumentData, FirestoreDataConverter } from 'firebase/firestore'

export function logDeviceError(operation: string, error: unknown) { const code = typeof error==='object' && error && 'code' in error ? String((error as FirestoreError).code) : 'firestore/unknown'; console.error('Device repository error', { operation, code, message:'The device data operation failed.' }) }
export function safeSnapshot<T>(snapshot: QuerySnapshot<DocumentData>, converter: FirestoreDataConverter<T>) { return snapshot.docs.flatMap(document => { try { return [converter.fromFirestore(document, {})] } catch { return [] } }) }
export const firestoreMessage = 'Nie udało się pobrać danych rejestru. Spróbuj ponownie.'
