import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { DeviceDetailsPage, DevicesRegistryPage } from './DeviceViews'

const hooks = vi.hoisted(() => ({ useDevices: vi.fn(), useDeviceDetails: vi.fn() }))
vi.mock('./useDeviceData', () => hooks)
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ role: 'member', user: { uid: 'test', displayName: 'Test' }, profile: { displayName: 'Test' } }) }))
const device = { id: 'ambona-4a', number: '4A', name: 'Test', type: 'ambona', status: 'sprawne', location: new GeoPoint(1, 2), conditionScore: 4.5, conditionLabel: '4+', inspectionDate: Timestamp.fromDate(new Date(2026, 4, 9)), inventoryUpdatedAt: null, updatedAt: Timestamp.fromDate(new Date(2026, 8, 27)), latestInspectionAt: null, guardianName: null, districtNumber: null, openIssuesCount: 0, currentPhotoId: null, version: 1 }
describe('widoki danych inwentaryzacji', () => {
  it('lista pokazuje numer tekstowy i opisową ocenę', () => {
    hooks.useDevices.mockReturnValue({ devices: [device], loading: false, error: null })
    render(<MemoryRouter><DevicesRegistryPage /></MemoryRouter>)
    expect(screen.getByText('Nr 4A — Test')).toBeInTheDocument()
    expect(screen.getByText('4,5/5 (4+)')).toBeInTheDocument()
    expect(screen.getByText('Aktualizacja inwentaryzacji')).toBeInTheDocument()
  })
  it('szczegóły nie podstawiają technicznego updatedAt za pustą datę biznesową', () => {
    hooks.useDeviceDetails.mockReturnValue({ device, inspections: [], issues: [], comments: [], repairs: [], media: [], loading: false, error: null })
    render(<MemoryRouter><DeviceDetailsPage /></MemoryRouter>)
    expect(screen.getByText('Ocena: 4,5/5 (4+)')).toBeInTheDocument()
    const label = screen.getByText('Data aktualizacji inwentaryzacji')
    expect(label.parentElement).toHaveTextContent('Brak')
    expect(label.parentElement).not.toHaveTextContent('27.09.2026')
  })
})
