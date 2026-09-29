import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing'
import {collection,getDocs,doc,getDoc,setDoc,type DocumentData} from 'firebase/firestore'
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest'
import {indexClient,dryRun,applyIndex,planIndex} from '../../scripts/device-number-index.mjs'
let env:RulesTestEnvironment
const project='demo-nemrod40',client=indexClient({project,host:'127.0.0.1:8080'})
const options={project,operator:'emulator-index-test',activate:false}
async function seed(id:string,number:string|number,type='ambona'){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'devices',id),{type,number,description:'Zachować',version:7,createdBy:'original',createdAt:new Date('2026-01-01')}))}
async function marker(){let value:DocumentData|undefined;await env.withSecurityRulesDisabled(async c=>{value=(await getDoc(doc(c.firestore(),'deviceRegistry/identityIndex'))).data()});return value}
async function deviceData(){let value:DocumentData[]=[];await env.withSecurityRulesDisabled(async c=>{value=(await getDocs(collection(c.firestore(),'devices'))).docs.map(d=>d.data())});return value}
beforeAll(async()=>{if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Emulator only');env=await initializeTestEnvironment({projectId:project,firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}})})
beforeEach(async()=>{await env.clearFirestore();await seed('random-A',40);await seed('random-B','40','pasnik')})
afterAll(async()=>{await env?.clearFirestore();await env?.cleanup()})
it('dry-run includes all random IDs and types, and does not write anything',async()=>{const plan=await dryRun(client,project);expect(plan.entries.map(e=>e.deviceId).sort()).toEqual(['random-A','random-B']);expect(await marker()).toBeUndefined();expect(await client.all('deviceNumbers')).toHaveLength(0)})
it('apply keeps device and subcollection data unchanged; explicit activation and repeat are safe',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'devices/random-A/comments/history'),{content:'Zachować komentarz'}))
 const before=await deviceData()
 const plan=await dryRun(client,project);await applyIndex(client,plan,options);expect((await marker())?.ready).toBe(false)
 await applyIndex(client,plan,{...options,activate:true});expect((await marker())?.ready).toBe(true);expect((await applyIndex(client,plan,{...options,activate:true})).resumed).toBe(true)
 const after=await deviceData();expect(after).toEqual(before)
 await env.withSecurityRulesDisabled(async c=>expect((await getDoc(doc(c.firestore(),'devices/random-A/comments/history'))).data()?.content).toBe('Zachować komentarz'))
})
it('rejects collisions, missing numbers, changed source and conflicting reservations',async()=>{
 const plan=await dryRun(client,project);await seed('random-C','40');await expect(dryRun(client,project)).rejects.toThrow('Collision');await expect(applyIndex(client,plan,options)).rejects.toThrow('Collision');expect(await marker()).toBeUndefined()
 await env.clearFirestore();await seed('bad','');await expect(dryRun(client,project)).rejects.toThrow('Invalid number')
 await env.clearFirestore();await seed('random-A','41');await expect(applyIndex(client,plan,options)).rejects.toThrow('Source changed')
 const fresh=await dryRun(client,project);await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'deviceNumbers/ambona-41'),{deviceId:'wrong',type:'ambona',number:'41'}));await expect(applyIndex(client,fresh,options)).rejects.toThrow('Conflicting')
})
it('resumes interruption from stored index, not from an untrusted checkpoint',async()=>{const plan=await dryRun(client,project);await expect(applyIndex(client,plan,{...options,checkpoint:async()=>{throw Error('simulated interruption')}})).rejects.toThrow('interruption');expect((await marker())?.ready).toBe(false);await applyIndex(client,plan,{...options,activate:true});expect((await marker())?.ready).toBe(true)})
it('does not activate if identity changes after batch write',async()=>{const plan=await dryRun(client,project);await expect(applyIndex(client,plan,{...options,activate:true,checkpoint:async()=>seed('random-A','42')})).rejects.toThrow('Source changed during apply');expect((await marker())?.ready).toBe(false)})
it('ordinary descriptive changes during apply do not block verification',async()=>{const plan=await dryRun(client,project);await applyIndex(client,plan,{...options,activate:true,checkpoint:async()=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'devices/random-A'),{description:'Zmieniony opis',version:8},{merge:true}))});expect((await marker())?.ready).toBe(true)})
it('CLI writes a local manifest and requires freeze confirmation before apply',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'nemrod-index-test-')),manifest=path.join(directory,'manifest.json'),run=promisify(execFile)
 if(path.dirname(directory)!==path.resolve(tmpdir())||!path.basename(directory).startsWith('nemrod-index-test-'))throw Error('Unsafe cleanup path')
 try{
  await run(process.execPath,['scripts/device-number-index.mjs','dry-run','--project',project,'--manifest',manifest])
  expect(JSON.parse(await readFile(manifest,'utf8')).entries).toHaveLength(2);expect(await marker()).toBeUndefined()
  await expect(run(process.execPath,['scripts/device-number-index.mjs','apply','--project',project,'--manifest',manifest,'--operator','test'])).rejects.toThrow()
  await run(process.execPath,['scripts/device-number-index.mjs','apply','--project',project,'--manifest',manifest,'--operator','test','--freeze-confirmed','--activate'])
  expect((await marker())?.ready).toBe(true);expect(JSON.parse(await readFile(manifest+'.checkpoint.json','utf8')).processed).toBe(2)
 }finally{await rm(directory,{recursive:true,force:true})}
})
it('rejects forged manifests, unsafe endpoints and implicit production access',async()=>{const plan=await dryRun(client,project);await expect(applyIndex(client,{...plan,digest:'tampered'},options)).rejects.toThrow('manifest');expect(()=>indexClient({project:'nemrod40pl'})).toThrow('Production requires');expect(()=>indexClient({project,host:'evil.example:8080'})).toThrow('Only demo');expect(()=>planIndex([{id:'a',data:{type:'ambona',number:40}},{id:'b',data:{type:'ambona',number:' 40 '}}],project)).toThrow('Collision')})
