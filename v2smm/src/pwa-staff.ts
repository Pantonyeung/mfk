export interface SmmStaffDirectoryItem{
  readonly staffId:string;
  readonly displayName:string;
  readonly role:string;
}

export interface SmmStaffSession extends SmmStaffDirectoryItem{
  readonly sessionToken:string;
  readonly expiresAt?:string;
}

const KEY='mfk.smm.staff-session.v2';
const LEGACY_KEY='mfk.smm.staff-session.v1';

function cleanSession(value:unknown):SmmStaffSession|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const staffId=String(row.staffId??'').trim();
  const displayName=String(row.displayName??'').trim();
  const role=String(row.role??'').trim();
  const sessionToken=String(row.sessionToken??'').trim();
  const expiresAt=typeof row.expiresAt==='string'?row.expiresAt:undefined;
  if(!staffId||!displayName||sessionToken.length<32)return null;
  return Object.freeze({staffId,displayName,role,sessionToken,...(expiresAt?{expiresAt}:{})});
}

export function readSmmStaffSession():SmmStaffSession|null{
  try{
    localStorage.removeItem(LEGACY_KEY);
    const raw=localStorage.getItem(KEY);
    return raw?cleanSession(JSON.parse(raw)):null;
  }catch{return null;}
}

export function saveSmmStaffSession(value:SmmStaffSession){
  localStorage.setItem(KEY,JSON.stringify(value));
}

export function clearSmmStaffSession(){
  try{
    const session=readSmmStaffSession();
    localStorage.removeItem(KEY);
    if(session){
      void fetch('/api/smm/staff/session',{
        method:'POST',
        headers:{'x-mfk-smm-session':session.sessionToken},
      }).catch(()=>{});
    }
  }catch{}
}

export async function refreshSmmStaffSession():Promise<SmmStaffSession|null>{
  const current=readSmmStaffSession();
  if(!current)return null;
  try{
    const response=await fetch('/api/smm/staff/session',{
      method:'GET',
      cache:'no-store',
      headers:{'x-mfk-smm-session':current.sessionToken},
    });
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok){localStorage.removeItem(KEY);return null;}
    const next=cleanSession({
      staffId:body.staffId,
      displayName:body.displayName,
      role:body.role,
      sessionToken:current.sessionToken,
      expiresAt:body.expiresAt??current.expiresAt,
    });
    if(!next){localStorage.removeItem(KEY);return null;}
    saveSmmStaffSession(next);
    return next;
  }catch{
    // Keep the last trusted device session during temporary network failure.
    return current;
  }
}

export async function listSmmStaff():Promise<readonly SmmStaffDirectoryItem[]>{
  const response=await fetch('/api/smm/staff',{cache:'no-store',headers:{accept:'application/json'}});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.code||'SMM_STAFF_DIRECTORY_FAILED'));
  const staff=Array.isArray(body.staff)?body.staff:[];
  return Object.freeze(staff.flatMap(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return[];
    const row=raw as Record<string,unknown>;
    const staffId=String(row.staffId??'').trim();
    const displayName=String(row.displayName??'').trim();
    const role=String(row.role??'').trim();
    return staffId&&displayName?[Object.freeze({staffId,displayName,role})]:[];
  }));
}

export async function verifySmmStaff(staffId:string,pin:string):Promise<SmmStaffSession>{
  const cleanPin=String(pin||'').replace(/\D/g,'');
  if(cleanPin.length<4||cleanPin.length>8)throw new Error('PIN 必須為 4–8 位數字');
  const response=await fetch('/api/smm/staff/verify',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({staffId,pin:cleanPin}),
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.message||body.code||'員工帳戶驗證失敗'));
  const session=cleanSession({
    staffId:body.staffId,
    displayName:body.displayName,
    role:body.role,
    sessionToken:body.sessionToken,
    expiresAt:body.expiresAt,
  });
  if(!session)throw new Error('SMM_STAFF_SESSION_INVALID');
  saveSmmStaffSession(session);
  return session;
}
