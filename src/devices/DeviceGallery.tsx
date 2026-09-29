import { useEffect, useState, type FormEvent } from 'react';
import type { Device, DeviceMedia } from './models';
import { addDeviceMedia, changeDeviceMedia, getMedia } from './mediaRepository';
import { photoUrl, uploadDevicePhoto, validPhotoPath } from './devicePhotos';
export function DeviceCover({ device }: {
    device: Device;
}) {
    const [legacy, setLegacy] = useState<{
        id: string;
        mediaId: string;
        path: string;
    } | null>(null);
    useEffect(() => { let active = true; if (!device.primaryPhotoPath && device.currentPhotoId)
        void getMedia(device.id, device.currentPhotoId).then(media => { if (active && media && !media.hidden)
            setLegacy({ id: device.id, mediaId: media.id, path: media.path }); }).catch(() => { }); return () => { active = false; }; }, [device.id, device.primaryPhotoPath, device.currentPhotoId]);
    const fallback = legacy?.id === device.id && legacy?.mediaId === device.currentPhotoId ? legacy.path : null;
    return <DevicePhoto path={device.primaryPhotoPath ?? fallback} alt={`Urządzenie ${device.number}`}/>;
}
export function DevicePhoto({ path, alt }: {
    path: string | null | undefined;
    alt: string;
}) {
    const [resolved, setResolved] = useState<{
        path: string;
        url: string;
    } | null>(null);
    useEffect(() => { let active = true, url: string | undefined; if (path)
        void photoUrl(path).then(value => { url = value; if (active)
            setResolved({ path, url: value });
        else if (value.startsWith('blob:'))
            URL.revokeObjectURL(value); }).catch(() => { }); return () => { active = false; if (url?.startsWith('blob:'))
        URL.revokeObjectURL(url); }; }, [path]);
    return resolved && resolved.path === path ? <img src={resolved.url} alt={alt}/> : <span className="device-photo-placeholder">Brak dostępnego zdjęcia</span>;
}
export function DeviceGallery({ device, media, admin, uid }: {
    device: Device;
    media: DeviceMedia[];
    admin: boolean;
    uid: string;
}) {
    const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    async function action(run: () => Promise<unknown>, summary: string) { if (busy || !confirm(summary))
        return; setBusy(true); try {
        await run();
        setMessage('Zapisano zmianę galerii.');
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : 'Nie udało się zmienić galerii.');
    }
    finally {
        setBusy(false);
    } }
    async function add(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget, data = new FormData(form), file = data.get('file'), existing = String(data.get('path') ?? '').trim(), status = String(data.get('photoStatus')) as 'aktualne' | 'archiwalne' | '';
        if (!(file instanceof File && file.size) && !validPhotoPath(existing)) {
            setMessage('Wybierz zdjęcie lub poprawną ścieżkę istniejącego zdjęcia.');
            return;
        }
        await action(async () => { const path = file instanceof File && file.size ? await uploadDevicePhoto(device.id, file) : existing; try {
            await addDeviceMedia(device.id, { path, storageProvider: path.startsWith('/') ? 'public' : 'firebase_storage', category: 'aktualne', relatedType: 'device', relatedId: null, caption: String(data.get('caption')) || null, uploadedBy: uid, capturedAt: null }, status || null);
        }
        catch {
            throw Error(`Plik zachowany; przypisanie nie zostało zapisane. Spróbuj ponownie ze ścieżką: ${path}`);
        } form.reset(); }, 'Dodać wskazane zdjęcie do galerii urządzenia?');
    }
    return <section className="registry-section"><h2>Zdjęcia aktualne i historyczne</h2>{(['aktualne', 'archiwalne', null] as const).map(status => <div key={status ?? 'unknown'}><h3>{status ?? 'Aktualność do ustalenia'}</h3><div className="media-grid">{media.filter(m => !m.hidden && (m.photoStatus ?? null) === status).map(m => <figure key={m.id}><DevicePhoto path={m.path} alt={m.caption || 'Zdjęcie urządzenia'}/><figcaption>{m.caption || m.path.split('/').at(-1)}{m.id === device.currentPhotoId ? ' · zdjęcie główne' : ''}</figcaption>{admin && <div className="row-actions"><button disabled={busy} onClick={() => void action(() => changeDeviceMedia(device.id, m.id, 'primary', uid), 'Ustawić to zdjęcie jako główne?')}>Ustaw jako główne</button><button disabled={busy} onClick={() => void action(() => changeDeviceMedia(device.id, m.id, status === 'archiwalne' ? 'aktualne' : 'archiwalne', uid), 'Zmienić aktualność zdjęcia?')}>{status === 'archiwalne' ? 'Oznacz aktualne' : 'Oznacz archiwalne'}</button>{status === null && <button disabled={busy} onClick={() => void action(() => changeDeviceMedia(device.id, m.id, 'aktualne', uid), 'Oznaczyć jako aktualne?')}>Oznacz aktualne</button>}<button disabled={busy} onClick={() => void action(() => changeDeviceMedia(device.id, m.id, 'detach', uid), 'Usunąć przypisanie? Plik i zapis historii pozostaną zachowane.')}>Usuń przypisanie</button></div>}</figure>)}</div></div>)}{admin && <details><summary>Dodaj zdjęcie</summary><form className="registry-form" onSubmit={e => void add(e)}><label>Plik zdjęcia<input name="file" type="file" accept="image/jpeg,image/png,image/webp"/></label><label>Lub ścieżka istniejącego zdjęcia<input name="path" placeholder="/images/devices/…"/></label><label>Podpis zdjęcia<input name="caption"/></label><label>Aktualność<select name="photoStatus"><option value="">do ustalenia</option><option value="aktualne">aktualne</option><option value="archiwalne">archiwalne</option></select></label><button disabled={busy}>Dodaj zdjęcie do galerii</button></form></details>}{message && <p role="status">{message}</p>}</section>;
}
