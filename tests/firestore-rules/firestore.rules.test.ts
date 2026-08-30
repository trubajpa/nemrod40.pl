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

let testEnv: RulesTestEnvironment

const context = (user?: typeof MEMBER) =>
  user
    ? testEnv.authenticatedContext(user.uid, { email: user.email }).firestore()
    : testEnv.unauthenticatedContext().firestore()

const validDevice = (uid = ADMIN.uid) => ({
  number: 40,
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
        ...validDevice(),
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
    await assertSucceeds(setDoc(doc(context(ADMIN), 'devices/new-device'), validDevice()))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/bad-status'), { ...validDevice(), status: 'nieznany' }))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/bad-score'), { ...validDevice(), conditionScore: 6 }))
    await assertFails(setDoc(doc(context(ADMIN), 'devices/bad-author'), { ...validDevice(), createdBy: MEMBER.uid }))
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
      inspectorUid: ADMIN.uid, createdBy: ADMIN.uid, createdAt: serverTimestamp(), locked: true,
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
      description: 'Naprawa testowa', createdBy: ADMIN.uid,
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
