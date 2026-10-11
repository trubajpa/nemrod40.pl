import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { storagePhotoBlob } from '../lib/storagePhotos'
import { photoStorageEnabled, photoStorageUnavailableMessage } from '../devices/photoStorage'
export const validPublicationPhoto = (path: string) => /^publications\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(path)
export async function publicationPhotoUrl(path: string) {
  if (/^\/images\/(activities|events|brand)\/[A-Za-z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(path)) return path
  if (!validPublicationPhoto(path)) throw new Error('Nieprawidłowa ścieżka zdjęcia.')
  if (!photoStorageEnabled) throw new Error(photoStorageUnavailableMessage)
  return storagePhotoBlob(path)
}
export async function uploadPublicationPhoto(id: string, file: File) {
  if (!photoStorageEnabled) throw new Error(photoStorageUnavailableMessage)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) throw new Error('Zdjęcie musi być JPG, PNG lub WebP do 10 MB.')
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `publications/${id}/${crypto.randomUUID()}.${extension}`
  await uploadBytes(ref(getStorage(), path), file, { contentType: file.type })
  return path
}
