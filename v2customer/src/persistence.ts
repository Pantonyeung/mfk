import type {CustomerCartLine,CustomerCheckoutDraft,CustomerPendingIntent} from './product-types';

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
      pendingIntents:Object.freeze([...safeArray<CustomerPendingIntent>(parsed.pendingIntents)]),
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

export function createCustomerPendingIntent(
  cart:readonly CustomerCartLine[],
  checkout:CustomerCheckoutDraft,
  menuRevision:string,
):CustomerPendingIntent{
  const submissionId=createCustomerSubmissionId();
  const now=new Date().toISOString();
  return Object.freeze({
    submissionId,
    menuRevision:String(menuRevision||'').trim(),
    idempotencyKey:`customer-order:${submissionId}`,
    createdAt:now,
    updatedAt:now,
    state:'DRAFT',
    cart:Object.freeze([...cart]),
    checkout:Object.freeze({...checkout}),
  });
}
