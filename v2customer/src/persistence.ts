import type {CustomerCartLine,CustomerCheckoutDraft,CustomerPendingIntent} from './product-types';
import {validateMfkCustomerCommercialFreshnessProof,type MfkCustomerCommercialFreshnessProof} from '../../contracts/customer-commercial-freshness-v1';

const STORAGE_KEY='mfk:customer:workspace:v1';

export interface CustomerLocalPreferences {
  readonly activeView:'home'|'menu'|'cart'|'checkout'|'orders'|'more';
  readonly activeCategoryId:string|null;
}

export interface CustomerLocalWorkspace {
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_NON_AUTHORITATIVE';
  readonly cart:readonly CustomerCartLine[];
  readonly checkout:CustomerCheckoutDraft;
  readonly pendingIntents:readonly CustomerPendingIntent[];
  readonly preferences:CustomerLocalPreferences;
  readonly updatedAt:string;
}

const DEFAULT_WORKSPACE:CustomerLocalWorkspace=Object.freeze({
  schemaVersion:1,
  storageKind:'LOCAL_NON_AUTHORITATIVE',
  cart:Object.freeze([]),
  checkout:Object.freeze({name:'',phone:'',paymentMethod:'PAY_AT_STORE'}),
  pendingIntents:Object.freeze([]),
  preferences:Object.freeze({activeView:'home',activeCategoryId:null}),
  updatedAt:new Date(0).toISOString(),
});

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}

function safeArray<T>(value:unknown):readonly T[]{
  return Array.isArray(value)?value as readonly T[]:[];
}

function normalizePaymentEvidence(value:unknown):CustomerCheckoutDraft['paymentEvidence']|undefined{
  if(!isRecord(value))return undefined;
  const state=String(value.state||'');
  if(!['LOCAL_PENDING_UPLOAD','UPLOADED','VERIFIED','REJECTED'].includes(state))return undefined;
  const fileName=typeof value.fileName==='string'?value.fileName.slice(0,255):'';
  const mimeType=typeof value.mimeType==='string'?value.mimeType.slice(0,120):'';
  const size=Number(value.size);
  if(!fileName||!mimeType||!Number.isFinite(size)||size<0)return undefined;
  return Object.freeze({
    fileName,
    mimeType,
    size:Math.round(size),
    state:state as NonNullable<CustomerCheckoutDraft['paymentEvidence']>['state'],
    ...(typeof value.evidenceRef==='string'&&value.evidenceRef.trim()?{evidenceRef:value.evidenceRef.trim()}:{}),
  });
}

export function customerFallbackReference(value:Pick<CustomerPendingIntent,'submissionId'>|{readonly fallbackReference?:string}):string{
  const direct='fallbackReference' in value&&typeof value.fallbackReference==='string'?value.fallbackReference.trim():'';
  if(/^\d{4,6}$/.test(direct))return direct;
  const source=String('submissionId' in value?value.submissionId:'');
  let hash=2166136261;
  for(let index=0;index<source.length;index++){
    hash^=source.charCodeAt(index);
    hash=Math.imul(hash,16777619)>>>0;
  }
  return String(hash%1_000_000).padStart(6,'0');
}

function normalizePendingIntent(value:unknown):CustomerPendingIntent|null{
  if(!isRecord(value))return null;
  const submissionId=typeof value.submissionId==='string'?value.submissionId:'';
  const menuRevision=typeof value.menuRevision==='string'?value.menuRevision:'';
  const idempotencyKey=typeof value.idempotencyKey==='string'?value.idempotencyKey:'';
  const createdAt=typeof value.createdAt==='string'?value.createdAt:'';
  const updatedAt=typeof value.updatedAt==='string'?value.updatedAt:createdAt;
  const state=['DRAFT','NOT_CONNECTED','PENDING','UNKNOWN','REJECTED','DELIVERED'].includes(String(value.state))
    ?value.state as CustomerPendingIntent['state']
    :'DRAFT';
  if(!submissionId||!idempotencyKey||!createdAt)return null;
  const rawCheckout=isRecord(value.checkout)?value.checkout:{};
  const checkout:CustomerCheckoutDraft=Object.freeze({
    name:typeof rawCheckout.name==='string'?rawCheckout.name:'',
    phone:typeof rawCheckout.phone==='string'?rawCheckout.phone:'',
    paymentMethod:rawCheckout.paymentMethod==='ELECTRONIC'?'ELECTRONIC':'PAY_AT_STORE',
    ...(rawCheckout.paymentMethod==='ELECTRONIC'&&typeof rawCheckout.paymentChannelId==='string'?{
      paymentChannelId:String(rawCheckout.paymentChannelId),
      paymentChannelLabel:typeof rawCheckout.paymentChannelLabel==='string'?rawCheckout.paymentChannelLabel:'',
    }:{}),
    ...(()=>{const paymentEvidence=normalizePaymentEvidence(rawCheckout.paymentEvidence);return paymentEvidence?{paymentEvidence}:{}})(),
  });
  const fallbackReference=customerFallbackReference({
    submissionId,
    fallbackReference:typeof value.fallbackReference==='string'?value.fallbackReference:undefined,
  });
  let commercialFreshness:MfkCustomerCommercialFreshnessProof|undefined;
  try{commercialFreshness=validateMfkCustomerCommercialFreshnessProof(value.commercialFreshness);}catch{}
  return Object.freeze({
    submissionId,menuRevision,idempotencyKey,createdAt,updatedAt,state,
    cart:Object.freeze([...safeArray<CustomerCartLine>(value.cart)]),
    checkout,
    fallbackReference,
    ...(commercialFreshness?{commercialFreshness}:{}),
    ...(Number.isSafeInteger(Number(value.publishedTotalMinor))&&Number(value.publishedTotalMinor)>=0?{publishedTotalMinor:Number(value.publishedTotalMinor)}:{}),
    ...(typeof value.canonicalOrderId==='string'&&value.canonicalOrderId?{canonicalOrderId:value.canonicalOrderId}:{}),
    ...(typeof value.canonicalDisplay==='string'&&value.canonicalDisplay?{canonicalDisplay:value.canonicalDisplay}:{}),
    ...(typeof value.committedAt==='string'&&value.committedAt?{committedAt:value.committedAt}:{}),
    ...(typeof value.lastMessage==='string'?{lastMessage:value.lastMessage}:{}),
  });
}

export function readCustomerLocalWorkspace():CustomerLocalWorkspace{
  if(typeof window==='undefined'||!window.localStorage)return DEFAULT_WORKSPACE;
  const raw=window.localStorage.getItem(STORAGE_KEY);
  if(!raw)return DEFAULT_WORKSPACE;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!isRecord(parsed)||parsed.schemaVersion!==1||parsed.storageKind!=='LOCAL_NON_AUTHORITATIVE')return DEFAULT_WORKSPACE;
    const checkout=isRecord(parsed.checkout)?parsed.checkout:{};
    const preferences=isRecord(parsed.preferences)?parsed.preferences:{};
    const activeView=['home','menu','cart','checkout','orders','more'].includes(String(preferences.activeView))
      ?preferences.activeView as CustomerLocalPreferences['activeView']
      :'home';
    return Object.freeze({
      schemaVersion:1,
      storageKind:'LOCAL_NON_AUTHORITATIVE',
      cart:Object.freeze([...safeArray<CustomerCartLine>(parsed.cart)]),
      checkout:Object.freeze({
        name:typeof checkout.name==='string'?checkout.name:'',
        phone:typeof checkout.phone==='string'?checkout.phone:'',
        paymentMethod:checkout.paymentMethod==='ELECTRONIC'?'ELECTRONIC':'PAY_AT_STORE',
        ...(checkout.paymentMethod==='ELECTRONIC'&&/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(String(checkout.paymentChannelId||'').toUpperCase())?{paymentChannelId:String(checkout.paymentChannelId).toUpperCase(),paymentChannelLabel:typeof checkout.paymentChannelLabel==='string'?checkout.paymentChannelLabel.slice(0,120):''}:{}),
      }),
      pendingIntents:Object.freeze(safeArray<unknown>(parsed.pendingIntents).map(normalizePendingIntent).filter((item):item is CustomerPendingIntent=>Boolean(item))),
      preferences:Object.freeze({
        activeView,
        activeCategoryId:typeof preferences.activeCategoryId==='string'?preferences.activeCategoryId:null,
      }),
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:new Date(0).toISOString(),
    });
  }catch{
    return DEFAULT_WORKSPACE;
  }
}

export function writeCustomerLocalWorkspace(workspace:Omit<CustomerLocalWorkspace,'schemaVersion'|'storageKind'|'updatedAt'>):CustomerLocalWorkspace{
  const {paymentEvidence:_paymentEvidence,...persistedCheckout}=workspace.checkout;
  const next:CustomerLocalWorkspace=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE',
    cart:Object.freeze([...workspace.cart]),
    checkout:Object.freeze({...persistedCheckout}),
    pendingIntents:Object.freeze([...workspace.pendingIntents]),
    preferences:Object.freeze({...workspace.preferences}),
    updatedAt:new Date().toISOString(),
  });
  if(typeof window!=='undefined'&&window.localStorage){
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  }
  return next;
}

export function createCustomerSubmissionId():string{
  const uuid=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID()
    :`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `CUSTOMER-${uuid}`;
}

function createCustomerFallbackReference():string{
  if(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function'){
    const value=crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000;
    return String(value).padStart(6,'0');
  }
  return String(Date.now()%1_000_000).padStart(6,'0');
}

function customerPublishedTotalMinor(cart:readonly CustomerCartLine[]){
  if(!cart.length||cart.some(line=>!Number.isSafeInteger(Number(line.publishedUnitPriceMinor))||Number(line.publishedUnitPriceMinor)<0))return undefined;
  const total=cart.reduce((sum,line)=>sum+Number(line.publishedUnitPriceMinor)*line.quantity,0);
  return Number.isSafeInteger(total)&&total>=0?total:undefined;
}

export function createCustomerPendingIntent(
  cart:readonly CustomerCartLine[],
  checkout:CustomerCheckoutDraft,
  menuRevision:string,
  commercialFreshness?:MfkCustomerCommercialFreshnessProof,
):CustomerPendingIntent{
  const submissionId=createCustomerSubmissionId();
  const now=new Date().toISOString();
  const publishedTotalMinor=customerPublishedTotalMinor(cart);
  return Object.freeze({
    submissionId,
    menuRevision:String(menuRevision||'').trim(),
    ...(commercialFreshness?{commercialFreshness}:{}),
    idempotencyKey:`customer-order:${submissionId}`,
    createdAt:now,
    updatedAt:now,
    state:'DRAFT',
    cart:Object.freeze([...cart]),
    checkout:Object.freeze({...checkout}),
    fallbackReference:createCustomerFallbackReference(),
    ...(publishedTotalMinor!==undefined?{publishedTotalMinor}:{}),
  });
}
