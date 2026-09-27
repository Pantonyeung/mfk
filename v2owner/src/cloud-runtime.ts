import type {OwnerAuthSession,OwnerChannelHealth,OwnerPlanningCommandResult,OwnerPlanningSaveInput,OwnerPlanningSnapshot,OwnerReadModelSnapshot,OwnerRuntimePort} from './product-types';

const OWNER_API_ORIGIN='https://admin.morefunos.com';
const STORE_ID='MF01';
const SESSION_KEY='mfk.owner.session.v1';

export class OwnerRuntimeError extends Error{
  readonly code:string;
  constructor(code:string,message?:string){super(message??code);this.code=code;}
}

function cleanSession(value:unknown):OwnerAuthSession|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const staffId=String(row.staffId??'').trim();
  const loginId=String(row.loginId??row.staffId??'').trim();
  const displayName=String(row.displayName??'').trim();
  const sessionToken=String(row.sessionToken??'').trim();
  if(!staffId||!loginId||!displayName||String(row.role)!=='OWNER'||sessionToken.length<32)return null;
  return Object.freeze({
    staffId,loginId,displayName,role:'OWNER',
    scope:String(row.scope??'STORE'),
    permissions:Object.freeze(Array.isArray(row.permissions)?row.permissions.map(String):[]),
    sessionToken,
    ...(typeof row.expiresAt==='string'?{expiresAt:row.expiresAt}:{}),
  });
}
export function readStoredOwnerSession():OwnerAuthSession|null{
  if(typeof localStorage==='undefined')return null;
  try{const raw=localStorage.getItem(SESSION_KEY);return raw?cleanSession(JSON.parse(raw)):null;}catch{return null;}
}
function saveOwnerSession(value:OwnerAuthSession|null){
  if(typeof localStorage==='undefined')return;
  if(!value)localStorage.removeItem(SESSION_KEY);else localStorage.setItem(SESSION_KEY,JSON.stringify(value));
}
function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new OwnerRuntimeError('OWNER_AUTH_HEX_INVALID');
  const output=new Uint8Array(value.length/2);for(let i=0;i<output.length;i++)output[i]=Number.parseInt(value.slice(i*2,i*2+2),16);return output;
}
function bytesToHex(bytes:Uint8Array){return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function derivePinKeyHex(pin:string,saltHex:string,iterations:number){
  if(!Number.isSafeInteger(iterations)||iterations<100000)throw new OwnerRuntimeError('OWNER_AUTH_ITERATIONS_INVALID');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:hexToBytes(saltHex),iterations},key,256);
  return bytesToHex(new Uint8Array(bits));
}
async function hmacHex(keyHex:string,message:string){
  const key=await crypto.subtle.importKey('raw',hexToBytes(keyHex),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));return bytesToHex(new Uint8Array(signature));
}
async function ownerFetch(path:string,init:RequestInit={}){
  let response:Response;
  try{response=await fetch(OWNER_API_ORIGIN+path,init);}catch{throw new OwnerRuntimeError('OWNER_NETWORK_ERROR','暫時未能連接 Owner 服務');}
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new OwnerRuntimeError(String(body.code||'OWNER_HTTP_'+response.status),String(body.message||body.code||'Owner 服務暫時不可用'));
  return body;
}
export async function refreshOwnerSession():Promise<OwnerAuthSession|null>{
  const current=readStoredOwnerSession();if(!current)return null;
  try{
    const body=await ownerFetch('/api/owner/auth/session?storeId='+encodeURIComponent(STORE_ID),{method:'GET',cache:'no-store',headers:{'x-mfk-owner-session':current.sessionToken}});
    const next=cleanSession({...body,sessionToken:current.sessionToken});if(!next){saveOwnerSession(null);return null;}saveOwnerSession(next);return next;
  }catch(error){
    if(error instanceof OwnerRuntimeError&&error.code==='OWNER_NETWORK_ERROR')return current;
    saveOwnerSession(null);return null;
  }
}
export async function loginOwner(loginId:string,pin:string):Promise<OwnerAuthSession>{
  const id=String(loginId||'').trim(),cleanPin=String(pin||'').replace(/\D/g,'');
  if(!id)throw new OwnerRuntimeError('OWNER_LOGIN_ID_REQUIRED','請輸入登入編號');
  if(cleanPin.length<4||cleanPin.length>8)throw new OwnerRuntimeError('OWNER_PIN_INVALID','PIN 必須為 4–8 位數字');
  const challenge=await ownerFetch('/api/owner/auth/challenge?storeId='+encodeURIComponent(STORE_ID),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:id})});
  const challengeId=String(challenge.challengeId??'').trim(),nonce=String(challenge.nonce??'').trim(),saltHex=String(challenge.saltHex??'').trim(),iterations=Number(challenge.iterations);
  if(!challengeId||!nonce||!saltHex||!Number.isSafeInteger(iterations))throw new OwnerRuntimeError('OWNER_AUTH_CHALLENGE_INVALID');
  const derived=await derivePinKeyHex(cleanPin,saltHex,iterations);
  const proofHex=await hmacHex(derived,'MFK_OWNER_LOGIN_V1\n'+challengeId+'\n'+id+'\n'+nonce);
  const body=await ownerFetch('/api/owner/auth/verify?storeId='+encodeURIComponent(STORE_ID),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:id,challengeId,proofHex})});
  const session=cleanSession(body);if(!session)throw new OwnerRuntimeError('OWNER_SESSION_INVALID');saveOwnerSession(session);return session;
}
export async function logoutOwner(){
  const current=readStoredOwnerSession();saveOwnerSession(null);if(!current)return;
  try{await ownerFetch('/api/owner/auth/session?storeId='+encodeURIComponent(STORE_ID),{method:'POST',headers:{'x-mfk-owner-session':current.sessionToken}});}catch{}
}

function requireOwnerSession():OwnerAuthSession{
  const session=readStoredOwnerSession();
  if(!session)throw new OwnerRuntimeError('OWNER_SESSION_REQUIRED','請先登入 Owner App');
  return session;
}
function ownerSessionHeaders(extra:Record<string,string>={}){
  const session=requireOwnerSession();
  return {'x-mfk-owner-session':session.sessionToken,...extra};
}
export async function readOwnerChannels():Promise<readonly OwnerChannelHealth[]>{
  const body=await ownerFetch('/api/owner/channels?storeId='+encodeURIComponent(STORE_ID),{
    method:'GET',cache:'no-store',headers:ownerSessionHeaders(),
  });
  return Object.freeze(Array.isArray(body.channels)?body.channels as unknown as OwnerChannelHealth[]:[]);
}
export async function readOwnerPlanning(monthKey:string):Promise<OwnerPlanningSnapshot>{
  const body=await ownerFetch('/api/owner/planning?storeId='+encodeURIComponent(STORE_ID)+'&monthKey='+encodeURIComponent(monthKey),{
    method:'GET',cache:'no-store',headers:ownerSessionHeaders(),
  });
  return body as unknown as OwnerPlanningSnapshot;
}
export async function saveOwnerPlanning(input:OwnerPlanningSaveInput):Promise<OwnerPlanningCommandResult>{
  const body=await ownerFetch('/api/owner/planning?storeId='+encodeURIComponent(STORE_ID),{
    method:'POST',
    headers:ownerSessionHeaders({'content-type':'application/json'}),
    body:JSON.stringify(input),
  });
  return body as unknown as OwnerPlanningCommandResult;
}
export function createCloudOwnerRuntimePort():OwnerRuntimePort{
  return Object.freeze({
    portId:'MFK_OWNER_PORT_V1' as const,
    readOwnerSession:refreshOwnerSession,loginOwner,logoutOwner,
    readChannels:readOwnerChannels,
    readPlanning:readOwnerPlanning,
    savePlanning:saveOwnerPlanning,
    async readSnapshot():Promise<OwnerReadModelSnapshot>{
      const session=readStoredOwnerSession();if(!session)throw new OwnerRuntimeError('OWNER_SESSION_REQUIRED','請先登入 Owner App');
      const body=await ownerFetch('/api/owner/snapshot?storeId='+encodeURIComponent(STORE_ID),{method:'GET',cache:'no-store',headers:{'x-mfk-owner-session':session.sessionToken}});
      return body as unknown as OwnerReadModelSnapshot;
    },
  });
}
