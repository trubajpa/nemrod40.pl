import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  type Firestore, type DocumentData,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'

const PROJECT_ID = 'demo-nemrod40'
const MEMBER = { uid: 'member-uid', email: 'member@example.test', displayName: 'Członek testowy' }
const ADMIN = { uid: 'admin-uid', email: 'admin@example.test', displayName: 'Administrator testowy' }

async function createIndexed(db:Firestore,path:string,data:DocumentData){
 const batch=writeBatch(db),id=path.split('/').at(-1)!;batch.set(doc(db,path),data);batch.set(doc(db,'deviceNumbers',data.type+'-'+String(data.number).toLowerCase()),{deviceId:id,type:data.type,number:data.number,updatedBy:ADMIN.uid,updatedAt:serverTimestamp()});return batch.commit()
}
let testEnv: RulesTestEnvironment

const context = (user?: typeof MEMBER) =>
  user
    ? testEnv.authenticatedContext(user.uid, { email: user.email }).firestore()
    : testEnv.unauthenticatedContext().firestore()

const validDevice = (uid = ADMIN.uid) => ({
  number: '40',
  name: 'Urządzenie testowe',
  type: 'inne',
  active: true,
  archived: false,
  conditionScore: 5,
  status: 'sprawne',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedBy: uid,
  updatedAt: serverTimestamp(),
  version: 1,
})

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (adminContext) => {
    const firestore = adminContext.firestore()
    await Promise.all([
      setDoc(doc(firestore,'deviceRegistry/identityIndex'),{ready:true}),
      setDoc(doc(firestore, 'authorizedUsers', MEMBER.email), {
        active: true,
        role: 'member',
        displayName: MEMBER.displayName,
      }),
      setDoc(doc(firestore, 'authorizedUsers', ADMIN.email), {
        active: true,
        role: 'admin',
        displayName: ADMIN.displayName,
      }),
      setDoc(doc(firestore, 'authorizedUsers', 'inactive@example.test'), {
        active: false,
        role: 'member',
        displayName: 'Nieaktywny',
      }),
      setDoc(doc(firestore, 'devices', 'device-test'), {
        ...validDevice(), number: 40,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
      setDoc(doc(firestore, 'devices/device-test/comments/comment-test'), {
        type: 'uwaga', content: 'Treść', authorUid: MEMBER.uid,
        authorName: MEMBER.displayName, createdAt: new Date('2026-01-01T00:00:00Z'),
        relatedType: 'device', relatedId: null, status: 'nowy',
        convertedToIssueId: null, moderatedAt: null, moderatedBy: null,
      }),
      setDoc(doc(firestore, 'devices/device-test/media/media-old'), {
        path: '/old.jpg', uploadedBy: ADMIN.uid,
        uploadedAt: new Date('2026-01-01T00:00:00Z'), isCurrent: true,
        replacedBy: null, hidden: false,
      }),
      setDoc(doc(firestore, 'devices/device-test/issues/issue-test'), {
        title: 'Usterka testowa', status: 'zgloszona', createdBy: ADMIN.uid,
        createdAt: new Date('2026-01-01T00:00:00Z'), updatedBy: ADMIN.uid,
        updatedAt: new Date('2026-01-01T00:00:00Z'), resolvedAt: null,
        resolvedByRepairId: null,
      }),
      setDoc(doc(firestore, 'devices/device-test/inspections/inspection-test'), {
        inspectorUid: ADMIN.uid, createdBy: ADMIN.uid,
        createdAt: new Date('2026-01-01T00:00:00Z'), locked: true,
      }),
      setDoc(doc(firestore, 'devices/device-test/repairs/repair-test'), {
        createdBy: ADMIN.uid, verifiedByUid: ADMIN.uid,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    ])
  })
}

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Only local Firestore emulator 127.0.0.1:8080 is allowed')
  const rules = await readFile(resolve('firestore.rules'), 'utf8')
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080, rules },
  })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('firestore.rules w Local Emulator Suite', () => {
  async function rename(id:string,number:string){
    const db=context(ADMIN),ref=doc(db,'devices',id),before=(await getDoc(ref)).data()!
    const after={...before,number,updatedAt:serverTimestamp(),updatedBy:ADMIN.uid,version:before.version+1}
    const batch=writeBatch(db)
    batch.update(ref,after)
    batch.set(doc(db,'deviceNumbers',`${before.type}-${number.toLowerCase()}`),{deviceId:id,type:before.type,number,updatedBy:ADMIN.uid,updatedAt:serverTimestamp()})
    batch.set(doc(db,'devices',id,'edits',String(after.version)),{before,after,version:after.version,createdBy:ADMIN.uid,createdAt:serverTimestamp()})
    return batch.commit()
  }
  it('renumbers a legacy random ID with immutable history and leaves child comments intact',async()=>{
    await seed();await assertSucceeds(rename('device-test','1001'))
    await assertSucceeds(getDoc(doc(context(MEMBER),'devices/device-test/comments/comment-test')))
    await assertFails(updateDoc(doc(context(ADMIN),'devices/device-test/edits/2'),{before:{}}))
  })
  it('blocks occupied identities and concurrent claims for a single number',async()=>{
    await seed();await createIndexed(context(ADMIN),'devices/inne-41',{...validDevice(),number:'41'})
    await assertFails(rename('device-test','41'))
    const results=await Promise.allSettled([rename('device-test','1002'),rename('inne-41','1002')])
    if(results.filter(r=>r.status==='fulfilled').length!==1)throw Error('Exactly one identity claim must succeed')
  })
  it('blocks identity writes before trusted legacy-index readiness and blocks clients changing readiness',async()=>{
    await seed();await testEnv.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'deviceRegistry/identityIndex'),{ready:false}))
    await assertFails(rename('device-test','1003'))
    await assertFails(setDoc(doc(context(ADMIN),'deviceRegistry/identityIndex'),{ready:true}))
  })
  it('admin edits comment with original content in immutable history; member cannot',async()=>{
    await seed();const db=context(ADMIN),ref=doc(db,'devices/device-test/comments/comment-test'),batch=writeBatch(db)
    batch.set(doc(db,'devices/device-test/comments/comment-test/edits/edit-1'),{before:'Treść',after:'Poprawiona treść',createdBy:ADMIN.uid,createdAt:serverTimestamp()})
    batch.update(ref,{content:'Poprawiona treść',lastEditId:'edit-1',moderatedAt:serverTimestamp(),moderatedBy:ADMIN.uid})
    await assertSucceeds(batch.commit());await assertFails(updateDoc(doc(context(MEMBER),'devices/device-test/comments/comment-test'),{content:'Podszyta zmiana'}))
  })
  it('admin changes photo status/detaches without file deletion; member cannot',async()=>{
    await seed();await assertSucceeds(updateDoc(doc(context(ADMIN),'devices/device-test/media/media-old'),{photoStatus:'archiwalne',hidden:true,isCurrent:false}))
    await assertFails(updateDoc(doc(context(MEMBER),'devices/device-test/media/media-old'),{photoStatus:'aktualne'}))
    await assertFails(updateDoc(doc(context(ADMIN),'devices/device-test/media/media-old'),{photoStatus:'niewiadome'}))
  })
  it('przyjmuje tekstowe numery, rozdziela typy i dopuszcza wszystkie półpunktowe oceny', async () => {
    await seed()
    for (const [type, number] of [['ambona', '31'], ['pasnik', '31'], ['ambona', '4A'], ['ambona', '4B']]) {
      await assertSucceeds(createIndexed(context(ADMIN), `devices/${type}-${number.toLowerCase()}`, { ...validDevice(), type, number, conditionScore: 0, conditionLabel: '4+', inspectionDate: new Date('2026-05-09T00:00:00Z'), inventoryUpdatedAt: null }))
    }
    for (let score = 0; score <= 5; score += 0.5) {
      const number = String(100 + score * 2)
      await assertSucceeds(createIndexed(context(ADMIN), `devices/inne-${number}`, { ...validDevice(), number, conditionScore: score }))
    }
  })

  it('odrzuca złe ID, brak numeru i nowe numery liczbowe', async () => {
    await seed()
    for (const [id, number] of [['random-id', '4A'], ['ambona-4', '4B'], ['ambona-4a', 4], ['ambona-', ''], ['ambona-unknown', 'do ustalenia']]) {
      await assertFails(setDoc(doc(context(ADMIN), `devices/${id}`), { ...validDevice(), type: 'ambona', number }))
    }
  })

  it('odrzuca błędną skalę, etykietę, daty i pusty audyt także przy edycji', async () => {
    await seed()
    const invalid = [
      { conditionScore: -0.5 }, { conditionScore: 5.5 }, { conditionScore: 2.25 }, { conditionScore: '4+' },
      { conditionLabel: 4 }, { conditionLabel: 'x'.repeat(81) },
      { inspectionDate: '2026-05-09' }, { inventoryUpdatedAt: '2026-05-10' }, { updatedAt: null },
    ]
    for (const fields of invalid) {
      await assertFails(setDoc(doc(context(ADMIN), 'devices/inne-41'), { ...validDevice(), number: '41', ...fields }))
      await assertFails(updateDoc(doc(context(ADMIN), 'devices/device-test'), { updatedAt: serverTimestamp(), updatedBy: ADMIN.uid, version: increment(1), ...fields }))
    }
    await assertSucceeds(updateDoc(doc(context(ADMIN), 'devices/device-test'), { number: '40', conditionScore: 0.5, conditionLabel: '4+', inventoryUpdatedAt: new Date('2026-05-10T00:00:00Z'), updatedAt: serverTimestamp(), updatedBy: ADMIN.uid, version: increment(1) }))
    await assertFails(updateDoc(doc(context(ADMIN), 'devices/device-test'), { number: '41', updatedAt: serverTimestamp(), updatedBy: ADMIN.uid, version: increment(1) }))
    await assertFails(updateDoc(doc(context(ADMIN), 'devices/device-test'), { type: 'ambona', updatedAt: serverTimestamp(), updatedBy: ADMIN.uid, version: increment(1) }))
  })

  it('waliduje skalę i opis oceny przeglądów oraz napraw bez poluzowania autora historii', async () => {
    await seed()
    const db = context(ADMIN)
    const inspection = { inspectorUid: ADMIN.uid, createdBy: ADMIN.uid, createdAt: serverTimestamp(), locked: true, statusAfterInspection: 'sprawne', approvedForUse: false, inspectionDate: new Date('2026-05-09T00:00:00Z'), conditionScore: 0, conditionLabel: '4+' }
    await assertSucceeds(setDoc(doc(db, 'devices/device-test/inspections/zero'), inspection))
    await assertFails(setDoc(doc(db, 'devices/device-test/inspections/bad-score'), { ...inspection, conditionScore: 4.25 }))
    await assertFails(setDoc(doc(db, 'devices/device-test/inspections/bad-author'), { ...inspection, inspectorUid: MEMBER.uid }))
    await assertFails(setDoc(doc(db, 'devices/device-test/inspections/bad-date'), { ...inspection, inspectionDate: null }))
    const repair = { createdBy: ADMIN.uid, verifiedByUid: ADMIN.uid, createdAt: serverTimestamp(), conditionAfter: 0.5, conditionBefore: 0, conditionLabel: '4+' }
    await assertSucceeds(setDoc(doc(db, 'devices/device-test/repairs/half'), repair))
    await assertFails(setDoc(doc(db, 'devices/device-test/repairs/bad-after'), { ...repair, conditionAfter: 5.5 }))
    await assertFails(setDoc(doc(db, 'devices/device-test/repairs/bad-before'), { ...repair, conditionBefore: 0.25 }))
    await assertFails(setDoc(doc(db, 'devices/device-test/repairs/bad-label'), { ...repair, conditionLabel: 4 }))
  })

  it('odrzuca odczyt urządzeń bez logowania, dla nieaktywnego konta i przy różnej wielkości liter e-maila', async () => {
    await seed()
    await assertFails(getDoc(doc(context(), 'devices/device-test')))
    const inactive = testEnv.authenticatedContext('inactive-uid', { email: 'inactive@example.test' }).firestore()
    await assertFails(getDoc(doc(inactive, 'devices/device-test')))
    const wrongCase = testEnv.authenticatedContext(MEMBER.uid, { email: 'Member@example.test' }).firestore()
    await assertFails(getDoc(doc(wrongCase, 'devices/device-test')))
  })

  it('pozwala aktywnemu członkowi pobrać urządzenie i listę urządzeń', async () => {
    await seed()
    await assertSucceeds(getDoc(doc(context(MEMBER), 'devices/device-test')))
    await assertSucceeds(getDocs(query(collection(context(MEMBER), 'devices'))))
  })

  it('odrzuca użytkownika bez dokumentu authorizedUsers', async () => {
    await seed()
    const unknown = testEnv.authenticatedContext('unknown-uid', { email: 'unknown@example.test' }).firestore()
    await assertFails(getDoc(doc(unknown, 'devices/device-test')))
  })

  it('pozwala użytkownikowi odczytać wyłącznie własny wpis authorizedUsers', async () => {
    await seed()
    await assertSucceeds(getDoc(doc(context(MEMBER), `authorizedUsers/${MEMBER.email}`)))
    await assertFails(getDoc(doc(context(MEMBER), `authorizedUsers/${ADMIN.email}`)))
    await assertFails(updateDoc(doc(context(MEMBER), `authorizedUsers/${MEMBER.email}`), { role: 'admin' }))
  })

  it('pozwala członkowi utworzyć poprawny komentarz', async () => {
    await seed()
    await assertSucceeds(setDoc(doc(context(MEMBER), 'devices/device-test/comments/new-comment'), {
      type: 'uwaga', content: 'Nowa uwaga', authorUid: MEMBER.uid,
      authorName: MEMBER.displayName, createdAt: serverTimestamp(), relatedType: 'device',
      relatedId: null, status: 'nowy', convertedToIssueId: null,
      moderatedAt: null, moderatedBy: null,
    }))
  })

  it('odrzuca komentarz z podszytym autorem, nazwą lub dodatkowym polem', async () => {
    await seed()
    const base = {
      type: 'uwaga', content: 'Nowa uwaga', authorUid: MEMBER.uid,
      authorName: MEMBER.displayName, createdAt: serverTimestamp(), relatedType: 'device',
      relatedId: null, status: 'nowy', convertedToIssueId: null,
      moderatedAt: null, moderatedBy: null,
    }
    await assertFails(setDoc(doc(context(MEMBER), 'devices/device-test/comments/bad-uid'), { ...base, authorUid: ADMIN.uid }))
    await assertFails(setDoc(doc(context(MEMBER), 'devices/device-test/comments/bad-name'), { ...base, authorName: 'Ktoś inny' }))
    await assertFails(setDoc(doc(context(MEMBER), 'devices/device-test/comments/extra'), { ...base, role: 'admin' }))
  })

  it('odrzuca administracyjne zapisy członka', async () => {
    await seed()
    await assertFails(setDoc(doc(context(MEMBER), 'devices/member-device'), validDevice(MEMBER.uid)))
    await assertFails(updateDoc(doc(context(MEMBER), 'devices/device-test'), {
      name: 'Zmiana membera', updatedBy: MEMBER.uid,
      updatedAt: serverTimestamp(), version: increment(1),
    }))
    await assertFails(deleteDoc(doc(context(MEMBER), 'devices/device-test')))
    await assertFails(setDoc(doc(context(MEMBER), 'devices/device-test/inspections/member-inspection'), {
      inspectorUid: MEMBER.uid, createdBy: MEMBER.uid, createdAt: serverTimestamp(), locked: true,
    }))
    await assertFails(setDoc(doc(context(MEMBER), 'devices/device-test/repairs/member-repair'), {
      createdBy: MEMBER.uid, verifiedByUid: MEMBER.uid, createdAt: serverTimestamp(),
    }))
  })

  it('odrzuca edycję treści własnego komentarza przez członka', async () => {
    await seed()
    await assertFails(updateDoc(doc(context(MEMBER), 'devices/device-test/comments/comment-test'), {
      content: 'Treść zmieniona przez autora',
    }))
  })

  it('pozwala administratorowi utworzyć poprawne urządzenie, ale sprawdza status, ocenę i audyt', async () => {
    await seed()
    await assertSucceeds(createIndexed(context(ADMIN), 'devices/inne-40', validDevice()))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/inne-41'), { ...validDevice(), number: '41', status: 'nieznany' }))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/inne-42'), { ...validDevice(), number: '42', conditionScore: 6 }))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/inne-43'), { ...validDevice(), number: '43', createdBy: MEMBER.uid }))
  })

  it('wymaga przy aktualizacji urządzenia niezmiennego autora, czasu utworzenia i wersji +1', async () => {
    await seed()
    const ref = doc(context(ADMIN), 'devices/device-test')
    await assertSucceeds(updateDoc(ref, { name: 'Po zmianie', updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(1) }))
    await assertFails(updateDoc(ref, { createdBy: MEMBER.uid, updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(1) }))
    await assertFails(updateDoc(ref, { createdAt: new Date('2026-02-01T00:00:00Z'), updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(1) }))
    await assertFails(updateDoc(ref, { name: 'Bez wersji', updatedBy: ADMIN.uid, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { name: 'Skok wersji', updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(2) }))
  })

  it('pozwala administratorowi moderować tylko pola moderacji komentarza', async () => {
    await seed()
    const ref = doc(context(ADMIN), 'devices/device-test/comments/comment-test')
    await assertSucceeds(updateDoc(ref, { status: 'ukryty', moderatedAt: serverTimestamp(), moderatedBy: ADMIN.uid }))
    await assertFails(updateDoc(ref, { content: 'Zmieniona treść', status: 'ukryty', moderatedAt: serverTimestamp(), moderatedBy: ADMIN.uid }))
  })

  it('chroni historyczne pola medium', async () => {
    await seed()
    const ref = doc(context(ADMIN), 'devices/device-test/media/media-old')
    await assertSucceeds(updateDoc(ref, { isCurrent: false, replacedBy: 'media-new' }))
    await assertFails(updateDoc(ref, { path: '/changed.jpg', hidden: true }))
  })

  it('pozwala administratorowi wykonać atomowy zapis przeglądu i aktualizację urządzenia', async () => {
    await seed()
    const db = context(ADMIN)
    const batch = writeBatch(db)
    batch.set(doc(db, 'devices/device-test/inspections/inspection-new'), {
      inspectorUid: ADMIN.uid, createdBy: ADMIN.uid, createdAt: serverTimestamp(), locked: true, statusAfterInspection: 'sprawne', approvedForUse: false, conditionScore: 4.5, inspectionDate: new Date('2026-05-09T00:00:00Z'),
    })
    batch.update(doc(db, 'devices/device-test'), {
      conditionScore: 4, updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(1),
    })
    await assertSucceeds(batch.commit())
  })

  it('pozwala administratorowi wykonać atomową naprawę zamykającą usterkę i aktualizującą urządzenie', async () => {
    await seed()
    const db = context(ADMIN)
    const batch = writeBatch(db)
    batch.set(doc(db, 'devices/device-test/repairs/repair-new'), {
      description: 'Naprawa testowa', conditionAfter: 4.5, createdBy: ADMIN.uid,
      verifiedByUid: ADMIN.uid, createdAt: serverTimestamp(),
    })
    batch.update(doc(db, 'devices/device-test/issues/issue-test'), {
      status: 'usunieta', resolvedByRepairId: 'repair-new', resolvedAt: serverTimestamp(),
      updatedBy: ADMIN.uid, updatedAt: serverTimestamp(),
    })
    batch.update(doc(db, 'devices/device-test'), {
      conditionScore: 5, openIssuesCount: 0, status: 'sprawne',
      updatedBy: ADMIN.uid, updatedAt: serverTimestamp(), version: increment(1),
    })
    await assertSucceeds(batch.commit())
  })

  it('pozwala administratorowi atomowo dodać zdjęcie, ustawić replacedBy i zaktualizować urządzenie', async () => {
    await seed()
    const db = context(ADMIN)
    const batch = writeBatch(db)
    batch.set(doc(db, 'devices/device-test/media/media-new'), {
      path: '/new.jpg', uploadedBy: ADMIN.uid, uploadedAt: serverTimestamp(),
      isCurrent: true, replacedBy: null, hidden: false,
    })
    batch.update(doc(db, 'devices/device-test/media/media-old'), {
      isCurrent: false, replacedBy: 'media-new',
    })
    batch.update(doc(db, 'devices/device-test'), {
      currentPhotoId: 'media-new', updatedBy: ADMIN.uid,
      updatedAt: serverTimestamp(), version: increment(1),
    })
    await assertSucceeds(batch.commit())
  })

  it('blokuje fizyczne usuwanie danych dla członka i administratora', async () => {
    await seed()
    const paths = [
      'devices/device-test',
      'devices/device-test/comments/comment-test',
      'devices/device-test/issues/issue-test',
      'devices/device-test/inspections/inspection-test',
      'devices/device-test/repairs/repair-test',
      'devices/device-test/media/media-old',
    ]
    for (const path of paths) {
      await assertFails(deleteDoc(doc(context(MEMBER), path)))
      await assertFails(deleteDoc(doc(context(ADMIN), path)))
    }
  })

  it('blokuje modyfikację authorizedUsers zarówno członkowi, jak i administratorowi', async () => {
    await seed()
    await assertFails(updateDoc(doc(context(MEMBER), `authorizedUsers/${MEMBER.email}`), { role: 'admin' }))
    await assertFails(updateDoc(doc(context(ADMIN), `authorizedUsers/${MEMBER.email}`), { role: 'admin' }))
  })

  it('domyślnie odrzuca dostęp do nieznanych kolekcji', async () => {
    await seed()
    await assertFails(getDoc(doc(context(ADMIN), 'private/secret')))
    await assertFails(setDoc(doc(context(ADMIN), 'private/secret'), { value: true }))
  })
})

describe('do_ustalenia direct Firestore rules',()=>{
 it('allows creation and update with false approval',async()=>{
  await seed();const db=context(ADMIN);await assertSucceeds(createIndexed(db,'devices/inne-40',{...validDevice(),status:'do_ustalenia',approvedForUse:false}));
  await assertSucceeds(updateDoc(doc(db,'devices/inne-40'),{name:'Updated',version:2,updatedAt:serverTimestamp()}));
 });
 it.each([{status:'unknown',approvedForUse:false},{status:'do_ustalenia',approvedForUse:true},{status:'do_ustalenia'}])('rejects invalid create and update %j',async fields=>{
  await seed();const db=context(ADMIN);await assertFails(createIndexed(db,'devices/inne-40',{...validDevice(),...fields}));
  await assertFails(updateDoc(doc(db,'devices/device-test'),{...fields,version:2,updatedAt:serverTimestamp(),updatedBy:ADMIN.uid}));
 });
 it('rejects approving an existing undetermined device',async()=>{
  await seed();const db=context(ADMIN);await createIndexed(db,'devices/inne-40',{...validDevice(),status:'do_ustalenia',approvedForUse:false});
  await assertFails(updateDoc(doc(db,'devices/inne-40'),{approvedForUse:true,version:2,updatedAt:serverTimestamp()}));
 });
});

it('enforces undetermined inspection approval and rejects unknown status',async()=>{
 await seed();const db=context(ADMIN);const data={inspectorUid:ADMIN.uid,createdBy:ADMIN.uid,createdAt:serverTimestamp(),locked:true,inspectionDate:new Date(),conditionScore:4,statusAfterInspection:'do_ustalenia',approvedForUse:false};
 await assertSucceeds(setDoc(doc(db,'devices/device-test/inspections/undetermined'),data));
 await assertFails(setDoc(doc(db,'devices/device-test/inspections/approved'),{...data,approvedForUse:true}));
 await assertFails(setDoc(doc(db,'devices/device-test/inspections/unknown'),{...data,statusAfterInspection:'unknown'}));
});
