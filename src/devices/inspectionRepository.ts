import { Timestamp, collection, doc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { validateStatusApproval } from './validation'
import { db } from '../lib/firebase'
import { inspectionConverter } from './converters'
import type { DeviceStatus, Inspection } from './models'
import { logDeviceError, safeSnapshot } from './repositoryUtils'

export type InspectionInput={inspectionDate:Date;inspectorUid:string;inspectorName:string;conditionScore:number;conditionLabel?:string|null;statusAfterInspection:DeviceStatus;description:string;recommendations:string[];approvedForUse:boolean;nextInspectionDate:Date|null;createdBy:string}
export function subscribeInspections(deviceId:string,onData:(x:Inspection[])=>void,onError:()=>void){return onSnapshot(query(collection(db,'devices',deviceId,'inspections'),orderBy('inspectionDate','desc')),s=>onData(safeSnapshot(s,inspectionConverter)),e=>{logDeviceError('list_inspections',e);onError()})}
export async function addInspection(deviceId:string,input:InspectionInput){if(Object.keys(validateStatusApproval(input.statusAfterInspection,input.approvedForUse)).length)throw new Error('invalid_status_approval');return runTransaction(db,async tx=>{const ref=doc(collection(db,'devices',deviceId,'inspections'));tx.set(ref,{...input,conditionLabel:input.conditionLabel?.trim()||null,inspectionDate:Timestamp.fromDate(input.inspectionDate),nextInspectionDate:input.nextInspectionDate?Timestamp.fromDate(input.nextInspectionDate):null,createdAt:serverTimestamp(),locked:true});tx.update(doc(db,'devices',deviceId),{conditionScore:input.conditionScore,conditionLabel:input.conditionLabel?.trim()||null,status:input.statusAfterInspection,...(input.statusAfterInspection==='do_ustalenia'?{approvedForUse:false}:{}),latestInspectionAt:Timestamp.fromDate(input.inspectionDate),latestInspectionId:ref.id,updatedAt:serverTimestamp(),updatedBy:input.createdBy,version:increment(1)});return ref.id})}
