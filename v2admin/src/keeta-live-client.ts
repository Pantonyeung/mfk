import {readAdminStored} from './admin-local-store.ts';

const PUBLISHER_KEY='sync-publisher-key.v1';

export interface KeetaLiveStatus{
  readonly provider:'KEETA';
  readonly market:'HONG_KONG';
  readonly canonicalStoreId:string;
  readonly providerShopId:number|null;
  readonly readyForAuthorization:boolean;
  readonly missingConfig:readonly string[];
  readonly oauth:{
    readonly state:'NOT_CONNECTED'|'CONNECTED'|'EXPIRED';
    readonly expiresAt:string|null;
    readonly lastCallbackAt:string|null;
    readonly lastCallbackResult:'CONNECTED'|'FAILED'|null;
    readonly lastCallbackError:string|null;
    readonly lastCallbackMethod:'GET'|'POST'|null;
    readonly lastCallbackParamNames:readonly string[];
    readonly tokenSource:'OAUTH_CALLBACK'|'TEST_PROVIDER_PORTAL_IMPORT'|'TEST_PROVIDER_PORTAL_REFRESH'|null;
  };
  readonly webhook:{
    readonly callbackUrl:string;
    readonly lastAcceptedAt:string|null;
    readonly lastEventId:number|null;
    readonly lastMessageId:string|null;
    readonly lastSignatureFailureAt:string|null;
    readonly acceptedCount:number;
    readonly duplicateCount:number;
    readonly conflictCount:number;
  };
  readonly knownExternalBlocker:string|null;
  readonly automaticOrderMutation:false;
  readonly providerCommandActivation:false;
}

function headers(){
  const key=readAdminStored<string>(PUBLISHER_KEY,'');
  return key?{'x-mfk-admin-publish-key':key}:{};
}

export async function readKeetaLiveStatus():Promise<KeetaLiveStatus>{
  const response=await fetch('/api/keeta/admin/status?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    headers:headers(),
  });
  const body=await response.json().catch(()=>({})) as KeetaLiveStatus&{code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_STATUS_HTTP_'+response.status);
  return body;
}

export async function beginKeetaOAuth(){
  const response=await fetch('/api/keeta/admin/oauth/begin?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json',...headers()},
  });
  const body=await response.json().catch(()=>({})) as {authorizationUrl?:string;code?:string};
  if(!response.ok||!body.authorizationUrl)throw new Error(body.code||'KEETA_OAUTH_BEGIN_HTTP_'+response.status);
  return body.authorizationUrl;
}

export async function checkKeetaTokenReadiness(){
  const response=await fetch('/api/keeta/admin/token/readiness?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json',...headers()},
  });
  const body=await response.json().catch(()=>({})) as {state?:string;code?:string};
  return Object.freeze({ok:response.ok,state:body.state??'UNKNOWN',code:body.code});
}


export async function importKeetaTestToken(raw:string){
  let token:unknown;
  try{token=JSON.parse(raw);}
  catch{throw new Error('KEETA_TEST_TOKEN_JSON_INVALID');}
  const response=await fetch('/api/keeta/admin/token/import-test?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json',...headers()},
    body:JSON.stringify(token),
  });
  const body=await response.json().catch(()=>({})) as {state?:string;source?:string;expiresAt?:string;code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_TEST_TOKEN_IMPORT_HTTP_'+response.status);
  return body;
}
