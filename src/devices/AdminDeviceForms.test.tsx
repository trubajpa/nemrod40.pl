import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeoPoint, Timestamp } from 'firebase/firestore'
import { AdminCreateDeviceForm, AdminDeviceForms } from './AdminDeviceForms'
import { createDevice, updateDevice } from './deviceRepository'
import type { Device } from './models'

vi.mock('./deviceRepository', () => ({ createDevice: vi.fn(), updateDevice: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
describe('formularze inwentaryzacji', () => {
  it('zapisuje tekstowy numer, zero, etykietę i puste daty bez podstawiania zera', async () => {
    render(<AdminCreateDeviceForm uid="test-admin" />)
    fireEvent.change(screen.getByLabelText('Numer'), { target: { value: '4A' } })
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText('Ocena'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Opis oceny'), { target: { value: '4+' } })
    fireEvent.change(screen.getByLabelText('Szerokość geograficzna'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Długość geograficzna'), { target: { value: '2' } })
    fireEvent.submit(screen.getByText('Zapisz urządzenie').closest('form')!)
    await waitFor(() => expect(createDevice).toHaveBeenCalledWith(expect.objectContaining({ number: '4A', conditionScore: 0, conditionLabel: '4+', inspectionDate: null, inventoryUpdatedAt: null }), 'test-admin'))
    expect(await screen.findByRole('status')).toHaveTextContent('Operacja została zapisana.')
  })
  it('edycja zachowuje daty i etykietę oraz nie zmienia tożsamości urządzenia', async () => {
    const device = { id: 'legacy-id', number: '4B', type:'ambona', version:1, name: 'Test', status: 'sprawne', conditionScore: 4.5, conditionLabel: '4+', location: new GeoPoint(1, 2), inspectionDate: Timestamp.fromDate(new Date(2026, 4, 9)), inventoryUpdatedAt: null } as Device
    render(<AdminDeviceForms device={device} deviceId={device.id} uid="test-admin" name="Test" issues={[]} comments={[]} currentPhotoId={null} />)
    const form = screen.getByText('Zapisz metryczkę').closest('form')!
    expect(form.querySelector('[name="score"]')).toHaveValue(4.5)
    expect(form.querySelector('[name="inspectionDate"]')).toHaveValue('2026-05-09')
    expect(form.querySelector('[name="inventoryUpdatedAt"]')).toHaveValue('')
    fireEvent.submit(form)
    expect(updateDevice).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Potwierdź zapis zmian'))
    await waitFor(() => expect(updateDevice).toHaveBeenCalled())
    const data = vi.mocked(updateDevice).mock.calls[0][1]
    expect(data).toMatchObject({ conditionScore: 4.5, conditionLabel: '4+', inventoryUpdatedAt: null })
    expect(data.number).toBe('4B')
    expect(data).not.toHaveProperty('updatedAt')
  })
})

it('offers and saves Do ustalenia without changing the score',async()=>{
 render(<AdminCreateDeviceForm uid="test-admin"/>);
 fireEvent.change(screen.getByLabelText('Numer'),{target:{value:'42'}});
 fireEvent.change(screen.getByLabelText('Nazwa'),{target:{value:'Test'}});
 fireEvent.change(screen.getByLabelText('Status'),{target:{value:'do_ustalenia'}});
 expect(screen.getByRole('option',{name:'Do ustalenia'})).toBeInTheDocument();
 fireEvent.submit(screen.getByLabelText('Numer').closest('form')!);
 await waitFor(()=>expect(createDevice).toHaveBeenCalledWith(expect.objectContaining({status:'do_ustalenia',conditionScore:null}),'test-admin'));
});
