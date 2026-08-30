import { GeoPoint, Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceConverter } from './converters'
import { buildActivityTimeline, countOpenIssues, filterDevices } from './deviceUtils'
import { buildMediaReplacement } from './mediaRepository'
import type { Device, DeviceComment, DeviceMedia, Inspection, Issue, Repair } from './models'
import { buildCommentPayload, buildInspectionSummary, buildIssueConversion } from './operationPlans'
import { getDevicePermissions } from './permissions'
import { buildRepairResolution } from './repairRepository'
import { logDeviceError, safeSnapshot } from './repositoryUtils'
import { validateCommentInput, validateDeviceInput, validateInspectionInput, validateIssueInput, validateMediaInput, validateRepairInput } from './validation'

const now=Timestamp.fromMillis(1_000)
const later=Timestamp.fromMillis(2_000)
const device:Device={id:'device-test',number:7,name:'Urządzenie testowe',type:'inne',districtNumber:null,active:true,archived:false,location:new GeoPoint(0,0),guardianUid:null,guardianName:null,status:'sprawne',conditionScore:5,latestInspectionAt:null,latestInspectionId:null,currentPhotoId:null,openIssuesCount:0,createdAt:now,createdBy:'uid-test',updatedAt:now,updatedBy:'uid-test',version:1}

describe('konwertery Firestore',()=>{
  it('konwertuje poprawną metryczkę urządzenia',()=>{const snapshot={id:device.id,data:()=>device} as unknown as QueryDocumentSnapshot;expect(deviceConverter.fromFirestore(snapshot,{})).toMatchObject({id:'device-test',name:'Urządzenie testowe',conditionScore:5})})
  it('odrzuca pusty dokument bez wywracania całej listy',()=>{const bad={id:'bad',data:()=>({})};const snapshot={docs:[bad]} as never;expect(safeSnapshot(snapshot,deviceConverter)).toEqual([])})
})

describe('walidacja formularzy',()=>{
  it('waliduje urządzenie i GPS',()=>expect(validateDeviceInput({name:'',number:Number.NaN,type:'x',status:'wylaczone',conditionScore:8,latitude:100,longitude:200})).toEqual(expect.objectContaining({name:expect.any(String),number:expect.any(String),type:expect.any(String),conditionScore:expect.any(String),location:expect.any(String),disabledReason:expect.any(String)})))
  it('waliduje przegląd',()=>expect(validateInspectionInput({description:'',conditionScore:0})).toEqual(expect.objectContaining({description:expect.any(String),conditionScore:expect.any(String),inspectionDate:expect.any(String)})))
  it('waliduje usterkę',()=>expect(validateIssueInput({title:'',description:' '})).toEqual(expect.objectContaining({title:expect.any(String),description:expect.any(String)})))
  it('waliduje naprawę',()=>expect(validateRepairInput({description:'',cost:-1,startedAt:new Date('2026-02-02'),completedAt:new Date('2026-02-01'),conditionAfter:6,verifiedByUid:''})).toEqual(expect.objectContaining({description:expect.any(String),cost:expect.any(String),completedAt:expect.any(String),conditionAfter:expect.any(String),verifiedByUid:expect.any(String)})))
  it('waliduje komentarz i media',()=>{expect(validateCommentInput({content:' '})).toHaveProperty('content');expect(validateMediaInput({path:''})).toHaveProperty('path')})
})

describe('uprawnienia interfejsu',()=>{
  it('aktywnemu członkowi pozwala czytać i komentować',()=>expect(getDevicePermissions('member',true)).toMatchObject({canRead:true,canComment:true,canManageDevice:false,canApproveRepair:false}))
  it('administratorowi udostępnia operacje oficjalne',()=>expect(getDevicePermissions('admin',true)).toMatchObject({canManageDevice:true,canInspect:true,canManageIssues:true,canApproveRepair:true,canManageMedia:true,canModerateComments:true}))
})

describe('niezmienna historia i aktualizacja podsumowania',()=>{
  it('tworzy komentarz wyłącznie z autorem sesji',()=>{const payload=buildCommentPayload({type:'uwaga',content:' Treść ',relatedType:'device',relatedId:null},{uid:'session-uid',name:'Członek testowy'});expect(payload).toMatchObject({authorUid:'session-uid',authorName:'Członek testowy',content:'Treść',status:'nowy'})})
  it('wiąże usterkę z komentarzem',()=>expect(buildIssueConversion('comment-test','issue-test')).toEqual({issue:{sourceType:'comment',sourceId:'comment-test'},comment:{status:'przyjety',convertedToIssueId:'issue-test'}}))
  it('przegląd aktualizuje bieżące podsumowanie',()=>expect(buildInspectionSummary({conditionScore:3,statusAfterInspection:'wymaga_naprawy'},'inspection-test')).toEqual({conditionScore:3,status:'wymaga_naprawy',latestInspectionId:'inspection-test'}))
  it('naprawa zamyka wskazane usterki bez ich usuwania',()=>expect(buildRepairResolution(['issue-a','issue-b'],'repair-test')).toEqual([{issueId:'issue-a',repairId:'repair-test',status:'usunieta'},{issueId:'issue-b',repairId:'repair-test',status:'usunieta'}]))
  it('przelicza otwarte usterki',()=>expect(countOpenIssues([{status:'zgloszona'},{status:'w_naprawie'},{status:'usunieta'},{status:'odrzucona'}])).toBe(2))
  it('zmienia zdjęcie aktualne bez usuwania starego',()=>expect(buildMediaReplacement('old-media','new-media')).toEqual({previous:{id:'old-media',isCurrent:false,replacedBy:'new-media'},current:{id:'new-media',isCurrent:true}}))
})

describe('widoki danych',()=>{
  it('filtruje listę po stanie wymagającym naprawy',()=>{const broken={...device,id:'broken',status:'wymaga_naprawy' as const,openIssuesCount:1};expect(filterDevices([device,broken],{district:'',type:'',status:'',guardian:'',needsRepair:true})).toEqual([broken])})
  it('buduje chronologiczną oś bez osobnej kopii danych',()=>{const inspection={id:'i',inspectionDate:now,createdAt:now,description:'',conditionScore:5} as Inspection;const comment={id:'c',createdAt:later,content:''} as DeviceComment;expect(buildActivityTimeline({inspections:[inspection],issues:[] as Issue[],repairs:[] as Repair[],comments:[comment],media:[] as DeviceMedia[]}).map(x=>x.id)).toEqual(['c','i'])})
})

describe('prywatność loggera',()=>{afterEach(()=>vi.restoreAllMocks());it('nie loguje dokumentu ani danych wrażliwych',()=>{const spy=vi.spyOn(console,'error').mockImplementation(()=>undefined);logDeviceError('load_device',{code:'permission-denied',content:'private description',location:'private GPS'});expect(spy).toHaveBeenCalledWith('Device repository error',{operation:'load_device',code:'permission-denied',message:'The device data operation failed.'});expect(JSON.stringify(spy.mock.calls)).not.toContain('private description')})})
