import type { ActivityItem, Device, DeviceComment, DeviceFilters, DeviceMedia, Inspection, Issue, Repair } from './models'

export function filterDevices(devices: Device[], filters: DeviceFilters) { return devices.filter(d => (!filters.district || String(d.districtNumber)===filters.district) && (!filters.type||d.type===filters.type) && (!filters.status||d.status===filters.status) && (!filters.guardian||d.guardianName===filters.guardian) && (!filters.needsRepair||d.status==='wymaga_naprawy'||d.openIssuesCount>0)) }
export function countOpenIssues(issues: Pick<Issue,'status'>[]) { return issues.filter(i => !['usunieta','odrzucona'].includes(i.status)).length }
export function buildActivityTimeline(data: { inspections: Inspection[]; issues: Issue[]; repairs: Repair[]; comments: DeviceComment[]; media: DeviceMedia[] }): ActivityItem[] { return [
  ...data.inspections.map(x=>({id:x.id,kind:'inspection' as const,date:x.inspectionDate,title:'Przegląd urządzenia'})),
  ...data.issues.map(x=>({id:x.id,kind:'issue' as const,date:x.createdAt,title:`Usterka: ${x.title}`})),
  ...data.repairs.map(x=>({id:x.id,kind:'repair' as const,date:x.completedAt,title:'Zatwierdzona naprawa'})),
  ...data.comments.map(x=>({id:x.id,kind:'comment' as const,date:x.createdAt,title:'Komentarz członka'})),
  ...data.media.map(x=>({id:x.id,kind:'media' as const,date:x.uploadedAt,title:'Zmiana zdjęcia'})),
].sort((a,b)=>b.date.toMillis()-a.date.toMillis()) }
