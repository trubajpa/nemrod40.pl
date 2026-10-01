import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { analyzeStaging, fileHashes, resolvePhotoPath, REQUIRED_APPROVAL } from './device-import.mjs'

const temporary = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))) })

describe('device import safety', () => {
  it('requires the exact production approval phrase', () => {
    expect(REQUIRED_APPROVAL).toBe('POTWIERDZAM IMPORT 21 URZĄDZEŃ, GPS I ZDJĘĆ')
  })

  it('rejects paths outside the workspace', () => {
    expect(() => resolvePhotoPath('C:/repo', { origin: 'repository', path: '../secret.jpg' })).toThrow('outside workspace')
  })

  it('keeps review-only staging blocked and reports collisions without writes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nemrod-import-')); temporary.push(root)
    const photoDirectory = path.join(root, '_import-local/ambony-2026-05/work/extracted/nemrod40-urzadzenia/a')
    await fs.mkdir(photoDirectory, { recursive: true }); const photoFile = path.join(photoDirectory, 'one.jpg'); await fs.writeFile(photoFile, 'photo'); const hashes = await fileHashes(photoFile)
    const staging = { mode: 'review-only', productionWritesAllowed: false, stagedDevices: [{ sourceId: 'a', proposedDocumentId: 'ambona-1', type: 'ambona', number: '1', numberConfirmed: true, guardian: 'do ustalenia', location: [51, 22], googleMaps: 'https://maps.google.com/?q=51,22', conditionScore: 3, proposedStatus: 'sprawne', statusMappingApproved: false, photos: [], missing: [], modelBlockers: [], globalBlockers: [], decisions: [] }], currentModelTemplates: [] }
    const photoPlan = { mode: 'plan-only', uploads: [], items: [{ origin: 'archive', path: 'a/one.jpg', deviceId: 'a', state: 'aktualne', sha256: hashes.sha256, bytes: hashes.bytes, uploadAllowed: false }] }
    const report = await analyzeStaging({ root, staging, photoPlan, production: { project: 'nemrod40pl', bucket: 'nemrod40pl.firebasestorage.app', devices: [{ id: 'ambona-1', type: 'ambona', number: '1' }], deviceNumbers: [], objects: [] } })
    expect(report.readyForApply).toBe(false)
    expect(report.summary.collisionCount).toBeGreaterThan(0)
    expect(report.rows[0].blockers).toContain('Mapowanie statusu nie zostało zatwierdzone.')
  })
})
