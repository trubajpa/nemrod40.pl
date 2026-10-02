import { DeviceEditHistory } from './DeviceEditHistory';
import { DeviceGallery, DevicePhoto, DeviceCover } from './DeviceGallery';
import { RegistryTable } from './RegistryTable';
import './registry.css';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AdminCreateDeviceForm, AdminDeviceForms } from './AdminDeviceForms';
import { createComment } from './commentRepository';
import { archiveDevice } from './deviceRepository';
import { buildActivityTimeline, filterDevices } from './deviceUtils';
import type { DeviceFilters } from './models';
import { useDeviceDetails, useDevices } from './useDeviceData';
import { formatCondition, validateCommentInput } from './validation';
const typeLabels = { ambona: 'Ambona', zwyzka: 'Zwyżka', pasnik: 'Paśnik', lizawka: 'Lizawka', inne: 'Inne' };
const statusLabels = { sprawne: 'Sprawne', wymaga_naprawy: 'Wymaga naprawy', wylaczone: 'Wyłączone z użytkowania', archiwalne: 'Archiwalne', do_ustalenia: 'Do ustalenia' };
const formatDate = (value: {
    toDate: () => Date;
} | null | undefined) => value?.toDate().toLocaleDateString('pl-PL') ?? 'Brak';
export function DevicesRegistryPage() {
    const { devices, loading, error } = useDevices();
    const { role, user } = useAuth();
    const isAdmin = role === 'admin';
    const [showCreate, setShowCreate] = useState(false);
    const [view, setView] = useState<'cards' | 'table'>('cards');
    const [filters, setFilters] = useState<DeviceFilters>({ district: '', type: '', status: '', guardian: '', needsRepair: false });
    const filtered = useMemo(() => filterDevices(devices, filters), [devices, filters]);
    const guardians = [...new Set(devices.map(x => x.guardianName).filter(Boolean))] as string[];
    return <section className="member-page"><div className="container member-shell registry-shell"><div className="registry-heading"><div><span className="eyebrow">Strefa członkowska</span><h1>Przegląd urządzeń łowieckich</h1></div>{isAdmin && <button className="button" type="button" onClick={() => setShowCreate(x => !x)}>Dodaj urządzenie</button>}</div>{isAdmin && showCreate && <AdminCreateDeviceForm uid={user!.uid}/>}<Link to="/panel">← Wróć do panelu</Link><div className="registry-view-switch" aria-label="Widok rejestru"><button aria-pressed={view === 'table'} onClick={() => setView('table')}>Tabela</button><button aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Karty</button></div><div className="device-filters" aria-label="Filtry urządzeń"><label>Szukaj numeru, opiekuna lub rewiru<input type="search" value={filters.search ?? ''} onChange={e => setFilters({ ...filters, search: e.target.value })}/></label><label>Obwód<select value={filters.district} onChange={e => setFilters({ ...filters, district: e.target.value })}><option value="">Wszystkie</option>{[...new Set(devices.map(x => x.districtNumber).filter(x => x !== null))].map(x => <option key={x} value={String(x)}>{x}</option>)}</select></label><label>Typ<select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}><option value="">Wszystkie</option>{Object.entries(typeLabels).filter(([v]) => v !== 'lizawka').map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Status<select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="">Wszystkie</option>{Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Opiekun urządzenia<select value={filters.guardian} onChange={e => setFilters({ ...filters, guardian: e.target.value })}><option value="">Wszyscy</option>{guardians.map(x => <option key={x}>{x}</option>)}</select></label><label className="check-filter"><input type="checkbox" checked={filters.needsRepair} onChange={e => setFilters({ ...filters, needsRepair: e.target.checked })}/> Tylko wymagające naprawy</label></div>{loading && <div className="auth-loading" role="status">Ładowanie rejestru…</div>}{error && <div className="form-message error" role="alert">{error}</div>}{!loading && !error && filtered.length === 0 && <div className="empty-state"><h2>Brak urządzeń spełniających kryteria</h2><p>Rejestr nie zawiera jeszcze danych lub filtry nie zwróciły wyników.</p></div>}{view === 'table' ? <RegistryTable devices={filtered}/> : <div className="device-list">{filtered.map(d => <article className="device-row" key={d.id}><Link className="device-card-photo" to={`/panel/urzadzenia/${d.id}`} aria-label={`Zdjęcie urządzenia ${d.number}`}><DeviceCover device={d}/></Link><div><span className={`status-badge ${d.status}`}>{statusLabels[d.status]}</span><h2><Link to={`/panel/urzadzenia/${d.id}`}>Nr {d.number} — {d.name}</Link></h2>{d.numberNeedsVerification && <strong className="safety-warning">Numer do weryfikacji</strong>}<dl><Metric label="Typ" value={typeLabels[d.type]}/><Metric label="Obwód" value={d.districtNumber ?? '—'}/><Metric label="Opiekun urządzenia" value={d.guardianName || 'do ustalenia'}/><Metric label="Rewir" value={d.rewir || 'do ustalenia'}/><Metric label="Ocena" value={formatCondition(d.conditionScore, d.conditionLabel)}/><Metric label="Inwentaryzacja" value={formatDate(d.inspectionDate)}/><Metric label="Aktualizacja inwentaryzacji" value={formatDate(d.inventoryUpdatedAt)}/><Metric label="Ostatni przegląd" value={formatDate(d.latestInspectionAt)}/><Metric label="Otwarte usterki" value={d.openIssuesCount}/></dl>{d.status === 'wylaczone' && <strong className="safety-warning">Urządzenie wyłączone z użytkowania</strong>}<div className="row-actions"><Link className="button outline" to={`/panel/urzadzenia/${d.id}`}>Otwórz szczegóły</Link>{isAdmin && <button type="button" onClick={() => { if (confirm('Czy zarchiwizować urządzenie?'))
        void archiveDevice(d.id, user!.uid); }}>Archiwizuj</button>}</div></div></article>)}</div>}</div></section>;
}
export function DeviceDetailsPage() { const { id = '' } = useParams(); return <DeviceDetailsContent key={id}/>; }
function DeviceDetailsContent() {
    const { id = '' } = useParams();
    const { device, inspections, issues, comments, repairs, media, loading, error } = useDeviceDetails(id);
    const { user, profile, role } = useAuth();
    const [content, setContent] = useState('');
    const [type, setType] = useState<'uwaga' | 'problem' | 'propozycja' | 'informacja' | 'zgloszenie_naprawy'>('uwaga');
    const [message, setMessage] = useState('');
    const timeline = useMemo(() => buildActivityTimeline({ inspections, issues, repairs, comments, media }), [inspections, issues, repairs, comments, media]);
    async function submit(e: FormEvent) { e.preventDefault(); if (Object.keys(validateCommentInput({ content })).length) {
        setMessage('Treść zgłoszenia jest wymagana.');
        return;
    } try {
        await createComment(id, { type, content, relatedType: 'device', relatedId: null }, { uid: user!.uid, name: profile?.displayName || user!.displayName || 'Członek' });
        setContent('');
        setMessage('Zgłoszenie zostało zapisane.');
    }
    catch {
        setMessage('Nie udało się zapisać zgłoszenia.');
    } }
    if (loading)
        return <div className="auth-loading" role="status">Ładowanie urządzenia…</div>;
    if (!device)
        return <section className="member-page"><div className="container member-shell"><div className="form-message error">{error || 'Nie znaleziono urządzenia.'}</div><Link to="/panel/urzadzenia">← Wróć do rejestru</Link></div></section>;
    const current = media.find(x => x.id === device.currentPhotoId && !x.hidden);
    const open = issues.filter(x => !['usunieta', 'odrzucona'].includes(x.status));
    const memberName = profile?.displayName || user!.displayName || 'Administrator';
    return <section className="member-page"><div className="container member-shell registry-shell"><Link to="/panel/urzadzenia">← Wróć do rejestru</Link>{error && <div className="form-message error">{error}</div>}<header className="device-detail-hero"><DevicePhoto path={device.primaryPhotoPath ?? current?.path} alt={current?.caption || `Urządzenie ${device.number}`}/><div><span className={`status-badge ${device.status}`}>{statusLabels[device.status]}</span><h1>Nr {device.number} — {device.name}</h1>{device.numberNeedsVerification && <strong className="safety-warning">Numer do weryfikacji</strong>}<strong>Ocena: {formatCondition(device.conditionScore, device.conditionLabel)}</strong></div></header><section className="registry-section"><h2>Metryczka urządzenia</h2><dl className="device-metrics"><Metric label="Typ" value={typeLabels[device.type]}/><Metric label="Rewir" value={device.rewir || 'do ustalenia'}/><Metric label="Obwód" value={device.districtNumber ?? '—'}/><Metric label="Status" value={statusLabels[device.status]}/><Metric label="Data inwentaryzacji" value={formatDate(device.inspectionDate)}/><Metric label="Data aktualizacji inwentaryzacji" value={formatDate(device.inventoryUpdatedAt)}/><Metric label="Wersja" value={device.version}/></dl></section><section className="registry-section"><h2>Opiekun urządzenia</h2><p>{device.guardianName || 'do ustalenia'}</p></section>{device.location ? <><p>GPS: {device.location.latitude}, {device.location.longitude}</p><a className="button outline" href={device.googleMaps || `https://maps.google.com/?q=${device.location.latitude},${device.location.longitude}`} target="_blank" rel="noreferrer">Otwórz w Google Maps</a></> : <p>GPS: do ustalenia</p>}<section className="registry-section"><h2>Opis urządzenia</h2><p className="preserve-lines">{device.description || 'do ustalenia'}</p><h3>Usterki inwentaryzacji</h3>{device.defects?.length ? <ul>{device.defects.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>do ustalenia</p>}<h3>Zalecenia</h3>{device.recommendations?.length ? <ul>{device.recommendations.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>do ustalenia</p>}</section><section className="registry-section"><h2>Otwarte usterki i prace</h2>{open.length ? open.map(x => <article className="history-card" key={x.id}><strong>{x.title}</strong><p>{x.description}</p><span>{x.priority}</span></article>) : <p>Brak otwartych usterek.</p>}</section><section className="registry-section"><h2>Ostatni przegląd</h2>{inspections[0] ? <article className="history-card"><strong>{formatDate(inspections[0].inspectionDate)} · {formatCondition(inspections[0].conditionScore, inspections[0].conditionLabel)}</strong><p>{inspections[0].description}</p></article> : <p>Brak przeglądów.</p>}</section><section className="registry-section"><h2>Zgłoś uwagę</h2><form className="registry-form" onSubmit={submit}><label>Rodzaj<select value={type} onChange={e => setType(e.target.value as typeof type)}><option value="uwaga">Uwaga</option><option value="problem">Problem</option><option value="propozycja">Propozycja</option><option value="informacja">Informacja</option><option value="zgloszenie_naprawy">Zgłoszenie naprawy</option></select></label><label>Treść<textarea value={content} onChange={e => setContent(e.target.value)} required/></label><button className="button" type="submit">Wyślij zgłoszenie</button>{message && <p role="status">{message}</p>}</form></section><History title="Komentarze członków" items={comments.filter(x => x.status !== 'ukryty').map(x => ({ id: x.id, date: x.createdAt, text: x.content }))}/><DeviceEditHistory deviceId={id}/><History title="Historia przeglądów" items={inspections.map(x => ({ id: x.id, date: x.inspectionDate, text: x.description }))}/><History title="Historia napraw" items={repairs.map(x => ({ id: x.id, date: x.completedAt, text: x.description }))}/><DeviceGallery device={device} media={media} admin={role === 'admin'} uid={user!.uid}/><section className="registry-section"><h2>Oś aktywności</h2><ol className="timeline">{timeline.map(x => <li key={`${x.kind}-${x.id}`}><time>{formatDate(x.date)}</time><strong>{x.title}</strong></li>)}</ol></section>{role === 'admin' && <section className="registry-section"><AdminDeviceForms device={device} deviceId={id} uid={user!.uid} name={memberName} issues={issues} comments={comments} currentPhotoId={device.currentPhotoId}/></section>}</div></section>;
}
function Metric({ label, value }: {
    label: string;
    value: string | number;
}) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function History({ title, items }: {
    title: string;
    items: {
        id: string;
        date: {
            toDate: () => Date;
        };
        text: string;
    }[];
}) { return <section className="registry-section"><h2>{title}</h2>{items.length ? items.map(x => <article className="history-card" key={x.id}><time>{formatDate(x.date)}</time><p>{x.text}</p></article>) : <p>Brak wpisów.</p>}</section>; }
