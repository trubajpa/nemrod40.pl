import { describe, expect, it } from 'vitest'
import { DEFAULT_FIREBASE_AUTH_DOMAIN } from './firebaseConfig'

describe('Firebase config', () => {
  it('używa właściwej domyślnej domeny Authentication', () => {
    expect(DEFAULT_FIREBASE_AUTH_DOMAIN).toBe('nemrod40pl.firebaseapp.com')
  })
})
