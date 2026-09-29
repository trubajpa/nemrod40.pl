import { GeoPoint, Timestamp, collection, doc, getDoc, getDocs, increment, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deviceConverter } from './converters';
import type { Device, DeviceStatus, DeviceType } from './models';
import { logDeviceError, safeSnapshot } from './repositoryUtils';
import { compareDeviceNumbers, deviceDocumentId, normalizeDeviceNumber } from './deviceIdentity';
import { validateCoordinates, validateInventoryDates, validateScore } from './validation';
export type DeviceInput = {
    number: string;
    name: string;
    type: DeviceType;
    districtNumber: number | null;
    latitude: number | null;
    longitude: number | null;
    guardianUid: string | null;
    guardianName: string | null;
    status: DeviceStatus;
    conditionScore: number | null;
    conditionLabel?: string | null;
    active: boolean;
    inspectionDate?: Date | null;
    inventoryUpdatedAt?: Date | null;
    rewir?: string | null;
    description?: string;
    defects?: string[];
    recommendations?: string[];
    numberNeedsVerification?: boolean;
};
export function subscribeDevice(id: string, onData: (item: Device | null) => void, onError: () => void) { return onSnapshot(doc(db, 'devices', id), s => { try {
    onData(s.exists() ? deviceConverter.fromFirestore(s, {}) : null);
}
catch {
    onError();
} }, onError); }
export function subscribeDevices(onData: (items: Device[]) => void, onError: (message: string) => void): Unsubscribe { return onSnapshot(collection(db, 'devices'), snapshot => onData(safeSnapshot(snapshot, deviceConverter).sort(compareDeviceNumbers)), error => { logDeviceError('list_devices', error); onError('Nie udało się pobrać urządzeń.'); }); }
export async function getDevice(deviceId: string) { const snapshot = await getDoc(doc(db, 'devices', deviceId)); if (!snapshot.exists())
    return null; try {
    return deviceConverter.fromFirestore(snapshot, {});
}
catch (error) {
    logDeviceError('get_device', error);
    return null;
} }
function deviceFields(input: Partial<DeviceInput>) {
    const { latitude, longitude, inspectionDate, inventoryUpdatedAt, ...data } = input;
    if (Object.keys(validateInventoryDates(input)).length)
        throw new Error('invalid_inventory_date');
    if (input.conditionScore != null && !validateScore(input.conditionScore))
        throw new Error('invalid_score');
    if (input.conditionLabel != null && input.conditionLabel.length > 80)
        throw new Error('invalid_condition_label');
    if ((latitude !== undefined || longitude !== undefined) && !(latitude === null && longitude === null) && (latitude == null || longitude == null || !validateCoordinates(latitude, longitude)))
        throw new Error('invalid_coordinates');
    if (input.name !== undefined && !input.name.trim())
        throw new Error('invalid_name');
    for (const key of ['description', 'rewir', 'guardianName'] as const)
        if (input[key] != null && (typeof input[key] !== 'string' || input[key]!.length > 20000))
            throw new Error('invalid_text');
    for (const key of ['defects', 'recommendations'] as const)
        if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key]!.some(x => typeof x !== 'string')))
            throw new Error('invalid_list');
    return {
        ...data,
        ...(latitude !== undefined && longitude !== undefined ? { location: latitude === null && longitude === null ? null : new GeoPoint(latitude!, longitude!) } : {}),
        ...(inspectionDate !== undefined ? { inspectionDate: inspectionDate ? Timestamp.fromDate(inspectionDate) : null } : {}),
        ...(inventoryUpdatedAt !== undefined ? { inventoryUpdatedAt: inventoryUpdatedAt ? Timestamp.fromDate(inventoryUpdatedAt) : null } : {}),
    };
}
export async function createDevice(input: DeviceInput, uid: string) {
    const number = normalizeDeviceNumber(input.number);
    const id = deviceDocumentId(input.type, number);
    const data = deviceFields(input);
    // Old records may have a numeric number and a random document ID.
    const legacy = await getDocs(query(collection(db, 'devices'), where('type', '==', input.type)));
    if (legacy.docs.some(item => normalizeDeviceNumber(String(item.data().number)) === number))
        throw new Error('device_already_exists');
    const ref = doc(db, 'devices', id);
    const identityRef = doc(db, 'deviceNumbers', id);
    await runTransaction(db, async (tx) => {
        if ((await tx.get(ref)).exists())
            throw new Error('device_already_exists');
        if ((await tx.get(identityRef)).exists())
            throw new Error('device_already_exists');
        tx.set(ref, { ...data, number, conditionLabel: input.conditionLabel?.trim() || null, archived: false,
            guardianUid: input.guardianUid || null, guardianName: input.guardianName || null,
            latestInspectionAt: null, latestInspectionId: null, currentPhotoId: null, openIssuesCount: 0,
            createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid, version: 1 });
        tx.set(identityRef, { deviceId: id, type: input.type, number, updatedBy: uid, updatedAt: serverTimestamp() });
    });
    return ref;
}
export async function archiveDevice(deviceId: string, uid: string) { return updateDoc(doc(db, 'devices', deviceId), { archived: true, active: false, status: 'archiwalne', updatedAt: serverTimestamp(), updatedBy: uid, version: increment(1) }); }
export async function updateDevice(deviceId: string, input: Partial<DeviceInput>, uid: string, expectedVersion?: number) {
    const fields = deviceFields(input);
    // Query also covers legacy random IDs and numeric numbers. Concurrent writers claim
    // the same reservation transactionally; document IDs and child collections never move.
    const legacy = ('number' in input || 'type' in input) ? await getDocs(collection(db, 'devices')) : null;
    const ref = doc(db, 'devices', deviceId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists())
            throw new Error('device_not_found');
        const before = snap.data();
        if (expectedVersion !== undefined && before.version !== expectedVersion)
            throw new Error('device_changed_reload');
        const type = input.type ?? before.type, number = normalizeDeviceNumber(String(input.number ?? before.number));
        const identityChanged = type !== before.type || number !== normalizeDeviceNumber(String(before.number));
        // Editing descriptive fields must work even while legacy identities conflict.
        // In particular preserve raw legacy "4a" rather than silently writing "4A".
        const ordinaryFields = { ...fields };
        delete ordinaryFields.number;
        delete ordinaryFields.type;
        let reservation: ReturnType<typeof doc> | null = null;
        let oldRef: ReturnType<typeof doc> | null = null;
        if (identityChanged) {
            reservation = doc(db, 'deviceNumbers', deviceDocumentId(type, number));
            if (legacy?.docs.some(d => d.id !== deviceId && d.data().type === type && normalizeDeviceNumber(String(d.data().number)) === number))
                throw new Error('device_already_exists');
            const claim = await tx.get(reservation);
            if (claim.exists() && claim.data().deviceId !== deviceId) throw new Error('device_already_exists');
            const previous = doc(db, 'deviceNumbers', deviceDocumentId(before.type, String(before.number)));
            const oldClaim = await tx.get(previous);
            if (oldClaim.exists() && oldClaim.data().deviceId === deviceId) oldRef = previous;
        }
        const next = { ...ordinaryFields, ...(identityChanged ? { type, number } : {}), updatedAt: serverTimestamp(), updatedBy: uid, version: before.version + 1 };
        tx.update(ref, next);
        if (reservation) tx.set(reservation, { deviceId, type, number, updatedBy: uid, updatedAt: serverTimestamp() });
        if (oldRef) tx.delete(oldRef);
        tx.set(doc(db, 'devices', deviceId, 'edits', String(before.version + 1)), { before, after: { ...before, ...next }, createdAt: serverTimestamp(), createdBy: uid, version: before.version + 1 });
    });
}
