const KEETA_AUTHORIZE_URL='https://merchant.mykeeta.com/m/web/openapi/authorize';
const KEETA_TOKEN_URL='https://open.mykeeta.com/api/open/base/oauth/token';
const TOKEN_REFRESH_WINDOW_MS=5*24*60*60*1000;
const TOKEN_REFRESH_MIN_INTERVAL_MS=60_000;
const OAUTH_STATE_TTL_MS=10*60*1000;

const KEETA_WEBHOOK_EVENTS=Object.freeze({
  1001:'ORDER_PLACEMENT',
  1002:'ORDER_ACCEPTANCE',
  1003:'ORDER_COMPLETION',
  1004:'ORDER_CANCELLATION',
  1005:'REFUND_INITIATION',
  1006:'DELIVERY_STATUS_UPDATE',
  1007:'PARTIAL_REFUND_INITIATION',
  1008:'OBSERVED_SYSTEM_ORDER_CANCELLATION',
  1101:'STORE_BUSINESS_HOURS_CHANGE',
  1102:'STORE_STATUS_CHANGE',
  1201:'PICTURE_BIND_TASK_COMPLETION',
  1202:'MENU_SYNC_TASK_COMPLETION',
});

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const encoder=new TextEncoder();
const decoder=new TextDecoder();

function json(value,status=200,extra={}){
  return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extra}});
}
function record(value,code){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value;
}
function nonEmpty(value,code){
  if(typeof value!=='string'||!value.trim())throw new Error(code);
  return value.trim();
}
function positiveInt(value,code){
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<=0)throw new Error(code);
  return parsed;
}
function bytesToHex(bytes){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function signatureValue(value){
  if(value===null)return 'null';
  if(value===undefined)return '';
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}

export function buildKeetaRuntimeSignaturePreimage(url,params,appSecret){
  const endpoint=nonEmpty(url,'KEETA_SIGNATURE_URL_REQUIRED');
  const secret=nonEmpty(appSecret,'KEETA_APP_SECRET_UNAVAILABLE');
  const row=record(params,'KEETA_SIGNATURE_PARAMS_INVALID');
  const ordered=Object.keys(row)
    .filter(key=>key!=='sig')
    .sort()
    .map(key=>key+'='+signatureValue(row[key]))
    .join('&');
  return endpoint+'?'+ordered+secret;
}

export async function signKeetaRuntimeParams(url,params,appSecret){
  const preimage=buildKeetaRuntimeSignaturePreimage(url,params,appSecret);
  return Object.freeze({...params,sig:await sha256Hex(preimage)});
}

function parseTokenMaterial(input){
  const row=typeof input==='string'?JSON.parse(input):record(input,'KEETA_TOKEN_RESPONSE_INVALID_SHAPE');
  if(!row||typeof row!=='object'||Array.isArray(row)
    ||typeof row.accessToken!=='string'||!row.accessToken
    ||row.tokenType!=='bearer'
    ||!Number.isFinite(Number(row.expiresIn))||Number(row.expiresIn)<=0
    ||typeof row.refreshToken!=='string'||!row.refreshToken
    ||typeof row.scope!=='string'
    ||!Number.isFinite(Number(row.issuedAtTime))||Number(row.issuedAtTime)<0){
    throw new Error('KEETA_TOKEN_RESPONSE_INVALID_SHAPE');
  }
  return Object.freeze({
    accessToken:row.accessToken,
    tokenType:'bearer',
    expiresIn:Number(row.expiresIn),
    refreshToken:row.refreshToken,
    scope:row.scope,
    issuedAtTime:Number(row.issuedAtTime),
  });
}

function tokenAssessment(token,nowMs=Date.now()){
  const expiresAtMs=token.issuedAtTime+token.expiresIn*1000;
  const refreshAtMs=expiresAtMs-TOKEN_REFRESH_WINDOW_MS;
  return Object.freeze({
    disposition:nowMs>=expiresAtMs?'EXPIRED':nowMs>=refreshAtMs?'REFRESH_DUE':'VALID',
    expiresAtMs,
    refreshAtMs,
  });
}

function decodeBase64(value,code){
  try{
    const binary=atob(nonEmpty(value,code));
    return Uint8Array.from(binary,char=>char.charCodeAt(0));
  }catch{throw new Error(code)}
}
function encodeBase64(value){
  let binary='';
  for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary);
}
function toArrayBuffer(value){
  const copy=new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
async function importEncryptionKey(raw){
  const bytes=decodeBase64(raw,'KEETA_TOKEN_ENCRYPTION_KEY_INVALID');
  if(bytes.byteLength!==32)throw new Error('KEETA_TOKEN_ENCRYPTION_KEY_INVALID');
  return crypto.subtle.importKey('raw',toArrayBuffer(bytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptToken(rawKey,token){
  const key=await importEncryptionKey(rawKey);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(token)));
  return Object.freeze({ciphertext:encodeBase64(new Uint8Array(ciphertext)),iv:encodeBase64(iv)});
}
async function decryptToken(rawKey,row){
  const key=await importEncryptionKey(rawKey);
  try{
    const clear=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:toArrayBuffer(decodeBase64(row.iv,'KEETA_TOKEN_IV_INVALID'))},
      key,
      toArrayBuffer(decodeBase64(row.ciphertext,'KEETA_TOKEN_CIPHERTEXT_INVALID')),
    );
    return parseTokenMaterial(decoder.decode(clear));
  }catch(error){
    if(error instanceof Error&&error.message.startsWith('KEETA_TOKEN_'))throw error;
    throw new Error('KEETA_TOKEN_DECRYPT_FAILED');
  }
}

function configStatus(env){
  const appId=Number(env.KEETA_APP_ID);
  const providerShopId=Number(env.KEETA_PROVIDER_SHOP_ID);
  const redirectUri=String(env.KEETA_OAUTH_REDIRECT_URI||'https://admin.morefunos.com/api/keeta/oauth/callback');
  let redirectValid=false;
  try{redirectValid=new URL(redirectUri).protocol==='https:';}catch{}
  let encryptionKeyValid=false;
  try{encryptionKeyValid=decodeBase64(String(env.KEETA_TOKEN_ENCRYPTION_KEY||''),'KEETA_TOKEN_ENCRYPTION_KEY_INVALID').byteLength===32;}catch{}
  return Object.freeze({
    appIdConfigured:Number.isSafeInteger(appId)&&appId>0,
    appSecretConfigured:typeof env.KEETA_APP_SECRET==='string'&&env.KEETA_APP_SECRET.length>0,
    encryptionKeyConfigured:encryptionKeyValid,
    providerShopConfigured:Number.isSafeInteger(providerShopId)&&providerShopId>0,
    redirectUriConfigured:redirectValid,
    redirectUri,
  });
}

export function assessKeetaRuntimeReadiness(env){
  const config=configStatus(env);
  const missing=[];
  if(!config.appIdConfigured)missing.push('KEETA_APP_ID');
  if(!config.appSecretConfigured)missing.push('KEETA_APP_SECRET');
  if(!config.encryptionKeyConfigured)missing.push('KEETA_TOKEN_ENCRYPTION_KEY');
  if(!config.providerShopConfigured)missing.push('KEETA_PROVIDER_SHOP_ID');
  if(!config.redirectUriConfigured)missing.push('KEETA_OAUTH_REDIRECT_URI');
  return Object.freeze({
    ready:missing.length===0,
    missing:Object.freeze(missing),
    config,
  });
}

function requireRuntimeConfig(env){
  const readiness=assessKeetaRuntimeReadiness(env);
  if(!readiness.ready)throw new Error('KEETA_RUNTIME_CONFIG_INCOMPLETE:'+readiness.missing.join(','));
  return Object.freeze({
    appId:positiveInt(env.KEETA_APP_ID,'KEETA_APP_ID_UNAVAILABLE'),
    appSecret:nonEmpty(env.KEETA_APP_SECRET,'KEETA_APP_SECRET_UNAVAILABLE'),
    encryptionKey:nonEmpty(env.KEETA_TOKEN_ENCRYPTION_KEY,'KEETA_TOKEN_ENCRYPTION_KEY_UNAVAILABLE'),
    providerShopId:positiveInt(env.KEETA_PROVIDER_SHOP_ID,'KEETA_PROVIDER_SHOP_ID_UNAVAILABLE'),
    redirectUri:new URL(env.KEETA_OAUTH_REDIRECT_URI||'https://admin.morefunos.com/api/keeta/oauth/callback').toString(),
  });
}

async function sendSignedProviderRequest({url,params,appSecret}){
  const signed=await signKeetaRuntimeParams(url,params,appSecret);
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'},
    body:JSON.stringify(signed),
  });
  if(response.status!==200)throw new Error('KEETA_HTTP_STATUS_'+response.status);
  return response.text();
}

async function exchangeAuthorizationCode(config,code){
  const raw=await sendSignedProviderRequest({
    url:KEETA_TOKEN_URL,
    params:{
      appId:config.appId,
      timestamp:Math.floor(Date.now()/1000),
      grantType:'authorization_code',
      code:nonEmpty(code,'KEETA_OAUTH_CODE_REQUIRED'),
    },
    appSecret:config.appSecret,
  });
  return parseTokenMaterial(raw);
}

async function refreshToken(config,refreshToken){
  let lastError;
  for(let attempt=1;attempt<=3;attempt+=1){
    try{
      const raw=await sendSignedProviderRequest({
        url:KEETA_TOKEN_URL,
        params:{
          appId:config.appId,
          timestamp:Math.floor(Date.now()/1000),
          grantType:'refresh_token',
          refreshToken:nonEmpty(refreshToken,'KEETA_TOKEN_REFRESH_INPUT_INVALID'),
        },
        appSecret:config.appSecret,
      });
      return parseTokenMaterial(raw);
    }catch(error){
      lastError=error;
      if(!(error instanceof TypeError)||attempt===3)throw error;
    }
  }
  throw lastError??new Error('KEETA_TOKEN_REFRESH_FAILED');
}

function authorizationUrl(config,state){
  const url=new URL(KEETA_AUTHORIZE_URL);
  url.searchParams.set('responseType','authorization_code');
  url.searchParams.set('appId',String(config.appId));
  url.searchParams.set('redirectUri',config.redirectUri);
  url.searchParams.set('state',state);
  url.searchParams.set('scope','all');
  return url.toString();
}

async function verifyWebhookSignature(requestUrl,body,appSecret){
  if(typeof body.sig!=='string'||!/^[0-9a-fA-F]{64}$/.test(body.sig))throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  const expected=(await sha256Hex(buildKeetaRuntimeSignaturePreimage(requestUrl,body,appSecret))).toLowerCase();
  const actual=body.sig.toLowerCase();
  if(expected.length!==actual.length)throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
  if(diff!==0)throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  return true;
}

function validateWebhookBody(body){
  const row=record(body,'KEETA_WEBHOOK_BODY_INVALID');
  const eventId=positiveInt(row.eventId,'KEETA_WEBHOOK_EVENT_ID_INVALID');
  if(!Object.prototype.hasOwnProperty.call(KEETA_WEBHOOK_EVENTS,eventId))throw new Error('KEETA_WEBHOOK_EVENT_UNKNOWN');
  return Object.freeze({
    eventId,
    eventName:KEETA_WEBHOOK_EVENTS[eventId],
    appId:positiveInt(row.appId,'KEETA_WEBHOOK_APP_ID_INVALID'),
    messageId:nonEmpty(row.messageId,'KEETA_WEBHOOK_MESSAGE_ID_REQUIRED'),
    shopId:positiveInt(row.shopId,'KEETA_WEBHOOK_PROVIDER_SHOP_ID_INVALID'),
    message:typeof row.message==='string'?row.message:(()=>{throw new Error('KEETA_WEBHOOK_MESSAGE_INVALID')})(),
    timestamp:positiveInt(row.timestamp,'KEETA_WEBHOOK_TIMESTAMP_INVALID'),
    sig:nonEmpty(row.sig,'KEETA_WEBHOOK_SIGNATURE_REQUIRED'),
  });
}

export class KeetaRuntimeStore{
  constructor(state,env){this.state=state;this.env=env;}

  async saveToken(token){
    const config=requireRuntimeConfig(this.env);
    const encrypted=await encryptToken(config.encryptionKey,token);
    const assessment=tokenAssessment(token);
    await this.state.storage.put('oauth:token',{
      ...encrypted,
      expiresAtMs:assessment.expiresAtMs,
      updatedAt:Date.now(),
    });
    return assessment;
  }

  async loadToken(){
    const config=requireRuntimeConfig(this.env);
    const row=await this.state.storage.get('oauth:token');
    if(!row)throw new Error('KEETA_OAUTH_TOKEN_NOT_FOUND');
    return decryptToken(config.encryptionKey,row);
  }

  async usableToken(){
    const config=requireRuntimeConfig(this.env);
    const token=await this.loadToken();
    const assessment=tokenAssessment(token);
    if(assessment.disposition==='EXPIRED')throw new Error('KEETA_OAUTH_TOKEN_EXPIRED_REAUTHORIZE');
    if(assessment.disposition==='VALID')return token;

    const lock=await this.state.storage.get('oauth:refresh-lock');
    const now=Date.now();
    if(lock&&now-Number(lock)<TOKEN_REFRESH_MIN_INTERVAL_MS)throw new Error('KEETA_TOKEN_REFRESH_RATE_LIMITED');
    await this.state.storage.put('oauth:refresh-lock',now);
    try{
      const refreshed=await refreshToken(config,token.refreshToken);
      await this.saveToken(refreshed);
      return refreshed;
    }finally{
      await this.state.storage.delete('oauth:refresh-lock');
    }
  }

  async status(){
    const readiness=assessKeetaRuntimeReadiness(this.env);
    const tokenRow=await this.state.storage.get('oauth:token');
    const journal=await this.state.storage.get('webhook:status')||{};
    let tokenState='NOT_CONNECTED';
    let expiresAt=null;
    if(tokenRow){
      expiresAt=Number(tokenRow.expiresAtMs)||null;
      tokenState=expiresAt&&Date.now()>=expiresAt?'EXPIRED':'CONNECTED';
    }
    return Object.freeze({
      provider:'KEETA',
      market:'HONG_KONG',
      canonicalStoreId:'MF01',
      providerShopId:readiness.config.providerShopConfigured?Number(this.env.KEETA_PROVIDER_SHOP_ID):null,
      readyForAuthorization:readiness.ready,
      missingConfig:readiness.missing,
      oauth:{
        state:tokenState,
        expiresAt:expiresAt?new Date(expiresAt).toISOString():null,
      },
      webhook:{
        callbackUrl:'https://admin.morefunos.com/api/keeta/webhook',
        lastAcceptedAt:journal.lastAcceptedAt??null,
        lastEventId:journal.lastEventId??null,
        lastMessageId:journal.lastMessageId??null,
        lastSignatureFailureAt:journal.lastSignatureFailureAt??null,
        acceptedCount:Number(journal.acceptedCount)||0,
        duplicateCount:Number(journal.duplicateCount)||0,
        conflictCount:Number(journal.conflictCount)||0,
      },
      knownExternalBlocker:'KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH',
      automaticOrderMutation:false,
      providerCommandActivation:false,
    });
  }

  async fetch(request){
    const url=new URL(request.url);

    if(url.pathname==='/admin/status'&&request.method==='GET'){
      return json(await this.status());
    }

    if(url.pathname==='/admin/oauth/begin'&&request.method==='POST'){
      try{
        const config=requireRuntimeConfig(this.env);
        const state=crypto.randomUUID();
        await this.state.storage.put('oauth:state:'+state,{createdAt:Date.now(),consumed:false});
        return json({
          state:'AUTHORIZATION_REQUIRED',
          authorizationUrl:authorizationUrl(config,state),
          redirectUri:config.redirectUri,
        });
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_OAUTH_BEGIN_FAILED'},409);
      }
    }

    if(url.pathname==='/oauth/callback'&&request.method==='GET'){
      try{
        const config=requireRuntimeConfig(this.env);
        const stateValue=nonEmpty(url.searchParams.get('state')||'','KEETA_OAUTH_STATE_REQUIRED');
        const code=nonEmpty(url.searchParams.get('code')||'','KEETA_OAUTH_CODE_REQUIRED');
        const key='oauth:state:'+stateValue;
        const saved=await this.state.storage.get(key);
        if(!saved||saved.consumed===true||Date.now()-Number(saved.createdAt)>OAUTH_STATE_TTL_MS){
          throw new Error('KEETA_OAUTH_STATE_INVALID_OR_REUSED');
        }
        await this.state.storage.put(key,{...saved,consumed:true,consumedAt:Date.now()});
        const token=await exchangeAuthorizationCode(config,code);
        await this.saveToken(token);
        await this.state.storage.put('connection',{
          canonicalStoreId:'MF01',
          providerShopId:config.providerShopId,
          authorizedAt:new Date().toISOString(),
        });
        return Response.redirect('https://admin.morefunos.com/admin/channels?keeta=connected',302);
      }catch(error){
        const code=encodeURIComponent(error instanceof Error?error.message:'KEETA_OAUTH_CALLBACK_FAILED');
        return Response.redirect('https://admin.morefunos.com/admin/channels?keeta_error='+code,302);
      }
    }

    if(url.pathname==='/admin/token/readiness'&&request.method==='POST'){
      try{
        await this.usableToken();
        return json({state:'TOKEN_USABLE'});
      }catch(error){
        return json({state:'TOKEN_UNAVAILABLE',code:error instanceof Error?error.message:'KEETA_TOKEN_UNAVAILABLE'},409);
      }
    }

    if(url.pathname==='/webhook'&&request.method==='POST'){
      const config=requireRuntimeConfig(this.env);
      let body;
      try{body=JSON.parse(await request.text());}
      catch{return json({code:'KEETA_WEBHOOK_JSON_INVALID'},400);}
      const status=await this.state.storage.get('webhook:status')||{};
      try{
        const envelope=validateWebhookBody(body);
        if(envelope.appId!==config.appId)throw new Error('KEETA_WEBHOOK_APP_ID_MISMATCH');
        if(envelope.shopId!==config.providerShopId)throw new Error('KEETA_PROVIDER_SHOP_BINDING_MISMATCH');
        await verifyWebhookSignature(request.url,body,config.appSecret);

        const fingerprint=await sha256Hex(stable({
          eventId:envelope.eventId,
          appId:envelope.appId,
          messageId:envelope.messageId,
          shopId:envelope.shopId,
          message:envelope.message,
          timestamp:envelope.timestamp,
        }));
        const dedupKey='webhook:dedup:'+envelope.messageId;
        const existing=await this.state.storage.get(dedupKey);
        if(existing){
          if(existing.fingerprint!==fingerprint){
            await this.state.storage.put('webhook:status',{
              ...status,
              conflictCount:(Number(status.conflictCount)||0)+1,
              lastConflictAt:new Date().toISOString(),
            });
            return json({code:'KEETA_WEBHOOK_IDENTITY_CONFLICT'},409);
          }
          await this.state.storage.put('webhook:status',{
            ...status,
            duplicateCount:(Number(status.duplicateCount)||0)+1,
            lastAcceptedAt:new Date().toISOString(),
            lastEventId:envelope.eventId,
            lastMessageId:envelope.messageId,
          });
          return json({code:0,message:'Success',data:{}});
        }

        const acceptedAt=new Date().toISOString();
        await this.state.storage.put(dedupKey,{fingerprint,acceptedAt,eventId:envelope.eventId});
        await this.state.storage.put('webhook:event:'+envelope.messageId,{
          provider:'KEETA',
          canonicalStoreId:'MF01',
          providerShopId:envelope.shopId,
          eventId:envelope.eventId,
          eventName:envelope.eventName,
          messageId:envelope.messageId,
          providerPushedAt:new Date(envelope.timestamp*1000).toISOString(),
          receivedAt:acceptedAt,
          message:envelope.message,
          fingerprint,
          authorityBoundary:'PROVIDER_EVIDENCE_ONLY_NO_MFK_MUTATION',
        });
        await this.state.storage.put('webhook:status',{
          ...status,
          acceptedCount:(Number(status.acceptedCount)||0)+1,
          lastAcceptedAt:acceptedAt,
          lastEventId:envelope.eventId,
          lastMessageId:envelope.messageId,
        });
        return json({code:0,message:'Success',data:{}});
      }catch(error){
        const code=error instanceof Error?error.message:'KEETA_WEBHOOK_REJECTED';
        if(code==='KEETA_WEBHOOK_SIGNATURE_INVALID'){
          await this.state.storage.put('webhook:status',{
            ...status,
            lastSignatureFailureAt:new Date().toISOString(),
          });
        }
        return json({code},401);
      }
    }

    return json({code:'NOT_FOUND'},404);
  }
}
