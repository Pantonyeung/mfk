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

function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new Error('SMM_AUTH_HEX_INVALID');
  const output=new Uint8Array(value.length/2);
  for(let i=0;i<output.length;i++)output[i]=Number.parseInt(value.slice(i*2,i*2+2),16);
  return output;
}
function bytesToHex(bytes:Uint8Array){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function derivePinKeyHex(pin:string,saltHex:string,iterations:number){
  if(!Number.isSafeInteger(iterations)||iterations<100000)throw new Error('SMM_AUTH_ITERATIONS_INVALID');
  const key=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits=await crypto.subtle.deriveBits({
    name:'PBKDF2',
    hash:'SHA-256',
    salt:hexToBytes(saltHex),
    iterations,
  },key,256);
  return bytesToHex(new Uint8Array(bits));
}
async function hmacHex(keyHex:string,message:string){
  const key=await crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign'],
  );
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

export async function verifySmmStaff(staffId:string,pin:string):Promise<SmmStaffSession>{
  const cleanPin=String(pin||'').replace(/\D/g,'');
  if(cleanPin.length<4||cleanPin.length>8)throw new Error('PIN 必須為 4–8 位數字');

  const challengeResponse=await fetch('/api/smm/staff/challenge',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({staffId}),
  });
  const challengeBody=await challengeResponse.json().catch(()=>({})) as Record<string,unknown>;
  if(!challengeResponse.ok){
    throw new Error(String(challengeBody.message||challengeBody.code||'未能開始員工驗證')+' · HTTP '+challengeResponse.status);
  }

  const challengeId=String(challengeBody.challengeId??'').trim();
  const nonce=String(challengeBody.nonce??'').trim();
  const saltHex=String(challengeBody.saltHex??'').trim();
  const iterations=Number(challengeBody.iterations);
  if(!challengeId||!nonce||!saltHex||!Number.isSafeInteger(iterations)){
    throw new Error('SMM_AUTH_CHALLENGE_INVALID');
  }

  let derivedHex:string;
  try{
    derivedHex=await derivePinKeyHex(cleanPin,saltHex,iterations);
  }catch(error){
    throw new Error(error instanceof Error?'瀏覽器 PIN 驗證失敗：'+error.message:'瀏覽器 PIN 驗證失敗');
  }
  const proofMessage='MFK_SMM_STAFF_LOGIN_V1\n'+challengeId+'\n'+staffId+'\n'+nonce;
  const proofHex=await hmacHex(derivedHex,proofMessage);

  const response=await fetch('/api/smm/staff/verify',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({staffId,challengeId,proofHex}),
  });
  const raw=await response.text();
  let body:Record<string,unknown>={};
  try{body=raw?JSON.parse(raw) as Record<string,unknown>:{};}catch{}
  if(!response.ok){
    const code=String(body.code||'SMM_STAFF_VERIFY_HTTP_'+response.status);
    const message=String(body.message||'員工帳戶驗證失敗');
    throw new Error(message+' · '+code+' · HTTP '+response.status);
  }

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
