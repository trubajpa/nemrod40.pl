import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { createDevice, updateDevice, type DeviceInput } from './deviceRepository'

const mocks = vi.hoisted(() => ({ getDocs: vi.fn(), get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn(), updateDoc: vi.fn() }))
vi.mock('firebase/firestore', async importOriginal => {
  const original = await importOriginal<typeof import('firebase/firestore')>()
  return { ...original,
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    query: () => ({}), where: () => ({}), getDocs: mocks.getDocs,
    runTransaction: async (_db: unknown, callback: (tx: { get: typeof mocks.get; set: typeof mocks.set; update:typeof mocks.update; delete:typeof mocks.delete }) => Promise<void>) => callback({ get: mocks.get, set: mocks.set, update: mocks.update, delete: mocks.delete }),
    updateDoc: mocks.updateDoc,
  }
})
const input: DeviceInput = { number: '4a', name: 'Test', type: 'ambona', districtNumber: null, latitude: 1, longitude: 2, guardianUid: null, guardianName: null, status: 'sprawne', conditionScore: 0, conditionLabel: '4+', active: true, inspectionDate: new Date('2026-05-08T22:00:00Z'), inventoryUpdatedAt: null }
beforeEach(() => { vi.clearAllMocks(); mocks.getDocs.mockResolvedValue({ docs: [] }); mocks.get.mockResolvedValue({ exists: () => false }) })

describe('nowe ID i niezmienne pola audytowe', () => {
  function existing(version=1){mocks.get.mockImplementation(async(ref:{path:string})=>ref.path==='devices/stable-id'?{exists:()=>true,data:()=>({type:'ambona',number:'1001',version,createdBy:'original',createdAt:Timestamp.fromMillis(1)})}:{exists:()=>false})}
  it('changes a temporary number without moving the document and records original fields',async()=>{
    existing();await updateDevice('stable-id',{number:'4a',type:'ambona'},'test-admin',1)
    expect(mocks.update).toHaveBeenCalledWith({path:'devices/stable-id'},expect.objectContaining({number:'4A',version:2}))
    expect(mocks.set).toHaveBeenCalledWith({path:'deviceNumbers/ambona-4a'},expect.objectContaining({deviceId:'stable-id'}))
    expect(mocks.set).toHaveBeenCalledWith({path:'devices/stable-id/edits/2'},expect.objectContaining({before:expect.objectContaining({number:'1001',createdBy:'original'})}))
  })
  it('rejects stale forms, legacy duplicate numbers and reserved identities',async()=>{
    existing(2);await expect(updateDevice('stable-id',{number:'4A'},'test-admin',1)).rejects.toThrow('device_changed_reload')
    existing();mocks.getDocs.mockResolvedValue({docs:[{id:'other',data:()=>({number:'4a',type:'ambona'})}]})
    await expect(updateDevice('stable-id',{number:'4A'},'test-admin',1)).rejects.toThrow('device_already_exists')
    mocks.getDocs.mockResolvedValue({docs:[]});mocks.get.mockImplementation(async(ref:{path:string})=>ref.path==='devices/stable-id'?{exists:()=>true,data:()=>({type:'ambona',number:'1001',version:1})}:{exists:()=>true,data:()=>({deviceId:'other'})})
    await expect(updateDevice('stable-id',{number:'4A'},'test-admin',1)).rejects.toThrow('device_already_exists');expect(mocks.update).not.toHaveBeenCalled()
  })
  it('tworzy kanoniczne ID transakcyjnie i serializuje osobne daty', async () => {
    await createDevice(input, 'test-admin')
    expect(mocks.set).toHaveBeenCalledWith({ path: 'devices/ambona-4a' }, expect.objectContaining({ number: '4A', conditionScore: 0, conditionLabel: '4+', inventoryUpdatedAt: null, version: 1, createdBy: 'test-admin', updatedBy: 'test-admin' }))
    const payload = mocks.set.mock.calls[0][1]
    expect(payload.inspectionDate).toBeInstanceOf(Timestamp)
    expect(payload.inspectionDate.toDate().toISOString()).toBe('2026-05-08T22:00:00.000Z')
    expect(payload.updatedAt).not.toBeNull()
    expect(payload.updatedAt).not.toBe(payload.inspectionDate)
  })
  it('nie nadpisuje istniejącego docelowego ID', async () => {
    mocks.get.mockResolvedValue({ exists: () => true })
    await expect(createDevice(input, 'test-admin')).rejects.toThrow('device_already_exists')
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('odrzuca kolizję ze starszym liczbowym numerem pod losowym ID', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{ data: () => ({ number: 31 }) }] })
    await expect(createDevice({ ...input, number: '31' }, 'test-admin')).rejects.toThrow('device_already_exists')
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('nie dotyka createdAt/createdBy podczas edycji daty biznesowej', async () => {
    mocks.get.mockImplementation(async (ref: {path:string}) => ref.path==='devices/legacy-id' ? {exists:()=>true,data:()=>({type:'ambona',number:31,version:1,createdAt:Timestamp.fromMillis(1),createdBy:'original'})} : {exists:()=>false})
    await updateDevice('legacy-id', { inventoryUpdatedAt: null, conditionScore: 0.5 }, 'test-admin')
    const payload = mocks.update.mock.calls[0][1]
    expect(payload).toMatchObject({ inventoryUpdatedAt: null, conditionScore: 0.5, updatedBy: 'test-admin' })
    expect(payload).not.toHaveProperty('createdAt')
    expect(payload).not.toHaveProperty('createdBy')
    expect(payload).not.toHaveProperty('number')
    expect(payload.updatedAt).not.toBeNull()
    expect(payload.version).toBeDefined()
  })
})
