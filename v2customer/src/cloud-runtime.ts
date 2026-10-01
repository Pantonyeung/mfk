import {
  MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
  MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
} from '../../contracts/customer-cloud-v1';
import {
  validateMfkSyncChangeBatch,
  validateMfkSyncCheckpoint,
  validateMfkSyncHead,
  type MfkSyncHead,
} from '../../contracts/checkpointed-delta-sync-v1';
import {
  customerCommercialProofMatches,
  validateMfkCustomerCommercialFreshnessProof,
  type MfkCustomerCommercialFreshnessProof,
} from '../../contracts/customer-commercial-freshness-v1';
import {
  applyMfkSyncChanges,
  buildCustomerSyncEntities,
  entityMapFromCheckpoint,
  materializeCustomerConfigSnapshot,
  projectionHashForEntities,
  type MfkSyncEntityMap,
} from '../../sync/checkpointed-delta-sync';
import type {
  CustomerCartLine,
  CustomerCommandResult,
  CustomerPendingIntent,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
  CustomerRuntimePort,
} from './product-types.ts';

const ENDPOINT='https://admin.morefunos.com';
const STORE_ID='MF01';
const REF_KEY='mfk:customer:cloud-submission-refs:v1';
const SYNC_BUNDLE_KEY='mfk:customer:config-sync-bundle:v1';

function readSubmissionRefs():string[]{
  try{
    const raw=localStorage.getItem(REF_KEY);
    const value=raw?JSON.parse(raw):[];
    return Array.isArray(value)?value.map(String).filter(Boolean).slice(0,24):[];
  }catch{return[];}
}
function rememberSubmissionRef(submissionId:string){
  try{
    const next=[submissionId,...readSubmissionRefs().filter(id=>id!==submissionId)].slice(0,24);
    localStorage.setItem(REF_KEY,JSON.stringify(next));
  }catch{}
}

interface CustomerConfigSyncBundle{
  readonly schema:'MFK_CUSTOMER_CONFIG_SYNC_BUNDLE_V1';
  readonly appliedSeq:number;
  readonly checkpointSeq:number;
  readonly projectionHash:string;
  readonly entities:MfkSyncEntityMap;
  readonly head:MfkSyncHead;
  readonly updatedAt:string;
}

function readCustomerSyncBundle():CustomerConfigSyncBundle|null{
  try{
    const raw=localStorage.getItem(SYNC_BUNDLE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as CustomerConfigSyncBundle;
    if(parsed?.schema!=='MFK_CUSTOMER_CONFIG_SYNC_BUNDLE_V1')return null;
    const head=validateMfkSyncHead(parsed.head);
    if(head.port!=='CUSTOMER')return null;
    if(!parsed.entities||typeof parsed.entities!=='object')return null;
    return Object.freeze({...parsed,head,entities:parsed.entities});
  }catch{return null;}
}

function writeCustomerSyncBundle(head:MfkSyncHead,entities:MfkSyncEntityMap,appliedSeq:number,checkpointSeq:number){
  const projectionHash=projectionHashForEntities(entities);
  if(appliedSeq===head.headSeq&&projectionHash!==head.projectionHash)throw new Error('CUSTOMER_SYNC_PROJECTION_HASH_MISMATCH');
  const bundle:CustomerConfigSyncBundle=Object.freeze({
    schema:'MFK_CUSTOMER_CONFIG_SYNC_BUNDLE_V1',
    appliedSeq,
    checkpointSeq,
    projectionHash,
    entities,
    head,
    updatedAt:new Date().toISOString(),
  });
  localStorage.setItem(SYNC_BUNDLE_KEY,JSON.stringify(bundle));
  return bundle;
}

async function fetchCustomerSyncHead(){
  const {response,body}=await jsonFetch('/api/customer/sync/head?storeId='+STORE_ID);
  if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SYNC_HEAD_FAILED'));
  const head=validateMfkSyncHead(body);
  if(head.port!=='CUSTOMER'||head.storeId!==STORE_ID)throw new Error('CUSTOMER_SYNC_HEAD_IDENTITY_MISMATCH');
  const commercialFreshness=validateMfkCustomerCommercialFreshnessProof(body.commercialFreshness);
  if(!customerCommercialProofMatches(commercialFreshness,{storeId:head.storeId,customerPortSeq:head.headSeq,projectionHash:head.projectionHash,canonicalRevision:head.canonicalRevision,canonicalFingerprint:head.canonicalFingerprint}))throw new Error('CUSTOMER_COMMERCIAL_PROOF_IDENTITY_MISMATCH');
  return Object.freeze({head,commercialFreshness});
}

async function fetchCustomerCheckpoint(head:MfkSyncHead){
  const {response,body}=await jsonFetch('/api/customer/sync/checkpoint?storeId='+STORE_ID+'&seq='+String(head.checkpointSeq));
  if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SYNC_CHECKPOINT_FAILED'));
  const checkpoint=validateMfkSyncCheckpoint(body);
  if(checkpoint.port!=='CUSTOMER'||checkpoint.storeId!==STORE_ID||checkpoint.checkpointSeq!==head.checkpointSeq)throw new Error('CUSTOMER_SYNC_CHECKPOINT_IDENTITY_MISMATCH');
  if(checkpoint.checkpointHash!==head.checkpointHash)throw new Error('CUSTOMER_SYNC_CHECKPOINT_HASH_MISMATCH');
  return checkpoint;
}

async function fetchCustomerChanges(after:number){
  const {response,body}=await jsonFetch('/api/customer/sync/changes?storeId='+STORE_ID+'&after='+String(after));
  if(response.status===409&&String(body.code||'').includes('CHECKPOINT'))return{checkpointRequired:true as const};
  if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SYNC_CHANGES_FAILED'));
  return{checkpointRequired:false as const,batch:validateMfkSyncChangeBatch(body)};
}

function customerConfigFromBundle(bundle:CustomerConfigSyncBundle,commercialFreshness:MfkCustomerCommercialFreshnessProof):Partial<CustomerReadModelSnapshot>{
  const materialized=materializeCustomerConfigSnapshot(bundle.entities) as {
    store?:CustomerReadModelSnapshot['store'];
    menu?:CustomerReadModelSnapshot['menu'];
    paymentChannels?:CustomerReadModelSnapshot['paymentChannels'];
    fallback?:CustomerReadModelSnapshot['fallback'];
  };
  const observedAt=bundle.head.observedAt;
  return Object.freeze({
    ...(materialized.store?{store:Object.freeze({...materialized.store,observedAt})}:{}),
    ...(materialized.menu?{menu:Object.freeze({...materialized.menu,revision:String(bundle.head.canonicalRevision),observedAt})}:{}),
    ...(materialized.paymentChannels?{paymentChannels:materialized.paymentChannels}:{}),
    ...(materialized.fallback?{fallback:materialized.fallback}:{}),
    commercialFreshness,
    observedAt,
  });
}

function overlayCustomerRuntimeSellability(
  config:Partial<CustomerReadModelSnapshot>,
  runtimeSellability:readonly unknown[],
):Partial<CustomerReadModelSnapshot>{
  const menu=config.menu;
  if(!menu||!runtimeSellability.length)return config;
  const state=new Map<string,boolean>();
  for(const raw of runtimeSellability){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
    const row=raw as Record<string,unknown>;
    const nodeId=String(row.nodeId||'').trim();
    if(nodeId)state.set(nodeId,row.sellable===true||String(row.status||'')==='available');
  }
  if(!state.size)return config;
  const products=menu.products.map(product=>Object.freeze({
    ...product,
    ...(state.has(product.productId)?{available:Boolean(state.get(product.productId))}:{}),
    optionGroups:product.optionGroups.map(group=>Object.freeze({
      ...group,
      options:group.options.map(option=>Object.freeze({
        ...option,
        ...(state.has('OPTION:'+option.optionId)?{available:Boolean(state.get('OPTION:'+option.optionId))}:{}),
      })),
    })),
  }));
  const comboPools=menu.comboPools?.map(pool=>Object.freeze({
    ...pool,
    groups:pool.groups.map(group=>Object.freeze({
      ...group,
      subPools:group.subPools.map(subPool=>Object.freeze({
        ...subPool,
        choices:subPool.choices.map(choice=>Object.freeze({
          ...choice,
          ...(state.has('COMBO_CHILD:'+choice.choiceId)?{available:Boolean(state.get('COMBO_CHILD:'+choice.choiceId))}:{}),
        })),
      })),
    })),
  }));
  return Object.freeze({...config,menu:Object.freeze({...menu,products:Object.freeze(products),...(comboPools?{comboPools:Object.freeze(comboPools)}:{})})});
}

async function reconcileCustomerConfig():Promise<Partial<CustomerReadModelSnapshot>>{
  let {head,commercialFreshness}=await fetchCustomerSyncHead();
  let bundle=readCustomerSyncBundle();
  let entities:MfkSyncEntityMap;
  let appliedSeq:number;
  let checkpointSeq:number;

  if(bundle&&bundle.head.storeId===head.storeId){
    entities=bundle.entities;
    appliedSeq=bundle.appliedSeq;
    checkpointSeq=bundle.checkpointSeq;
  }else if(head.checkpointHash){
    const checkpoint=await fetchCustomerCheckpoint(head);
    entities=entityMapFromCheckpoint(checkpoint);
    appliedSeq=checkpoint.checkpointSeq;
    checkpointSeq=checkpoint.checkpointSeq;
  }else{
    throw new Error('CUSTOMER_SYNC_BOOTSTRAP_CHECKPOINT_UNAVAILABLE');
  }

  for(let guard=0;guard<12;guard++){
    ({head,commercialFreshness}=await fetchCustomerSyncHead());
    if(appliedSeq>head.headSeq||appliedSeq<head.checkpointSeq){
      if(!head.checkpointHash)throw new Error('CUSTOMER_SYNC_CHECKPOINT_REQUIRED');
      const checkpoint=await fetchCustomerCheckpoint(head);
      entities=entityMapFromCheckpoint(checkpoint);
      appliedSeq=checkpoint.checkpointSeq;
      checkpointSeq=checkpoint.checkpointSeq;
    }
    if(appliedSeq===head.headSeq){
      bundle=writeCustomerSyncBundle(head,entities,appliedSeq,checkpointSeq);
      return customerConfigFromBundle(bundle,commercialFreshness);
    }
    const next=await fetchCustomerChanges(appliedSeq);
    if(next.checkpointRequired){
      if(!head.checkpointHash)throw new Error('CUSTOMER_SYNC_CHECKPOINT_REQUIRED');
      const checkpoint=await fetchCustomerCheckpoint(head);
      entities=entityMapFromCheckpoint(checkpoint);
      appliedSeq=checkpoint.checkpointSeq;
      checkpointSeq=checkpoint.checkpointSeq;
      continue;
    }
    if(next.batch.storeId!==STORE_ID||next.batch.port!=='CUSTOMER')throw new Error('CUSTOMER_SYNC_CHANGE_IDENTITY_MISMATCH');
    entities=applyMfkSyncChanges(entities,next.batch.changes);
    appliedSeq=next.batch.toInclusive;
  }
  throw new Error('CUSTOMER_SYNC_RECONCILE_GUARD_EXCEEDED');
}

async function bootstrapCustomerConfigFromLegacy():Promise<Partial<CustomerReadModelSnapshot>>{
  const params=new URLSearchParams({storeId:STORE_ID});
  const {response,body}=await jsonFetch('/api/customer/snapshot?'+params.toString());
  if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SNAPSHOT_FAILED'));
  const snapshot=body as unknown as CustomerReadModelSnapshot;
  try{
    const {head,commercialFreshness}=await fetchCustomerSyncHead();
    const entities=buildCustomerSyncEntities(snapshot);
    const hash=projectionHashForEntities(entities);
    if(head.headSeq===0||hash===head.projectionHash){
      const bundle=writeCustomerSyncBundle(head,entities,head.headSeq,head.checkpointSeq);
      return customerConfigFromBundle(bundle,commercialFreshness);
    }
  }catch{}
  return snapshot;
}

function subscribeCustomerConfigChanges(listener:(headSeq:number)=>void){
  let stopped=false;
  let socket:WebSocket|null=null;
  let timer:number|undefined;
  let attempt=0;
  const connect=()=>{
    if(stopped||typeof window==='undefined'||typeof WebSocket==='undefined'||navigator.onLine===false)return;
    try{
      const url=new URL(ENDPOINT);
      url.protocol=url.protocol==='https:'?'wss:':'ws:';
      url.pathname='/api/customer/events';
      url.search='?storeId='+encodeURIComponent(STORE_ID);
      socket=new WebSocket(url.toString());
      socket.addEventListener('open',()=>{attempt=0;});
      socket.addEventListener('message',event=>{
        try{
          const row=JSON.parse(String(event.data)) as Record<string,unknown>;
          if(row.type==='PORT_HEAD_AVAILABLE'&&row.port==='CUSTOMER')listener(Number(row.headSeq)||0);
        }catch{}
      });
      socket.addEventListener('close',()=>{
        socket=null;
        if(stopped)return;
        const delays=[500,1000,2000,5000,15000,30000];
        const delay=delays[Math.min(attempt,delays.length-1)]!;
        attempt+=1;
        timer=window.setTimeout(connect,delay);
      });
      socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
    }catch{
      if(!stopped)timer=window.setTimeout(connect,2000);
    }
  };
  connect();
  return()=>{
    stopped=true;
    if(timer!==undefined)window.clearTimeout(timer);
    try{socket?.close();}catch{}
  };
}

function requestId(prefix:string){
  const id=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID()
    :Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  return prefix+id;
}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
async function jsonFetch(path:string,init?:RequestInit){
  const response=await fetch(ENDPOINT+path,{
    cache:'no-store',
    ...init,
    headers:{'content-type':'application/json',...(init?.headers??{})},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  return {response,body};
}
async function jsonFetchWithTimeout(path:string,init:RequestInit|undefined,timeoutMs:number){
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await jsonFetch(path,{...init,signal:controller.signal});
  }finally{
    window.clearTimeout(timer);
  }
}
function commandFromReadback(body:Record<string,unknown>):CustomerCommandResult{
  const state=String(body.state||'UNKNOWN');
  if(state==='CONFIRMED'){
    return {
      state:'CONFIRMED',
      message:'店舖已確認收到訂單',
      orderId:typeof body.canonicalOrderId==='string'?body.canonicalOrderId:undefined,
      displayCode:typeof body.canonicalDisplay==='string'?body.canonicalDisplay:undefined,
      committedAt:typeof body.committedAt==='string'?body.committedAt:undefined,
      totalMinor:Number.isSafeInteger(Number(body.totalMinor))?Number(body.totalMinor):undefined,
    };
  }
  if(state==='REJECTED'){
    return {
      state:'REJECTED',
      message:typeof body.message==='string'?body.message:'店舖未能接受訂單',
    };
  }
  return {
    state:'UNKNOWN',
    readbackCode:state==='PENDING'?'PENDING':'UNKNOWN',
    message:'訂單已送出，等待店舖確認；系統唔會自動重送。',
  };
}

const QUOTE_READBACK_INTERVAL_MS=250;
const BACKEND_PROBE_ATTEMPTS=3;
const BACKEND_PROBE_INTERVAL_MS=700;
const BACKEND_PROBE_TIMEOUT_MS=1600;
const BACKEND_PROBE_FRESH_MS=5000;
let lastReachableBackendProbeAt=0;

async function probeOrderBackend(onAttempt?:(attempt:number,total:number)=>void){
  let lastReason='CUSTOMER_SMT_BACKEND_UNAVAILABLE';
  for(let attempt=1;attempt<=BACKEND_PROBE_ATTEMPTS;attempt++){
    onAttempt?.(attempt,BACKEND_PROBE_ATTEMPTS);
    try{
      const {response,body}=await jsonFetchWithTimeout('/api/customer/channel-health?storeId='+STORE_ID,undefined,BACKEND_PROBE_TIMEOUT_MS);
      if(response.ok&&body.reachable===true){
        lastReachableBackendProbeAt=Date.now();
        return Object.freeze({reachable:true,attempts:attempt});
      }
      lastReason=String(body.code||'CUSTOMER_SMT_BACKEND_UNAVAILABLE');
    }catch(error){
      lastReason=error instanceof Error?error.name==='AbortError'?'CUSTOMER_SMT_BACKEND_PROBE_TIMEOUT':error.message:'CUSTOMER_SMT_BACKEND_UNAVAILABLE';
    }
    if(attempt<BACKEND_PROBE_ATTEMPTS)await sleep(BACKEND_PROBE_INTERVAL_MS);
  }
  return Object.freeze({reachable:false,attempts:BACKEND_PROBE_ATTEMPTS,reason:lastReason});
}
// SMT has a 5s fallback reconcile when the realtime doorbell is missed. Keep the
// customer readback window safely beyond that fallback so a healthy local-first
// quote is not abandoned before SMT gets its first polling opportunity.
const QUOTE_READBACK_ATTEMPTS=48;

async function waitQuote(requestIdValue:string):Promise<CustomerQuoteSnapshot>{
  for(let attempt=0;attempt<QUOTE_READBACK_ATTEMPTS;attempt++){
    if(attempt>0)await sleep(QUOTE_READBACK_INTERVAL_MS);
    const {response,body}=await jsonFetch('/api/customer/quote/readback?storeId='+STORE_ID+'&requestId='+encodeURIComponent(requestIdValue));
    if(response.ok&&body.state==='CONFIRMED'){
      const totalMinor=Number(body.totalMinor);
      if(!Number.isSafeInteger(totalMinor)||totalMinor<0)throw new Error('CUSTOMER_QUOTE_TOTAL_INVALID');
      return Object.freeze({
        quoteId:String(body.quoteId||requestIdValue),
        revision:String(body.revision||'UNKNOWN'),
        currency:String(body.currency||'HKD'),
        totalMinor,
        observedAt:String(body.observedAt||new Date().toISOString()),
        freshness:'CURRENT',
      });
    }
    if(response.ok&&body.state==='REJECTED'){
      throw new Error(typeof body.message==='string'?body.message:'購物籃需要重新確認');
    }
    if(response.status!==404&&!response.ok)throw new Error(String(body.code||'CUSTOMER_QUOTE_READBACK_FAILED'));
  }
  throw new Error('店舖暫時未完成報價，請稍後再試');
}

async function waitOrder(submissionId:string):Promise<CustomerCommandResult>{
  for(let attempt=0;attempt<48;attempt++){
    if(attempt>0)await sleep(250);
    const {response,body}=await jsonFetch('/api/customer/orders/readback?storeId='+STORE_ID+'&submissionId='+encodeURIComponent(submissionId));
    if(response.ok){
      const result=commandFromReadback(body);
      if(result.state!=='UNKNOWN')return result;
    }else if(response.status!==404){
      return{state:'UNKNOWN',message:String(body.code||'暫時未能讀回訂單結果')};
    }
  }
  return{state:'UNKNOWN',readbackCode:'PENDING',message:'店舖已收到落單要求，確認仍在處理；請查詢原本提交結果。'};
}

export async function uploadCustomerPaymentEvidence(file:File):Promise<{evidenceRef:string}>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('付款截圖只支援 JPG、PNG 或 WebP');
  if(file.size<1||file.size>8*1024*1024)throw new Error('付款截圖必須細過 8MB');
  const response=await fetch(ENDPOINT+'/api/customer/payment-evidence?storeId='+STORE_ID,{
    method:'POST',
    headers:{'content-type':file.type},
    body:file,
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok||typeof body.evidenceRef!=='string')throw new Error(String(body.code||'付款截圖上載失敗'));
  return{evidenceRef:body.evidenceRef};
}

export function createCloudCustomerRuntimePort():CustomerRuntimePort{
  return Object.freeze({
    portId:'MFK_CUSTOMER_PORT_V1' as const,
    uploadPaymentEvidence:uploadCustomerPaymentEvidence,
    probeOrderBackend,
    subscribeConfigChanges:subscribeCustomerConfigChanges,

    async readSnapshot():Promise<CustomerReadModelSnapshot>{
      let config:Partial<CustomerReadModelSnapshot>;
      try{config=await reconcileCustomerConfig();}
      catch{config=await bootstrapCustomerConfigFromLegacy();}

      const params=new URLSearchParams({storeId:STORE_ID,config:'0'});
      for(const submissionId of readSubmissionRefs())params.append('submissionId',submissionId);
      const {response,body}=await jsonFetch('/api/customer/snapshot?'+params.toString());
      if(!response.ok)throw new Error(String(body.code||'CUSTOMER_SNAPSHOT_FAILED'));
      const dynamic=body as Record<string,unknown>;
      const merged=overlayCustomerRuntimeSellability(config,Array.isArray(dynamic.runtimeSellability)?dynamic.runtimeSellability:[]);
      return Object.freeze({
        ...merged,
        activeOrders:Array.isArray(dynamic.activeOrders)?dynamic.activeOrders:[],
        history:Array.isArray(dynamic.history)?dynamic.history:[],
        observedAt:typeof dynamic.observedAt==='string'?dynamic.observedAt:String(merged.observedAt||new Date().toISOString()),
      }) as CustomerReadModelSnapshot;
    },

    async quoteCart(cart:readonly CustomerCartLine[]):Promise<CustomerQuoteSnapshot>{
      const id=requestId('CUSTOMER-QUOTE-');
      const {response,body}=await jsonFetch('/api/customer/quote?storeId='+STORE_ID,{
        method:'POST',
        body:JSON.stringify({
          schema:MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
          storeId:STORE_ID,
          requestId:id,
          createdAt:new Date().toISOString(),
          cart,
        }),
      });
      if(!response.ok&&response.status!==202)throw new Error(String(body.code||'CUSTOMER_QUOTE_SUBMIT_FAILED'));
      return waitQuote(id);
    },

    async submitOrder(intent:CustomerPendingIntent):Promise<CustomerCommandResult>{
      if(Date.now()-lastReachableBackendProbeAt>BACKEND_PROBE_FRESH_MS){
        const health=await probeOrderBackend();
        if(!health.reachable){
          return{state:'NOT_CONNECTED',message:'暫時未能連接店舖接單系統；請改用 WhatsApp 聯絡店舖。'};
        }
      }
      rememberSubmissionRef(intent.submissionId);
      try{
        const {response,body}=await jsonFetchWithTimeout('/api/customer/orders/submit?storeId='+STORE_ID,{
          method:'POST',
          body:JSON.stringify({
            schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
            storeId:STORE_ID,
            submissionId:intent.submissionId,
            menuRevision:intent.menuRevision,
            customerPortSeq:intent.commercialFreshness?.customerPortSeq,
            projectionHash:intent.commercialFreshness?.projectionHash,
            canonicalRevision:intent.commercialFreshness?.canonicalRevision,
            commercialProof:intent.commercialFreshness,
            idempotencyKey:intent.idempotencyKey,
            createdAt:intent.createdAt,
            updatedAt:intent.updatedAt,
            cart:intent.cart,
            checkout:{
              name:intent.checkout.name,
              phone:intent.checkout.phone,
              paymentMethod:intent.checkout.paymentMethod,
              ...(intent.checkout.paymentMethod==='ELECTRONIC'&&intent.checkout.paymentChannelId?{paymentChannelId:intent.checkout.paymentChannelId,paymentChannelLabel:intent.checkout.paymentChannelLabel??''}:{}),
              ...(intent.checkout.paymentMethod==='ELECTRONIC'&&intent.checkout.paymentEvidence?.evidenceRef?{paymentEvidenceRef:intent.checkout.paymentEvidence.evidenceRef}:{}),
            },
          }),
        },5000);
        if(response.status===409)return{state:'FAILED',message:String(body.code||'提交身份衝突')};
        if(!response.ok&&response.status!==202)return{state:'FAILED',message:String(body.code||'未能提交訂單')};
        return waitOrder(intent.submissionId);
      }catch{
        return{state:'UNKNOWN',message:'落單要求可能已送出；系統會先讀回原本結果，請勿重複提交。'};
      }
    },

    async readSubmission(submissionId:string):Promise<CustomerCommandResult>{
      rememberSubmissionRef(submissionId);
      const {response,body}=await jsonFetch('/api/customer/orders/readback?storeId='+STORE_ID+'&submissionId='+encodeURIComponent(submissionId));
      if(response.status===404)return{state:'UNKNOWN',readbackCode:'NOT_FOUND',message:'正式接單橋未找到原本提交；可以轉用人工救援。'};
      if(!response.ok)return{state:'UNKNOWN',message:String(body.code||'暫時未能讀回訂單結果')};
      return commandFromReadback(body);
    },
  });
}
