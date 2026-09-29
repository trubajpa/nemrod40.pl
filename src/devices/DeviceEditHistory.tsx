import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
type Edit = {
    id: string;
    createdAt: Timestamp;
    createdBy: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
};
export function DeviceEditHistory({ deviceId }: {
    deviceId: string;
}) {
    const [items, setItems] = useState<Edit[]>([]), [error, setError] = useState(false);
    useEffect(() => onSnapshot(query(collection(db, 'devices', deviceId, 'edits'), orderBy('createdAt', 'desc')), s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() }) as Edit)), () => setError(true)), [deviceId]);
    return <section className="registry-section"><h2>Historia edycji urządzenia</h2>{error ? <p>Nie udało się pobrać historii edycji.</p> : items.length ? items.map(item => <details key={item.id}><summary>Wersja {item.id} • {item.createdAt?.toDate().toLocaleString('pl-PL') ?? 'Zapisywanie…'}</summary><p>Autor: {item.createdBy}</p><dl>{Object.keys(item.after).filter(key => !['updatedAt', 'updatedBy', 'version'].includes(key) && JSON.stringify(item.before[key]) !== JSON.stringify(item.after[key])).map(key => <div key={key}><dt>{key}</dt><dd>{JSON.stringify(item.before[key] ?? null)} → {JSON.stringify(item.after[key] ?? null)}</dd></div>)}</dl></details>) : <p>Brak zapisanych edycji.</p>}</section>;
}
