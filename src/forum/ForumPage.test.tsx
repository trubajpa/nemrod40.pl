import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ForumPage } from './ForumPage'
import { PostForm } from './ForumForm'
import { ProtectedRoute } from '../auth/ProtectedRoute'

const mocks = vi.hoisted(() => ({
  role: 'member', active: true, user: { uid: 'test-member' },
  subscribe: vi.fn(), getAuthor: vi.fn(), moderate: vi.fn(), publish: vi.fn(),
}))
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ role: mocks.role, isActiveMember: mocks.active, loading: false, user: mocks.user, profile: { displayName: 'Test Member' } }) }))
vi.mock('./forumRepository', () => ({ subscribeForum: mocks.subscribe, getAuthor: mocks.getAuthor, moderatePost: mocks.moderate, createTopic: vi.fn(), addReply: vi.fn(), addComment: vi.fn() }))
const base = { id: 'topic', path: 'forumTopics/topic', body: 'Topic body', signature: 'Pseudonym', pseudonym: true, createdAt: 1000 }
const topic = { ...base, title: 'Production forum', answers: [{ ...base, id: 'reply', path: `${base.path}/replies/reply`, body: 'Reply body', comments: [{ ...base, id: 'comment', path: `${base.path}/replies/reply/comments/comment`, body: 'Last level comment' }] }] }
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = 'member'; mocks.active = true
  mocks.subscribe.mockImplementation(callback => { callback([topic]); return () => {} })
  mocks.moderate.mockResolvedValue(undefined)
  mocks.getAuthor.mockResolvedValue({ uid: 'private-uid', name: 'Private Author', email: 'private@example.test' })
})
afterEach(() => vi.restoreAllMocks())

it('requires actual active membership; anonymous visitors do not subscribe to forum', () => {
  mocks.active = false
  render(<MemoryRouter initialEntries={['/forum']}><Routes><Route element={<ProtectedRoute />}><Route path="/forum" element={<ForumPage />} /></Route><Route path="/logowanie" element={<p>Login required</p>} /></Routes></MemoryRouter>)
  expect(screen.getByText('Login required')).toBeInTheDocument()
  expect(mocks.subscribe).not.toHaveBeenCalled()
})
it('never retrieves identity for a member and only offers comments on direct replies', async () => {
  render(<MemoryRouter initialEntries={['/forum/topic']}><Routes><Route path="/forum/:topicId" element={<ForumPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('Last level comment')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Skomentuj' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Ustal autora' })).not.toBeInTheDocument()
  expect(mocks.getAuthor).not.toHaveBeenCalled()
  expect(screen.queryByText(/Private Author/)).not.toBeInTheDocument()
  expect(screen.queryByText(/demonstracyjna/)).not.toBeInTheDocument()
})
it('reads identity only when an administrator requests it', async () => {
  mocks.role = 'admin'
  render(<MemoryRouter initialEntries={['/forum/topic']}><Routes><Route path="/forum/:topicId" element={<ForumPage />} /></Routes></MemoryRouter>)
  expect(mocks.getAuthor).not.toHaveBeenCalled()
  fireEvent.click((await screen.findAllByRole('button', { name: 'Ustal autora' }))[0])
  expect(await screen.findByText(/Private Author/)).toBeInTheDocument()
  expect(mocks.getAuthor).toHaveBeenCalledWith(expect.objectContaining({ path: base.path }))
})
it('requires confirmation before moderating a reply and its entire subtree', async () => {
  mocks.role = 'admin'
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<MemoryRouter initialEntries={['/forum/topic']}><Routes><Route path="/forum/:topicId" element={<ForumPage />} /></Routes></MemoryRouter>)
  const reply = (await screen.findByText('Reply body')).closest('article')!
  const remove = within(reply).getAllByRole('button', { name: 'Usuń' })[0]
  fireEvent.click(remove); expect(mocks.moderate).not.toHaveBeenCalled()
  confirmation.mockReturnValue(true); fireEvent.click(remove)
  await waitFor(() => expect(mocks.moderate).toHaveBeenCalledWith(expect.objectContaining({ id: 'reply' })))
  expect(confirmation).toHaveBeenCalledWith('Usunąć odpowiedź wraz ze wszystkimi jej komentarzami?')
})
it('preserves drafts when Firestore publication fails, with pseudonym disclosure', async () => {
  mocks.publish.mockRejectedValue(Error('permission-denied'))
  render(<PostForm profileName="Test Member" label="Publikuj" topic onPublish={mocks.publish} />)
  fireEvent.change(screen.getByLabelText('Tytuł'), { target: { value: 'Real topic' } })
  fireEvent.change(screen.getByLabelText('Treść'), { target: { value: 'Keep my draft' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Pseudonim' }))
  fireEvent.change(screen.getByLabelText('Twój pseudonim'), { target: { value: 'Forest' } })
  expect(screen.getByText('Publikujesz pod pseudonimem. Administrator może ustalić autora wpisu')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publikuj' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Treść pozostała w formularzu')
  expect(screen.getByLabelText('Treść')).toHaveValue('Keep my draft')
  expect(mocks.publish).toHaveBeenCalledWith({ body: 'Keep my draft', signature: 'Forest', pseudonym: true }, 'Real topic')
})
