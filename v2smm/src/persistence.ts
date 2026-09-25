import type {SmmCartLine,SmmPendingIntent,SmmServiceMode,SmmTender,SmmDiningTarget} from './product-types';

const STORAGE_KEY='mfk:smm:workspace:v1';

export interface SmmLocalPreferences {
  readonly activeView:'order'|'work'|'orders'|'dine'|'more';
  readonly activeCategoryId:string|null;
  readonly sourceFilter:string;
  readonly serviceMode:SmmServiceMode;
  readonly tender:SmmTender;
}

export interface SmmLocalWorkspace {
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_NON_AUTHORITATIVE';
  readonly cart:readonly SmmCartLine[];
  readonly pendingIntents:readonly SmmPendingIntent[];
  readonly preferences:SmmLocalPreferences;
  readonly updatedAt:string;
}

const DEFAULT_WORKSPACE:SmmLocalWorkspace=Object.freeze({
  schemaVersion:1,
  storageKind:'LOCAL_NON_AUTHORITATIVE',
  cart:Object.freeze([]),
  pendingIntents:Object.freeze([]),
  preferences:Object.freeze({
    activeView:'order',
    activeCategoryId:null,
    sourceFilter:'全部',
    serviceMode:'TAKEAWAY',
    tender:'CASH',
  }),
  updatedAt:new Date(0).toISOString(),
});

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}

function safeArray<T>(value:unknown):readonly T[]{
  return Array.isArray(value)?value as readonly T[]:[];
}

export function readSmmLocalWorkspace():SmmLocalWorkspace{
  if(typeof window==='undefined'||!window.localStorage)return DEFAULT_WORKSPACE;
  const raw=window.localStorage.getItem(STORAGE_KEY);
  if(!raw)return DEFAULT_WORKSPACE;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!isRecord(parsed)||parsed.schemaVersion!==1||parsed.storageKind!=='LOCAL_NON_AUTHORITATIVE')return DEFAULT_WORKSPACE;
    const preferences=isRecord(parsed.preferences)?parsed.preferences:{};
    const activeView=['order','work','orders','dine','more'].includes(String(preferences.activeView))
      ?preferences.activeView as SmmLocalPreferences['activeView']
      :'order';
    return Object.freeze({
      schemaVersion:1,
      storageKind:'LOCAL_NON_AUTHORITATIVE',
      cart:Object.freeze([...safeArray<SmmCartLine>(parsed.cart)]),
      pendingIntents:Object.freeze([...safeArray<SmmPendingIntent>(parsed.pendingIntents)]),
      preferences:Object.freeze({
        activeView,
        activeCategoryId:typeof preferences.activeCategoryId==='string'?preferences.activeCategoryId:null,
        sourceFilter:typeof preferences.sourceFilter==='string'?preferences.sourceFilter:'全部',
        serviceMode:preferences.serviceMode==='DINE_IN'?'DINE_IN':'TAKEAWAY',
        tender:['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(String(preferences.tender))?preferences.tender as SmmTender:'CASH',
      }),
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:new Date(0).toISOString(),
    });
  }catch{
    return DEFAULT_WORKSPACE;
  }
}

export function writeSmmLocalWorkspace(workspace:Omit<SmmLocalWorkspace,'schemaVersion'|'storageKind'|'updatedAt'>):SmmLocalWorkspace{
  const next:SmmLocalWorkspace=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE',
    cart:Object.freeze([...workspace.cart]),
    pendingIntents:Object.freeze([...workspace.pendingIntents]),
    preferences:Object.freeze({...workspace.preferences}),
    updatedAt:new Date().toISOString(),
  });
  if(typeof window!=='undefined'&&window.localStorage){
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  }
  return next;
}

export function createSmmStableSubmissionId():string{
  const uuid=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID()
    :`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `SMM-${uuid}`;
}

export function createSmmPendingIntent(input:{
  readonly cart:readonly SmmCartLine[];
  readonly menuRevision:string;
  readonly publishedTotalMinor:number;
  readonly serviceMode:SmmServiceMode;
  readonly tender:SmmTender;
  readonly diningTarget?:SmmDiningTarget;
}):SmmPendingIntent{
  const submissionId=createSmmStableSubmissionId();
  const now=new Date().toISOString();
  return Object.freeze({
    submissionId,
    idempotencyKey:`smm-direct:${submissionId}`,
    createdAt:now,
    updatedAt:now,
    state:'DRAFT',
    menuRevision:input.menuRevision,
    publishedTotalMinor:input.publishedTotalMinor,
    checkout:Object.freeze({serviceMode:input.serviceMode,tender:input.tender,...(input.diningTarget?{diningTarget:Object.freeze({...input.diningTarget})}:{})}),
    cart:Object.freeze([...input.cart]),
  });
}
