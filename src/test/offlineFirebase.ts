import { vi } from 'vitest'

// Unit tests must never initialize the real app or reach production services.
vi.mock('../lib/firebase', () => ({ db: {}, auth: {} }))
const blocked = () => { throw new Error('Network disabled in application unit tests') }
vi.stubGlobal('fetch', blocked)
vi.stubGlobal('XMLHttpRequest', class { constructor() { blocked() } })
vi.stubGlobal('WebSocket', class { constructor() { blocked() } })
