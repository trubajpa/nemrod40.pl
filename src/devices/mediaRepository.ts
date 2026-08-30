import { collection, doc, getDoc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { mediaConverter } from './converters'
import type { DeviceMedia } from './models'
import { logDeviceError, safeSnapshot } from './repositoryUtils'
export type MediaInput=Pick<DeviceMedia,'path'|'storageProvider'|'category'|'relatedType'|'relatedId'|'caption'> & {uploadedBy:string;capturedAt:null}
export function subscribeMedia(deviceId:string,onData:(x:DeviceMedia[])=>void,onError:()=>void){return onSnapshot(query(collection(db,'devices',deviceId,'media'),orderBy('uploadedAt','desc')),s=>onData(safeSnapshot(s,mediaConverter)),e=>{logDeviceError('list_media',e);onError()})}
export async function getMedia(deviceId:string,mediaId:string){const snapshot=await getDoc(doc(db,'devices',deviceId,'media',mediaId));if(!snapshot.exists())return null;try{return mediaConverter.fromFirestore(snapshot,{})}catch{return null}}
export function buildMediaReplacement(previousId:string|null,newId:string){return {previous:previousId?{id:previousId,isCurrent:false,replacedBy:newId}:null,current:{id:newId,isCurrent:true}}}
export async function replaceCurrentMedia(deviceId:string,previousId:string|null,input:MediaInput){return runTransaction(db,async tx=>{const ref=doc(collection(db,'devices',deviceId,'media'));tx.set(ref,{...input,uploadedAt:serverTimestamp(),isCurrent:true,replacedBy:null,hidden:false});if(previousId)tx.update(doc(db,'devices',deviceId,'media',previousId),{isCurrent:false,replacedBy:ref.id});tx.update(doc(db,'devices',deviceId),{currentPhotoId:ref.id,updatedAt:serverTimestamp(),updatedBy:input.uploadedBy,version:increment(1)});return ref.id})}
