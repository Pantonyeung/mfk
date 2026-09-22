import {validateRuntimeStaffAuthSnapshot,verifyStaffPin,type RuntimeStaffIdentity} from '../../../contracts/staff-auth-v1.ts';
import {readAdminSnapshotSection,subscribeSmtAdminConfig} from './admin-config-sync.ts';

export interface SmtStaffSession{
  readonly staffId:string;
  readonly displayName:string;
  readonly role:RuntimeStaffIdentity['role'];
  readonly scope:RuntimeStaffIdentity['scope'];
  readonly permissions:readonly string[];
  readonly signedInAt:string;
}

let session:SmtStaffSession|null=null;
const listeners=new Set<()=>void>();

function emit(){for(const listener of listeners)listener();}
export function subscribeStaffSession(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}
export function readActiveStaffSession(){return session;}

export function readRuntimeStaff(){
  const raw=readAdminSnapshotSection('staffAuth');
  if(!raw)return [] as readonly RuntimeStaffIdentity[];
  try{return validateRuntimeStaffAuthSnapshot(raw).staff;}
  catch{return [] as readonly RuntimeStaffIdentity[];}
}

export function staffAuthRequired(){
  return readRuntimeStaff().some(staff=>staff.active&&Boolean(staff.pinVerifier));
}

export async function loginStaff(staffId:string,pin:string){
  const staff=readRuntimeStaff().find(row=>row.staffId===staffId);
  if(!staff||!staff.active||!staff.pinVerifier)return {ok:false as const,code:'STAFF_LOGIN_NOT_AVAILABLE'};
  const ok=await verifyStaffPin(pin,staff.pinVerifier);
  if(!ok)return {ok:false as const,code:'STAFF_PIN_INVALID'};
  session=Object.freeze({
    staffId:staff.staffId,
    displayName:staff.name,
    role:staff.role,
    scope:staff.scope,
    permissions:Object.freeze([...staff.permissions]),
    signedInAt:new Date().toISOString(),
  });
  emit();
  return {ok:true as const,session};
}

export function logoutStaff(){
  session=null;
  emit();
}

export function hasStaffPermission(permission:string){
  if(!session)return !staffAuthRequired();
  return session.permissions.includes(permission);
}

let installed=false;
export function installStaffSessionInvalidation(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  subscribeSmtAdminConfig(()=>{
    if(!session)return;
    const current=readRuntimeStaff().find(row=>row.staffId===session!.staffId);
    if(!current||!current.active){
      session=null;
      emit();
      return;
    }
    session=Object.freeze({
      ...session,
      displayName:current.name,
      role:current.role,
      scope:current.scope,
      permissions:Object.freeze([...current.permissions]),
    });
    emit();
  });
}
