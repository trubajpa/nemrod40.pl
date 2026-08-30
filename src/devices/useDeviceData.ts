import { useEffect, useState } from 'react'
import { subscribeDevices, getDevice } from './deviceRepository'
import { subscribeComments } from './commentRepository'
import { subscribeInspections } from './inspectionRepository'
import { subscribeIssues } from './issueRepository'
import { subscribeMedia } from './mediaRepository'
import { subscribeRepairs } from './repairRepository'
import type { Device, DeviceComment, DeviceMedia, Inspection, Issue, Repair } from './models'

export function useDevices(){const [devices,setDevices]=useState<Device[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');useEffect(()=>subscribeDevices(x=>{setDevices(x);setLoading(false)},m=>{setError(m);setLoading(false)}),[]);return{devices,loading,error}}
export function useDeviceDetails(id:string){const [device,setDevice]=useState<Device|null>(null);const [inspections,setInspections]=useState<Inspection[]>([]);const [issues,setIssues]=useState<Issue[]>([]);const [comments,setComments]=useState<DeviceComment[]>([]);const [repairs,setRepairs]=useState<Repair[]>([]);const [media,setMedia]=useState<DeviceMedia[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');useEffect(()=>{let active=true;void getDevice(id).then(x=>{if(active){setDevice(x);setLoading(false)}}).catch(()=>{if(active){setError('Nie udało się pobrać urządzenia.');setLoading(false)}});const fail=()=>setError('Część historii nie mogła zostać pobrana.');const unsub=[subscribeInspections(id,setInspections,fail),subscribeIssues(id,setIssues,fail),subscribeComments(id,setComments,fail),subscribeRepairs(id,setRepairs,fail),subscribeMedia(id,setMedia,fail)];return()=>{active=false;unsub.forEach(fn=>fn())}},[id]);return{device,inspections,issues,comments,repairs,media,loading,error}}
