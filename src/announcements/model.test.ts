import { expect, it } from 'vitest'
import { archive, mergeArchive, normalizePublication } from './model'
it('zachowuje sześć aktualności, adresy i film oraz nie powiela zaimportowanych wpisów', () => {
  expect(archive).toHaveLength(6)
  expect(archive.some(item => item.video)).toBe(true)
  const imported = { ...archive[0], id: 'imported', subject: 'Nowa przyczepa transportowa' }
  expect(mergeArchive([imported], 'news')).toHaveLength(6)
  expect(mergeArchive([imported], 'news')[0].id).toBe('imported')
  expect(mergeArchive([], 'activity')).toHaveLength(0)
})
it('stare ogłoszenie jest prywatne i zachowuje identyfikator oraz datę', () => {
  const row = normalizePublication('old', { subject: 'Stary wpis', createdAt: { toMillis: () => 42 } })
  expect(row.id).toBe('old'); expect(row.createdAt).toBe(42)
  expect(row.publicStatus).toBe('private'); expect(row.placements).toEqual(['members'])
  expect(row.photos).toEqual([])
})
