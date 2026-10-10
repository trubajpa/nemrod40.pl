import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
const mocks=vi.hoisted(()=>({authChanged:vi.fn(),snapshot:vi.fn(),server:vi.fn(),submit:vi.fn(),stop:vi.fn()}))
vi.mock('firebase/auth',()=>({browserLocalPersistence:{},setPersistence:vi.fn().mockResolvedValue(undefined),onAuthStateChanged:mocks.authChanged,signOut:vi.fn().mockResolvedValue(undefined)}))
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDocFromServer:mocks.server,onSnapshot:mocks.snapshot}))
vi.mock('../lib/firebase',()=>({auth:{},db:{}}))
vi.mock('./accessRequests',()=>({submitAccessRequest:mocks.submit}))
const member={active:true,role:'member',displayName:'Jan'}
const snap=(data:object|null,cached=false)=>({exists:()=>!!data,data:()=>data,metadata:{fromCache:cached}})
function Session(){const auth=useAuth();return <div>{auth.loading?'loading':auth.isActiveMember?`access:${auth.role}`:`blocked:${auth.accessError}`}</div>}
beforeEach(()=>{vi.clearAllMocks();mocks.authChanged.mockReturnValue(()=>{});mocks.snapshot.mockReturnValue(mocks.stop);mocks.server.mockResolvedValue(snap(member));mocks.submit.mockResolvedValue('pending')})
it('otwarta sesja reaguje na zmianę roli i odebranie dostępu bez nowego wniosku',async()=>{
 render(<AuthProvider><Session/></AuthProvider>);const changed=mocks.authChanged.mock.calls[0][1]
 await act(()=>changed({uid:'u',email:'member@example.test'}));expect(screen.getByText('access:member')).toBeInTheDocument()
 const next=mocks.snapshot.mock.calls[0][2]
 act(()=>next(snap({...member,role:'admin'})));expect(screen.getByText('access:admin')).toBeInTheDocument()
 act(()=>next(snap({...member,active:false})));expect(screen.getByText('blocked:Dostęp został odebrany.')).toBeInTheDocument();expect(mocks.submit).not.toHaveBeenCalled()
 act(()=>next(snap(member,true)));expect(screen.getByText('blocked:Dostęp został odebrany.')).toBeInTheDocument()
})
it('ponowne logowanie po odebraniu dostępu składa wniosek, zatwierdzenie otwiera strefę',async()=>{
 mocks.server.mockResolvedValue(snap({...member,active:false}));render(<AuthProvider><Session/></AuthProvider>)
 await act(()=>mocks.authChanged.mock.calls[0][1]({uid:'u',email:'member@example.test',getIdTokenResult:async()=>({signInProvider:'google.com'})}))
 await waitFor(()=>expect(screen.getByText('blocked:Oczekujesz na zatwierdzenie')).toBeInTheDocument());expect(mocks.submit).toHaveBeenCalledOnce()
 act(()=>mocks.snapshot.mock.calls[0][2](snap(member)));expect(screen.getByText('access:member')).toBeInTheDocument()
})
it('błąd kontroli serwera zamyka dostęp',async()=>{render(<AuthProvider><Session/></AuthProvider>);await act(()=>mocks.authChanged.mock.calls[0][1]({uid:'u',email:'member@example.test'}));act(()=>mocks.snapshot.mock.calls[0][3](new Error('network')));expect(screen.getByText(/blocked:Nie udało się sprawdzić uprawnień/)).toBeInTheDocument()})
