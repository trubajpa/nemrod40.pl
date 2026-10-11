import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { publicationPhotoUrl, uploadPublicationPhoto } from './photos'
import { PublicationPhoto } from './PublicationPhoto'
const mocks = vi.hoisted(() => ({ blob: vi.fn(), upload: vi.fn(), ref: vi.fn((_storage, path: string) => path) }))
vi.mock('../devices/photoStorage', () => ({ photoStorageEnabled: true }))
vi.mock('firebase/storage', () => ({ getStorage: () => ({}), ref: mocks.ref, getBlob: mocks.blob, uploadBytes: mocks.upload }))
beforeEach(() => {
  vi.clearAllMocks(); mocks.blob.mockResolvedValue(new Blob(['image']))
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:private'); static revokeObjectURL = vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())
it('pobiera prywatne zdjęcie jako blob i zwalnia go po zamknięciu widoku', async () => {
  const view = render(<PublicationPhoto path="publications/post/photo.jpg" alt="Zdjęcie" />)
  expect(await screen.findByAltText('Zdjęcie')).toHaveAttribute('src', 'blob:private')
  expect(mocks.blob).toHaveBeenCalledWith('publications/post/photo.jpg')
  view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private')
})
it('zachowuje archiwalne statyczne zdjęcia i odrzuca URL z tokenem lub zdjęcie urządzenia', async () => {
  await expect(publicationPhotoUrl('/images/events/test/photo.webp')).resolves.toBe('/images/events/test/photo.webp')
  for (const path of ['https://example.test/photo?token=x', 'devices/test/photo.jpg', 'publications/post/../photo.jpg']) await expect(publicationPhotoUrl(path)).rejects.toThrow()
  expect(mocks.blob).not.toHaveBeenCalled()
})
it('waliduje pliki przed wysłaniem i zapisuje wyłącznie ścieżkę Storage', async () => {
  await expect(uploadPublicationPhoto('post', new File(['data'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow()
  const path = await uploadPublicationPhoto('post', new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))
  expect(path).toMatch(/^publications\/post\/.+\.jpg$/)
  expect(mocks.upload).toHaveBeenCalledTimes(1)
})
it('odmowa odczytu nie ujawnia adresu ani poprzedniego zdjęcia', async () => {
  mocks.blob.mockRejectedValue(new Error('permission-denied'))
  render(<PublicationPhoto path="publications/post/photo.jpg" alt="Zdjęcie" />)
  await waitFor(() => expect(mocks.blob).toHaveBeenCalled())
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
