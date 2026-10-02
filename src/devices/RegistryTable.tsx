import { Link } from 'react-router-dom';
import type { Device } from './models';
import { DeviceCover } from './DeviceGallery';
import { formatCondition } from './validation';
export function RegistryTable({ devices }: {
    devices: Device[];
}) { return <div className="registry-table-scroll"><table className="registry-table"><thead><tr><th>Zdjęcie główne</th><th>Urządzenie</th><th>Opiekun</th><th>Rewir</th><th>Ocena</th><th>Status</th></tr></thead><tbody>{devices.map(d => <tr key={d.id}><td><Link to={`/panel/urzadzenia/${d.id}`} aria-label={`Zdjęcie urządzenia ${d.number}`}><DeviceCover device={d}/></Link></td><td><Link to={`/panel/urzadzenia/${d.id}`}>Nr {d.number} — {d.name}</Link>{d.numberNeedsVerification && <strong className="safety-warning">Numer do weryfikacji</strong>}</td><td>{d.guardianName || 'do ustalenia'}</td><td>{d.rewir || 'do ustalenia'}</td><td>{formatCondition(d.conditionScore, d.conditionLabel)}</td><td>{{ sprawne: 'Sprawne', wymaga_naprawy: 'Wymaga naprawy', wylaczone: 'Wyłączone', archiwalne: 'Archiwalne', do_ustalenia: 'Do ustalenia' }[d.status]}</td></tr>)}</tbody></table></div>; }
