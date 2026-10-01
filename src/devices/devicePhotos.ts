import { getStorage, getBlob, ref, uploadBytes } from 'firebase/storage';
import { photoStorageEnabled, photoStorageUnavailableMessage } from './photoStorage';
export function validPhotoPath(path: string) { return /^\/images\/devices\/[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(path) || /^devices\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path); }
export async function photoUrl(path: string): Promise<string> {
    if (!validPhotoPath(path))
        throw new Error('invalid_photo_path');
    if (path.startsWith('/images/'))
        return path;
    if (!photoStorageEnabled)
        throw new Error(photoStorageUnavailableMessage);
    // No public download tokens: authenticated blob reads remain subject to Storage rules.
    return URL.createObjectURL(await getBlob(ref(getStorage(), path)));
}
export async function uploadDevicePhoto(id: string, file: File) {
    if (!photoStorageEnabled)
        throw new Error(photoStorageUnavailableMessage);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)
        throw new Error('Zdjęcie musi być JPG, PNG lub WebP do 10 MB.');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
    const path = `devices/${id}/${crypto.randomUUID()}.${extension}`;
    await uploadBytes(ref(getStorage(), path), file, { contentType: file.type });
    return path;
}
