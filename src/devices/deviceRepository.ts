import { GeoPoint, addDoc, collection, doc, getDoc, increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deviceConverter } from './converters'
import type { Device, DeviceStatus, DeviceType } from './models'
import { logDeviceError, safeSnapshot } from './repositoryUtils'

export type DeviceInput = { number:number; name:string; type:DeviceType; districtNumber:number|null; latitude:number; longitude:number; guardianUid:string|null; guardianName:string|null; status:DeviceStatus; conditionScore:number; active:boolean }
export function subscribeDevices(onData:(items:Device[])=>void,onError:(message:string)=>void):Unsubscribe { return onSnapshot(query(collection(db,'devices'),orderBy('number')), snapshot=>onData(safeSnapshot(snapshot,deviceConverter)), error=>{logDeviceError('list_devices',error);onError('Nie udało się pobrać urządzeń.')}) }
export async function getDevice(deviceId:string) { const snapshot=await getDoc(doc(db,'devices',deviceId)); if(!snapshot.exists()) return null; try{return deviceConverter.fromFirestore(snapshot, {})}catch(error){logDeviceError('get_device',error);return null} }
export async function createDevice(input:DeviceInput,uid:string){const {latitude,longitude,...data}=input;return addDoc(collection(db,'devices'),{...data,location:new GeoPoint(latitude,longitude),archived:false,guardianUid:input.guardianUid||null,guardianName:input.guardianName||null,latestInspectionAt:null,latestInspectionId:null,currentPhotoId:null,openIssuesCount:0,createdAt:serverTimestamp(),createdBy:uid,updatedAt:serverTimestamp(),updatedBy:uid,version:1})}
export async function archiveDevice(deviceId:string,uid:string){return updateDoc(doc(db,'devices',deviceId),{archived:true,active:false,status:'archiwalne',updatedAt:serverTimestamp(),updatedBy:uid,version:increment(1)})}
export async function updateDevice(deviceId:string,input:Partial<DeviceInput>,uid:string){const {latitude,longitude,...data}=input;return updateDoc(doc(db,'devices',deviceId),{...data,...(latitude!==undefined&&longitude!==undefined?{location:new GeoPoint(latitude,longitude)}:{}),updatedAt:serverTimestamp(),updatedBy:uid,version:increment(1)})}
