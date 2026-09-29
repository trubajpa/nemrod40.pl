import { useState, type FormEvent } from 'react';
import type { Device, DeviceStatus, DeviceType } from './models';
import { updateDevice, type DeviceInput } from './deviceRepository';
import { deviceDocumentId } from './deviceIdentity';
import { validateCoordinates, validateInventoryDates, validateScore } from './validation';
const dateValue = (date?: {
    toDate: () => Date;
} | null) => date ? new Intl.DateTimeFormat('sv-SE').format(date.toDate()) : '';
const labels = { name: 'Nazwa', number: 'Numer', type: 'Typ', guardianName: 'Opiekun', rewir: 'Rewir', districtNumber: 'Obwód', latitude: 'Szerokość', longitude: 'Długość', conditionScore: 'Ocena', conditionLabel: 'Opis oceny', status: 'Status', description: 'Opis', defects: 'Usterki', recommendations: 'Zalecenia', inspectionDate: 'Data inwentaryzacji', inventoryUpdatedAt: 'Data aktualizacji inwentaryzacji', numberNeedsVerification: 'Numer do weryfikacji' };
export function DeviceEditForm({ device, uid }: {
    device: Device;
    uid: string;
}) {
    const [pending, setPending] = useState<DeviceInput | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    const [pendingVersion, setPendingVersion] = useState<number | undefined>(undefined);
    const before = { ...device, latitude: device.location?.latitude ?? null, longitude: device.location?.longitude ?? null, inspectionDate: dateValue(device.inspectionDate), inventoryUpdatedAt: dateValue(device.inventoryUpdatedAt) };
    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setPending(null);
        const f = new FormData(e.currentTarget), text = (key: string) => String(f.get(key) ?? '').trim(), number = (key: string) => text(key) === '' ? null : Number(text(key)), date = (key: string) => text(key) ? new Date(`${text(key)}T00:00:00`) : null;
        const input: DeviceInput = { name: text('name'), number: text('number').toUpperCase(), type: text('type') as DeviceType, guardianName: text('guardianName') || null, guardianUid: device.guardianUid, rewir: text('rewir') || null, districtNumber: number('districtNumber'), latitude: number('latitude'), longitude: number('longitude'), conditionScore: number('score'), conditionLabel: text('conditionLabel') || null, status: text('status') as DeviceStatus, description: text('description'), defects: text('defects').split('\n').filter(Boolean), recommendations: text('recommendations').split('\n').filter(Boolean), active: device.active, inspectionDate: date('inspectionDate'), inventoryUpdatedAt: date('inventoryUpdatedAt'), numberNeedsVerification: f.has('numberNeedsVerification') };
        try {
            deviceDocumentId(input.type, input.number);
            if (!input.name || input.conditionScore !== null && !validateScore(input.conditionScore) || !(input.latitude === null && input.longitude === null) && (input.latitude === null || input.longitude === null || !validateCoordinates(input.latitude, input.longitude)) || Object.keys(validateInventoryDates(input)).length)
                throw Error('Popraw ocenę, GPS, nazwę lub daty.');
            setPending(input);
            setPendingVersion(device.version);
            setMessage('');
        }
        catch (error) {
            setMessage(error instanceof Error ? error.message : 'Popraw formularz.');
        }
    }
    async function save() { if (!pending || busy)
        return;
        if (pendingVersion !== device.version) { setPending(null); setMessage('Dane zmieniły się. Sprawdź aktualne dane i ponów edycję.'); return; }
        setBusy(true); try {
        await updateDevice(device.id, pending, uid, pendingVersion);
        setPending(null);
        setMessage('Operacja została zapisana.');
    }
    catch (error) {
        const code = error instanceof Error ? error.message : '';
        setMessage(code === 'device_already_exists' ? 'Ten typ i numer są już zajęte.' : code === 'device_changed_reload' ? 'Dane zmieniły się. Sprawdź aktualne dane i ponów edycję.' : 'Nie udało się zapisać zmian.');
    }
    finally {
        setBusy(false);
    } }
    return <details className="admin-form"><summary>Edytuj metryczkę i GPS</summary><form className="registry-form" key={`${device.id}-${device.version}`} onSubmit={submit} onChange={() => setPending(null)}>
  <label>Numer<input name="number" defaultValue={device.number} required maxLength={32}/></label><label><input type="checkbox" name="numberNeedsVerification" defaultChecked={device.numberNeedsVerification}/>Numer do weryfikacji</label>
  <label>Nazwa<input name="name" defaultValue={device.name} required/></label><label>Typ<select name="type" defaultValue={device.type}>{Object.entries({ ambona: 'Ambona', zwyzka: 'Zwyżka', pasnik: 'Paśnik', inne: 'Inne', lizawka: 'Lizawka (starszy typ)' }).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  <label>Opiekun<input name="guardianName" defaultValue={device.guardianName ?? ''} placeholder="do ustalenia"/></label><label>Rewir<input name="rewir" defaultValue={device.rewir ?? ''} placeholder="do ustalenia"/></label><label>Obwód<input name="districtNumber" type="number" defaultValue={device.districtNumber ?? ''}/></label>
  <label>Ocena<input name="score" type="number" min="0" max="5" step="0.5" defaultValue={device.conditionScore ?? ''} placeholder="do ustalenia"/></label><label>Opis oceny<input name="conditionLabel" maxLength={80} defaultValue={device.conditionLabel ?? ''}/></label>
  <label>Szerokość<input name="latitude" type="number" step="any" defaultValue={device.location?.latitude ?? ''}/></label><label>Długość<input name="longitude" type="number" step="any" defaultValue={device.location?.longitude ?? ''}/></label>
  <label>Status<select name="status" defaultValue={device.status}><option value="sprawne">Sprawne</option><option value="wymaga_naprawy">Wymaga naprawy</option><option value="wylaczone">Wyłączone</option><option value="archiwalne">Archiwalne</option></select></label>
  <label>Opis<textarea name="description" defaultValue={device.description ?? ''}/></label><label>Usterki<textarea name="defects" defaultValue={device.defects?.join('\n') ?? ''}/></label><label>Zalecenia<textarea name="recommendations" defaultValue={device.recommendations?.join('\n') ?? ''}/></label>
  <label>Data inwentaryzacji<input name="inspectionDate" type="date" defaultValue={dateValue(device.inspectionDate)}/></label><label>Data aktualizacji inwentaryzacji<input name="inventoryUpdatedAt" type="date" defaultValue={dateValue(device.inventoryUpdatedAt)}/></label>
  <button className="button" disabled={busy}>Zapisz metryczkę</button></form>
  {pending && <section aria-label="Podsumowanie zmian"><h3>Podsumowanie zmian</h3><dl>{Object.entries(labels).filter(([key]) => JSON.stringify(before[key as keyof typeof before] ?? null) !== JSON.stringify(pending[key as keyof DeviceInput] ?? null)).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{JSON.stringify(before[key as keyof typeof before] ?? 'do ustalenia')} → {JSON.stringify(pending[key as keyof DeviceInput] ?? 'do ustalenia')}</dd></div>)}</dl><p>ID i historia urządzenia pozostaną zachowane.</p><button type="button" onClick={() => void save()} disabled={busy}>Potwierdź zapis zmian</button><button type="button" onClick={() => setPending(null)} disabled={busy}>Anuluj</button></section>}{message && <p role="status">{message}</p>}
 </details>;
}
