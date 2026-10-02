import {
  MFK_KEETA_ORDER_ACK_SCHEMA,
  validateMfkKeetaOrderIntent,
  type MfkKeetaOrderIntent,
} from '../../../contracts/keeta-order-intake-v1.ts';
import {
  normalizeKeetaStandardProviderOrderFacts,
  type KeetaStandardProviderOrderFacts,
} from '../../../integrations/keeta/src/order-facts.js';
import {readSmtAdminConfigLkg,readSmtDeviceId,subscribeSmtAdminConfig,subscribeSmtCloudDoorbell} from './admin-config-sync.ts';
import {localRuntime,type StoredOrder} from './local-runtime.ts';
import {assertCapacityChannelAdmission} from './capacity-pool-state.ts';

const ENDPOINT='https://admin.morefunos.com';
const ATTENTION_KEY='mfk.keeta.order-intake.attention.v1';

interface ChannelMappingComponent{readonly canonicalProductId?:string;readonly quantity?:number}
interface ChannelMappingRow{readonly mappingId?:string;readonly enabled?:boolean;readonly skuOpenItemCode?:string;readonly spuOpenItemCode?:string;readonly providerSkuId?:string;readonly providerSpuId?:string;readonly channelName?:string;readonly components?:readonly ChannelMappingComponent[]}
interface CatalogProduct{
  readonly id?:string;
  readonly name?:string;
  readonly productCode?:string;
  readonly active?:boolean;
  readonly basePrice?:string;
  readonly takeawayAdjustment?:string;
  readonly takeawaySurchargeEnabled?:boolean;
}
interface OrderInput{
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode:'takeaway';productCode?:string;detail?:string}[];
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly sourceLabel:string;
  readonly providerRef:string;
  readonly providerMessageId:string;
  readonly providerPickupCode:string;
  readonly initialFulfillmentLabel:'待處理';
  readonly referenceValueMinor:number;
  readonly effectiveTransactionMinor:number;
  readonly pricingAuthority:'KEETA_PROVIDER_AUTHORIZED_TRANSACTION';
}

function snapshot(){
  const envelope=readSmtAdminConfigLkg();
  if(!envelope)throw new Error('KEETA_ORDER_ADMIN_CONFIG_REQUIRED');
  return envelope.snapshot as Record<string,unknown>;
}
function autoAcceptEnabled(){
  const policy=snapshot().channelPolicy;
  return Boolean(policy&&typeof policy==='object'&&!Array.isArray(policy)&&(policy as {autoAccept?:unknown}).autoAccept===true);
}
function rows(value:unknown):Record<string,unknown>[]{
  return Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)) as Record<string,unknown>[]:[];
}
function resolveProductionComponents(
  line:KeetaStandardProviderOrderFacts['lines'][number],
  catalog:readonly CatalogProduct[],
  mappings:readonly ChannelMappingRow[],
){
  const aliases=new Set([line.skuOpenItemCode,line.spuOpenItemCode,line.providerSkuId,line.providerSpuId].map(value=>String(value).trim()).filter(Boolean));
  const explicit=mappings.filter(row=>row.enabled!==false&&(
    aliases.has(String(row.skuOpenItemCode||''))||aliases.has(String(row.spuOpenItemCode||''))||
    aliases.has(String(row.providerSkuId||''))||aliases.has(String(row.providerSpuId||''))
  ));
  if(explicit.length>1)throw new Error('KEETA_ORDER_MAPPING_AMBIGUOUS:'+line.skuOpenItemCode);
  if(explicit.length===1){
    const components=Array.isArray(explicit[0]!.components)?explicit[0]!.components!:[];
    if(!components.length)throw new Error('KEETA_ORDER_MAPPING_COMPONENTS_REQUIRED:'+line.skuOpenItemCode);
    return components.map(component=>{
      const product=catalog.find(row=>String(row.id)===String(component.canonicalProductId||'')&&row.active!==false);
      if(!product)throw new Error('KEETA_ORDER_MAPPING_CANONICAL_PRODUCT_MISSING:'+String(component.canonicalProductId||''));
      const quantity=Number.isSafeInteger(component.quantity)&&Number(component.quantity)>0?Number(component.quantity):1;
      return {product,quantity};
    });
  }
  const candidates=[...aliases].flatMap(value=>[value,value.replace(/^(?:SPU:|SKU:|MF:)/i,'')]);
  const direct=catalog.filter(row=>row.active!==false&&(candidates.includes(String(row.productCode||''))||candidates.includes(String(row.id||''))));
  if(direct.length!==1)throw new Error(direct.length>1?'KEETA_ORDER_MAPPING_AMBIGUOUS:'+line.skuOpenItemCode:'KEETA_ORDER_MAPPING_REQUIRED:'+line.skuOpenItemCode);
  return [{product:direct[0]!,quantity:1}];
}
function canonicalTakeawayUnitMinor(product:CatalogProduct){
  const base=Number(product.basePrice);
  if(!Number.isFinite(base)||base<0)throw new Error('KEETA_ORDER_CANONICAL_PRICE_REQUIRED:'+String(product.id||''));
  const adjustment=product.takeawaySurchargeEnabled?Number(product.takeawayAdjustment||0):0;
  if(!Number.isFinite(adjustment))throw new Error('KEETA_ORDER_CANONICAL_TAKEAWAY_PRICE_INVALID:'+String(product.id||''));
  return Math.round((base+adjustment)*100);
}
function optionSummary(line:KeetaStandardProviderOrderFacts['lines'][number]){
  return line.selectedOptions
    .map(option=>{
      const qty=Number(option.quantity)||1;
      return option.providerOptionName+(qty>1?' x'+qty:'');
    })
    .filter(Boolean)
    .join('、');
}

export function translateKeetaIntentToLocalOrder(input:MfkKeetaOrderIntent):OrderInput{
  const intent=validateMfkKeetaOrderIntent(input);
  if(intent.state!=='PENDING_SMT')throw new Error('KEETA_ORDER_INTENT_NOT_PENDING');
  const config=snapshot();
  const catalogSection=config.catalog as {products?:unknown}|undefined;
  const catalog=rows(catalogSection?.products).map(row=>({
    id:typeof row.id==='string'?row.id:undefined,
    name:typeof row.name==='string'?row.name:undefined,
    productCode:typeof row.productCode==='string'?row.productCode:undefined,
    active:row.active!==false,
    basePrice:typeof row.basePrice==='string'?row.basePrice:undefined,
    takeawayAdjustment:typeof row.takeawayAdjustment==='string'?row.takeawayAdjustment:undefined,
    takeawaySurchargeEnabled:row.takeawaySurchargeEnabled===true,
  }));
  const channelMappings=config.channelMappings&&typeof config.channelMappings==='object'&&!Array.isArray(config.channelMappings)?config.channelMappings as {keeta?:unknown}:{};
  const mappings=rows(channelMappings.keeta).map(row=>({
    mappingId:typeof row.mappingId==='string'?row.mappingId:undefined,enabled:row.enabled!==false,
    skuOpenItemCode:typeof row.skuOpenItemCode==='string'?row.skuOpenItemCode:undefined,spuOpenItemCode:typeof row.spuOpenItemCode==='string'?row.spuOpenItemCode:undefined,
    providerSkuId:typeof row.providerSkuId==='string'?row.providerSkuId:undefined,providerSpuId:typeof row.providerSpuId==='string'?row.providerSpuId:undefined,
    channelName:typeof row.channelName==='string'?row.channelName:undefined,components:Array.isArray(row.components)?row.components as ChannelMappingComponent[]:[],
  }));
  const facts=normalizeKeetaStandardProviderOrderFacts({
    orderInfo:JSON.parse(intent.rawMessage),
    providerCapturedAt:intent.receivedAt,
    providerEvidenceRef:'KEETA_WEBHOOK:'+intent.providerMessageId,
  });
  if(facts.providerOrderId!==intent.providerOrderId)throw new Error('KEETA_ORDER_PROVIDER_ID_MISMATCH');
  if(facts.currency!=='HKD')throw new Error('KEETA_ORDER_CURRENCY_UNSUPPORTED:'+facts.currency);

  const items=facts.lines.flatMap(line=>{
    if(line.providerFinalAmountMinor!==line.providerFinalUnitPriceMinor*line.quantity)throw new Error('KEETA_ORDER_LINE_AMOUNT_MISMATCH:'+line.skuOpenItemCode);
    const options=optionSummary(line);
    const components=resolveProductionComponents(line,catalog,mappings);
    return components.map(({product,quantity},componentIndex)=>Object.freeze({
      id:String(product.id),
      name:String(product.name||line.providerProductName)+(options?'｜'+options:''),
      qty:line.quantity*quantity,
      unitMinor:canonicalTakeawayUnitMinor(product),
      serviceMode:'takeaway' as const,
      ...(product.productCode?{productCode:String(product.productCode)}:{}),
      detail:['Keeta: '+line.providerProductName,options].filter(Boolean).join('｜'),
    }));
  });
  const referenceValueMinor=items.reduce((sum,item)=>sum+item.unitMinor*item.qty,0);
  const effectiveTransactionMinor=facts.providerEffectiveProductTotalMinor;
  if(referenceValueMinor<=0)throw new Error('KEETA_ORDER_REFERENCE_VALUE_INVALID');
  if(!Number.isSafeInteger(effectiveTransactionMinor)||effectiveTransactionMinor<0)throw new Error('KEETA_ORDER_EFFECTIVE_TRANSACTION_INVALID');

  return Object.freeze({
    items:Object.freeze(items),
    totalMinor:effectiveTransactionMinor,
    referenceValueMinor,
    effectiveTransactionMinor,
    pricingAuthority:'KEETA_PROVIDER_AUTHORIZED_TRANSACTION' as const,
    paymentLabel:'KEETA',
    sourceLabel:'Keeta · '+facts.providerOrderCode,
    providerRef:'KEETA:'+facts.providerOrderId,
    providerMessageId:intent.providerMessageId,
    providerPickupCode:facts.providerOrderCode,
    initialFulfillmentLabel:'待處理' as const,
  });
}

function emitIntakeUpdate(detail?:{providerOrderId:string;canonicalOrderId:string;display:string;sourceLabel:string}){
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('mfk-keeta-order-intake',{detail}));
}
function attention(providerOrderId:string,code:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    const rows=Array.isArray(current)?current:[];
    const next=[
      {providerOrderId,code,updatedAt:new Date().toISOString()},
      ...rows.filter(row=>String(row?.providerOrderId)!==providerOrderId),
    ].slice(0,100);
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(next));
    emitIntakeUpdate();
  }catch{}
}
function clearAttention(providerOrderId:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    if(!Array.isArray(current))return;
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.filter(row=>String(row?.providerOrderId)!==providerOrderId)));
    emitIntakeUpdate();
  }catch{}
}
export function readKeetaOrderIntakeAttention(){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    return Object.freeze(Array.isArray(current)?current:[]);
  }catch{return Object.freeze([]);}
}

async function ack(intent:MfkKeetaOrderIntent,order:StoredOrder){
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/ack?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:MFK_KEETA_ORDER_ACK_SCHEMA,
        storeId:'MF01',
        provider:'KEETA',
        providerOrderId:intent.providerOrderId,
        providerMessageId:intent.providerMessageId,
        canonicalOrderId:order.id,
        canonicalDisplay:order.display,
        committedAt:new Date().toISOString(),
      }),
    },
  );
  const body=await response.json().catch(()=>({})) as {code?:string};
  if(!response.ok)throw new Error(body.code||'KEETA_ORDER_ACK_HTTP_'+response.status);
}

let reconciling=false;
export async function reconcileKeetaOrderIntake(){
  if(reconciling||typeof navigator!=='undefined'&&typeof navigator.onLine==='boolean'&&!navigator.onLine)return;
  reconciling=true;
  try{
    const deviceId=readSmtDeviceId();
    const response=await fetch(
      ENDPOINT+'/api/keeta/smt/orders/pending?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
      {cache:'no-store'},
    );
    const body=await response.json().catch(()=>({})) as {orders?:unknown[];code?:string};
    if(response.status===401){
      attention('__TRANSPORT__',body.code||'KEETA_SMT_UNAUTHORIZED');
      return;
    }
    if(!response.ok){
      attention('__TRANSPORT__',body.code||'KEETA_ORDER_PENDING_HTTP_'+response.status);
      return;
    }
    clearAttention('__TRANSPORT__');
    for(const raw of Array.isArray(body.orders)?body.orders:[]){
      let intent:MfkKeetaOrderIntent|undefined;
      try{
        intent=validateMfkKeetaOrderIntent(raw);
        const orderInput=translateKeetaIntentToLocalOrder(intent);
        const beforeId=localRuntime.orders().find(row=>row.providerRef===orderInput.providerRef)?.id;
        if(!beforeId){
          assertCapacityChannelAdmission({
            channel:'THIRD_PARTY',
            items:orderInput.items,
            orderEvents:localRuntime.orders().flatMap(order=>order.capacityEvents??[]),
          });
        }
        const order=localRuntime.createOrder(orderInput);
        await ack(intent,order);
        if(!beforeId)emitIntakeUpdate({providerOrderId:intent.providerOrderId,canonicalOrderId:order.id,display:order.display,sourceLabel:order.sourceLabel});
        if(autoAcceptEnabled()&&order.fulfillmentLabel==='待處理'){
          await localRuntime.acceptOrder(order.id);
        }
        clearAttention(intent.providerOrderId);
      }catch(error){
        const providerOrderId=intent?.providerOrderId??'UNKNOWN';
        attention(providerOrderId,error instanceof Error?error.message:'KEETA_ORDER_INTAKE_FAILED');
      }
    }
  }finally{
    reconciling=false;
  }
}

let installed=false;
let lastObservedConfigFingerprint='';
export function installKeetaOrderIntake(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const reconcile=()=>void reconcileKeetaOrderIntake();
  lastObservedConfigFingerprint=readSmtAdminConfigLkg()?.fingerprint??'';
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='KEETA_ORDER_AVAILABLE')reconcile();
  });
  // Re-run only when the canonical Admin config fingerprint actually changes.
  // Sync status, focus and visibility events must never look like new business data.
  subscribeSmtAdminConfig(()=>{
    const fingerprint=readSmtAdminConfigLkg()?.fingerprint??'';
    if(!fingerprint||fingerprint===lastObservedConfigFingerprint)return;
    lastObservedConfigFingerprint=fingerprint;
    reconcile();
  });
  window.addEventListener('online',reconcile);
  window.setTimeout(reconcile,0);
}
