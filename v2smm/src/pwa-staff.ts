export interface SmmStaffDirectoryItem{
  readonly staffId:string;
  readonly displayName:string;
  readonly role:string;
}

export interface SmmStaffSession extends SmmStaffDirectoryItem{
  readonly pin:string;
}

const KEY='mfk.smm.staff-session.v1';

function cleanSession(value:unknown):SmmStaffSession|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const staffId=String(row.staffId??'').trim();
  const displayName=String(row.displayName??'').trim();
  const role=String(row.role??'').trim();
  const pin=String(row.pin??'').replace(/\D/g,'');
  if(!staffId||!displayName||pin.length<4||pin.length>8)return null;
  return Object.freeze({staffId,displayName,role,pin});
}

export function readSmmStaffSession():SmmStaffSession|null{
  try{
    const raw=sessionStorage.getItem(KEY);
    return raw?cleanSession(JSON.parse(raw)):null;
  }catch{return null;}
}

export function saveSmmStaffSession(value:SmmStaffSession){
  sessionStorage.setItem(KEY,JSON.stringify(value));
}

export function clearSmmStaffSession(){
  sessionStorage.removeItem(KEY);
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
  if(!response.ok)throw new Error(String(body.message||body.code||'員工驗證失敗'));
  const session=cleanSession({
    staffId:body.staffId,
    displayName:body.displayName,
    role:body.role,
    pin:cleanPin,
  });
  if(!session)throw new Error('SMM_STAFF_SESSION_INVALID');
  saveSmmStaffSession(session);
  return session;
}
