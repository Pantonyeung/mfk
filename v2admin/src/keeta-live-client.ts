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


export interface KeetaMenuSummary{
  readonly categories:number;
  readonly choiceGroups:number;
  readonly options:number;
  readonly spus:number;
  readonly skus:number;
}
export interface KeetaMenuPreview{
  readonly state:'READY';
  readonly revision:number;
  readonly adminFingerprint:string;
  readonly snapshotFingerprint:string;
  readonly summary:KeetaMenuSummary;
  readonly destructiveOmissionSemantics:string;
}
export interface KeetaMenuStatus{
  readonly state:'NEVER_SYNCED'|'SUBMITTED'|'COMPLETED'|'PARTIAL'|'FAILED';
  readonly taskId?:number;
  readonly adminRevision?:number;
  readonly snapshotFingerprint?:string;
  readonly summary?:KeetaMenuSummary;
  readonly submittedAt?:string;
  readonly completion?:{
    readonly messageId:string;
    readonly completedAt:string;
    readonly taskId:number;
    readonly pictureTaskId:number|null;
    readonly errors:readonly {readonly openItemCode:string|null;readonly code:number|null;readonly message:string|null}[];
  }|null;
  readonly pictureCompletion?:{
    readonly messageId:string;
    readonly completedAt:string;
    readonly taskId:number;
    readonly mainTaskId:number|null;
    readonly errors:readonly {readonly openItemCode:string|null;readonly code:number|null;readonly message:string|null}[];
  }|null;
}
async function keetaAdminPost<T>(path:string):Promise<T>{
  const response=await fetch('/api/keeta/admin/'+path+'?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    headers:{'content-type':'application/json',...headers()},
  });
  const body=await response.json().catch(()=>({})) as T&{code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_ADMIN_HTTP_'+response.status);
  return body;
}
export function previewKeetaMenu():Promise<KeetaMenuPreview>{
  return keetaAdminPost<KeetaMenuPreview>('menu/preview');
}
export function syncKeetaMenu():Promise<KeetaMenuStatus>{
  return keetaAdminPost<KeetaMenuStatus>('menu/sync');
}
export function readKeetaMenuStatus():Promise<KeetaMenuStatus>{
  return keetaAdminPost<KeetaMenuStatus>('menu/status');
}


export interface KeetaSellabilityPreview{
  readonly state:'READY'|'DISABLED';
  readonly revision:number;
  readonly adminFingerprint:string;
  readonly total:number;
  readonly available:number;
  readonly unavailable:number;
}
export interface KeetaSellabilityStatus{
  readonly state:'NEVER_SYNCED'|'COMPLETED'|'FAILED';
  readonly total?:number;
  readonly available?:number;
  readonly unavailable?:number;
  readonly completedAt?:string;
  readonly code?:string;
}
export interface KeetaStorePreview{
  readonly state:'READY';
  readonly revision:number;
  readonly adminFingerprint:string;
  readonly businessHourOfTheWeek:Readonly<Record<string,readonly {readonly startTime:number;readonly endTime:number}[]>>;
}
export interface KeetaStoreStatus{
  readonly state:string;
  readonly sync?:unknown;
  readonly operation?:unknown;
  readonly readback?:unknown;
  readonly code?:string;
}
export function previewKeetaSellability():Promise<KeetaSellabilityPreview>{
  return keetaAdminPost<KeetaSellabilityPreview>('sellability/preview');
}
export function syncKeetaSellability():Promise<KeetaSellabilityStatus>{
  return keetaAdminPost<KeetaSellabilityStatus>('sellability/sync');
}
export function readKeetaSellabilityStatus():Promise<KeetaSellabilityStatus>{
  return keetaAdminPost<KeetaSellabilityStatus>('sellability/status');
}
export function previewKeetaStoreHours():Promise<KeetaStorePreview>{
  return keetaAdminPost<KeetaStorePreview>('store/preview');
}
export function syncKeetaStoreHours():Promise<KeetaStoreStatus>{
  return keetaAdminPost<KeetaStoreStatus>('store/hours/sync');
}
export function readKeetaStore():Promise<KeetaStoreStatus>{
  return keetaAdminPost<KeetaStoreStatus>('store/readback');
}
export function restKeetaStore():Promise<KeetaStoreStatus>{
  return keetaAdminPost<KeetaStoreStatus>('store/status/rest');
}
export function openKeetaStore():Promise<KeetaStoreStatus>{
  return keetaAdminPost<KeetaStoreStatus>('store/status/open');
}
export function readKeetaStoreStatus():Promise<KeetaStoreStatus>{
  return keetaAdminPost<KeetaStoreStatus>('store/status');
}


export interface KeetaCommercialSnapshot{
  readonly provider:'KEETA';
  readonly providerOrderId:string;
  readonly currency:string;
  readonly merchandiseSubtotalMinor?:number;
  readonly customerPaidMinor?:number;
  readonly shippingFeeMinor?:number;
  readonly customerPlatformFeeMinor?:number;
  readonly minimumOrderTopUpMinor?:number;
  readonly merchantCommissionMinor?:number;
  readonly merchantActivityFeeMinor?:number;
  readonly merchantEarningsMinor?:number;
  readonly settlementAuthority:'UNKNOWN'|'PROVIDER_ESTIMATE'|'PROVIDER_CONFIRMED'|'PAID_RECONCILED';
  readonly capturedAt:string;
  readonly providerEvidenceRef:string;
}
export interface KeetaCommercialRow{
  readonly state:'WEBHOOK_CAPTURED'|'PROVIDER_CONFIRMED';
  readonly provider:'KEETA';
  readonly canonicalStoreId:'MF01';
  readonly providerShopId:number;
  readonly providerOrderId:string;
  readonly providerOrderCode:string;
  readonly canonicalOrderId:string|null;
  readonly canonicalDisplay:string|null;
  readonly capturedAt:string;
  readonly providerConfirmedAt:string|null;
  readonly latestEvidenceRef:string;
  readonly snapshot:KeetaCommercialSnapshot;
}
export interface KeetaCommercialList{
  readonly state:'AVAILABLE';
  readonly provider:'KEETA';
  readonly canonicalStoreId:'MF01';
  readonly items:readonly KeetaCommercialRow[];
}
export function readKeetaCommercialRows():Promise<KeetaCommercialList>{
  return keetaAdminPost<KeetaCommercialList>('commercial/list');
}
export async function refreshKeetaCommercial(providerOrderId:string):Promise<KeetaCommercialRow>{
  const response=await fetch('/api/keeta/admin/commercial/refresh?storeId=MF01',{
    method:'POST',
    credentials:'same-origin',
    cache:'no-store',
    headers:{'content-type':'application/json',...headers()},
    body:JSON.stringify({providerOrderId}),
  });
  const body=await response.json().catch(()=>({})) as KeetaCommercialRow&{code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_COMMERCIAL_REFRESH_HTTP_'+response.status);
  return body;
}
