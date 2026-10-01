import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DeviceGallery, DevicePhoto } from './DeviceGallery'
import { photoUrl, uploadDevicePhoto } from './devicePhotos'
import { photoStorageUnavailableMessage } from './photoStorage'
import type { Device } from './models'

vi.mock('./photoStorage', () => ({
  photoStorageEnabled: false,
  photoStorageUnavailableMessage: 'Przesyłanie zdjęć będzie dostępne po konfiguracji magazynu',
}))
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => { throw new Error('Storage must not initialize') }),
  getBlob: vi.fn(), ref: vi.fn(), uploadBytes: vi.fn(),
}))
afterEach(() => vi.restoreAllMocks())

it('renders static photos without initializing Storage', async () => {
  const path = '/images/devices/test/photo.webp'
  await expect(photoUrl(path)).resolves.toBe(path)
  render(<DevicePhoto path={path} alt="Statyczne zdjęcie" />)
  expect(await screen.findByAltText('Statyczne zdjęcie')).toHaveAttribute('src', path)
})

it('handles unavailable Storage reads and blocks uploads before initialization', async () => {
  await expect(photoUrl('devices/test/photo.webp')).rejects.toThrow(photoStorageUnavailableMessage)
  await expect(uploadDevicePhoto('test', new File(['test'], 'photo.webp', { type: 'image/webp' }))).rejects.toThrow(photoStorageUnavailableMessage)
  render(<DevicePhoto path="devices/test/photo.webp" alt="Zdjęcie" />)
  expect(screen.getByText('Brak dostępnego zdjęcia')).toBeInTheDocument()
})

it('shows the disabled upload field and explanation to administrators', () => {
  render(<DeviceGallery device={{ id: 'test' } as Device} media={[]} admin uid="test" />)
  expect(screen.getByText(photoStorageUnavailableMessage)).toBeInTheDocument()
  expect(screen.getByLabelText('Plik zdjęcia')).toBeDisabled()
})
