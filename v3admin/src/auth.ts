const STORE_ID='MF01';

export interface V3AdminSession{
  readonly staffId:string;
  readonly loginId:string;
  readonly displayName:string;
  readonly role:string;
  readonly scope:string;
  readonly permissions:readonly string[];
  readonly sessionToken:string;
  readonly expiresAt?:string;
}

interface Challenge{
  readonly challengeId:string;
  readonly nonce:string;
  readonly saltHex:string;
  readonly iterations:number;
}

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}

function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new Error('V3_ADMIN_AUTH_HEX_INVALID');
  const out=new Uint8Array(value.length/2);
  for(let i=0;i<out.length;i++)out[i]=Number.parseInt(value.slice(i*2,i*2+2),16);
  return out;
}

function bytesToHex(bytes:Uint8Array){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function derivePinKeyHex(pin:string,saltHex:string,iterations:number){
  if(!Number.isSafeInteger(iterations)||iterations<100000)throw new Error('V3_ADMIN_AUTH_ITERATIONS_INVALID');
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
  const response=await fetch(apiBase()+path,init);
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.message||body.code||'V3_ADMIN_HTTP_'+response.status));
  return body;
}

function cleanSession(value:unknown):V3AdminSession{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('V3_ADMIN_SESSION_INVALID');
  const row=value as Record<string,unknown>;
  const sessionToken=String(row.sessionToken??'').trim();
  const staffId=String(row.staffId??'').trim();
  const loginId=String(row.loginId??'').trim();
  const displayName=String(row.displayName??'').trim();
  if(sessionToken.length<32||!staffId||!loginId||!displayName)throw new Error('V3_ADMIN_SESSION_INVALID');
  return Object.freeze({
    staffId,
    loginId,
    displayName,
    role:String(row.role??''),
    scope:String(row.scope??'STORE'),
    permissions:Object.freeze(Array.isArray(row.permissions)?row.permissions.map(String):[]),
    sessionToken,
    ...(typeof row.expiresAt==='string'?{expiresAt:row.expiresAt}:{}),
  });
}

export async function deriveV3AdminProofHex(input:{
  readonly pin:string;
  readonly loginId:string;
  readonly challengeId:string;
  readonly nonce:string;
  readonly saltHex:string;
  readonly iterations:number;
}){
  const derived=await derivePinKeyHex(input.pin,input.saltHex,input.iterations);
  return hmacHex(derived,'MFK_ADMIN_BROWSER_LOGIN_V1\n'+input.challengeId+'\n'+input.loginId+'\n'+input.nonce);
}

export async function loginV3Admin(loginId:string,pin:string):Promise<V3AdminSession>{
  const account=String(loginId||'').trim();
  const cleanPin=String(pin||'').replace(/\D/g,'');
  if(!account)throw new Error('請輸入登入編號');
  if(cleanPin.length<4||cleanPin.length>8)throw new Error('PIN 必須為 4–8 位數字');

  const rawChallenge=await request('/api/admin-browser/auth/challenge?storeId='+encodeURIComponent(STORE_ID),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({loginId:account}),
  });
  const challenge:Challenge={
    challengeId:String(rawChallenge.challengeId??'').trim(),
    nonce:String(rawChallenge.nonce??'').trim(),
    saltHex:String(rawChallenge.saltHex??'').trim(),
    iterations:Number(rawChallenge.iterations),
  };
  if(!challenge.challengeId||!challenge.nonce||!challenge.saltHex||!Number.isSafeInteger(challenge.iterations)){
    throw new Error('V3_ADMIN_AUTH_CHALLENGE_INVALID');
  }

  const proofHex=await deriveV3AdminProofHex({
    pin:cleanPin,
    loginId:account,
    ...challenge,
  });

  const verified=await request('/api/admin-browser/auth/verify?storeId='+encodeURIComponent(STORE_ID),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({loginId:account,challengeId:challenge.challengeId,proofHex}),
  });
  return cleanSession(verified);
}

export async function logoutV3Admin(sessionToken:string){
  if(!sessionToken)return;
  try{
    await request('/api/admin-browser/auth/session?storeId='+encodeURIComponent(STORE_ID),{
      method:'POST',
      headers:{'x-mfk-admin-session':sessionToken},
    });
  }catch{}
}
