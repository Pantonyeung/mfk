export type KeetaConnectionState=
  |'NOT_CONFIGURED'
  |'STORE_BINDING_REQUIRED'
  |'AUTH_REQUIRED'
  |'CONNECTED_UNVERIFIED'
  |'CONNECTED_VERIFIED';

export interface KeetaLiveStatus{
  readonly provider:'KEETA';
  readonly market:'HONG_KONG';
  readonly state:KeetaConnectionState;
  readonly credentials:string;
  readonly storeId:string;
  readonly providerShopId:number|null;
  readonly adminEnabled:boolean;
  readonly tokenState:string;
  readonly tokenExpiresAt:string|null;
  readonly providerProbe:null|Readonly<{
    ok:boolean;
    status:string;
    code:number|null;
    message:string;
    providerShopId:number;
    checkedAt:string;
  }>;
  readonly lastWebhook:null|Readonly<{
    storeId:string;
    eventId:number;
    eventName:string;
    messageId:string;
    providerShopId:number;
    disposition:'NEW'|'DUPLICATE';
    verified:true;
    at:string;
  }>;
  readonly lastWebhookError:null|Readonly<{code:string;at:string}>;
  readonly knownExternalBlocker:string;
  readonly formalOrderWiring:'HOLD';
  readonly menuSyncWiring:'HOLD';
}

async function readJson(response:Response){
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(typeof body.code==='string'?body.code:'KEETA_HTTP_'+response.status);
  return body;
}

export async function readKeetaLiveStatus(storeId='MF01'):Promise<KeetaLiveStatus>{
  const response=await fetch('/api/keeta/status?storeId='+encodeURIComponent(storeId),{
    method:'GET',
    credentials:'same-origin',
    cache:'no-store',
  });
  return await readJson(response) as unknown as KeetaLiveStatus;
}

export async function beginKeetaOAuth(storeId='MF01'){
  const response=await fetch('/api/keeta/oauth/start?storeId='+encodeURIComponent(storeId),{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:'{}',
  });
  const body=await readJson(response) as {authorizationUrl?:unknown};
  if(typeof body.authorizationUrl!=='string'||!body.authorizationUrl.startsWith('https://'))throw new Error('KEETA_OAUTH_AUTHORIZATION_URL_INVALID');
  return body.authorizationUrl;
}

export async function probeKeetaProvider(storeId='MF01'){
  const response=await fetch('/api/keeta/probe?storeId='+encodeURIComponent(storeId),{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:'{}',
  });
  return await readJson(response);
}
