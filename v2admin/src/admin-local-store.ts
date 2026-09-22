import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';

export interface AdminAuditRecord{
  readonly id:string;
  readonly at:string;
  readonly action:string;
  readonly target:string;
  readonly reason?:string;
  readonly before?:unknown;
  readonly after?:unknown;
}

const PREFIX='mfk.admin.';
const AUDIT_KEY=PREFIX+'audit.v1';

function storage(){
  return typeof window==='undefined'?null:window.localStorage;
}

export function readAdminStored<T>(key:string,fallback:T):T{
  try{
    const raw=storage()?.getItem(PREFIX+key);
    return raw?JSON.parse(raw) as T:fallback;
  }catch{return fallback;}
}

export function writeAdminStored<T>(key:string,value:T){
  try{storage()?.setItem(PREFIX+key,JSON.stringify(value));}catch{}
}

export function usePersistentAdminState<T>(key:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
  const [value,setValue]=useState<T>(()=>readAdminStored(key,initial));
  useEffect(()=>writeAdminStored(key,value),[key,value]);
  return [value,setValue];
}

export function appendAdminAudit(input:Omit<AdminAuditRecord,'id'|'at'>){
  const rows=readAdminStored<AdminAuditRecord[]>('audit.v1',[]);
  const record:AdminAuditRecord=Object.freeze({
    id:'audit-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
    at:new Date().toISOString(),
    ...input,
  });
  writeAdminStored('audit.v1',[record,...rows].slice(0,2000));
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-admin-audit'));
  return record;
}

export function readAdminAudit(){
  return readAdminStored<AdminAuditRecord[]>('audit.v1',[]);
}

export interface AdminRelease{
  readonly version:number;
  readonly createdAt:string;
  readonly label:string;
  readonly fingerprint:string;
  readonly snapshot:unknown;
  readonly reason?:string;
}
const RELEASE_KEY='releases.v1';
const ACTIVE_RELEASE_KEY='active-release.v1';

export interface ActiveAdminReleaseRef{
  readonly version:number;
  readonly createdAt:string;
  readonly fingerprint:string;
}

export function readActiveAdminRelease(){
  return readAdminStored<ActiveAdminReleaseRef|null>(ACTIVE_RELEASE_KEY,null);
}

function fnv1a(value:string){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}

export function readAdminReleases(){
  return readAdminStored<AdminRelease[]>(RELEASE_KEY,[]);
}

export function createAdminRelease(snapshot:unknown,reason?:string){
  const rows=readAdminReleases();
  const version=(rows[0]?.version??0)+1;
  const createdAt=new Date().toISOString();
  const canonical=JSON.stringify(snapshot);
  const fingerprint='fnv1a32:'+fnv1a(canonical);
  const row:AdminRelease=Object.freeze({
    version,
    createdAt,
    label:'設定版本 R'+version,
    fingerprint,
    snapshot,
    ...(reason?.trim()?{reason:reason.trim()}:{}),
  });
  writeAdminStored(RELEASE_KEY,[row,...rows].slice(0,200));
  writeAdminStored<ActiveAdminReleaseRef>(ACTIVE_RELEASE_KEY,{version,createdAt,fingerprint});
  appendAdminAudit({action:'保存並啟用設定版本',target:'Admin 設定 R'+version,after:{version,fingerprint},reason});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-admin-release'));
  return row;
}

export function restoreAdminReleaseAsDraft<T>(release:AdminRelease):T{
  appendAdminAudit({action:'讀取歷史版本作還原',target:'Admin 設定 R'+release.version,before:{version:release.version,fingerprint:release.fingerprint}});
  return structuredClone(release.snapshot) as T;
}
