import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { CircleMembersPage } from './CircleMembersPage'
import { sortMembers } from '../members/directory'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: mocks.auth }))
vi.mock('../members/directory', async importOriginal => ({ ...await importOriginal<typeof import('../members/directory')>(), loadCircleMembers: mocks.load }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockReturnValue({ loading: false, isActiveMember: true })
  mocks.load.mockResolvedValue(sortMembers(Array.from({ length: 45 }, (_, i) => ({ firstName: i === 0 ? 'Łukasz' : `Jan${i}`, lastName: i < 2 ? 'Żak' : `Testowy${i}` }))))
})
function view() {
  return render(<MemoryRouter initialEntries={['/panel/czlonkowie']}><Routes><Route element={<ProtectedRoute />}><Route path="/panel/czlonkowie" element={<CircleMembersPage />} /></Route><Route path="/logowanie" element={<h1>Logowanie</h1>} /></Routes></MemoryRouter>)
}
it('aktywny członek widzi 45 osób, wspólne nazwiska i wyszukuje imię lub nazwisko', async () => {
  view()
  await screen.findByText('Wyświetlono 45 z 45 osób.')
  expect(within(screen.getByRole('list', { name: 'Członkowie koła' })).getAllByRole('listitem')).toHaveLength(45)
  fireEvent.change(screen.getByLabelText('Szukaj po imieniu lub nazwisku'), { target: { value: 'zak' } })
  expect(screen.getByText('Łukasz Żak')).toBeInTheDocument()
  expect(screen.getByText('Jan1 Żak')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Szukaj po imieniu lub nazwisku'), { target: { value: 'LUKASZ' } })
  expect(screen.getByText('Wyświetlono 1 z 45 osób.')).toBeInTheDocument()
})
it.each(['bez logowania', 'nieaktywny użytkownik'])('%s nie pobiera ani nie widzi listy', () => {
  mocks.auth.mockReturnValue({ loading: false, isActiveMember: false })
  view()
  expect(screen.getByRole('heading', { name: 'Logowanie' })).toBeInTheDocument()
  expect(mocks.load).not.toHaveBeenCalled()
})
it('sortuje według polskiego alfabetu, nazwiska i pierwszego imienia', () => {
  expect(sortMembers([{ firstName: 'Jan', lastName: 'Żak' }, { firstName: 'Jan', lastName: 'Łącki' }, { firstName: 'Adam', lastName: 'Łącki' }, { firstName: 'Anna', lastName: 'Lis' }])).toEqual([{ firstName: 'Anna', lastName: 'Lis' }, { firstName: 'Adam', lastName: 'Łącki' }, { firstName: 'Jan', lastName: 'Łącki' }, { firstName: 'Jan', lastName: 'Żak' }])
})
it('błąd odczytu nie ujawnia danych', async () => {
  mocks.load.mockRejectedValue(new Error('permission-denied'))
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})
