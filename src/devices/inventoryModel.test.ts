import { describe, expect, it } from 'vitest'
import { GeoPoint, Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore'
import { deviceConverter, inspectionConverter } from './converters'
import { compareDeviceNumbers, deviceDocumentId, validDeviceNumber } from './deviceIdentity'
import { formatCondition, validateInventoryDates, validateScore } from './validation'

const timestamp = Timestamp.fromMillis(1000)
const base = { location: new GeoPoint(1, 1), createdAt: timestamp, updatedAt: timestamp, number: 4, conditionScore: 4 }
const snapshot = (data: Record<string, unknown>) => ({ id: 'legacy-random-id', data: () => data }) as unknown as QueryDocumentSnapshot

describe('zgodność modelu inwentaryzacji', () => {
  it('zachowuje brak GPS i oceny bez wymyślania zer',()=>{
    expect(deviceConverter.fromFirestore(snapshot({...base,location:null,googleMaps:null,conditionScore:null,description:'Opis źródłowy',rewir:null}),{})).toMatchObject({location:null,googleMaps:null,conditionScore:null,description:'Opis źródłowy',rewir:null})
    expect(formatCondition(null,'4+')).toBe('do ustalenia (4+)')
  })
  it('czyta stary numer liczbowy jako tekst bez zmiany ID i dat audytowych', () => {
    expect(deviceConverter.fromFirestore(snapshot(base), {})).toMatchObject({ id: 'legacy-random-id', number: '4', inspectionDate: null, inventoryUpdatedAt: null, conditionLabel: null, createdAt: timestamp, updatedAt: timestamp })
  })
  it('zachowuje numer z literą, ocenę 0, etykietę i osobne daty', () => {
    const date = Timestamp.fromDate(new Date('2026-05-08T22:00:00Z'))
    expect(deviceConverter.fromFirestore(snapshot({ ...base, number: '4A', conditionScore: 0, conditionLabel: '4+', inspectionDate: date, inventoryUpdatedAt: null }), {})).toMatchObject({ number: '4A', conditionScore: 0, conditionLabel: '4+', inspectionDate: date, inventoryUpdatedAt: null, updatedAt: timestamp })
    expect(inspectionConverter.fromFirestore(snapshot({ inspectionDate: date, createdAt: timestamp, conditionScore: 4.5, conditionLabel: '4+' }), {})).toMatchObject({ conditionScore: 4.5, conditionLabel: '4+' })
  })
  it('nadal odrzuca brak technicznego updatedAt', () => {
    expect(() => deviceConverter.fromFirestore(snapshot({ ...base, updatedAt: null }), {})).toThrow('invalid_device')
  })
  it('rozróżnia typy i numery z literami w identyfikatorze', () => {
    expect(deviceDocumentId('ambona', '31')).toBe('ambona-31')
    expect(deviceDocumentId('pasnik', '31')).toBe('pasnik-31')
    expect(deviceDocumentId('ambona', ' 4a ')).toBe('ambona-4a')
    expect(deviceDocumentId('ambona', '4B')).toBe('ambona-4b')
    for (const value of ['', 'do ustalenia', '4/a', '../4', 'a'.repeat(33)]) expect(validDeviceNumber(value)).toBe(false)
  })
  it('sortuje naturalnie po przejściu ze starych liczb na tekst', () => {
    const items = ['11', '4B', '3', '4A', '4'].map(number => ({ number, type: 'ambona', id: number }))
    expect(items.sort(compareDeviceNumbers).map(x => x.number)).toEqual(['3', '4', '4A', '4B', '11'])
  })
  it('akceptuje wyłącznie skalę 0–5 co pół punktu', () => {
    for (let score = 0; score <= 5; score += 0.5) expect(validateScore(score)).toBe(true)
    for (const score of [-0.5, 5.5, 2.25, NaN, Infinity]) expect(validateScore(score)).toBe(false)
    expect(formatCondition(4.5, '4+')).toBe('4,5/5 (4+)')
  })
  it('nie wymaga biznesowej aktualizacji i odrzuca nieprawidłowe daty', () => {
    expect(validateInventoryDates({})).toEqual({})
    expect(validateInventoryDates({ inventoryUpdatedAt: null })).toEqual({})
    expect(validateInventoryDates({ inventoryUpdatedAt: new Date('invalid') })).toHaveProperty('inventoryUpdatedAt')
  })
})
