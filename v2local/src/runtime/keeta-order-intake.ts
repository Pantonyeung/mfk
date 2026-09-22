import {
  MFK_KEETA_ORDER_ACK_SCHEMA,
  validateMfkKeetaOrderIntent,
  type MfkKeetaOrderIntent,
} from '../../../contracts/keeta-order-intake-v1.ts';
import {
  normalizeKeetaStandardProviderOrderFacts,
  type KeetaStandardProviderOrderFacts,
} from '../../../integrations/keeta/src/order-facts.js';
import {readSmtAdminConfigLkg,readSmtDeviceId,subscribeSmtCloudDoorbell} from './admin-config-sync.ts';
import {localRuntime,type StoredOrder} from './local-runtime.ts';

const ENDPOINT='https://admin.morefunos.com';
const ATTENTION_KEY='mfk.keeta.order-intake.attention.v1';

interface ChannelMappingRow{
  readonly providerItemId?:string;
  readonly productId?:string;
  readonly status?:string;
}
interface CatalogProduct{
  readonly id?:string;
  readonly name?:string;
  readonly productCode?:string;
  readonly active?:boolean;
}
interface OrderInput{
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode:'takeaway'}[];
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly sourceLabel:string;
  readonly providerRef:string;
  readonly providerMessageId:string;
  readonly initialFulfillmentLabel:'待處理';
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
function resolveProduct(
  line:KeetaStandardProviderOrderFacts['lines'][number],
  catalog:readonly CatalogProduct[],
  mappings:readonly ChannelMappingRow[],
){
  const candidates=[line.skuOpenItemCode,line.spuOpenItemCode,line.providerSkuId,line.providerSpuId].map(String);
  const explicit=mappings.find(row=>row.status==='MAPPED'&&candidates.includes(String(row.providerItemId||'')));
  if(explicit?.productId){
    const product=catalog.find(row=>String(row.id)===String(explicit.productId)&&row.active!==false);
    if(!product)throw new Error('KEETA_ORDER_MAPPING_CANONICAL_PRODUCT_MISSING:'+line.skuOpenItemCode);
    return product;
  }
  const direct=catalog.filter(row=>row.active!==false&&(
    candidates.includes(String(row.productCode||''))||
    candidates.includes(String(row.id||''))
  ));
  if(direct.length!==1)throw new Error(direct.length>1
    ?'KEETA_ORDER_MAPPING_AMBIGUOUS:'+line.skuOpenItemCode
    :'KEETA_ORDER_MAPPING_REQUIRED:'+line.skuOpenItemCode);
  return direct[0]!;
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
  }));
  const mappings=rows(config.channelMapping).map(row=>({
    providerItemId:typeof row.providerItemId==='string'?row.providerItemId:undefined,
    productId:typeof row.productId==='string'?row.productId:undefined,
    status:typeof row.status==='string'?row.status:undefined,
  }));
  const facts=normalizeKeetaStandardProviderOrderFacts({
    orderInfo:JSON.parse(intent.rawMessage),
    providerCapturedAt:intent.receivedAt,
    providerEvidenceRef:'KEETA_WEBHOOK:'+intent.providerMessageId,
  });
  if(facts.providerOrderId!==intent.providerOrderId)throw new Error('KEETA_ORDER_PROVIDER_ID_MISMATCH');
  if(facts.currency!=='HKD')throw new Error('KEETA_ORDER_CURRENCY_UNSUPPORTED:'+facts.currency);

  const items=facts.lines.map(line=>{
    const product=resolveProduct(line,catalog,mappings);
    if(line.providerFinalAmountMinor!==line.providerFinalUnitPriceMinor*line.quantity){
      throw new Error('KEETA_ORDER_LINE_AMOUNT_MISMATCH:'+line.skuOpenItemCode);
    }
    const options=optionSummary(line);
    return Object.freeze({
      id:String(product.id),
      name:String(product.name||line.providerProductName)+(options?'｜'+options:''),
      qty:line.quantity,
      unitMinor:line.providerFinalUnitPriceMinor,
      serviceMode:'takeaway' as const,
    });
  });
  const totalMinor=items.reduce((sum,item)=>sum+item.unitMinor*item.qty,0);
  if(totalMinor<=0)throw new Error('KEETA_ORDER_TOTAL_INVALID');

  return Object.freeze({
    items:Object.freeze(items),
    totalMinor,
    paymentLabel:'KEETA',
    sourceLabel:'Keeta · '+facts.providerOrderCode,
    providerRef:'KEETA:'+facts.providerOrderId,
    providerMessageId:intent.providerMessageId,
    initialFulfillmentLabel:'待處理' as const,
  });
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
  }catch{}
}
function clearAttention(providerOrderId:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    if(!Array.isArray(current))return;
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.filter(row=>String(row?.providerOrderId)!==providerOrderId)));
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
  if(reconciling||typeof navigator!=='undefined'&&!navigator.onLine)return;
  reconciling=true;
  try{
    const deviceId=readSmtDeviceId();
    const response=await fetch(
      ENDPOINT+'/api/keeta/smt/orders/pending?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
      {cache:'no-store'},
    );
    if(response.status===401)return;
    const body=await response.json().catch(()=>({})) as {orders?:unknown[];code?:string};
    if(!response.ok)throw new Error(body.code||'KEETA_ORDER_PENDING_HTTP_'+response.status);
    for(const raw of Array.isArray(body.orders)?body.orders:[]){
      let intent:MfkKeetaOrderIntent|undefined;
      try{
        intent=validateMfkKeetaOrderIntent(raw);
        const orderInput=translateKeetaIntentToLocalOrder(intent);
        const order=localRuntime.createOrder(orderInput);
        await ack(intent,order);
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
export function installKeetaOrderIntake(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='KEETA_ORDER_AVAILABLE')void reconcileKeetaOrderIntake();
  });
  window.addEventListener('online',()=>void reconcileKeetaOrderIntake());
  window.addEventListener('focus',()=>void reconcileKeetaOrderIntake());
  window.setTimeout(()=>void reconcileKeetaOrderIntake(),0);
}
