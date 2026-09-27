import { GeoPoint, Timestamp, collection, doc, getDoc, getDocs, increment, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, type Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deviceConverter } from './converters'
import type { Device, DeviceStatus, DeviceType } from './models'
import { logDeviceError, safeSnapshot } from './repositoryUtils'
import { compareDeviceNumbers, deviceDocumentId, normalizeDeviceNumber } from './deviceIdentity'
import { validateCoordinates, validateInventoryDates, validateScore } from './validation'

export type DeviceInput = { number:string; name:string; type:DeviceType; districtNumber:number|null; latitude:number; longitude:number; guardianUid:string|null; guardianName:string|null; status:DeviceStatus; conditionScore:number; conditionLabel?:string|null; active:boolean; inspectionDate?:Date|null; inventoryUpdatedAt?:Date|null }
export function subscribeDevices(onData:(items:Device[])=>void,onError:(message:string)=>void):Unsubscribe { return onSnapshot(collection(db,'devices'), snapshot=>onData(safeSnapshot(snapshot,deviceConverter).sort(compareDeviceNumbers)), error=>{logDeviceError('list_devices',error);onError('Nie udało się pobrać urządzeń.')}) }
export async function getDevice(deviceId:string) { const snapshot=await getDoc(doc(db,'devices',deviceId)); if(!snapshot.exists()) return null; try{return deviceConverter.fromFirestore(snapshot, {})}catch(error){logDeviceError('get_device',error);return null} }
function deviceFields(input: Partial<DeviceInput>) {
  const { latitude, longitude, inspectionDate, inventoryUpdatedAt, ...data } = input
  if (Object.keys(validateInventoryDates(input)).length) throw new Error('invalid_inventory_date')
  if (input.conditionScore !== undefined && !validateScore(input.conditionScore)) throw new Error('invalid_score')
  if (input.conditionLabel != null && input.conditionLabel.length > 80) throw new Error('invalid_condition_label')
  if ((latitude !== undefined || longitude !== undefined) && (latitude === undefined || longitude === undefined || !validateCoordinates(latitude, longitude))) throw new Error('invalid_coordinates')
  return {
    ...data,
    ...(latitude !== undefined && longitude !== undefined ? { location: new GeoPoint(latitude, longitude) } : {}),
    ...(inspectionDate !== undefined ? { inspectionDate: inspectionDate ? Timestamp.fromDate(inspectionDate) : null } : {}),
    ...(inventoryUpdatedAt !== undefined ? { inventoryUpdatedAt: inventoryUpdatedAt ? Timestamp.fromDate(inventoryUpdatedAt) : null } : {}),
  }
}
export async function createDevice(input: DeviceInput, uid: string) {
  const number = normalizeDeviceNumber(input.number)
  const id = deviceDocumentId(input.type, number)
  const data = deviceFields(input)
  // Old records may have a numeric number and a random document ID.
  const legacy = await getDocs(query(collection(db, 'devices'), where('type', '==', input.type)))
  if (legacy.docs.some(item => normalizeDeviceNumber(String(item.data().number)) === number)) throw new Error('device_already_exists')
  const ref = doc(db, 'devices', id)
  await runTransaction(db, async tx => {
    if ((await tx.get(ref)).exists()) throw new Error('device_already_exists')
    tx.set(ref, { ...data, number, conditionLabel: input.conditionLabel?.trim() || null, archived: false,
      guardianUid: input.guardianUid || null, guardianName: input.guardianName || null,
      latestInspectionAt: null, latestInspectionId: null, currentPhotoId: null, openIssuesCount: 0,
      createdAt: serverTimestamp(), createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid, version: 1 })
  })
  return ref
}
export async function archiveDevice(deviceId:string,uid:string){return updateDoc(doc(db,'devices',deviceId),{archived:true,active:false,status:'archiwalne',updatedAt:serverTimestamp(),updatedBy:uid,version:increment(1)})}
export async function updateDevice(deviceId:string,input:Partial<Omit<DeviceInput,'number'|'type'>>,uid:string){
  if ('number' in input || 'type' in input) throw new Error('device_identity_is_immutable')
  return updateDoc(doc(db,'devices',deviceId),{...deviceFields(input),updatedAt:serverTimestamp(),updatedBy:uid,version:increment(1)})
}
