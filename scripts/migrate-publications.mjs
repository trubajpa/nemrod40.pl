import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ts from 'typescript'
const backend = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = backend('firebase-admin/app')
const { getFirestore, Timestamp } = backend('firebase-admin/firestore')
const args = process.argv.slice(2)
const project = args[args.indexOf('--project') + 1]
const apply = args.includes('--apply')
if (!args.includes('--project') || !project) throw Error('Use --project <id>; writes require --apply.')
if (process.env.FIRESTORE_EMULATOR_HOST && project !== 'demo-nemrod40') throw Error('Emulator migration must use demo-nemrod40.')
const source = await readFile(new URL('../src/data/news.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { news } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const db = getFirestore(initializeApp({ projectId: project }))
const existing = await db.collection('announcements').get()
let oldCount = 0, archiveCount = 0
for (const row of existing.docs) {
  if (row.data().placements) continue
  oldCount++
  if (apply) await row.ref.update({ placements: ['members'], publicStatus: 'private', ready: true, photos: [], mainPhoto: '', approvedBy: null, approvedAt: null })
}
for (const item of news) {
  const ref = db.doc(`announcements/legacy-${item.slug}`)
  const current = await ref.get()
  if (current.exists) {
    if (current.data().legacySlug !== item.slug) throw Error(`Conflicting archive ID: ${ref.id}; no replacement performed.`)
    continue
  }
  archiveCount++
  if (apply) await ref.create({ subject: item.title, body: item.description, lead: item.lead, category: item.category, dateLabel: item.date, legacySlug: item.slug,
    authorUid: 'legacy-editorial', authorName: 'Koło Łowieckie nr 40 „Nemrod”', createdAt: Timestamp.fromMillis(0),
    kind: 'aktualność', placements: ['news', 'members'], publicStatus: 'approved', approvedBy: 'legacy-editorial', approvedAt: Timestamp.now(), ready: true,
    photos: [...new Set([item.image, ...item.gallery.map(photo => photo.src)])], mainPhoto: item.image, ...(item.video ? { video: item.video } : {}) })
}
console.log(JSON.stringify({ project, mode: apply ? 'apply' : 'dry-run', oldAnnouncements: oldCount, archivedNews: archiveCount }))
