import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DevicesRegistryPage, DeviceDetailsPage } from './DeviceViews'
import { DeviceCover, DevicePhoto } from './DeviceGallery'
import { photoUrl, validPhotoPath } from './devicePhotos'
import type { Device, DeviceMedia } from './models'

const mocks = vi.hoisted(() => ({
  useDevices: vi.fn(), useDeviceDetails: vi.fn(), getMedia: vi.fn(),
  getBlob: vi.fn(), ref: vi.fn((_storage, path: string) => ({ fullPath: path })),
}))
vi.mock('./photoStorage', () => ({ photoStorageEnabled: true, photoStorageUnavailableMessage: 'Storage unavailable' }))
vi.mock('firebase/storage', () => ({ getStorage: () => ({}), getBlob: mocks.getBlob, ref: mocks.ref, uploadBytes: vi.fn() }))
vi.mock('./useDeviceData', () => ({ useDevices: mocks.useDevices, useDeviceDetails: mocks.useDeviceDetails }))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ role: 'admin', user: { uid: 'test' }, profile: {} }) }))
vi.mock('./DeviceEditHistory', () => ({ DeviceEditHistory: () => null }))
vi.mock('./mediaRepository', () => ({ getMedia: mocks.getMedia, addDeviceMedia: vi.fn(), changeDeviceMedia: vi.fn(), replaceCurrentMedia: vi.fn() }))

const path = 'devices/ambona-3/inventory-2026-05-09/4c956057bdaf422061e4fa2afc342e8e6000b7ff1e6d0d2e7e0d9afa71245f9f.jpg'
const secondPath = 'devices/ambona-3/inventory-2026-05-09/second.jpg'
const device: Device = { id: 'ambona-3', number: '3', name: 'Ambona 3', type: 'ambona', status: 'sprawne', approvedForUse: true,
  active: true, archived: false, districtNumber: null, location: null, conditionScore: 5, conditionLabel: null, version: 1,
  currentPhotoId: 'primary', primaryPhotoPath: path, photoPaths: [path, secondPath], description: '',
  defects: [], recommendations: [], openIssuesCount: 0, guardianUid: null, guardianName: null,
  latestInspectionAt: null, latestInspectionId: null, createdAt: Timestamp.fromMillis(1000), createdBy: 'test',
  updatedAt: Timestamp.fromMillis(1000), updatedBy: 'test' }
const media = [
  { id: 'primary', path, caption: 'Zdjęcie główne 3', isCurrent: true },
  { id: 'second', path: secondPath, caption: 'Drugie zdjęcie 3', isCurrent: false },
].map(m => ({ ...m, hidden: false, photoStatus: null, uploadedAt: Timestamp.fromMillis(1000) })) as DeviceMedia[]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:device-photo')
    static revokeObjectURL = vi.fn()
  })
  mocks.getBlob.mockResolvedValue(new Blob(['photo'], { type: 'image/jpeg' }))
  mocks.getMedia.mockResolvedValue(media[0])
  mocks.useDevices.mockReturnValue({ devices: [device, { ...device, id: 'no-photo', number: '99', currentPhotoId: null, primaryPhotoPath: null, photoPaths: [] }], loading: false, error: null })
  mocks.useDeviceDetails.mockReturnValue({ device, media, inspections: [], issues: [], comments: [], repairs: [], loading: false, error: null })
})
afterEach(() => vi.unstubAllGlobals())

it.each(['3', '4', '33', '34'])('reads imported nested Storage paths for ambona %s', async number => {
  const importedPath = `devices/ambona-${number}/inventory-2026-05-09/photo.webp`
  await expect(photoUrl(importedPath)).resolves.toBe('blob:device-photo')
  expect(mocks.ref).toHaveBeenCalledWith({}, importedPath)
  expect(mocks.getBlob).toHaveBeenCalledWith({ fullPath: importedPath })
})

it.each(['devices/ambona-3/../photo.jpg', 'devices/ambona-3/./photo.jpg', 'devices/ambona-3//photo.jpg',
  'devices/ambona-3/inventory/photo.jpg?token=private', 'https://example.com/photo.jpg', 'devices/ambona-3/inventory/'])('rejects malformed paths: %s', value => {
  expect(validPhotoPath(value)).toBe(false)
})

it('keeps direct Storage and repository paths supported', () => {
  expect(validPhotoPath('devices/ambona-3/photo.jpg')).toBe(true)
  expect(validPhotoPath('/images/devices/ambona-33/photo.webp')).toBe(true)
})

it('renders the imported primary photo in cards and table, retaining the empty-device placeholder', async () => {
  render(<MemoryRouter><DevicesRegistryPage /></MemoryRouter>)
  expect(await screen.findByAltText('Urządzenie 3')).toHaveAttribute('src', 'blob:device-photo')
  expect(screen.getByText('Brak dostępnego zdjęcia')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
  expect(await screen.findByAltText('Urządzenie 3')).toHaveAttribute('src', 'blob:device-photo')
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByText('Brak dostępnego zdjęcia')).toBeInTheDocument()
  expect(mocks.getMedia).not.toHaveBeenCalled()
})

it('renders the primary photo and all visible gallery photos on the details page', async () => {
  render(<MemoryRouter initialEntries={['/panel/urzadzenia/ambona-3']}><Routes><Route path="/panel/urzadzenia/:id" element={<DeviceDetailsPage />} /></Routes></MemoryRouter>)
  await waitFor(() => expect(screen.getAllByAltText('Zdjęcie główne 3')).toHaveLength(2))
  for (const image of screen.getAllByAltText('Zdjęcie główne 3')) expect(image).toHaveAttribute('src', 'blob:device-photo')
  expect(await screen.findByAltText('Drugie zdjęcie 3')).toHaveAttribute('src', 'blob:device-photo')
  expect(mocks.ref).toHaveBeenCalledWith({}, secondPath)
})

it('resolves a legacy primary media reference without a primaryPhotoPath', async () => {
  render(<DeviceCover device={{ ...device, primaryPhotoPath: null }} />)
  expect(await screen.findByAltText('Urządzenie 3')).toHaveAttribute('src', 'blob:device-photo')
  expect(mocks.getMedia).toHaveBeenCalledWith('ambona-3', 'primary')
})

it('retains the placeholder when Storage denies a read', async () => {
  mocks.getBlob.mockRejectedValue(Object.assign(new Error('denied'), { code: 'storage/unauthorized' }))
  render(<DevicePhoto path={path} alt="Denied photo" />)
  await waitFor(() => expect(mocks.getBlob).toHaveBeenCalled())
  expect(screen.queryByAltText('Denied photo')).not.toBeInTheDocument()
  expect(screen.getByText('Brak dostępnego zdjęcia')).toBeInTheDocument()
})
