// Te testy pilnują kontraktu pliku reguł bez udawania emulatora.
import { describe, expect, it } from 'vitest'
import rules from '../../firestore.rules?raw'

describe('statyczny kontrakt firestore.rules', () => {
  it('wymaga uwierzytelnienia i aktywnego użytkownika', () => {
    expect(rules).toContain('request.auth != null')
    expect(rules).toContain("get(memberPath()).data.active == true")
  })
  it('blokuje samodzielną zmianę authorizedUsers i roli', () => {
    expect(rules).toMatch(/match \/authorizedUsers\/\{email\}[\s\S]*?allow write: if false/)
  })
  it('wiąże komentarz z UID, nazwą i czasem żądania', () => {
    expect(rules).toContain('request.resource.data.authorUid == request.auth.uid')
    expect(rules).toContain('request.resource.data.authorName == member().displayName')
    expect(rules).toContain('request.resource.data.createdAt == request.time')
  })
  it('chroni pola komentarza podczas moderacji', () => {
    expect(rules).toContain("affectedKeys().hasOnly(['status','convertedToIssueId','moderatedAt','moderatedBy'])")
  })
  it('blokuje fizyczne usuwanie i modyfikację historii', () => {
    expect(rules).toContain('allow update, delete: if false;')
    expect(rules.match(/allow delete: if false/g)?.length).toBeGreaterThanOrEqual(4)
  })
  it('chroni historyczne pola mediów', () => {
    expect(rules).toContain("affectedKeys().hasOnly(['isCurrent','replacedBy','hidden'])")
  })
  it('wymusza UID i serverTimestamp w zapisach administratora', () => {
    expect(rules).toContain('data.createdBy == request.auth.uid')
    expect(rules).toContain('data.updatedAt == request.time')
    expect(rules).toContain('request.resource.data.uploadedAt == request.time')
  })
})
