import type {
  CustomerCloudCartLine,
  MfkCustomerOrderIntent,
  MfkCustomerQuoteRequest,
} from '../../../contracts/customer-cloud-v1.ts';
import {projectSyncedOrderingCatalog,type SyncedOrderingProduct} from './admin-config-projection.ts';
import {
  readSmtAdminConfigLkg,
  readSmtDeviceId,
  subscribeSmtAdminConfig,
  subscribeSmtCloudDoorbell,
} from './admin-config-sync.ts';
import {localRuntime} from './local-runtime.ts';
import {createSmmLanIngress} from './smm-lan-ingress.ts';
import type {SmmLanOrderRequest} from '../../../contracts/smm-lan-v1.ts';

const ENDPOINT='https://admin.morefunos.com';
const ATTENTION_KEY='mfk.customer.cloud-intake.attention.v1';

export interface CustomerPricedLine{
  readonly id:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly serviceMode:'takeaway';
  readonly detail?:string;
}
export interface CustomerPricedCart{
  readonly items:readonly CustomerPricedLine[];
  readonly totalMinor:number;
}

function selectedByGroup(line:CustomerCloudCartLine){
  const map=new Map<string,string[]>();
  for(const selection of line.selections){
    const current=map.get(selection.optionGroupId)??[];
    current.push(selection.optionId);
    map.set(selection.optionGroupId,current);
  }
  return map;
}

export function priceCustomerCart(
  cart:readonly CustomerCloudCartLine[],
  products:readonly SyncedOrderingProduct[],
):CustomerPricedCart{
  const byId=new Map(products.map(product=>[product.id,product] as const));
  const items:CustomerPricedLine[]=[];
  let totalMinor=0;

  for(const line of cart){
    if(line.selectedVariationId)throw new Error('CUSTOMER_VARIATION_NOT_SUPPORTED_BY_PUBLISHED_CATALOG:'+line.productId);
    const product=byId.get(line.productId);
    if(!product||!product.sellable)throw new Error('CUSTOMER_PRODUCT_UNAVAILABLE:'+line.productId);
    if(!product.priceReady)throw new Error('CUSTOMER_PRODUCT_PRICE_NOT_READY:'+line.productId);

    const chosen=selectedByGroup(line);
    let optionMinor=0;
    const optionNames:string[]=[];
    for(const set of product.optionSets){
      const selected=[...new Set(chosen.get(set.id)??[])];
      const min=Math.max(set.required?1:0,set.min);
      const max=Math.max(min,set.max);
      if(selected.length<min)throw new Error('CUSTOMER_OPTION_REQUIRED:'+product.id+':'+set.id);
      if(selected.length>max)throw new Error('CUSTOMER_OPTION_MAX_EXCEEDED:'+product.id+':'+set.id);
      for(const optionId of selected){
        const option=set.options.find(row=>row.id===optionId&&row.active);
        if(!option)throw new Error('CUSTOMER_OPTION_UNAVAILABLE:'+product.id+':'+set.id+':'+optionId);
        optionMinor+=option.priceAdjustmentMinor;
        optionNames.push(option.name);
      }
    }
    for(const groupId of chosen.keys()){
      if(!product.optionSets.some(set=>set.id===groupId))throw new Error('CUSTOMER_OPTION_GROUP_UNKNOWN:'+product.id+':'+groupId);
    }

    const unitMinor=product.priceMinor+optionMinor;
    if(!Number.isSafeInteger(unitMinor)||unitMinor<0)throw new Error('CUSTOMER_UNIT_PRICE_INVALID:'+product.id);
    const qty=Math.max(1,Math.floor(Number(line.quantity)||1));
    totalMinor+=unitMinor*qty;
    const detail=[optionNames.join('、'),String(line.note||'').trim()].filter(Boolean).join(' · ');
    items.push(Object.freeze({
      id:product.id,
      name:product.name,
      qty,
      unitMinor,
      serviceMode:'takeaway' as const,
      ...(detail?{detail}:{}),
    }));
  }

  if(!Number.isSafeInteger(totalMinor)||totalMinor<0)throw new Error('CUSTOMER_TOTAL_INVALID');
  return Object.freeze({items:Object.freeze(items),totalMinor});
}

function attention(code:string){
  try{
    const rows=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    const current=Array.isArray(rows)?rows:[];
    current.unshift({code,updatedAt:new Date().toISOString()});
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.slice(0,100)));
  }catch{}
}
export interface CustomerCloudBridgeDiagnostic{
  readonly ok:boolean;
  readonly stage:string;
  readonly deviceAuthorized?:boolean;
  readonly pendingQuotes?:number|null;
  readonly pendingOrders?:number|null;
  readonly quotePullStatus?:number;
  readonly orderPullStatus?:number;
  readonly status?:number;
  readonly code?:string;
  readonly observedAt?:string;
  readonly lastPublicQuote?:Record<string,unknown>|null;
  readonly lastQuotePull?:Record<string,unknown>|null;
  readonly lastQuoteAck?:Record<string,unknown>|null;
}

export async function diagnoseCustomerCloudBridge():Promise<CustomerCloudBridgeDiagnostic>{
  const deviceId=readSmtDeviceId();
  try{
    const response=await fetch(ENDPOINT+'/api/customer/smt/diagnostics?storeId=MF01&deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    return Object.freeze({
      ok:response.ok&&body.ok===true,
      stage:String(body.stage||'CUSTOMER_BRIDGE_DIAGNOSTIC_UNKNOWN'),
      deviceAuthorized:body.deviceAuthorized===true,
      pendingQuotes:Number.isFinite(Number(body.pendingQuotes))?Number(body.pendingQuotes):null,
      pendingOrders:Number.isFinite(Number(body.pendingOrders))?Number(body.pendingOrders):null,
      quotePullStatus:Number.isFinite(Number(body.quotePullStatus))?Number(body.quotePullStatus):undefined,
      orderPullStatus:Number.isFinite(Number(body.orderPullStatus))?Number(body.orderPullStatus):undefined,
      status:response.status,
      code:typeof body.code==='string'?body.code:undefined,
      observedAt:typeof body.observedAt==='string'?body.observedAt:new Date().toISOString(),
      lastPublicQuote:body.lastPublicQuote&&typeof body.lastPublicQuote==='object'?body.lastPublicQuote as Record<string,unknown>:null,
      lastQuotePull:body.lastQuotePull&&typeof body.lastQuotePull==='object'?body.lastQuotePull as Record<string,unknown>:null,
      lastQuoteAck:body.lastQuoteAck&&typeof body.lastQuoteAck==='object'?body.lastQuoteAck as Record<string,unknown>:null,
    });
  }catch(error){
    return Object.freeze({
      ok:false,
      stage:'CUSTOMER_BRIDGE_DIAGNOSTIC_NETWORK_ERROR',
      deviceAuthorized:false,
      status:0,
      code:error instanceof Error?error.message:'NETWORK_ERROR',
      observedAt:new Date().toISOString(),
    });
  }
}

export function readCustomerCloudIntakeAttention(){
  try{
    const rows=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    return Object.freeze(Array.isArray(rows)?rows:[]);
  }catch{return Object.freeze([]);}
}

const smmIngress=createSmmLanIngress(localRuntime);

function activeCatalog(){
  const envelope=readSmtAdminConfigLkg();
  if(!envelope)throw new Error('CUSTOMER_ADMIN_CONFIG_REQUIRED');
  return {
    envelope,
    catalog:projectSyncedOrderingCatalog('takeaway',envelope),
  };
}

async function getJson(path:string){
  const deviceId=readSmtDeviceId();
  const response=await fetch(ENDPOINT+path+(path.includes('?')?'&':'?')+'storeId=MF01&deviceId='+encodeURIComponent(deviceId),{cache:'no-store'});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.code||'CUSTOMER_CLOUD_HTTP_'+response.status));
  return body;
}

async function postJson(path:string,body:unknown){
  const deviceId=readSmtDeviceId();
  const response=await fetch(ENDPOINT+path+(path.includes('?')?'&':'?')+'storeId=MF01&deviceId='+encodeURIComponent(deviceId),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  const result=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(result.code||'CUSTOMER_CLOUD_HTTP_'+response.status));
  return result;
}

async function reconcileQuotes(){
  const body=await getJson('/api/customer/smt/quotes/pending');
  const quotes=Array.isArray(body.quotes)?body.quotes:[];
  if(!quotes.length)return;
  const {envelope,catalog}=activeCatalog();
  for(const raw of quotes){
    const quote=raw as MfkCustomerQuoteRequest&{state?:string};
    try{
      const priced=priceCustomerCart(quote.cart,catalog.products);
      await postJson('/api/customer/smt/quotes/ack',{
        requestId:quote.requestId,
        state:'CONFIRMED',
        quoteId:'CUSTOMER-QUOTE:'+quote.requestId,
        revision:String(envelope.revision)+':'+String(envelope.fingerprint),
        currency:'HKD',
        totalMinor:priced.totalMinor,
        observedAt:new Date().toISOString(),
      });
    }catch(error){
      await postJson('/api/customer/smt/quotes/ack',{
        requestId:quote.requestId,
        state:'REJECTED',
        code:error instanceof Error?error.message:'CUSTOMER_QUOTE_REJECTED',
        message:'購物籃需要重新確認',
      }).catch(()=>{});
    }
  }
}

async function reconcileOrders(){
  const body=await getJson('/api/customer/smt/orders/pending');
  const orders=Array.isArray(body.orders)?body.orders:[];
  if(!orders.length)return;
  const {catalog}=activeCatalog();
  for(const raw of orders){
    const bridgeRow=raw as Record<string,unknown>;
    if(bridgeRow.bridgeKind==='SMM_STAFF'){
      const request=bridgeRow.request as SmmLanOrderRequest|undefined;
      if(!request)continue;
      try{
        const result=smmIngress.submit(request,{deviceId:readSmtDeviceId(),trusted:true});
        if(result.disposition==='REJECTED'){
          await postJson('/api/customer/smt/orders/ack',{
            submissionId:request.submissionId,
            idempotencyKey:request.idempotencyKey,
            state:'REJECTED',
            code:result.reasonCode,
            message:'SMM 員工訂單需要重新確認',
          });
          continue;
        }
        const order=localRuntime.orders().find(row=>row.id===result.orderId);
        if(!order)throw new Error('SMM_CANONICAL_ORDER_READBACK_MISSING');
        window.dispatchEvent(new CustomEvent('mfk-customer-order-intake',{detail:{
          canonicalOrderId:order.id,
          display:order.display,
          sourceLabel:'SMM',
          submissionId:request.submissionId,
        }}));
        await postJson('/api/customer/smt/orders/ack',{
          submissionId:request.submissionId,
          idempotencyKey:request.idempotencyKey,
          state:'CONFIRMED',
          canonicalOrderId:order.id,
          canonicalDisplay:order.display,
          committedAt:order.createdAt,
          totalMinor:order.totalMinor,
        });
      }catch(error){
        await postJson('/api/customer/smt/orders/ack',{
          submissionId:request.submissionId,
          idempotencyKey:request.idempotencyKey,
          state:'REJECTED',
          code:error instanceof Error?error.message:'SMM_ORDER_REJECTED',
          message:'店舖未能接受此員工訂單，請重新確認',
        }).catch(()=>{});
      }
      continue;
    }

    const intent=raw as MfkCustomerOrderIntent&{state?:string};
    try{
      const priced=priceCustomerCart(intent.cart,catalog.products);
      const publishedTotal=intent.cart.reduce((sum,line)=>sum+(Number.isSafeInteger(Number(line.publishedUnitPriceMinor))?Number(line.publishedUnitPriceMinor)*line.quantity:0),0);
      const hasPublishedTotal=intent.cart.every(line=>Number.isSafeInteger(Number(line.publishedUnitPriceMinor))&&Number(line.publishedUnitPriceMinor)>=0);
      if(hasPublishedTotal&&publishedTotal!==priced.totalMinor)throw new Error('CUSTOMER_MENU_PRICE_CHANGED');
      const providerRef='CUSTOMER:'+intent.submissionId;
      const order=localRuntime.createOrder({
        items:priced.items,
        totalMinor:priced.totalMinor,
        paymentLabel:intent.checkout.paymentMethod==='ELECTRONIC'?'電子支付（待核對）':'到店付款',
        sourceLabel:'自家 App',
        providerRef,
        ...(intent.checkout.paymentMethod==='ELECTRONIC'&&intent.checkout.paymentEvidenceRef?{paymentEvidenceRef:intent.checkout.paymentEvidenceRef,paymentVerificationState:'PENDING' as const}:{}),
        customerPhone:intent.checkout.phone,
        initialFulfillmentLabel:'待處理',
      });
      window.dispatchEvent(new CustomEvent('mfk-customer-order-intake',{detail:{
        canonicalOrderId:order.id,
        display:order.display,
        sourceLabel:'自家 App',
        submissionId:intent.submissionId,
      }}));
      await postJson('/api/customer/smt/orders/ack',{
        submissionId:intent.submissionId,
        idempotencyKey:intent.idempotencyKey,
        state:'CONFIRMED',
        canonicalOrderId:order.id,
        canonicalDisplay:order.display,
        committedAt:order.createdAt,
        totalMinor:order.totalMinor,
      });
    }catch(error){
      await postJson('/api/customer/smt/orders/ack',{
        submissionId:intent.submissionId,
        idempotencyKey:intent.idempotencyKey,
        state:'REJECTED',
        code:error instanceof Error?error.message:'CUSTOMER_ORDER_REJECTED',
        message:'店舖未能接受此訂單，請重新確認購物籃',
      }).catch(()=>{});
    }
  }
}

let reconciling=false;
export async function reconcileCustomerCloudBridge(){
  if(reconciling||typeof navigator!=='undefined'&&typeof navigator.onLine==='boolean'&&!navigator.onLine)return;
  reconciling=true;
  try{
    await reconcileQuotes();
    await reconcileOrders();
  }catch(error){
    attention(error instanceof Error?error.message:'CUSTOMER_CLOUD_RECONCILE_FAILED');
  }finally{
    reconciling=false;
  }
}

let installed=false;
let fallbackTimer:number|undefined;
export function installCustomerCloudBridge(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const reconcile=()=>void reconcileCustomerCloudBridge();
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='CUSTOMER_QUOTE_AVAILABLE'||event.type==='CUSTOMER_ORDER_AVAILABLE')reconcile();
  });
  subscribeSmtAdminConfig(reconcile);
  window.addEventListener('online',reconcile);
  window.addEventListener('focus',reconcile);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconcile();});
  fallbackTimer=window.setInterval(()=>{
    if(document.visibilityState==='visible'&&navigator.onLine)reconcile();
  },5000);
  window.setTimeout(reconcile,0);
}
