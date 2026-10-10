import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, signInWithCredential, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc, terminate, type Firestore } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { beforeAll, beforeEach, afterEach, afterAll, it, expect, vi } from 'vitest'
const holder=vi.hoisted(()=>({db:null as Firestore|null,auth:null as Auth|null}))
vi.mock('../../src/lib/firebase',()=>({get db(){return holder.db},get auth(){return holder.auth}}))
import { submitAccessRequest } from '../../src/auth/accessRequests'
import { listUsersPage, changeUserAccess } from '../../src/auth/userManagement'
const require = createRequire(new URL('../../functions/package.json', import.meta.url))
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app')
const { getAuth: getAdminAuth } = require('firebase-admin/auth')
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore')
const project='demo-nemrod40', password='emulator-password-only'
let env:RulesTestEnvironment
const adminApp=initializeAdminApp({projectId:project},'user-backend-tests'), adminAuth=getAdminAuth(adminApp), adminDb=getAdminFirestore(adminApp)
const clients:{app:FirebaseApp;auth:Auth;db:Firestore}[]=[]
function client(){const app=initializeApp({projectId:project,apiKey:'fake-emulator-key',authDomain:`${project}.firebaseapp.com`},`user-test-${clients.length}-${Date.now()}`);const auth=getAuth(app),db=getFirestore(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);connectFunctionsEmulator(getFunctions(app,'europe-west1'),'127.0.0.1',5001);const c={app,auth,db};clients.push(c);return c}
async function account(uid:string,role?:string){const email=`${uid}@example.test`;await adminAuth.createUser({uid,email,password,emailVerified:true,displayName:`Name ${uid}`});if(role)await adminDb.doc(`authorizedUsers/${email}`).set({active:true,role,displayName:`Name ${uid}`});const c=client();await signInWithEmailAndPassword(c.auth,email,password);return c}
async function google(){const c=client();const token=[{alg:'none',typ:'JWT'},{sub:'google-applicant',email:'google@example.test',email_verified:true,name:'Google Applicant',iss:'https://accounts.google.com',aud:'test',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')+'.';await signInWithCredential(c.auth,GoogleAuthProvider.credential(token));return c}
const use=(c:ReturnType<typeof client>)=>{holder.auth=c.auth;holder.db=c.db}
const change=(c:ReturnType<typeof client>,data:object)=>httpsCallable(getFunctions(c.app,'europe-west1'),'manageAppUser')(data)
beforeAll(async()=>{
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw new Error('Auth and Firestore emulators are required; production is forbidden')
 env=await initializeTestEnvironment({projectId:project,firestore:{rules:await readFile('firestore.rules','utf8'),host:'127.0.0.1',port:8080}})
},60000)
beforeEach(async()=>{await env.clearFirestore();await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${project}/accounts`,{method:'DELETE'})})
afterEach(async()=>{for(const c of clients){await terminate(c.db);await deleteApp(c.app)}clients.length=0})
afterAll(async()=>{await env.cleanup();await deleteAdminApp(adminApp)})
it('pełny przepływ: zgłoszenie → member → admin → member → odebranie → nowy wniosek → member',async()=>{
 const admin=await account('admin','admin'), applicant=await google();use(applicant)
 await adminDb.doc('devices/private').set({active:true});await submitAccessRequest(applicant.auth.currentUser!)
 await assertFails(getDoc(doc(applicant.db,'devices/private')))
 use(admin);await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'approve'})
 expect((await getDoc(doc(applicant.db,'authorizedUsers/google@example.test'))).data()!.role).toBe('member')
 await getDoc(doc(applicant.db,'devices/private'))
 await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'role',role:'admin'})
 expect((await adminDb.doc('authorizedUsers/google@example.test').get()).data().role).toBe('admin')
 await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'role',role:'member'})
 await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'revoke',confirmed:true})
 expect((await adminAuth.getUser(applicant.auth.currentUser!.uid)).uid).toBe(applicant.auth.currentUser!.uid)
 await assertFails(getDoc(doc(applicant.db,'devices/private')))
 const relogged = await google();expect(relogged.auth.currentUser!.uid).toBe(applicant.auth.currentUser!.uid)
 use(relogged);expect(await submitAccessRequest(relogged.auth.currentUser!)).toBe('pending')
 use(admin);await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'approve'})
 await getDoc(doc(applicant.db,'devices/private'))
 const audit=await adminDb.collection('authorizationAudit').get();expect(audit.size).toBe(5)
 for(const item of audit.docs){expect(item.data().actorUid).toBe('admin');expect(item.data().createdAt.toDate()).toBeInstanceOf(Date)}
},60000)
it('lista Auth jest stronicowana, łączy profile i wnioski i nie ujawnia pól administracyjnych',async()=>{
 const admin=await account('admin','admin');await account('member','member');await account('noaccess');use(admin)
 const all=[];let token:string|undefined
 do{const result=await httpsCallable(getFunctions(admin.app,'europe-west1'),'listAppUsers')({pageSize:1,...(token?{pageToken:token}:{})});const page=result.data as {users:{uid:string;status:string;lastSignInTime:string;authorizedUser:unknown}[];nextPageToken:string|null};expect(page.users.length).toBeLessThanOrEqual(1);all.push(...page.users);token=page.nextPageToken??undefined}while(token)
 expect(all).toHaveLength(3);expect(all.find(user=>user.uid==='noaccess')!.status).toBe('no-access');expect(all.find(user=>user.uid==='member')!.lastSignInTime).toBeTruthy()
 expect(JSON.stringify(all)).not.toMatch(/passwordHash|passwordSalt|customClaims|tokensValidAfterTime/)
 expect((await listUsersPage()).users).toHaveLength(3)
},60000)
it('odmawia listy i zmian bez aktualnej roli admin; sfałszowane żądanie nie nadaje dostępu',async()=>{
 const member=await account('member','member');use(member)
 await expect(listUsersPage()).rejects.toMatchObject({code:'functions/permission-denied'})
 await expect(changeUserAccess({uid:'member',action:'role',role:'admin'})).rejects.toMatchObject({code:'functions/permission-denied'})
 const unauth=client();await expect(httpsCallable(getFunctions(unauth.app,'europe-west1'),'listAppUsers')({})).rejects.toMatchObject({code:'functions/unauthenticated'})
 const admin=await account('admin','admin');await adminDb.doc('authorizedUsers/admin@example.test').update({active:false});use(admin)
 await expect(listUsersPage()).rejects.toMatchObject({code:'functions/permission-denied'})
},60000)
it('chroni ostatniego administratora i nie dopuszcza zmiany własnej roli',async()=>{
 const admin=await account('admin','admin');use(admin)
 await expect(changeUserAccess({uid:'admin',action:'revoke',confirmed:true})).rejects.toMatchObject({code:'functions/failed-precondition'})
 await expect(changeUserAccess({uid:'admin',action:'role',role:'member'})).rejects.toMatchObject({code:'functions/failed-precondition'})
 expect((await adminDb.doc('authorizedUsers/admin@example.test').get()).data().active).toBe(true)
 expect((await adminDb.collection('authorizationAudit').get()).size).toBe(0)
},60000)
it('równoczesne degradacje dwóch adminów pozostawiają przynajmniej jednego',async()=>{
 const a=await account('admina','admin'),b=await account('adminb','admin')
 const results=await Promise.allSettled([change(a,{uid:'adminb',action:'role',role:'member'}),change(b,{uid:'admina',action:'role',role:'member'})])
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
 const profiles=await adminDb.collection('authorizedUsers').get();expect(profiles.docs.filter((item:{data:()=>{active:boolean;role:string}})=>item.data().active&&item.data().role==='admin')).toHaveLength(1)
},60000)
it('wymaga potwierdzenia odebrania, odrzucenie i niezgodny wniosek nie przyznają uprawnień',async()=>{
 const admin=await account('admin','admin');const member=await account('member','member');use(admin)
 await expect(changeUserAccess({uid:'member',action:'revoke'})).rejects.toMatchObject({code:'functions/failed-precondition'})
 await adminDb.doc('accessRequests/member').set({uid:'member',email:'other@example.test',status:'pending',displayName:'Spoof'})
 await expect(changeUserAccess({uid:member.auth.currentUser!.uid,action:'approve'})).rejects.toMatchObject({code:'functions/failed-precondition'})
 const applicant=await google();use(applicant);await submitAccessRequest(applicant.auth.currentUser!);use(admin);await changeUserAccess({uid:applicant.auth.currentUser!.uid,action:'reject'})
 expect((await adminDb.doc('accessRequests/'+applicant.auth.currentUser!.uid).get()).data().status).toBe('rejected')
 expect((await adminDb.doc('authorizedUsers/google@example.test').get()).exists).toBe(false)
})
it('zablokowane i osierocone wpisy admin nie pozwalają odebrać dostępu ostatniemu działającemu adminowi',async()=>{
 const admin=await account('admin','admin');await adminAuth.createUser({uid:'disabled',email:'disabled@example.test',disabled:true});await adminDb.doc('authorizedUsers/disabled@example.test').set({active:true,role:'admin',displayName:'Disabled'});await adminDb.doc('authorizedUsers/orphan@example.test').set({active:true,role:'admin',displayName:'Orphan'});use(admin)
 await expect(changeUserAccess({uid:'admin',action:'revoke',confirmed:true})).rejects.toMatchObject({code:'functions/failed-precondition'})
 expect((await adminDb.doc('authorizedUsers/admin@example.test').get()).data().active).toBe(true)
})
it('użytkownik logujący się hasłem może ponowić wniosek po odebraniu dostępu',async()=>{
 const admin=await account('admin','admin'),member=await account('passwordmember','member');use(admin)
 await changeUserAccess({uid:'passwordmember',action:'revoke',confirmed:true})
 await adminAuth.updateUser('passwordmember',{displayName:'Inna nazwa konta'})
 await signOut(member.auth);await signInWithEmailAndPassword(member.auth,'passwordmember@example.test',password)
 use(member);expect(await submitAccessRequest(member.auth.currentUser!)).toBe('pending')
 use(admin);await changeUserAccess({uid:'passwordmember',action:'approve'})
 const restored=(await adminDb.doc('authorizedUsers/passwordmember@example.test').get()).data()
 expect(restored.active).toBe(true);expect(restored.displayName).toBe('Name passwordmember')
})
