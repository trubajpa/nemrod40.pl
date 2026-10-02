import { CommentEditForm } from './CommentEditForm';
import { DeviceEditForm } from './DeviceEditForm';
import { useState, type FormEvent, type ReactNode } from 'react';
import { createDevice, updateDevice } from './deviceRepository';
import { addInspection } from './inspectionRepository';
import { convertCommentToIssue, createIssue } from './issueRepository';
import { addRepair } from './repairRepository';
import { replaceCurrentMedia } from './mediaRepository';
import { moderateComment } from './commentRepository';
import type { Device, DeviceComment, DeviceStatus, Issue } from './models';
import { validateDeviceInput, validateInspectionInput, validateIssueInput, validateMediaInput, validateRepairInput } from './validation';
const optionalDate = (value: FormDataEntryValue | null) => value ? new Date(`${String(value)}T00:00:00`) : null;
const confirmOfficial = () => window.confirm('Ta operacja zmieni oficjalne dane. Czy chcesz kontynuować?');
const FormBox = ({ title, children }: {
    title: string;
    children: ReactNode;
}) => <details className="admin-form"><summary>{title}</summary>{children}</details>;
const resultMessage = (ok: boolean) => ok ? 'Operacja została zapisana.' : 'Nie udało się zapisać operacji.';
export function AdminCreateDeviceForm({ uid }: {
    uid: string;
}) { const [message, setMessage] = useState(''); async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const element = event.currentTarget; const form = new FormData(element); const input = { number: String(form.get('number')), name: String(form.get('name')), type: String(form.get('type')), status: String(form.get('status')), conditionScore: form.get('score') === '' ? null : Number(form.get('score')), conditionLabel: String(form.get('conditionLabel') || '').trim() || null, inspectionDate: optionalDate(form.get('inspectionDate')), inventoryUpdatedAt: optionalDate(form.get('inventoryUpdatedAt')), latitude: form.get('latitude') === '' ? null : Number(form.get('latitude')), longitude: form.get('longitude') === '' ? null : Number(form.get('longitude')), disabledReason: '' }; if (Object.keys(validateDeviceInput(input)).length) {
    setMessage('Popraw dane formularza.');
    return;
} if (!confirmOfficial())
    return; try {
    await createDevice({ ...input, type: input.type as 'inne', status: input.status as DeviceStatus, districtNumber: Number(form.get('district')) || null, guardianUid: null, guardianName: null, active: true }, uid);
    element.reset();
    setMessage(resultMessage(true));
}
catch {
    setMessage(resultMessage(false));
} } return <FormBox title="Dodaj urządzenie"><form className="registry-form" onSubmit={submit}><label>Numer<input name="number" type="text" maxLength={32} placeholder="np. 4A" required/></label><label>Nazwa<input name="name" required/></label><label>Status<select name="status" defaultValue="sprawne"><option value="do_ustalenia">Do ustalenia</option><option value="sprawne">Sprawne</option><option value="wymaga_naprawy">Wymaga naprawy</option><option value="wylaczone">Wyłączone</option><option value="archiwalne">Archiwalne</option></select></label><label>Typ<select name="type"><option value="ambona">Ambona</option><option value="zwyzka">Zwyżka</option><option value="pasnik">Paśnik</option><option value="lizawka">Lizawka</option><option value="inne">Inne</option></select></label><label>Obwód<input name="district" type="number"/></label><label>Ocena<input name="score" type="number" min="0" max="5" step="0.5" placeholder="do ustalenia"/></label><label>Opis oceny<input name="conditionLabel" maxLength={80} placeholder="np. 4+"/></label><label>Data inwentaryzacji<input name="inspectionDate" type="date"/></label><label>Data aktualizacji inwentaryzacji<input name="inventoryUpdatedAt" type="date"/></label><label>Szerokość geograficzna<input name="latitude" type="number" step="any" placeholder="do ustalenia"/></label><label>Długość geograficzna<input name="longitude" type="number" step="any" placeholder="do ustalenia"/></label><button className="button">Zapisz urządzenie</button><Output text={message}/></form></FormBox>; }
export function AdminDeviceForms({ device, deviceId, uid, name, issues, comments, currentPhotoId }: {
    device: Device;
    deviceId: string;
    uid: string;
    name: string;
    issues: Issue[];
    comments: DeviceComment[];
    currentPhotoId: string | null;
}) { const [message, setMessage] = useState(''); async function run(action: () => Promise<unknown>) { if (!confirmOfficial())
    return; try {
    await action();
    setMessage(resultMessage(true));
}
catch {
    setMessage(resultMessage(false));
} } return <div className="admin-tools"><h2>Narzędzia administratora</h2><Output text={message}/><DeviceEditForm device={device} uid={uid}/><FormBox title="Przypisz opiekuna urządzenia"><form className="registry-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run(() => updateDevice(deviceId, { guardianUid: String(f.get('uid')) || null, guardianName: String(f.get('name')) || null }, uid)); }}><label>UID opiekuna<input name="uid"/></label><label>Nazwa opiekuna<input name="name"/></label><button className="button">Przypisz</button></form></FormBox><FormBox title="Dodaj formalny przegląd"><form className="registry-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const input = { inspectionDate: new Date(String(f.get('date'))), description: String(f.get('description')), conditionScore: Number(f.get('score')), conditionLabel: String(f.get('conditionLabel') || '').trim() || null }; if (Object.keys(validateInspectionInput(input)).length) {
    setMessage('Popraw dane przeglądu.');
    return;
} void run(() => addInspection(deviceId, { ...input, inspectorUid: uid, inspectorName: name, statusAfterInspection: String(f.get('status')) as DeviceStatus, recommendations: String(f.get('recommendations')).split('\n').filter(Boolean), approvedForUse: f.get('approved') === 'on', nextInspectionDate: null, createdBy: uid })); }}><label>Data<input name="date" type="date" required/></label><label>Ocena<input name="score" type="number" min="0" max="5" step="0.5" required/></label><label>Opis oceny<input name="conditionLabel" maxLength={80} placeholder="np. 4+"/></label><label>Status po przeglądzie<select name="status" defaultValue="sprawne"><option value="do_ustalenia">Do ustalenia</option><option value="sprawne">Sprawne</option><option value="wymaga_naprawy">Wymaga naprawy</option><option value="wylaczone">Wyłączone</option></select></label><label>Opis<textarea name="description" required/></label><label>Zalecenia, po jednym w wierszu<textarea name="recommendations"/></label><label><input name="approved" type="checkbox"/> Dopuszczone do użytkowania</label><button className="button">Zapisz przegląd</button></form></FormBox><FormBox title="Utwórz usterkę"><IssueForm onSubmit={input => run(() => createIssue(deviceId, { ...input, sourceType: 'admin', sourceId: null, assignedUid: null, assignedName: null, createdBy: uid }))}/></FormBox><FormBox title="Zatwierdź naprawę"><form className="registry-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const resolved = String(f.get('issues')).split(',').map(x => x.trim()).filter(Boolean); const input = { description: String(f.get('description')), cost: f.get('cost') === '' ? null : Number(f.get('cost')), startedAt: null, completedAt: new Date(String(f.get('completedAt'))), conditionAfter: Number(f.get('score')), conditionLabel: String(f.get('conditionLabel') || '').trim() || null, verifiedByUid: uid }; if (Object.keys(validateRepairInput(input)).length) {
    setMessage('Popraw dane naprawy.');
    return;
} void run(() => addRepair(deviceId, { ...input, performedBy: String(f.get('performedBy')).split(',').filter(Boolean), materials: String(f.get('materials')).split(',').filter(Boolean), resolvedIssueIds: resolved, conditionBefore: null, statusAfterRepair: String(f.get('status')) as DeviceStatus, verifiedByName: name, createdBy: uid, remainingOpenIssues: issues.filter(x => !resolved.includes(x.id) && !['usunieta', 'odrzucona'].includes(x.status)).length })); }}><label>Data zakończenia<input name="completedAt" type="date" required/></label><label>Opis<textarea name="description" required/></label><label>Wykonawcy, oddzieleni przecinkiem<input name="performedBy" required/></label><label>Materiały<input name="materials"/></label><label>Koszt<input name="cost" type="number" min="0" step="0.01"/></label><label>ID usterek do zamknięcia<input name="issues" placeholder={issues.map(x => x.id).join(', ')}/></label><label>Opis oceny po naprawie<input name="conditionLabel" maxLength={80} placeholder="np. 4+"/></label><label>Ocena po naprawie<input name="score" type="number" min="0" max="5" step="0.5" required/></label><label>Status<select name="status" defaultValue="sprawne"><option value="do_ustalenia">Do ustalenia</option><option value="sprawne">Sprawne</option><option value="wymaga_naprawy">Wymaga naprawy</option><option value="wylaczone">Wyłączone</option></select></label><button className="button">Zatwierdź naprawę</button></form></FormBox><FormBox title="Zarejestruj nowe zdjęcie i ustaw jako aktualne"><form className="registry-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const path = String(f.get('path')); if (Object.keys(validateMediaInput({ path })).length) {
    setMessage('Podaj ścieżkę zdjęcia.');
    return;
} void run(() => replaceCurrentMedia(deviceId, currentPhotoId, { path, storageProvider: 'public', category: 'aktualne', relatedType: 'device', relatedId: null, caption: String(f.get('caption')) || null, uploadedBy: uid, capturedAt: null })); }}><label>Ścieżka istniejącego zdjęcia<input name="path" required/></label><label>Podpis<input name="caption"/></label><button className="button">Zmień zdjęcie aktualne</button></form></FormBox><FormBox title="Moderacja komentarzy i tworzenie usterek">{comments.map(comment => <article className="history-card" key={comment.id}><p>{comment.content}</p><CommentEditForm comment={comment} deviceId={deviceId} uid={uid}/><div className="row-actions"><button onClick={() => void run(() => moderateComment(deviceId, comment.id, 'ukryty', uid))}>Ukryj</button><button onClick={() => void run(() => convertCommentToIssue(deviceId, comment.id, { title: 'Zgłoszenie członka', description: comment.content, priority: 'sredni', sourceType: 'comment', sourceId: comment.id, assignedUid: null, assignedName: null, createdBy: uid }))}>Utwórz usterkę</button></div></article>)}</FormBox></div>; }
function IssueForm({ onSubmit }: {
    onSubmit: (input: {
        title: string;
        description: string;
        priority: 'niski' | 'sredni' | 'wysoki' | 'bezpieczenstwo';
    }) => void;
}) { return <form className="registry-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const input = { title: String(f.get('title')), description: String(f.get('description')), priority: String(f.get('priority')) as 'sredni' }; if (!Object.keys(validateIssueInput(input)).length)
    onSubmit(input); }}><label>Tytuł<input name="title" required/></label><label>Opis<textarea name="description" required/></label><label>Priorytet<select name="priority"><option value="niski">Niski</option><option value="sredni">Średni</option><option value="wysoki">Wysoki</option><option value="bezpieczenstwo">Bezpieczeństwo</option></select></label><button className="button">Utwórz usterkę</button></form>; }
function Output({ text }: {
    text: string;
}) { return text ? <p role="status">{text}</p> : null; }
