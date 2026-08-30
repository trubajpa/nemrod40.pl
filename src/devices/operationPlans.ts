import type { DeviceComment, DeviceStatus } from './models'

export function buildCommentPayload(input:Pick<DeviceComment,'type'|'content'|'relatedType'|'relatedId'>,author:{uid:string;name:string}) { return {...input,content:input.content.trim(),authorUid:author.uid,authorName:author.name,status:'nowy' as const,convertedToIssueId:null,moderatedAt:null,moderatedBy:null} }
export function buildInspectionSummary(input:{conditionScore:number;statusAfterInspection:DeviceStatus},inspectionId:string){return{conditionScore:input.conditionScore,status:input.statusAfterInspection,latestInspectionId:inspectionId}}
export function buildIssueConversion(commentId:string,issueId:string){return{issue:{sourceType:'comment' as const,sourceId:commentId},comment:{status:'przyjety' as const,convertedToIssueId:issueId}}}
