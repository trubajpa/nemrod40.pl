import { doc, getDocFromServer } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface CircleMember { firstName: string; lastName: string }
const collator = new Intl.Collator('pl')
export function sortMembers(members: CircleMember[]) {
  return [...members].sort((a, b) => collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName))
}
export function searchName(value: string) {
  return value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/g, 'l').trim()
}
export async function loadCircleMembers(): Promise<CircleMember[]> {
  if (!db) throw new Error('Brak połączenia z bazą danych.')
  const snapshot = await getDocFromServer(doc(db, 'circleMembers', 'current'))
  const members: unknown = snapshot.data()?.members
  if (!Array.isArray(members) || members.length !== 45 || members.some(person =>
    !person || typeof person.firstName !== 'string' || typeof person.lastName !== 'string'
    || !person.firstName.trim() || !person.lastName.trim())) {
    throw new Error('Lista członków jest chwilowo niedostępna.')
  }
  return sortMembers(members.map(({ firstName, lastName }) => ({ firstName, lastName })))
}
