import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicationsFeed } from './PublicationsFeed'
import { archive, mergeArchive } from './model'
const subscribe = vi.hoisted(() => vi.fn())
vi.mock('./repository', () => ({ subscribePublications: subscribe }))
vi.mock('./PublicationPhoto', () => ({ PublicationPhoto: ({ alt }: { alt: string }) => <span>{alt}</span> }))
beforeEach(() => vi.clearAllMocks())
it('publiczny widok zachowuje sześć aktualności bez duplikatów, nie oferuje komentarzy ani reakcji', () => {
  subscribe.mockImplementation((_placement, _member, next) => { next(mergeArchive([{ ...archive[0], id: 'imported' }], 'news')); return vi.fn() })
  render(<MemoryRouter><PublicationsFeed placement="news" /></MemoryRouter>)
  expect(screen.getAllByRole('link')).toHaveLength(6)
  expect(screen.getByRole('link', { name: /Nowa przyczepa transportowa/ })).toHaveAttribute('href', '/aktualnosci/nowa-przyczepa-transportowa')
  expect(subscribe).toHaveBeenCalledWith('news', false, expect.any(Function), expect.any(Function))
  expect(screen.queryByRole('button', { name: 'Serduszko' })).not.toBeInTheDocument(); expect(screen.queryByLabelText('Komentarz')).not.toBeInTheDocument()
})
it('błąd bazy nie usuwa dotychczasowych publicznych treści', () => {
  subscribe.mockImplementation((_placement, _member, _next, error) => { error(); return vi.fn() })
  render(<MemoryRouter><PublicationsFeed placement="news" /></MemoryRouter>)
  expect(screen.getAllByRole('link')).toHaveLength(6)
  expect(screen.getByRole('status')).toHaveTextContent('Nowe wpisy są chwilowo niedostępne')
})
