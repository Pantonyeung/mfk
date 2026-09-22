import {
  KEETA_PROVIDER,
  PROVIDER_OPERATIONS,
  assessKeetaTokenLifecycle,
  buildKeetaOAuthAuthorizationShape,
  parseKeetaWebhookEnvelope,
  buildKeetaWebhookReplayIdentity,
  assertKeetaReplayCompatible,
  verifyKeetaSignatureShape,
} from '../integrations/keeta/src/index.js';
import {
  exchangeKeetaAuthorizationCodeRuntime,
  refreshKeetaTokenRuntime,
  sendKeetaSignedJsonRuntime,
} from '../integrations/keeta/src/live-runtime.js';

const ADMIN_ORIGIN='https://admin.morefunos.com';
const OAUTH_STATE_TTL_MS=10*60*1000;

function json(value,status=200){
  return new Response(JSON.stringify(value),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}
function nowIso(){return new Date().toISOString();}
function nonEmpty(value,code){
  const out=typeof value==='string'?value.trim():'';
  if(!out)throw new Error(code);
  return out;
}
function requirePositiveInteger(value,code){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<=0)throw new Error(code);
  return n;
}
function appId(env){return requirePositiveInteger(env.KEETA_APP_ID,'KEETA_APP_ID_UNAVAILABLE');}
function appSecret(env){return nonEmpty(env.KEETA_APP_SECRET,'KEETA_APP_SECRET_UNAVAILABLE');}
function encryptionSecret(env){
  const secret=nonEmpty(env.KEETA_TOKEN_ENCRYPTION_KEY,'KEETA_TOKEN_ENCRYPTION_KEY_UNAVAILABLE');
  if(secret.length<32)throw new Error('KEETA_TOKEN_ENCRYPTION_KEY_TOO_SHORT');
  return secret;
}
function redirectUri(env){
  const value=env.KEETA_OAUTH_REDIRECT_URI||ADMIN_ORIGIN+'/api/keeta/oauth/callback';
  const parsed=new URL(value);
  if(parsed.protocol!=='https:')throw new Error('KEETA_OAUTH_REDIRECT_URI_INVALID');
  return parsed.toString();
}
function callbackUrl(env){
  const value=env.KEETA_WEBHOOK_CALLBACK_URL||ADMIN_ORIGIN+'/api/keeta/webhook';
  const parsed=new URL(value);
  if(parsed.protocol!=='https:')throw new Error('KEETA_WEBHOOK_CALLBACK_HTTPS_REQUIRED');
  return parsed.toString();
}
function adminRequest(request){
  const requestOrigin=new URL(request.url).origin;
  const origin=request.headers.get('origin')||'';
  const site=request.headers.get('sec-fetch-site')||'';
  if(requestOrigin!==ADMIN_ORIGIN)return false;
  if(origin&&origin!==ADMIN_ORIGIN)return false;
  if(site&&site!=='same-origin')return false;
  return true;
}
function b64(bytes){
  let binary='';
  for(const value of bytes)binary+=String.fromCharCode(value);
  return btoa(binary);
}
function fromB64(value){
  const binary=atob(value);
  const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
async function cryptoKey(secret){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptJson(value,secret){
  const iv=new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key=await cryptoKey(secret);
  const plaintext=new TextEncoder().encode(JSON.stringify(value));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);
  return Object.freeze({iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))});
}
async function decryptJson(value,secret){
  if(!value||typeof value!=='object'||typeof value.iv!=='string'||typeof value.ciphertext!=='string')throw new Error('KEETA_TOKEN_CIPHERTEXT_INVALID');
  const key=await cryptoKey(secret);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(value.iv)},key,fromB64(value.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function tokenKey(storeId){return 'oauth:token:'+storeId;}
function probeKey(storeId){return 'probe:'+storeId;}
function bindingKey(providerShopId){return 'shop:'+providerShopId;}

export class KeetaEdgeStore{
  constructor(state,env){
    this.state=state;
    this.env=env;
  }

  async readAdminSnapshot(storeId){
    const id=this.env.ADMIN_SYNC.idFromName(storeId);
    const stub=this.env.ADMIN_SYNC.get(id);
    const response=await stub.fetch(new Request('https://mfk.internal/active'));
    if(response.status===404)return null;
    if(!response.ok)throw new Error('KEETA_ADMIN_ACTIVE_CONFIG_HTTP_'+response.status);
    const body=await response.json();
    return body?.snapshot&&typeof body.snapshot==='object'?body.snapshot:null;
  }

  async resolveStoreBinding(storeId){
    const snapshot=await this.readAdminSnapshot(storeId);
    if(!snapshot)throw new Error('KEETA_ADMIN_ACTIVE_CONFIG_REQUIRED');
    const rows=Array.isArray(snapshot.storeBindings)?snapshot.storeBindings:[];
    const matches=rows.filter(row=>
      row&&typeof row==='object'
      &&String(row.provider||'').trim().toUpperCase()==='KEETA'
      &&String(row.mfkStoreId||'').trim()===storeId
      &&row.active!==false
    );
    if(matches.length!==1)throw new Error(matches.length===0?'KEETA_STORE_BINDING_REQUIRED':'KEETA_STORE_BINDING_AMBIGUOUS');
    const row=matches[0];
    const providerShopId=requirePositiveInteger(row.externalStoreId,'KEETA_PROVIDER_SHOP_ID_INVALID');
    await this.state.storage.put(bindingKey(providerShopId),storeId);
    return Object.freeze({
      storeId,
      providerShopId,
      displayName:String(row.displayName||'').trim(),
      channelPolicy:snapshot.channelPolicy??{},
      channelMapping:Array.isArray(snapshot.channelMapping)?snapshot.channelMapping:[],
    });
  }

  async saveToken(storeId,token){
    const encrypted=await encryptJson(token,encryptionSecret(this.env));
    await this.state.storage.put(tokenKey(storeId),{
      ...encrypted,
      issuedAtTime:token.issuedAtTime,
      expiresIn:token.expiresIn,
      updatedAt:Date.now(),
    });
  }

  async loadToken(storeId){
    const stored=await this.state.storage.get(tokenKey(storeId));
    if(!stored)throw new Error('KEETA_OAUTH_TOKEN_NOT_FOUND');
    return decryptJson(stored,encryptionSecret(this.env));
  }

  async usableToken(storeId){
    const token=await this.loadToken(storeId);
    const assessment=assessKeetaTokenLifecycle({
      issuedAtTime:token.issuedAtTime,
      expiresIn:token.expiresIn,
      nowMs:Date.now(),
    });
    if(assessment.disposition==='EXPIRED')throw new Error('KEETA_OAUTH_TOKEN_EXPIRED_REAUTHORIZE');
    if(assessment.disposition==='VALID')return token;
    const refreshed=await refreshKeetaTokenRuntime({
      appId:appId(this.env),
      refreshToken:token.refreshToken,
      timestamp:Math.floor(Date.now()/1000),
      appSecret:appSecret(this.env),
    });
    await this.saveToken(storeId,refreshed);
    return refreshed;
  }

  async status(storeId){
    let credentials='READY';
    try{appId(this.env);appSecret(this.env);encryptionSecret(this.env);}
    catch(error){credentials=error instanceof Error?error.message:'KEETA_CREDENTIALS_UNAVAILABLE';}
    let binding=null;
    let bindingError=null;
    try{binding=await this.resolveStoreBinding(storeId);}
    catch(error){bindingError=error instanceof Error?error.message:'KEETA_STORE_BINDING_ERROR';}

    const stored=await this.state.storage.get(tokenKey(storeId));
    let tokenState='MISSING';
    let tokenExpiresAt=null;
    if(stored){
      try{
        const token=await this.loadToken(storeId);
        const assessment=assessKeetaTokenLifecycle({issuedAtTime:token.issuedAtTime,expiresIn:token.expiresIn,nowMs:Date.now()});
        tokenState=assessment.disposition;
        tokenExpiresAt=new Date(assessment.expiresAtMs).toISOString();
      }catch(error){tokenState=error instanceof Error?error.message:'TOKEN_ERROR';}
    }
    const probe=await this.state.storage.get(probeKey(storeId))||null;
    const lastWebhook=await this.state.storage.get('webhook:last')||null;
    const lastWebhookError=await this.state.storage.get('webhook:last-error')||null;

    const state=credentials!=='READY'?'NOT_CONFIGURED'
      :bindingError?'STORE_BINDING_REQUIRED'
      :!stored?'AUTH_REQUIRED'
      :probe?.ok===true?'CONNECTED_VERIFIED'
      :'CONNECTED_UNVERIFIED';

    return Object.freeze({
      provider:KEETA_PROVIDER.provider,
      market:KEETA_PROVIDER.market,
      state,
      credentials:credentials==='READY'?'READY':credentials,
      storeId,
      providerShopId:binding?.providerShopId??null,
      adminEnabled:Boolean(binding?.channelPolicy?.enabled),
      tokenState,
      tokenExpiresAt,
      providerProbe:probe,
      lastWebhook,
      lastWebhookError,
      knownExternalBlocker:'KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH',
      formalOrderWiring:'HOLD',
      menuSyncWiring:'HOLD',
    });
  }

  async beginOAuth(request){
    if(!adminRequest(request))return json({code:'KEETA_ADMIN_ORIGIN_REQUIRED'},401);
    const url=new URL(request.url);
    const storeId=(url.searchParams.get('storeId')||'MF01').trim();
    const binding=await this.resolveStoreBinding(storeId);
    const state=crypto.randomUUID();
    await this.state.storage.put('oauth:state:'+state,{storeId,createdAt:Date.now()});
    const shape=buildKeetaOAuthAuthorizationShape({
      appId:appId(this.env),
      redirectUri:redirectUri(this.env),
      state,
      scope:'all',
    });
    return json({
      state:'AUTHORIZATION_REQUIRED',
      storeId,
      providerShopId:binding.providerShopId,
      authorizationUrl:shape.authorizationUrl,
    });
  }

  async finishOAuth(request){
    const url=new URL(request.url);
    const code=nonEmpty(url.searchParams.get('code')||'','KEETA_OAUTH_CODE_REQUIRED');
    const state=nonEmpty(url.searchParams.get('state')||'','KEETA_OAUTH_STATE_REQUIRED');
    const stateKey='oauth:state:'+state;
    const saved=await this.state.storage.get(stateKey);
    if(!saved)throw new Error('KEETA_OAUTH_STATE_INVALID_OR_REUSED');
    await this.state.storage.delete(stateKey);
    if(Date.now()-Number(saved.createdAt)>OAUTH_STATE_TTL_MS)throw new Error('KEETA_OAUTH_STATE_EXPIRED');
    const storeId=nonEmpty(saved.storeId,'KEETA_OAUTH_STORE_ID_REQUIRED');
    await this.resolveStoreBinding(storeId);
    const token=await exchangeKeetaAuthorizationCodeRuntime({
      appId:appId(this.env),
      code,
      timestamp:Math.floor(Date.now()/1000),
      appSecret:appSecret(this.env),
    });
    await this.saveToken(storeId,token);
    await this.state.storage.put('oauth:last',{storeId,completedAt:nowIso()});
    return Response.redirect(ADMIN_ORIGIN+'/admin/channels?keeta=oauth-connected',302);
  }

  async probe(request){
    if(!adminRequest(request))return json({code:'KEETA_ADMIN_ORIGIN_REQUIRED'},401);
    const url=new URL(request.url);
    const storeId=(url.searchParams.get('storeId')||'MF01').trim();
    const binding=await this.resolveStoreBinding(storeId);
    const token=await this.usableToken(storeId);
    const result=await sendKeetaSignedJsonRuntime({
      url:'https://open.mykeeta.com'+PROVIDER_OPERATIONS.storeDetails,
      params:{
        accessToken:token.accessToken,
        appId:appId(this.env),
        timestamp:Math.floor(Date.now()/1000),
        shopId:binding.providerShopId,
      },
      appSecret:appSecret(this.env),
    });
    const evidence={
      ok:result.ok===true,
      status:result.status,
      code:result.code??null,
      message:result.message??'',
      providerShopId:binding.providerShopId,
      checkedAt:nowIso(),
    };
    await this.state.storage.put(probeKey(storeId),evidence);
    return json(evidence,result.ok?200:502);
  }

  async ingestWebhook(request){
    if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
    let body;
    try{body=await request.json();}
    catch{return json({code:'KEETA_WEBHOOK_BODY_INVALID'},400);}
    let envelope;
    try{
      envelope=parseKeetaWebhookEnvelope(body);
      if(envelope.appId!==appId(this.env))throw new Error('KEETA_WEBHOOK_APP_ID_MISMATCH');
      verifyKeetaSignatureShape(callbackUrl(this.env),body,appSecret(this.env));
    }catch(error){
      const code=error instanceof Error?error.message:'KEETA_WEBHOOK_REJECTED';
      await this.state.storage.put('webhook:last-error',{code,at:nowIso()});
      return json({code},401);
    }

    const storeId=await this.state.storage.get(bindingKey(envelope.providerShopId));
    if(!storeId){
      await this.state.storage.put('webhook:last-error',{code:'KEETA_PROVIDER_SHOP_BINDING_NOT_REGISTERED',at:nowIso(),providerShopId:envelope.providerShopId});
      return json({code:'KEETA_PROVIDER_SHOP_BINDING_NOT_REGISTERED'},409);
    }

    const replay=buildKeetaWebhookReplayIdentity(envelope);
    const dedupKey='webhook:dedup:'+replay.dedupKey;
    const existing=await this.state.storage.get(dedupKey);
    let disposition;
    try{disposition=assertKeetaReplayCompatible(existing?.fingerprint,replay.fingerprint);}
    catch(error){
      await this.state.storage.put('webhook:last-error',{code:'KEETA_WEBHOOK_IDENTITY_CONFLICT',at:nowIso(),messageId:envelope.messageId});
      return json({code:'KEETA_WEBHOOK_IDENTITY_CONFLICT'},409);
    }
    if(disposition==='NEW'){
      await this.state.storage.put(dedupKey,{fingerprint:replay.fingerprint,receivedAt:Date.now()});
      await this.state.storage.put('webhook:evidence:'+Date.now()+':'+envelope.messageId,{
        storeId,
        receivedAt:nowIso(),
        envelope,
        replay,
        mutation:'NONE_K0_CAPTURE_ONLY',
      });
    }
    const status={
      storeId,
      eventId:envelope.eventId,
      eventName:envelope.eventName,
      messageId:envelope.messageId,
      providerShopId:envelope.providerShopId,
      disposition,
      verified:true,
      at:nowIso(),
    };
    await this.state.storage.put('webhook:last',status);
    await this.state.storage.delete('webhook:last-error');
    return json({code:0,message:'Success',data:{}});
  }

  async fetch(request){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/status'){
        if(!adminRequest(request))return json({code:'KEETA_ADMIN_ORIGIN_REQUIRED'},401);
        return json(await this.status((url.searchParams.get('storeId')||'MF01').trim()));
      }
      if(url.pathname==='/oauth/start'){
        if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
        return await this.beginOAuth(request);
      }
      if(url.pathname==='/oauth/callback')return await this.finishOAuth(request);
      if(url.pathname==='/probe'){
        if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
        return await this.probe(request);
      }
      if(url.pathname==='/webhook')return await this.ingestWebhook(request);
      return json({code:'NOT_FOUND'},404);
    }catch(error){
      const code=error instanceof Error?error.message:'KEETA_RUNTIME_ERROR';
      return json({code},code.includes('UNAVAILABLE')||code.includes('REQUIRED')?503:400);
    }
  }
}
