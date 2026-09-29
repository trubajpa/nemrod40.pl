import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { mediaConverter } from './converters';
import type { DeviceMedia } from './models';
import { logDeviceError, safeSnapshot } from './repositoryUtils';
import { validPhotoPath } from './devicePhotos';
export type MediaInput = Pick<DeviceMedia, 'path' | 'storageProvider' | 'category' | 'relatedType' | 'relatedId' | 'caption'> & {
    uploadedBy: string;
    capturedAt: null;
};
export function subscribeMedia(deviceId: string, onData: (x: DeviceMedia[]) => void, onError: () => void) { return onSnapshot(query(collection(db, 'devices', deviceId, 'media'), orderBy('uploadedAt', 'desc')), s => onData(safeSnapshot(s, mediaConverter)), e => { logDeviceError('list_media', e); onError(); }); }
export async function getMedia(deviceId: string, mediaId: string) { const snapshot = await getDoc(doc(db, 'devices', deviceId, 'media', mediaId)); if (!snapshot.exists())
    return null; try {
    return mediaConverter.fromFirestore(snapshot, {});
}
catch {
    return null;
} }
export function buildMediaReplacement(previousId: string | null, newId: string) { return { previous: previousId ? { id: previousId, isCurrent: false, replacedBy: newId } : null, current: { id: newId, isCurrent: true } }; }
export async function replaceCurrentMedia(deviceId: string, _previousId: string | null, input: MediaInput) { return mutateMedia(deviceId, null, 'primary', input.uploadedBy, input, null); }
export async function addDeviceMedia(deviceId: string, input: MediaInput, status: DeviceMedia['photoStatus']) { return mutateMedia(deviceId, null, 'add', input.uploadedBy, input, status ?? null); }
export async function changeDeviceMedia(deviceId: string, mediaId: string, action: 'primary' | 'detach' | 'aktualne' | 'archiwalne', uid: string) { return mutateMedia(deviceId, mediaId, action, uid); }
async function mutateMedia(deviceId: string, mediaId: string | null, action: string, uid: string, input?: MediaInput, status: DeviceMedia['photoStatus'] = null) {
    if (input && (!validPhotoPath(input.path) || (input.path.startsWith('devices/') && !input.path.startsWith(`devices/${deviceId}/`))))
        throw new Error('Nieprawidłowa ścieżka zdjęcia.');
    const legacy = await getDocs(collection(db, 'devices', deviceId, 'media'));
    const ref = mediaId ? doc(db, 'devices', deviceId, 'media', mediaId) : doc(collection(db, 'devices', deviceId, 'media'));
    return runTransaction(db, async (tx) => {
        const deviceRef = doc(db, 'devices', deviceId), snap = await tx.get(deviceRef);
        if (!snap.exists())
            throw new Error('device_not_found');
        const before = snap.data(), existing = mediaId ? await tx.get(ref) : null;
        if (mediaId && (!existing?.exists() || existing.data().hidden))
            throw new Error('Zdjęcie nie jest przypisane.');
        const oldRef = before.currentPhotoId ? doc(db, 'devices', deviceId, 'media', before.currentPhotoId) : null;
        const old = oldRef ? await tx.get(oldRef) : null;
        const path = input?.path ?? existing!.data()!.path;
        const paths: string[] = before.photoPaths ?? legacy.docs.filter(d => !d.data().hidden).map(d => d.data().path);
        if (input && paths.includes(path))
            throw new Error('Zdjęcie jest już przypisane.');
        const primary = action === 'primary' || (!before.currentPhotoId && !!input);
        const clearing = action === 'detach' && before.currentPhotoId === ref.id;
        const updates = { photoPaths: action === 'detach' ? paths.filter(p => p !== path) : [...new Set([...paths, path])], currentPhotoId: primary ? ref.id : clearing ? null : before.currentPhotoId ?? null, primaryPhotoPath: primary ? path : clearing ? null : before.primaryPhotoPath ?? old?.data()?.path ?? null, updatedAt: serverTimestamp(), updatedBy: uid, version: before.version + 1 };
        if (input)
            tx.set(ref, { ...input, photoStatus: status, uploadedAt: serverTimestamp(), isCurrent: primary, replacedBy: null, hidden: false });
        else
            tx.update(ref, action === 'detach' ? { hidden: true, isCurrent: false } : action === 'primary' ? { isCurrent: true } : { photoStatus: action });
        if (primary && old?.exists() && oldRef && oldRef.id !== ref.id)
            tx.update(oldRef, { isCurrent: false, replacedBy: ref.id });
        tx.update(deviceRef, updates);
        tx.set(doc(db, 'devices', deviceId, 'edits', String(before.version + 1)), { before, after: { ...before, ...updates }, mediaChange: { id: ref.id, action, before: existing?.data() ?? null }, createdAt: serverTimestamp(), createdBy: uid, version: before.version + 1 });
        return ref.id;
    });
}
