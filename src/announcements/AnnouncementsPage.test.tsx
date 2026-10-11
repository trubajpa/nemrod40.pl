import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AnnouncementsPage } from './AnnouncementsPage'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), subscribe: vi.fn(), details: vi.fn(), create: vi.fn(), comment: vi.fn(), toggle: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: mocks.auth }))
vi.mock('./repository', () => ({ kinds: ['impreza', 'spotkanie', 'ustalenie', 'czyn', 'inne'], subscribeAnnouncements: mocks.subscribe, subscribeDetails: mocks.details, createAnnouncement: mocks.create, addAnnouncementComment: mocks.comment, toggleReaction: mocks.toggle }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockReturnValue({ user: { uid: 'member' }, profile: { displayName: 'Jan Testowy' }, isActiveMember: true, loading: false })
  mocks.subscribe.mockImplementation(next => { next([{ id: 'post', subject: 'Praca wspólna', body: 'Zapraszamy.', kind: 'czyn', authorName: 'Anna Testowa', createdAt: 1000 }]); return vi.fn() })
  mocks.details.mockImplementation((_id, comments, votes) => { comments([{ id: 'comment', body: 'Przyjdę.', authorName: 'Jan Testowy', createdAt: 1000 }]); votes([]); return vi.fn() })
  mocks.create.mockResolvedValue(undefined); mocks.comment.mockResolvedValue(undefined); mocks.toggle.mockResolvedValue(undefined)
})
function view() { return render(<MemoryRouter initialEntries={['/panel/ogloszenia']}><Routes><Route element={<ProtectedRoute />}><Route path="/panel/ogloszenia" element={<AnnouncementsPage />} /></Route><Route path="/logowanie" element={<h1>Logowanie</h1>} /></Routes></MemoryRouter>) }
it('publikuje temat, treść i rodzaj, pokazuje autora, datę i komentarz bez odpowiedzi', async () => {
  view()
  expect(screen.getByText('Anna Testowa')).toBeInTheDocument()
  expect(screen.getByText('1 komentarzy')).toBeInTheDocument()
  expect(screen.getByText('Przyjdę.')).toBeInTheDocument()
  expect(screen.queryByText('Dodaj odpowiedź')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Temat'), { target: { value: 'Ognisko' } })
  fireEvent.change(screen.getByLabelText('Treść'), { target: { value: 'Zapraszamy wszystkich.' } })
  fireEvent.change(screen.getByLabelText('Rodzaj'), { target: { value: 'impreza' } })
  fireEvent.click(screen.getByText('Opublikuj ogłoszenie'))
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('Ognisko', 'Zapraszamy wszystkich.', 'impreza', 'Jan Testowy'))
  fireEvent.change(screen.getByLabelText('Komentarz'), { target: { value: 'Będę.' } })
  fireEvent.click(screen.getByText('Dodaj komentarz'))
  await waitFor(() => expect(mocks.comment).toHaveBeenCalledWith('post', 'Będę.', 'Jan Testowy'))
})
it.each([['heart', 'Serduszko'], ['up', 'Kciuk w górę'], ['down', 'Kciuk w dół']])('dodaje i cofa reakcję %s, pokazując stan i licznik', async (type, label) => {
  let emit: (votes: { uid: string; type: string }[]) => void
  mocks.details.mockImplementation((_id, comments, votes) => { emit = votes; comments([]); votes([]); return vi.fn() })
  let selected = false
  mocks.toggle.mockImplementation(async () => { selected = !selected; emit(selected ? [{ uid: 'member', type }] : []) })
  view()
  const button = screen.getByRole('button', { name: label })
  fireEvent.click(button)
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  expect(button).toHaveTextContent('1')
  fireEvent.click(button)
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
  expect(button).toHaveTextContent('0')
  expect(mocks.toggle).toHaveBeenCalledTimes(2)
  expect(mocks.toggle).toHaveBeenCalledWith('post', type)
})
it('bez aktywnego dostępu nie odczytuje ogłoszeń', () => {
  mocks.auth.mockReturnValue({ user: null, isActiveMember: false, loading: false }); view()
  expect(screen.getByText('Logowanie')).toBeInTheDocument(); expect(mocks.subscribe).not.toHaveBeenCalled()
})
it('błąd zapisu komentarza zachowuje treść i pokazuje komunikat', async () => {
  mocks.comment.mockRejectedValue(new Error('permission-denied')); view()
  fireEvent.change(screen.getByLabelText('Komentarz'), { target: { value: 'Będę.' } }); fireEvent.click(screen.getByText('Dodaj komentarz'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać')
  expect(screen.getByLabelText('Komentarz')).toHaveValue('Będę.')
  expect(within(screen.getByRole('region', { name: 'Lista ogłoszeń' })).getByText('Przyjdę.')).toBeInTheDocument()
})
