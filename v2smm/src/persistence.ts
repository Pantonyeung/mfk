import type {SmmCartLine,SmmPendingIntent,SmmServiceMode,SmmTender,SmmDiningTarget} from './product-types';

const STORAGE_KEY='mfk:smm:workspace:v1';

export interface SmmLocalPreferences {
  readonly activeView:'order'|'work'|'orders'|'dine'|'more';
  readonly activeCategoryId:string|null;
  readonly sourceFilter:string;
  readonly serviceMode:SmmServiceMode;
  readonly tender:SmmTender;
  readonly diningTarget:SmmDiningTarget|null;
}

export interface SmmLocalWorkspace {
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_NON_AUTHORITATIVE';
  readonly cart:readonly SmmCartLine[];
  readonly cartNote:string;
  readonly pendingIntents:readonly SmmPendingIntent[];
  readonly preferences:SmmLocalPreferences;
  readonly updatedAt:string;
}

const DEFAULT_WORKSPACE:SmmLocalWorkspace=Object.freeze({
  schemaVersion:1,
  storageKind:'LOCAL_NON_AUTHORITATIVE',
  cart:Object.freeze([]),
  cartNote:'',
  pendingIntents:Object.freeze([]),
  preferences:Object.freeze({
    activeView:'order',
    activeCategoryId:null,
    sourceFilter:'全部',
    serviceMode:'TAKEAWAY',
    tender:'CASH',
    diningTarget:null,
  }),
  updatedAt:new Date(0).toISOString(),
});

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}

function safeArray<T>(value:unknown):readonly T[]{
  return Array.isArray(value)?value as readonly T[]:[];
}

function readDiningTarget(value:unknown):SmmDiningTarget|null{
  if(!isRecord(value))return null;
  const covers=Number(value.covers);
  if(!Number.isSafeInteger(covers)||covers<1||covers>30)return null;
  if(value.kind==='WAITING')return Object.freeze({kind:'WAITING',covers});
  if(value.kind==='TABLE'&&typeof value.tableId==='string'&&value.tableId.trim()){
    return Object.freeze({kind:'TABLE',tableId:value.tableId.trim(),covers});
  }
  return null;
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
      cartNote:typeof parsed.cartNote==='string'?parsed.cartNote.slice(0,160):'',
      pendingIntents:Object.freeze([...safeArray<SmmPendingIntent>(parsed.pendingIntents)]),
      preferences:Object.freeze({
        activeView,
        activeCategoryId:typeof preferences.activeCategoryId==='string'?preferences.activeCategoryId:null,
        sourceFilter:typeof preferences.sourceFilter==='string'?preferences.sourceFilter:'全部',
        serviceMode:preferences.serviceMode==='DINE_IN'?'DINE_IN':'TAKEAWAY',
        tender:['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(String(preferences.tender))?preferences.tender as SmmTender:'CASH',
        diningTarget:readDiningTarget(preferences.diningTarget),
      }),
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:new Date(0).toISOString(),
    });
  }catch{
    return DEFAULT_WORKSPACE;
  }
}

export function writeSmmLocalWorkspace(workspace:Omit<SmmLocalWorkspace,'schemaVersion'|'storageKind'|'updatedAt'|'cartNote'>&{readonly cartNote?:string}):SmmLocalWorkspace{
  const previous=readSmmLocalWorkspace();
  const next:SmmLocalWorkspace=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE',
    cart:Object.freeze([...workspace.cart]),
    cartNote:typeof workspace.cartNote==='string'?workspace.cartNote.slice(0,160):previous.cartNote,
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
  readonly tender?:SmmTender;
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
    checkout:Object.freeze({serviceMode:input.serviceMode,...(input.serviceMode==='TAKEAWAY'&&input.tender?{tender:input.tender}:{}),...(input.diningTarget?{diningTarget:Object.freeze({...input.diningTarget})}:{})}),
    cart:Object.freeze([...input.cart]),
  });
}
