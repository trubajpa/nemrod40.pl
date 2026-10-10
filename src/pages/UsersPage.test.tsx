import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UsersPage } from './UsersPage'
const mocks=vi.hoisted(()=>({auth:vi.fn(),list:vi.fn(),change:vi.fn()}))
vi.mock('../auth/useAuth',()=>({useAuth:mocks.auth}))
vi.mock('../auth/userManagement',()=>({listUsersPage:mocks.list,changeUserAccess:mocks.change}))
const member={uid:'member',email:'member@example.test',displayName:'Jan Członek',role:'member',status:'active',lastSignInTime:'2026-10-10T10:00:00Z',disabled:false,authorizedUser:{active:true},accessRequest:null}
const applicant={...member,uid:'applicant',email:'waiting@example.test',displayName:'Anna Oczekująca',role:null,status:'pending',authorizedUser:null,accessRequest:{status:'pending',requestedAt:'2026-10-10T10:00:00Z'}}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue({role:'admin',user:{uid:'admin'}});mocks.list.mockResolvedValue({users:[member,applicant],nextPageToken:null});mocks.change.mockResolvedValue(undefined)})
const view=()=>render(<MemoryRouter><UsersPage/></MemoryRouter>)
it('łączy wszystkie strony backendu i wyszukuje oraz filtruje konta',async()=>{
 mocks.list.mockResolvedValueOnce({users:[member],nextPageToken:'next'}).mockResolvedValueOnce({users:[applicant],nextPageToken:null});view()
 await screen.findByText('Anna Oczekująca');expect(mocks.list).toHaveBeenNthCalledWith(2,'next')
 fireEvent.change(screen.getByLabelText('Szukaj po imieniu lub e-mailu'),{target:{value:'waiting@'}})
 expect(screen.queryByText('Jan Członek')).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Szukaj po imieniu lub e-mailu'),{target:{value:''}})
 fireEvent.change(screen.getByLabelText('Status'),{target:{value:'active'}})
 expect(screen.getByText('Jan Członek')).toBeInTheDocument();expect(screen.queryByText('Anna Oczekująca')).not.toBeInTheDocument()
})
it('zatwierdza jako member i zmienia rolę przez backend',async()=>{view();await screen.findByText('Anna Oczekująca');fireEvent.click(screen.getByText('Zatwierdź jako member'));await waitFor(()=>expect(mocks.change).toHaveBeenCalledWith({uid:'applicant',action:'approve'}));await screen.findByText('Zmień na admin');fireEvent.click(screen.getByText('Zmień na admin'));await waitFor(()=>expect(mocks.change).toHaveBeenCalledWith({uid:'member',action:'role',role:'admin'}))})
it('odebranie dostępu wymaga potwierdzenia, można anulować',async()=>{view();await screen.findByText('Jan Członek');fireEvent.click(screen.getByText('Odbierz dostęp'));expect(mocks.change).not.toHaveBeenCalled();fireEvent.click(within(screen.getByRole('dialog')).getByText('Anuluj'));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();fireEvent.click(screen.getByText('Odbierz dostęp'));fireEvent.click(screen.getByText('Potwierdź odebranie dostępu'));await waitFor(()=>expect(mocks.change).toHaveBeenCalledWith({uid:'member',action:'revoke',confirmed:true}))})
it('błąd ochrony ostatniego admina pozostaje widoczny',async()=>{mocks.change.mockRejectedValue(new Error('Ostatni aktywny administrator'));view();await screen.findByText('Jan Członek');fireEvent.click(screen.getByText('Odbierz dostęp'));fireEvent.click(screen.getByText('Potwierdź odebranie dostępu'));await waitFor(()=>expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Ostatni aktywny administrator'));expect(screen.getByRole('dialog')).toBeInTheDocument()})
it('członek nie pobiera listy kont Auth',()=>{mocks.auth.mockReturnValue({role:'member',user:{uid:'member'}});view();expect(mocks.list).not.toHaveBeenCalled()})
it('administrator nie może zmienić własnej roli',async()=>{mocks.auth.mockReturnValue({role:'admin',user:{uid:'member'}});view();await screen.findByText('Jan Członek');expect(screen.getByText('Zmień na admin')).toBeDisabled()})
