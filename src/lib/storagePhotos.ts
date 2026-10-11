import { getBlob, getStorage, ref } from 'firebase/storage'

// Blob reads are checked against Storage rules; never create a download-token URL.
export async function storagePhotoBlob(path: string) {
  return URL.createObjectURL(await getBlob(ref(getStorage(), path)))
}
