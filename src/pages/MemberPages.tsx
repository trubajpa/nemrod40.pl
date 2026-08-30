import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
export { DevicesRegistryPage as DevicesPage, DeviceDetailsPage as DevicePlaceholder } from '../devices/DeviceViews'

export function MemberPanel() {
  const { user, profile, role, logout } = useAuth()
  const name = profile?.displayName || user?.displayName || user?.email

  return <section className="member-page">
    <div className="container member-shell">
      <div className="member-topbar">
        <Link className="member-brand" to="/"><img src="/images/brand/logo-nemrod-v2.png" alt=""/><span>Nemrod</span></Link>
        <button className="button outline" type="button" onClick={() => void logout()}>Wyloguj się</button>
      </div>
      <header className="member-header"><span className="eyebrow">Panel członka</span><h1>Strefa członkowska</h1><p>Witaj, <strong>{name}</strong>.</p><span className="role-badge">Rola: {role || 'członek'}</span></header>
      <div className="member-grid">
        <Link className="member-card" to="/panel/urzadzenia"><span>Rejestr wewnętrzny</span><h2>Przegląd urządzeń łowieckich</h2><p>Przejdź do bezpiecznego obszaru ewidencji urządzeń Koła.</p><strong>Otwórz przegląd →</strong></Link>
        <aside className="member-notice"><h2>Informacja</h2><p>Dane w tej strefie są przeznaczone wyłącznie dla członków Koła Łowieckiego nr 40 „Nemrod”.</p></aside>
      </div>
      <Link className="public-back-link" to="/">← Przejdź do strony publicznej</Link>
    </div>
  </section>
}
