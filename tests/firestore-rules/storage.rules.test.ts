import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage'
import { beforeAll, afterAll, describe, it } from 'vitest'
let env:RulesTestEnvironment
beforeAll(async()=>{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:9199')throw Error('Only demo local emulators allowed')
 env=await initializeTestEnvironment({projectId:'demo-nemrod40',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:await readFile('storage.rules','utf8')}})
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'authorizedUsers/admin-storage@example.test'),{active:true,role:'admin'});await setDoc(doc(c.firestore(),'authorizedUsers/member-storage@example.test'),{active:true,role:'member'});await setDoc(doc(c.firestore(),'devices/storage-test'),{name:'Fikcyjne urządzenie testowe'})})
})
afterAll(async()=>{await env?.clearStorage();await env?.clearFirestore();await env?.cleanup()})
const storage=(role:string)=>env.authenticatedContext(role,{email:`${role}-storage@example.test`}).storage()
describe('Storage permissions on demo-nemrod40',()=>{
 it('admin uploads, member reads; anonymous cannot read',async()=>{const path='devices/storage-test/sample.webp';await assertSucceeds(uploadBytes(ref(storage('admin'),path),new Uint8Array([1,2,3]),{contentType:'image/webp'}));await assertSucceeds(getBytes(ref(storage('member'),path)));await assertFails(getBytes(ref(env.unauthenticatedContext().storage(),path)))})
 it('allows protected nested inventory paths',async()=>{const path='devices/storage-test/inventory-2026-05-09/nested.webp';await assertSucceeds(uploadBytes(ref(storage('admin'),path),new Uint8Array([1]),{contentType:'image/webp'}));await assertSucceeds(getBytes(ref(storage('member'),path)));await assertFails(getBytes(ref(env.unauthenticatedContext().storage(),path)))})
 it('member cannot upload; admin cannot overwrite or delete',async()=>{const path='devices/storage-test/immutable.webp';await assertSucceeds(uploadBytes(ref(storage('admin'),path),new Uint8Array([1]),{contentType:'image/webp'}));await assertFails(uploadBytes(ref(storage('member'),'devices/storage-test/member.webp'),new Uint8Array([1]),{contentType:'image/webp'}));await assertFails(uploadBytes(ref(storage('admin'),path),new Uint8Array([2]),{contentType:'image/webp'}));await assertFails(deleteObject(ref(storage('admin'),path)))})
 it('rejects unsafe type, missing device, unknown account and excessive size',async()=>{await assertFails(uploadBytes(ref(storage('admin'),'devices/storage-test/text.txt'),new Uint8Array([1]),{contentType:'text/plain'}));await assertFails(uploadBytes(ref(storage('admin'),'devices/missing/a.webp'),new Uint8Array([1]),{contentType:'image/webp'}));await assertFails(uploadBytes(ref(storage('unknown'),'devices/storage-test/unknown.webp'),new Uint8Array([1]),{contentType:'image/webp'}));await assertFails(uploadBytes(ref(storage('admin'),'devices/storage-test/large.webp'),new Uint8Array(10*1024*1024+1),{contentType:'image/webp'}))})
})
