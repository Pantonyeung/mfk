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

const STAFF_SESSION_STORAGE_KEY='mfk:smt:staff-session:v1';

function freezeSession(value:SmtStaffSession):SmtStaffSession{
  return Object.freeze({...value,permissions:Object.freeze([...value.permissions])});
}

function persistSession(value:SmtStaffSession|null){
  if(typeof localStorage==='undefined')return;
  try{
    if(!value)localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
    else localStorage.setItem(STAFF_SESSION_STORAGE_KEY,JSON.stringify(value));
  }catch{/* Storage failure must not block frontline operation. */}
}

function restoreSession():SmtStaffSession|null{
  if(typeof localStorage==='undefined')return null;
  try{
    const raw=localStorage.getItem(STAFF_SESSION_STORAGE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Partial<SmtStaffSession>;
    if(!parsed||typeof parsed.staffId!=='string'||!parsed.staffId||typeof parsed.signedInAt!=='string')return null;
    const current=readRuntimeStaff().find(row=>row.staffId===parsed.staffId);
    if(!current||!current.active){localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);return null;}
    return freezeSession({
      staffId:current.staffId,
      displayName:current.name,
      role:current.role,
      scope:current.scope,
      permissions:current.permissions,
      signedInAt:parsed.signedInAt,
    });
  }catch{return null;}
}

let session:SmtStaffSession|null=null;
let restoreAttempted=false;
const listeners=new Set<()=>void>();

function emit(){for(const listener of listeners)listener();}
export function subscribeStaffSession(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}
export function readActiveStaffSession(){
  if(!session&&!restoreAttempted){
    restoreAttempted=true;
    session=restoreSession();
  }
  return session;
}

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
  session=freezeSession({
    staffId:staff.staffId,
    displayName:staff.name,
    role:staff.role,
    scope:staff.scope,
    permissions:staff.permissions,
    signedInAt:new Date().toISOString(),
  });
  restoreAttempted=true;
  persistSession(session);
  emit();
  return {ok:true as const,session};
}

export function logoutStaff(){
  session=null;
  restoreAttempted=true;
  persistSession(null);
  emit();
}

export function hasStaffPermission(permission:string){
  const active=readActiveStaffSession();
  if(!active)return !staffAuthRequired();
  return active.permissions.includes(permission);
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
      persistSession(null);
      emit();
      return;
    }
    session=freezeSession({
      ...session,
      displayName:current.name,
      role:current.role,
      scope:current.scope,
      permissions:current.permissions,
    });
    persistSession(session);
    emit();
  });
}
