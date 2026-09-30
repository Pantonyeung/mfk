import {validateMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateRuntimeStaffAuthSnapshot,type StaffPinVerifier} from '../../contracts/staff-auth-v1.ts';
import {OPTION_SET_CENTER_STORAGE_KEYS} from './admin-option-set-center.ts';
import {readAdminStored,writeAdminStored,type AdminRelease} from './admin-local-store.ts';

export interface AdminBrowserSession{
  readonly staffId:string;
  readonly loginId:string;
  readonly displayName:string;
  readonly role:string;
  readonly scope:string;
  readonly permissions:readonly string[];
  readonly sessionToken:string;
  readonly expiresAt?:string;
}

const SESSION_KEY='browser-session.v1';
const STORE_ID='MF01';

function cleanSession(value:unknown):AdminBrowserSession|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const staffId=String(row.staffId??'').trim();
  const loginId=String(row.loginId??'').trim();
  const displayName=String(row.displayName??'').trim();
  const sessionToken=String(row.sessionToken??'').trim();
  if(!staffId||!loginId||!displayName||sessionToken.length<32)return null;
  return Object.freeze({
    staffId,loginId,displayName,
    role:String(row.role??''),
    scope:String(row.scope??'STORE'),
    permissions:Object.freeze(Array.isArray(row.permissions)?row.permissions.map(String):[]),
    sessionToken,
    ...(typeof row.expiresAt==='string'?{expiresAt:row.expiresAt}:{}),
  });
}
export function readStoredAdminBrowserSession(){
  return cleanSession(readAdminStored<unknown>(SESSION_KEY,null));
}
function saveSession(value:AdminBrowserSession|null){
  writeAdminStored(SESSION_KEY,value);
}
function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new Error('ADMIN_BROWSER_AUTH_HEX_INVALID');
  const out=new Uint8Array(value.length/2);
  for(let i=0;i<out.length;i++)out[i]=Number.parseInt(value.slice(i*2,i*2+2),16);
  return out;
}
function bytesToHex(bytes:Uint8Array){return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function derivePinKeyHex(pin:string,saltHex:string,iterations:number){
  if(!Number.isSafeInteger(iterations)||iterations<100000)throw new Error('ADMIN_BROWSER_AUTH_ITERATIONS_INVALID');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:hexToBytes(saltHex),iterations},key,256);
  return bytesToHex(new Uint8Array(bits));
}
async function hmacHex(keyHex:string,message:string){
  const key=await crypto.subtle.importKey('raw',hexToBytes(keyHex),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}
async function request(path:string,init:RequestInit={}){
  const response=await fetch(path,init);
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.message||body.code||'ADMIN_BROWSER_HTTP_'+response.status));
  return body;
}
export async function loginAdminBrowser(loginId:string,pin:string){
  const account=String(loginId||'').trim();
  const cleanPin=String(pin||'').replace(/\D/g,'');
  if(!account)throw new Error('請輸入登入編號');
  if(cleanPin.length<4||cleanPin.length>8)throw new Error('PIN 必須為 4–8 位數字');
  const challenge=await request('/api/admin-browser/auth/challenge?storeId='+encodeURIComponent(STORE_ID),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:account}),
  });
  const challengeId=String(challenge.challengeId??'').trim();
  const nonce=String(challenge.nonce??'').trim();
  const saltHex=String(challenge.saltHex??'').trim();
  const iterations=Number(challenge.iterations);
  if(!challengeId||!nonce||!saltHex||!Number.isSafeInteger(iterations))throw new Error('ADMIN_BROWSER_AUTH_CHALLENGE_INVALID');
  const derived=await derivePinKeyHex(cleanPin,saltHex,iterations);
  const proofHex=await hmacHex(derived,'MFK_ADMIN_BROWSER_LOGIN_V1\n'+challengeId+'\n'+account+'\n'+nonce);
  const body=await request('/api/admin-browser/auth/verify?storeId='+encodeURIComponent(STORE_ID),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:account,challengeId,proofHex}),
  });
  const session=cleanSession(body);
  if(!session)throw new Error('ADMIN_BROWSER_SESSION_INVALID');
  saveSession(session);
  return session;
}
export async function refreshAdminBrowserSession(){
  const current=readStoredAdminBrowserSession();
  if(!current)return null;
  try{
    const body=await request('/api/admin-browser/auth/session?storeId='+encodeURIComponent(STORE_ID),{
      method:'GET',cache:'no-store',headers:{'x-mfk-admin-session':current.sessionToken},
    });
    const next=cleanSession({...body,sessionToken:current.sessionToken});
    if(!next){saveSession(null);return null;}
    saveSession(next);return next;
  }catch{saveSession(null);return null;}
}
export async function logoutAdminBrowser(){
  const current=readStoredAdminBrowserSession();saveSession(null);if(!current)return;
  try{await request('/api/admin-browser/auth/session?storeId='+encodeURIComponent(STORE_ID),{method:'POST',headers:{'x-mfk-admin-session':current.sessionToken}});}catch{}
}
export async function readCanonicalAdminActive(){
  const session=readStoredAdminBrowserSession();
  if(!session)throw new Error('ADMIN_BROWSER_SESSION_REQUIRED');
  const body=await request('/api/admin-browser/active?storeId='+encodeURIComponent(STORE_ID),{
    method:'GET',cache:'no-store',headers:{'x-mfk-admin-session':session.sessionToken},
  });
  return validateMfkAdminConfigEnvelope(body);
}

function canonicalStaffDrafts(snapshot:Readonly<Record<string,unknown>>){
  try{
    const auth=validateRuntimeStaffAuthSnapshot(snapshot.staffAuth);
    return auth.staff.map(staff=>Object.freeze({
      id:staff.staffId,
      loginId:staff.loginId,
      name:staff.name,
      role:staff.role,
      pin:'',
      ...(staff.pinVerifier?{pinVerifier:Object.freeze({...staff.pinVerifier} as StaffPinVerifier)}:{}),
      scope:staff.scope,
      adminLogin:staff.adminLogin,
      active:staff.active,
      permissions:Object.freeze([...staff.permissions]),
    }));
  }catch{return Object.freeze([]);}
}
function writeIfPresent(snapshot:Readonly<Record<string,unknown>>,sourceKey:string,storageKey:string){
  if(Object.prototype.hasOwnProperty.call(snapshot,sourceKey))writeAdminStored(storageKey,snapshot[sourceKey]);
}
export function hydrateAdminFromCanonical(envelope:MfkAdminConfigEnvelope){
  const snapshot=envelope.snapshot;
  const staff=canonicalStaffDrafts(snapshot);
  if(snapshot.catalog)writeAdminStored('catalog-draft.v2',snapshot.catalog);
  writeAdminStored('catalog-dirty.v1',false);
  if(snapshot.optionCenter&&typeof snapshot.optionCenter==='object'&&!Array.isArray(snapshot.optionCenter)){
    const optionCenter=snapshot.optionCenter as Record<string,unknown>;
    writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.sets,Array.isArray(optionCenter.sets)?optionCenter.sets:[]);
    writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.productLinks,Array.isArray(optionCenter.productLinks)?optionCenter.productLinks:[]);
    writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.dirty,false);
  }
  if(staff.length)writeAdminStored('staff.v1',staff);
  for(const [sourceKey,storageKey] of[
    ['availability','availability.v1'],['businessDay','business-day.v1'],['logicalPrinters','logical-printers.v1'],
    ['printTemplates','print-templates.v1'],['printRules','print-rules.v1'],['productMedia','product-media.v1'],
    ['storeSettings','store-settings.v1'],['quickReasons','quick-reasons.v1'],['channelPolicy','channel-policy.keeta.v1'],
    ['customerChannelPolicy','channel-policy.customer.v1'],['channelMapping','channel-mapping.keeta.v1'],
    ['capacity','capacity.v1'],['inventory','inventory-lite.v1'],['loyalty','loyalty.v1'],['coupons','coupons.v1'],
    ['pricingPromotions','pricing-promotions.v1'],['announcements','announcements.v1'],
  ] as const)writeIfPresent(snapshot,sourceKey,storageKey);
  if(snapshot.presentation&&typeof snapshot.presentation==='object'&&!Array.isArray(snapshot.presentation)){
    const presentation=snapshot.presentation as Record<string,unknown>;
    if(presentation.customer!==undefined)writeAdminStored('presentation.customer.v1',presentation.customer);
    if(presentation.owner!==undefined)writeAdminStored('presentation.owner.v1',presentation.owner);
    if(presentation.frontline!==undefined)writeAdminStored('presentation.frontline.v1',presentation.frontline);
  }
  const editableSnapshot=Object.freeze({...snapshot,staff,staffAuth:undefined});
  const release:AdminRelease=Object.freeze({
    version:envelope.revision,
    createdAt:envelope.publishedAt,
    label:'設定版本 R'+envelope.revision,
    fingerprint:envelope.adminFingerprint,
    snapshot:editableSnapshot,
    reason:'CANONICAL_CLOUD_HYDRATION',
  });
  const releases=readAdminStored<AdminRelease[]>('releases.v1',[]);
  writeAdminStored(
    'releases.v1',
    [release,...releases.filter(row=>!(row.createdAt===release.createdAt&&row.fingerprint===release.fingerprint))]
      .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
      .slice(0,200),
  );
  writeAdminStored('active-release.v1',{version:envelope.revision,createdAt:envelope.publishedAt,fingerprint:envelope.adminFingerprint});
  const activePublishedAt=Date.parse(envelope.publishedAt);
  const pendingOutbox=readAdminStored<Array<{revision?:number;publishedAt?:string;fingerprint?:string}>>('sync-outbox.v1',[]).filter(row=>{
    if(row.fingerprint===envelope.fingerprint)return false;
    const at=Date.parse(String(row.publishedAt||''));
    if(Number.isFinite(at))return at>activePublishedAt;
    // Legacy pre-time-first outbox rows may not carry publishedAt.
    // Keep only rows that were historically queued after this diagnostic revision.
    const legacyRevision=Number(row.revision);
    return Number.isSafeInteger(legacyRevision)&&legacyRevision>envelope.revision;
  });
  writeAdminStored('sync-outbox.v1',pendingOutbox);
  writeAdminStored('sync-status.v1',{
    state:'PUBLISHED',
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    adminFingerprint:envelope.adminFingerprint,
    cloudPublishedAt:envelope.publishedAt,
    updatedAt:new Date().toISOString(),
  });
  writeAdminStored('canonical-hydrated.v1',{
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    publishedAt:envelope.publishedAt,
    hydratedAt:new Date().toISOString(),
  });
  return envelope.revision;
}
