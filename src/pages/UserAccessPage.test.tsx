import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { UserAccessPage } from './UserAccessPage'
const mocks = vi.hoisted(() => ({ auth:vi.fn(), watch:vi.fn(), review:vi.fn() }))
vi.mock('../auth/useAuth',()=>({useAuth:mocks.auth}))
vi.mock('../auth/accessRequests',()=>({watchPendingRequests:mocks.watch,reviewAccessRequest:mocks.review}))
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue({role:'admin',user:{uid:'admin'}});mocks.watch.mockImplementation(next=>{next([{uid:'u',email:'test@example.test',displayName:'Test Google',requestedAt:{toDate:()=>new Date('2026-10-10T12:00:00Z')}}]);return()=>{}});mocks.review.mockResolvedValue(undefined)})
it('pokazuje wniosek i zatwierdza wyłącznie jako member',async()=>{render(<MemoryRouter><UserAccessPage/></MemoryRouter>);expect(screen.getByText('test@example.test')).toBeInTheDocument();fireEvent.click(screen.getByText('Zatwierdź jako member'));await waitFor(()=>expect(mocks.review).toHaveBeenCalledWith('u','approved','admin'));expect(screen.queryByText('Zatwierdź jako admin')).not.toBeInTheDocument()})
it('odrzuca wniosek',async()=>{render(<MemoryRouter><UserAccessPage/></MemoryRouter>);fireEvent.click(screen.getByText('Odrzuć'));await waitFor(()=>expect(mocks.review).toHaveBeenCalledWith('u','rejected','admin'))})
it('członek nie pobiera wniosków i nie widzi przycisków',()=>{mocks.auth.mockReturnValue({role:'member',user:{uid:'member'}});render(<MemoryRouter><UserAccessPage/></MemoryRouter>);expect(mocks.watch).not.toHaveBeenCalled();expect(screen.queryByText('Zatwierdź jako member')).not.toBeInTheDocument()})
