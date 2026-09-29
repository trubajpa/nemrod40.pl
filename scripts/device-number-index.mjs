import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

const types=new Set(['ambona','zwyzka','pasnik','lizawka','inne'])
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function planIndex(devices, project){
 const keys=new Map()
 const entries=devices.map(({id,data})=>{
  const raw=data.number
  if(!types.has(data.type)||(typeof raw!=='string'&&typeof raw!=='number'))throw Error(`Invalid identity: ${id}`)
  const number=String(raw).trim().toUpperCase()
  if(!/^[0-9][A-Z0-9-]{0,31}$/.test(number))throw Error(`Invalid number: ${id}`)
  const key=`${data.type}-${number.toLowerCase()}`
  if(keys.has(key))throw Error(`Collision ${key}: ${keys.get(key)} / ${id}`)
  keys.set(key,id)
  return {key,deviceId:id,type:data.type,number,sourceNumber:raw}
 }).sort((a,b)=>a.key.localeCompare(b.key))
 return {schema:1,project,entries,digest:hash(entries)}
}
function validateManifest(manifest,project){
 if(manifest.schema!==1||manifest.project!==project||!Array.isArray(manifest.entries)||hash(manifest.entries)!==manifest.digest)throw Error('Invalid manifest or project mismatch')
 const rebuilt=planIndex(manifest.entries.map(e=>({id:e.deviceId,data:{type:e.type,number:e.sourceNumber}})),project)
 if(rebuilt.digest!==manifest.digest)throw Error('Manifest identities do not match canonical entries')
}
function checkReservations(entries, reservations,complete=false){
 const expected=new Map(entries.map(e=>[e.key,e]))
 for(const {id,data} of reservations){const e=expected.get(id);if(!e||data.deviceId!==e.deviceId||data.type!==e.type||data.number!==e.number)throw Error(`Conflicting or orphan reservation: ${id}`)}
 if(complete&&reservations.length!==entries.length)throw Error('Incomplete index')
}
function decodeValue(v){if('stringValue'in v)return v.stringValue;if('timestampValue'in v)return v.timestampValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('nullValue'in v)return null;return undefined}
function decode(document){return {id:document.name.split('/').at(-1),data:Object.fromEntries(Object.entries(document.fields??{}).map(([k,v])=>[k,decodeValue(v)])),updateTime:document.updateTime}}
const encode=object=>Object.fromEntries(Object.entries(object).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:/At$/.test(k)?{timestampValue:String(v)}:{stringValue:String(v)}]))

/** REST adapter uses an explicit project; it never reads the application's Firebase config. */
export function indexClient({project,host,token,production=false,confirmProject}){
 if(!/^[a-z][a-z0-9-]{4,62}$/.test(project??''))throw Error('Explicit valid project required')
 if(host){if(host!=='127.0.0.1:8080'||project!=='demo-nemrod40'||production)throw Error('Only demo-nemrod40 at 127.0.0.1:8080 is allowed for emulator mode')}
 else if(!production||confirmProject!==project||!token||project.startsWith('demo-'))throw Error('Production requires explicit --production, matching --confirm-project and NEMROD_INDEX_ACCESS_TOKEN')
 const database=`projects/${project}/databases/(default)`,base=`${host?'http://'+host:'https://firestore.googleapis.com'}/v1/${database}/documents`
 async function request(suffix,body){const response=await fetch(base+suffix,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${host?'owner':token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Firestore HTTP ${response.status} for ${suffix.split('?')[0]}`);return response.json()}
 async function all(collection,transaction){
  if(transaction){const rows=await request(':runQuery',{structuredQuery:{from:[{collectionId:collection}]},transaction});return rows.filter(row=>row.document).map(row=>decode(row.document))}
  const records=[];let pageToken
  do{const page=await request('/'+collection+'?pageSize=300'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));records.push(...(page.documents??[]).map(decode));pageToken=page.nextPageToken}while(pageToken)
  return records
 }
 const write=(collection,id,data,precondition)=>({update:{name:`${database}/documents/${collection}/${id}`,fields:encode(data)},...(precondition?{currentDocument:precondition}:{})})
 return {all,write,begin:async()=>(await request(':beginTransaction',{options:{readWrite:{}}})).transaction,
  commit:(writes,transaction)=>request(':commit',{writes,...(transaction?{transaction}:{})}),
  rollback:transaction=>request(':rollback',{transaction}),
 }
}
export async function dryRun(client,project){const plan=planIndex(await client.all('devices'),project);checkReservations(plan.entries,await client.all('deviceNumbers'));return plan}
export async function applyIndex(client,manifest,{project,operator,activate=false,checkpoint=async()=>{}}){
 validateManifest(manifest,project)
 if(!operator?.trim())throw Error('Operator required')
 const buildId=manifest.digest
 // Acquire a resumable build marker transactionally. Never turn an active index off.
 const transaction=await client.begin()
 try{
  const devices=await client.all('devices',transaction),reservations=await client.all('deviceNumbers',transaction),metadata=await client.all('deviceRegistry',transaction)
  if(planIndex(devices,project).digest!==buildId)throw Error('Source changed since dry-run')
  checkReservations(manifest.entries,reservations)
  const old=metadata.find(d=>d.id==='identityIndex')
  if(old?.data.ready===true){checkReservations(manifest.entries,reservations,true);if(old.data.digest!==buildId)throw Error('Active index has another manifest');await client.rollback(transaction);return {ready:true,count:manifest.entries.length,resumed:true}}
  if(old?.data.buildId&&old.data.buildId!==buildId)throw Error('Another unfinished index build exists')
  await client.commit([client.write('deviceRegistry','identityIndex',{ready:false,buildId,operator,startedAt:old?.data.startedAt??new Date().toISOString()},old?{updateTime:old.updateTime}:{exists:false})],transaction)
 }catch(error){await client.rollback(transaction).catch(()=>{});throw error}
 const existing=new Map((await client.all('deviceNumbers')).map(r=>[r.id,r]))
 checkReservations(manifest.entries,[...existing.values()])
 // Each create has an exists:false precondition. A concurrent writer is never overwritten.
 for(let offset=0;offset<manifest.entries.length;offset+=200){
  const entries=manifest.entries.slice(offset,offset+200).filter(e=>!existing.has(e.key))
  if(entries.length)await client.commit(entries.map(e=>client.write('deviceNumbers',e.key,{deviceId:e.deviceId,type:e.type,number:e.number,updatedBy:operator,updatedAt:new Date().toISOString()},{exists:false})))
  await checkpoint({buildId,processed:Math.min(offset+200,manifest.entries.length),total:manifest.entries.length})
 }
 // Re-read sources and reservations in one transaction before marking ready. Query
 // locks detect concurrent identity changes; normal descriptive edits are harmless.
 const verification=await client.begin()
 try{
  const devices=await client.all('devices',verification),reservations=await client.all('deviceNumbers',verification),metadata=await client.all('deviceRegistry',verification)
  if(planIndex(devices,project).digest!==buildId)throw Error('Source changed during apply; index remains not ready')
  checkReservations(manifest.entries,reservations,true)
  const state=metadata.find(d=>d.id==='identityIndex')
  if(state?.data.buildId!==buildId||state.data.ready===true)throw Error('Build marker changed')
  await client.commit([client.write('deviceRegistry','identityIndex',{ready:activate,buildId,digest:buildId,count:manifest.entries.length,operator,verifiedAt:new Date().toISOString()},{updateTime:state.updateTime})],verification)
 }catch(error){await client.rollback(verification).catch(()=>{});throw error}
 return {ready:activate,count:manifest.entries.length,resumed:false}
}
async function main(){
 const args=process.argv.slice(2),options={};const flags=new Set(['--production','--activate','--freeze-confirmed'])
 for(let i=1;i<args.length;i++){const key=args[i];if(!['--project','--manifest','--operator','--confirm-project',...flags].includes(key)||key in options)throw Error('Unknown or duplicate argument');options[key]=flags.has(key)?true:args[++i];if(options[key]===undefined)throw Error('Missing argument value')}
 const mode=args[0];if(!['dry-run','apply'].includes(mode)||!options['--manifest'])throw Error('Usage: node scripts/device-number-index.mjs dry-run|apply --project PROJECT --manifest FILE [--operator NAME --freeze-confirmed --activate]')
 if(mode==='apply'&&!options['--freeze-confirmed'])throw Error('Confirm identity writes are frozen with --freeze-confirmed')
 const project=options['--project'],client=indexClient({project,host:process.env.FIRESTORE_EMULATOR_HOST,token:process.env.NEMROD_INDEX_ACCESS_TOKEN,production:options['--production'],confirmProject:options['--confirm-project']})
 const file=path.resolve(options['--manifest'])
 if(mode==='dry-run'){const manifest=await dryRun(client,project);await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(`Dry-run: ${manifest.entries.length} identities; manifest ${file}; no writes to Firestore`)}
 else {const manifest=JSON.parse(await fs.readFile(file,'utf8'));console.log(JSON.stringify(await applyIndex(client,manifest,{project,operator:options['--operator'],activate:!!options['--activate'],checkpoint:progress=>fs.writeFile(file+'.checkpoint.json',JSON.stringify(progress,null,2)+'\n')})))}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1})
