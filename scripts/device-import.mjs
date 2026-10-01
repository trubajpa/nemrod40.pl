import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const REQUIRED_APPROVAL = 'POTWIERDZAM IMPORT 21 URZĄDZEŃ, GPS I ZDJĘĆ'
const allowedTypes = new Set(['ambona', 'zwyzka', 'pasnik', 'inne'])
const allowedStatuses = new Set(['sprawne', 'wymaga_naprawy', 'wylaczone', 'archiwalne'])
const sourceRoot = '_import-local/ambony-2026-05'
const defaults = {
  staging: `${sourceRoot}/prepared/import-local.json`,
  photos: `${sourceRoot}/prepared/photo-upload-plan.json`,
  report: `${sourceRoot}/prepared/DRY-RUN-IMPORTU.json`,
  markdown: `${sourceRoot}/prepared/DRY-RUN-IMPORTU.md`,
  log: `${sourceRoot}/prepared/import-operations.ndjson`,
  checkpoint: `${sourceRoot}/prepared/import-checkpoint.json`,
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const inside = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
const display = value => value === null || value === undefined || value === '' ? 'do ustalenia' : value
const unique = values => [...new Set(values.filter(Boolean))]

export function resolvePhotoPath(root, item) {
  const candidate = item.origin === 'repository'
    ? path.resolve(root, item.path)
    : path.resolve(root, sourceRoot, 'work/extracted/nemrod40-urzadzenia', item.path)
  if (!inside(root, candidate)) throw new Error(`Photo outside workspace: ${item.path}`)
  return candidate
}

export async function fileHashes(file) {
  const bytes = await fs.readFile(file)
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    md5: createHash('md5').update(bytes).digest('base64'),
  }
}

function expectedMaps(location) {
  return Array.isArray(location) && location.length === 2
    ? `https://maps.google.com/?q=${location[0]},${location[1]}`
    : null
}

function identity(device) {
  if (!device.proposedDocumentId || !device.numberConfirmed) return null
  const number = String(device.number).trim().toUpperCase()
  return { id: device.proposedDocumentId, type: device.type, number, key: `${device.type}-${number.toLowerCase()}` }
}

function detectSecrets(value) {
  const text = JSON.stringify(value)
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AIza[0-9A-Za-z_-]{30,}/,
    /(?:refresh_token|client_secret|private_key)\s*["':=]+\s*["'][^"']+/i,
  ]
  return patterns.filter(pattern => pattern.test(text)).map(pattern => pattern.source)
}

export async function analyzeStaging({ root, staging, photoPlan, production }) {
  const devices = staging.stagedDevices ?? []
  const photoItems = photoPlan.items ?? []
  const templates = new Map((staging.currentModelTemplates ?? []).map(item => [item.sourceId, item]))
  const errors = [], warnings = []
  if (devices.length !== 21) errors.push(`Oczekiwano 21 urządzeń, znaleziono ${devices.length}.`)
  if (staging.productionWritesAllowed !== true) errors.push('Staging ma productionWritesAllowed=false.')
  if (staging.mode === 'review-only') errors.push('Staging pozostaje w trybie review-only.')
  if (photoPlan.mode === 'plan-only') errors.push('Plan zdjęć pozostaje w trybie plan-only.')
  if ((photoPlan.uploads ?? []).length !== photoItems.length) errors.push('Wykonywalna lista uploads nie obejmuje wszystkich pozycji planu zdjęć.')
  for (const match of detectSecrets({ staging, photoPlan })) errors.push(`W danych wejściowych wykryto możliwy sekret: ${match}`)

  const localPhotos = []
  for (const item of photoItems) {
    const file = resolvePhotoPath(root, item)
    let actual
    try { actual = await fileHashes(file) } catch { errors.push(`Brak pliku zdjęcia: ${item.path}`); continue }
    if (actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) errors.push(`Niezgodny plik lub SHA-256: ${item.path}`)
    localPhotos.push({ ...item, sourceFile: path.relative(root, file).replaceAll('\\', '/'), actualMd5: actual.md5 })
  }

  const identities = devices.map(identity).filter(Boolean)
  const duplicateIds = identities.filter((item, index) => identities.findIndex(other => other.id === item.id) !== index)
  const duplicateKeys = identities.filter((item, index) => identities.findIndex(other => other.key === item.key) !== index)
  if (duplicateIds.length) errors.push(`Powtórzone ID w stagingu: ${unique(duplicateIds.map(x => x.id)).join(', ')}`)
  if (duplicateKeys.length) errors.push(`Powtórzone typ+numer w stagingu: ${unique(duplicateKeys.map(x => x.key)).join(', ')}`)

  const existingDevices = production.devices ?? []
  const existingNumbers = production.deviceNumbers ?? []
  const existingObjects = production.objects ?? []
  const collisions = []
  for (const item of identities) {
    if (existingDevices.some(row => row.id === item.id)) collisions.push(`Istnieje dokument devices/${item.id}.`)
    const sameIdentity = existingDevices.find(row => row.type === item.type && String(row.number).trim().toUpperCase() === item.number)
    if (sameIdentity) collisions.push(`Typ i numer ${item.type} ${item.number} istnieje jako devices/${sameIdentity.id}.`)
    const reservation = existingNumbers.find(row => row.id === item.key)
    if (reservation) collisions.push(`Istnieje rezerwacja deviceNumbers/${item.key} dla ${reservation.deviceId ?? 'nieznanego ID'}.`)
  }
  if (collisions.length) errors.push(...collisions)

  const rows = devices.map(device => {
    const id = identity(device)
    const expected = expectedMaps(device.location)
    const template = templates.get(device.sourceId)
    const photos = localPhotos.filter(photo => photo.deviceId === device.sourceId || (id && photo.deviceId === id.id))
    const primary = photos.filter(photo => photo.primary === true)
    const blockers = [
      ...(device.missing ?? []), ...(device.modelBlockers ?? []), ...(device.globalBlockers ?? []), ...(device.decisions ?? []),
    ]
    if (!id) blockers.push('Brak potwierdzonego numeru i docelowego ID.')
    if (!allowedTypes.has(device.type)) blockers.push(`Nieobsługiwany typ: ${device.type}`)
    if (id && id.id !== id.key) blockers.push(`ID ${id.id} nie odpowiada typowi i numerowi (${id.key}).`)
    if (id && !/^[0-9][A-Z0-9-]{0,31}$/.test(id.number)) blockers.push(`Nieprawidłowy numer: ${id.number}`)
    if (expected !== (device.googleMaps === 'do ustalenia' ? null : device.googleMaps)) blockers.push('Link Google Maps nie odpowiada współrzędnym.')
    if (Array.isArray(device.location) && (device.location.length !== 2 || Math.abs(device.location[0]) > 90 || Math.abs(device.location[1]) > 180)) blockers.push('Nieprawidłowe współrzędne GPS.')
    if (device.proposedStatus && !allowedStatuses.has(device.proposedStatus)) blockers.push(`Nieprawidłowy status: ${device.proposedStatus}`)
    if (!device.statusMappingApproved) blockers.push('Mapowanie statusu nie zostało zatwierdzone.')
    if (!template?.executable) blockers.push('Brak wykonywalnego szablonu dokumentów Firestore.')
    if (photos.some(photo => photo.uploadAllowed !== true && photo.origin !== 'repository')) blockers.push('Co najmniej jedno zdjęcie nie ma zgody uploadAllowed=true.')
    if (photos.length && primary.length !== 1) blockers.push(`Wymagane jedno zdjęcie główne; wskazano ${primary.length}.`)
    for (const photo of photos.filter(photo => photo.uploadAllowed === true)) {
      if (!photo.proposedObjectPath?.startsWith(`devices/${id?.id}/`)) blockers.push(`Nieprawidłowa ścieżka Storage: ${photo.path}`)
      if (existingObjects.some(object => object.name === photo.proposedObjectPath)) blockers.push(`Obiekt Storage już istnieje: ${photo.proposedObjectPath}`)
    }
    return {
      sourceId: device.sourceId,
      id: id?.id ?? null,
      type: device.type,
      number: id?.number ?? 'do ustalenia',
      guardian: display(device.guardian),
      rewir: display(device.rewir),
      location: Array.isArray(device.location) ? device.location : null,
      googleMaps: expected,
      conditionScore: typeof device.conditionScore === 'number' ? device.conditionScore : null,
      conditionLabel: device.conditionLabel ?? null,
      description: device.description ?? '',
      defects: device.defects ?? [],
      recommendations: device.repairs ?? [],
      photoCount: photos.length,
      primaryPhoto: primary[0]?.path ?? null,
      photoStatuses: Object.fromEntries([...new Set(photos.map(photo => photo.state ?? 'do ustalenia'))].map(status => [status, photos.filter(photo => (photo.state ?? 'do ustalenia') === status).length])),
      blockers: unique(blockers),
      template: template ?? null,
      photos,
    }
  })

  const unassignedPhotos = localPhotos.filter(photo => !photo.deviceId)
  if (unassignedPhotos.length) warnings.push(`${unassignedPhotos.length} zdjęcia nie są przypisane do urządzenia.`)
  const duplicatePhotoHashes = [...new Set(localPhotos.map(photo => photo.sha256))]
    .map(sha256 => localPhotos.filter(photo => photo.sha256 === sha256))
    .filter(group => group.length > 1)
    .map(group => ({ sha256: group[0].sha256, paths: group.map(photo => photo.path) }))

  const summary = {
    deviceCount: rows.length,
    types: Object.fromEntries([...allowedTypes].map(type => [type, rows.filter(row => row.type === type).length])),
    photoReferences: rows.reduce((sum, row) => sum + row.photoCount, 0),
    distinctPhotoFiles: new Set(rows.flatMap(row => row.photos.map(photo => photo.sha256))).size,
    unassignedPhotos: unassignedPhotos.length,
    devicesWithGps: rows.filter(row => row.location).length,
    devicesWithoutGps: rows.filter(row => !row.location).map(row => row.sourceId),
    confirmedIdentities: rows.filter(row => row.id).length,
    unresolvedIdentities: rows.filter(row => !row.id).map(row => row.sourceId),
    existingDeviceCount: existingDevices.length,
    existingStorageObjects: existingObjects.length,
    collisionCount: collisions.length,
    blockedDeviceCount: rows.filter(row => row.blockers.length).length,
  }
  const input = {
    stagingSha256: digest(staging), photoPlanSha256: digest(photoPlan),
    productionSnapshotSha256: digest({ devices: existingDevices, deviceNumbers: existingNumbers, objects: existingObjects }),
  }
  const result = {
    schema: 1, project: production.project, bucket: production.bucket, generatedAt: new Date().toISOString(),
    input, summary, errors: unique(errors), warnings, duplicatePhotoHashes, unassignedPhotos: unassignedPhotos.map(photo => photo.path), rows,
  }
  result.readyForApply = result.errors.length === 0 && summary.deviceCount === 21 && summary.blockedDeviceCount === 0 && summary.collisionCount === 0
  result.manifestSha256 = digest({ ...result, generatedAt: undefined, manifestSha256: undefined })
  return result
}

function markdown(report) {
  const lines = [
    '# Dry-run importu urządzeń', '',
    `- Projekt: \`${report.project}\``, `- Bucket: \`${report.bucket}\``,
    `- Manifest SHA-256: \`${report.manifestSha256}\``,
    `- Gotowy do apply: **${report.readyForApply ? 'TAK' : 'NIE'}**`,
    `- Urządzenia: ${report.summary.deviceCount}; zdjęcia przypisane: ${report.summary.photoReferences}; unikalne pliki: ${report.summary.distinctPhotoFiles}; GPS: ${report.summary.devicesWithGps}/${report.summary.deviceCount}.`, '',
    '## Urządzenia', '',
    '| ID źródłowe | Typ | Numer | Opiekun | Rewir | GPS / Maps | Ocena | Zdjęcia | Główne | Blokady |',
    '|---|---|---|---|---|---|---:|---:|---|---|',
    ...report.rows.map(row => `| ${row.sourceId} | ${row.type} | ${row.number} | ${row.guardian} | ${row.rewir} | ${row.location ? `${row.location.join(', ')} · ${row.googleMaps}` : 'do ustalenia'} | ${row.conditionScore ?? row.conditionLabel ?? 'do ustalenia'} | ${row.photoCount} | ${row.primaryPhoto ?? 'do ustalenia'} | ${row.blockers.join('; ') || 'brak'} |`),
    '', '## Błędy globalne', '', ...(report.errors.length ? report.errors.map(item => `- ${item}`) : ['- brak']),
    '', '## Opisy, usterki i zalecenia', '',
    ...report.rows.flatMap(row => [`### ${row.sourceId}`, '', `Opis: ${row.description || 'do ustalenia'}`, '', `Usterki: ${row.defects.length ? row.defects.join('; ') : 'do ustalenia'}`, '', `Zalecenia: ${row.recommendations.length ? row.recommendations.join('; ') : 'do ustalenia'}`, '']),
    '', '## Ostrzeżenia', '', ...(report.warnings.length ? report.warnings.map(item => `- ${item}`) : ['- brak']), '',
  ]
  return lines.join('\n')
}

async function firebaseToken(project) {
  const require = createRequire(import.meta.url)
  const auth = require('../node_modules/firebase-tools/lib/auth.js')
  const { requireAuth } = require('../node_modules/firebase-tools/lib/requireAuth.js')
  const apiv2 = require('../node_modules/firebase-tools/lib/apiv2.js')
  const account = auth.getGlobalDefaultAccount()
  if (!account) throw new Error('Brak zalogowanej sesji Firebase CLI.')
  await requireAuth({ project, nonInteractive: true, cwd: process.cwd(), ...account })
  return { token: await apiv2.getAccessToken(), email: account.user.email }
}

function decodeValue(value) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('geoPointValue' in value) return [value.geoPointValue.latitude, value.geoPointValue.longitude]
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decodeValue(item)]))
  return undefined
}
const decodeDocument = document => ({ id: document.name.split('/').at(-1), path: document.name.split('/documents/')[1], updateTime: document.updateTime, ...Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeValue(value)])) })

async function api(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) }, signal: AbortSignal.timeout(60000) })
  if (!response.ok) {
    const body = await response.text()
    const error = new Error(`HTTP ${response.status} ${new URL(url).pathname}: ${body.slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return response.status === 204 ? null : response.json()
}

async function listCollection(project, collection, token) {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}`
  const rows = []; let pageToken
  do {
    const page = await api(`${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token)
    rows.push(...(page.documents ?? []).map(decodeDocument)); pageToken = page.nextPageToken
  } while (pageToken)
  return rows
}

async function productionSnapshot(project, bucket, token) {
  const [devices, deviceNumbers, bucketInfo] = await Promise.all([
    listCollection(project, 'devices', token), listCollection(project, 'deviceNumbers', token),
    api(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`, token),
  ])
  const objects = []; let pageToken
  do {
    const page = await api(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=devices%2F${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token)
    objects.push(...(page.items ?? []).map(item => ({ name: item.name, size: Number(item.size), md5Hash: item.md5Hash, generation: item.generation })))
    pageToken = page.nextPageToken
  } while (pageToken)
  return { project, bucket: bucketInfo.name, bucketLocation: bucketInfo.location, devices, deviceNumbers, objects }
}

function bind(value, bindings, transforms, prefix = '') {
  if (Array.isArray(value)) return value.map((item, index) => bind(item, bindings, transforms, `${prefix}.${index}`))
  if (!value || typeof value !== 'object') return value
  if (value.$bind) {
    if (!(value.$bind in bindings)) throw new Error(`Brak wartości wiązania ${value.$bind}`)
    return bindings[value.$bind]
  }
  if (value.$firestore === 'serverTimestamp') { transforms.push(prefix); return undefined }
  if (value.$firestore === 'Timestamp') return { __timestamp: value.iso }
  if (value.$firestore === 'GeoPoint') return { __geo: [value.latitude, value.longitude] }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bind(item, bindings, transforms, prefix ? `${prefix}.${key}` : key)]).filter(([, item]) => item !== undefined))
}

function encodeValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (value?.__timestamp) return { timestampValue: value.__timestamp }
  if (value?.__geo) return { geoPointValue: { latitude: value.__geo[0], longitude: value.__geo[1] } }
  if (value && typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  throw new Error(`Nieobsługiwana wartość Firestore: ${typeof value}`)
}
const encodeFields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encodeValue(value)]))

function plannedWrites(row, report, bindings) {
  const template = row.template
  if (!template?.executable) throw new Error(`Szablon ${row.sourceId} nie jest wykonywalny.`)
  const photos = row.photos.filter(photo => photo.uploadAllowed === true || photo.origin === 'repository')
  const primary = photos.find(photo => photo.primary === true)
  const paths = photos.map(photo => photo.origin === 'repository' ? `/${photo.path.replace(/^public\//, '')}` : photo.proposedObjectPath)
  const media = photos.map(photo => ({
    documentPath: `devices/${row.id}/media/${photo.mediaDocumentId}`,
    data: {
      ...(photo.mediaTemplate ?? {}), path: photo.origin === 'repository' ? `/${photo.path.replace(/^public\//, '')}` : photo.proposedObjectPath,
      storageProvider: photo.origin === 'repository' ? 'public' : 'firebase_storage', photoStatus: photo.state === 'aktualne' || photo.state === 'archiwalne' ? photo.state : null,
      isCurrent: photo === primary, replacedBy: null, hidden: false,
    },
  }))
  const operations = [template.device, template.inspection, ...(template.issues ?? []), ...media]
  operations[0] = { ...operations[0], data: { ...operations[0].data, guardianName: row.guardian, rewir: row.rewir === 'do ustalenia' ? null : row.rewir, description: row.description, defects: row.defects, recommendations: row.recommendations, googleMaps: row.googleMaps, photoPaths: paths, primaryPhotoPath: primary ? paths[photos.indexOf(primary)] : null, currentPhotoId: primary?.mediaDocumentId ?? null } }
  return operations.map(operation => {
    const transforms = []
    const data = bind(operation.data, bindings, transforms)
    const name = `projects/${report.project}/databases/(default)/documents/${operation.documentPath}`
    return { update: { name, fields: encodeFields(data) }, currentDocument: { exists: false }, ...(transforms.length ? { updateTransforms: transforms.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}) }
  })
}

async function uploadObject({ bucket, token, item, file }) {
  const bytes = await fs.readFile(file)
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: item.proposedObjectPath, metadata: { sha256: item.sha256 } })], { type: 'application/json' }))
  form.append('file', new Blob([bytes], { type: item.contentType ?? (file.endsWith('.webp') ? 'image/webp' : 'image/jpeg') }))
  return api(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&ifGenerationMatch=0`, token, { method: 'POST', body: form })
}

async function apply(report, options, token, root) {
  if (!report.readyForApply) throw new Error('Manifest dry-run nie jest gotowy do apply.')
  if (options.approval !== REQUIRED_APPROVAL) throw new Error(`Wymagane potwierdzenie: ${REQUIRED_APPROVAL}`)
  if (options.manifestSha256 !== report.manifestSha256) throw new Error('Hash manifestu nie zgadza się z zatwierdzonym hashem.')
  if (!options.operatorUid) throw new Error('Wymagany --operator-uid.')
  const bindings = { authenticatedImportUid: options.operatorUid, ...(options.bindings ? JSON.parse(await fs.readFile(path.resolve(root, options.bindings), 'utf8')) : {}) }
  const checkpointFile = path.resolve(root, options.checkpoint)
  const checkpoint = await fs.readFile(checkpointFile, 'utf8').then(JSON.parse).catch(() => ({ manifestSha256: report.manifestSha256, objects: [], devices: [] }))
  if (checkpoint.manifestSha256 !== report.manifestSha256) throw new Error('Checkpoint należy do innego manifestu.')
  const logFile = path.resolve(root, options.log)
  const log = async entry => fs.appendFile(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
  for (const row of report.rows) {
    for (const item of row.photos.filter(photo => photo.uploadAllowed === true && photo.origin !== 'repository')) {
      if (checkpoint.objects.includes(item.proposedObjectPath)) continue
      const file = resolvePhotoPath(root, item); const actual = await fileHashes(file)
      if (actual.sha256 !== item.sha256 || actual.md5 !== item.actualMd5) throw new Error(`Plik zmienił się od dry-run: ${item.path}`)
      try { await uploadObject({ bucket: report.bucket, token, item, file }); await log({ action: 'upload', status: 'created', object: item.proposedObjectPath }) }
      catch (error) {
        if (error.status !== 412) throw error
        const existing = await api(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(report.bucket)}/o/${encodeURIComponent(item.proposedObjectPath)}`, token)
        if (existing.md5Hash !== actual.md5 || Number(existing.size) !== actual.bytes) throw new Error(`Istniejący obiekt ma inną treść: ${item.proposedObjectPath}`)
        await log({ action: 'upload', status: 'resumed', object: item.proposedObjectPath })
      }
      checkpoint.objects.push(item.proposedObjectPath); await fs.writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`)
    }
    if (checkpoint.devices.includes(row.id)) continue
    const writes = plannedWrites(row, report, bindings)
    await api(`https://firestore.googleapis.com/v1/projects/${report.project}/databases/(default)/documents:commit`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) })
    checkpoint.devices.push(row.id); await fs.writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`)
    await log({ action: 'firestore-device', status: 'created', deviceId: row.id, writes: writes.length })
  }
  return checkpoint
}

function parseArgs(argv) {
  const mode = argv[0], options = { ...defaults }
  const aliases = { '--staging': 'staging', '--photos': 'photos', '--report': 'report', '--markdown': 'markdown', '--log': 'log', '--checkpoint': 'checkpoint', '--project': 'project', '--bucket': 'bucket', '--confirm-project': 'confirmProject', '--approval': 'approval', '--manifest-sha256': 'manifestSha256', '--operator-uid': 'operatorUid', '--bindings': 'bindings' }
  for (let index = 1; index < argv.length; index += 2) {
    const key = aliases[argv[index]]; if (!key || argv[index + 1] === undefined) throw new Error(`Nieprawidłowy argument: ${argv[index]}`)
    options[key] = argv[index + 1]
  }
  if (!['dry-run', 'apply'].includes(mode)) throw new Error('Użycie: node scripts/device-import.mjs dry-run|apply --project PROJECT --confirm-project PROJECT --bucket BUCKET')
  if (!options.project || options.confirmProject !== options.project || options.project.startsWith('demo-')) throw new Error('Wymagane zgodne --project i --confirm-project dla produkcji.')
  if (!options.bucket) throw new Error('Wymagany --bucket.')
  return { mode, options }
}

export async function run(argv, root = process.cwd()) {
  const { mode, options } = parseArgs(argv)
  const { token, email } = await firebaseToken(options.project)
  const staging = JSON.parse(await fs.readFile(path.resolve(root, options.staging), 'utf8'))
  const photoPlan = JSON.parse(await fs.readFile(path.resolve(root, options.photos), 'utf8'))
  if (mode === 'dry-run') {
    const production = await productionSnapshot(options.project, options.bucket, token)
    const report = await analyzeStaging({ root, staging, photoPlan, production })
    await fs.writeFile(path.resolve(root, options.report), `${JSON.stringify(report, null, 2)}\n`)
    await fs.writeFile(path.resolve(root, options.markdown), `${markdown(report)}\n`)
    console.log(JSON.stringify({ authenticatedAs: email, readyForApply: report.readyForApply, manifestSha256: report.manifestSha256, summary: report.summary, report: options.report, markdown: options.markdown }, null, 2))
    if (!report.readyForApply) process.exitCode = 2
    return report
  }
  const report = JSON.parse(await fs.readFile(path.resolve(root, options.report), 'utf8'))
  const claimedHash = report.manifestSha256
  if (digest({ ...report, generatedAt: undefined, manifestSha256: undefined }) !== claimedHash) throw new Error('Plik manifestu został zmieniony od dry-run.')
  const fresh = await productionSnapshot(options.project, options.bucket, token)
  if (digest({ devices: fresh.devices, deviceNumbers: fresh.deviceNumbers, objects: fresh.objects }) !== report.input.productionSnapshotSha256) throw new Error('Stan Firestore lub Storage zmienił się od dry-run. Uruchom dry-run ponownie.')
  const result = await apply(report, options, token, root)
  console.log(JSON.stringify({ status: 'applied', ...result }, null, 2))
  return result
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
