import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AnnouncementsPage } from './AnnouncementsPage'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), subscribe: vi.fn(), details: vi.fn(), create: vi.fn(), approve: vi.fn(), comment: vi.fn(), toggle: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: mocks.auth }))
vi.mock('../devices/photoStorage', () => ({ photoStorageEnabled: true }))
vi.mock('./PublicationPhoto', () => ({ PublicationPhoto: () => null }))
vi.mock('./repository', () => ({ kinds: ['impreza', 'spotkanie', 'ustalenie', 'czyn', 'aktualność', 'inne'], subscribeAnnouncements: mocks.subscribe, subscribeDetails: mocks.details, createPublication: mocks.create, approvePublication: mocks.approve, addAnnouncementComment: mocks.comment, toggleReaction: mocks.toggle }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockReturnValue({ user: { uid: 'member' }, profile: { displayName: 'Jan Testowy' }, isActiveMember: true, loading: false, role: 'member' })
  mocks.subscribe.mockImplementation(next => { next([{ id: 'post', subject: 'Praca wspólna', body: 'Zapraszamy.', kind: 'czyn', authorName: 'Anna Testowa', createdAt: 1000, placements: ['members', 'news', 'activity'], publicStatus: 'pending', photos: [], mainPhoto: '', ready: true }]); return vi.fn() })
  mocks.details.mockImplementation((_id, comments, votes) => { comments([{ id: 'comment', body: 'Przyjdę.', authorName: 'Jan Testowy', createdAt: 1000 }]); votes([]); return vi.fn() })
  mocks.create.mockResolvedValue('new'); mocks.comment.mockResolvedValue(undefined); mocks.toggle.mockResolvedValue(undefined); mocks.approve.mockResolvedValue(undefined)
})
function view() { return render(<MemoryRouter initialEntries={['/panel/informacje']}><Routes><Route element={<ProtectedRoute />}><Route path="/panel/informacje" element={<AnnouncementsPage />} /></Route><Route path="/logowanie" element={<h1>Logowanie</h1>} /></Routes></MemoryRouter>) }
it('jeden formularz zapisuje wiele miejsc i jasno pokazuje oczekiwanie na zatwierdzenie', async () => {
  view()
  expect(screen.getByText(/Tylko dla zalogowanych —/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: 'Ognisko' } })
  fireEvent.change(screen.getByLabelText('Treść'), { target: { value: 'Zapraszamy wszystkich.' } })
  fireEvent.change(screen.getByLabelText('Typ'), { target: { value: 'aktualność' } })
  fireEvent.click(screen.getByLabelText('Aktualności')); fireEvent.click(screen.getByLabelText('Działalność'))
  expect(screen.getByText(/Do tego czasu wpis i zdjęcia/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Zapisz wpis'))
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('Ognisko', 'Zapraszamy wszystkich.', 'aktualność', 'Jan Testowy', ['members', 'news', 'activity'], [], 0))
  expect(await screen.findByText(/Wpis dostępny dla członków/)).toBeInTheDocument()
})
it('wybiera wiele zdjęć, zdjęcie główne i kolejność galerii', async () => {
  view()
  const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' }), b = new File(['b'], 'b.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText(/Zdjęcia \(maksymalnie/), { target: { files: [a, b] } })
  fireEvent.click(screen.getByRole('button', { name: 'Przesuń a.jpg później' }))
  fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: 'Galeria' } }); fireEvent.change(screen.getByLabelText('Treść'), { target: { value: 'Zdjęcia.' } }); fireEvent.click(screen.getByText('Zapisz wpis'))
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('Galeria', 'Zdjęcia.', 'inne', 'Jan Testowy', ['members'], [b, a], 1))
})
it('tylko administrator otrzymuje akcję zatwierdzenia obu publicznych miejsc', async () => {
  mocks.auth.mockReturnValue({ ...mocks.auth(), role: 'admin' }); view()
  fireEvent.click(screen.getByRole('button', { name: /Zatwierdź publikację publiczną: Aktualności, Działalność/ }))
  await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('post'))
})
it('członek dodaje komentarz bez odpowiedzi i nie ma akcji zatwierdzenia', async () => {
  view()
  expect(screen.queryByRole('button', { name: /Zatwierdź/ })).not.toBeInTheDocument()
  expect(screen.getByText('1 komentarzy')).toBeInTheDocument(); expect(screen.queryByText('Dodaj odpowiedź')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Komentarz'), { target: { value: 'Będę.' } }); fireEvent.click(screen.getByText('Dodaj komentarz'))
  await waitFor(() => expect(mocks.comment).toHaveBeenCalledWith('post', 'Będę.', 'Jan Testowy'))
})
it('dodaje i cofa serduszko oraz nie oferuje innych reakcji', async () => {
  let emit: (votes: { uid: string; type: string }[]) => void, selected = false
  mocks.details.mockImplementation((_id, comments, votes) => { emit = votes; comments([]); votes([]); return vi.fn() })
  mocks.toggle.mockImplementation(async () => { selected = !selected; emit(selected ? [{ uid: 'member', type: 'heart' }] : []) })
  view(); const button = screen.getByRole('button', { name: 'Serduszko' })
  fireEvent.click(button); await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  fireEvent.click(button); await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
  expect(mocks.toggle).toHaveBeenCalledTimes(2); expect(screen.queryByRole('button', { name: /Kciuk/ })).not.toBeInTheDocument()
})
it('bez aktywnego dostępu nie odczytuje wpisów', () => {
  mocks.auth.mockReturnValue({ user: null, isActiveMember: false, loading: false }); view()
  expect(screen.getByText('Logowanie')).toBeInTheDocument(); expect(mocks.subscribe).not.toHaveBeenCalled()
})
it('błąd komentarza zachowuje treść i pokazuje komunikat', async () => {
  mocks.comment.mockRejectedValue(new Error('permission-denied')); view()
  fireEvent.change(screen.getByLabelText('Komentarz'), { target: { value: 'Będę.' } }); fireEvent.click(screen.getByText('Dodaj komentarz'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać'); expect(screen.getByLabelText('Komentarz')).toHaveValue('Będę.')
})
