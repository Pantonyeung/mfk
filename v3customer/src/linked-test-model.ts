import type {LinkedCatalog,LinkedProduct} from '../../integrations/v3-linked-test.ts';
import type {LinkedRequestStatus} from '../../integrations/v3-linked-client.ts';
import {validateMfkCustomerOrderIntent} from '../../contracts/customer-cloud-v1.ts';
import type {CustomerCloudCartLine,MfkCustomerOrderIntent} from '../../contracts/customer-cloud-v1.ts';

export const LINKED_STORAGE_KEY='mfp:v3:linked-test:customer:request:v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('LINKED_RESPONSE_INVALID');return v as Record<string,any>;};
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const integer=(v:unknown,min=0)=>Number.isSafeInteger(v)&&Number(v)>=min;
const unique=(values:string[])=>new Set(values).size===values.length;
function rejectFormalClaims(row:Record<string,any>){for(const key of ['formalCheckoutConnected','physicalPrintConnected','formalOrderCreated','paymentConfirmed'])if(Object.hasOwn(row,key)&&row[key]!==false)throw Error('LINKED_FORMAL_CLAIM_INVALID');}
/** Validate the canonical response before rendering it. No local or preview fallback. */
export function parseLinkedCatalog(value:unknown):LinkedCatalog{
  const row=object(value);rejectFormalClaims(row);
  if(row.scope!=='MFP_V3_LINKED_TEST_MF01_20261003'||row.mode!=='CONNECTED_TEST'||!text(row.fingerprint)||!integer(row.revision,1)||!text(row.publishedAt)||!Number.isFinite(Date.parse(row.publishedAt))||row.formalCheckoutConnected!==false||row.physicalPrintConnected!==false||!Array.isArray(row.categories)||!Array.isArray(row.products))throw Error('LINKED_CATALOG_INVALID');
  const categories=row.categories.map((c:unknown)=>{const item=object(c);if(!text(item.id)||!text(item.name))throw Error('LINKED_CATEGORY_INVALID');return item.id;});
  if(!unique(categories)||!unique(row.products.map((p:any)=>p?.id)))throw Error('LINKED_CATALOG_DUPLICATE');
  for(const raw of row.products){
    const p=object(raw);
    if(!text(p.id)||!text(p.name)||typeof p.description!=='string'||!categories.includes(p.categoryId)||typeof p.available!=='boolean'||typeof p.unavailableReason!=='string'||!(p.priceMinor===null||integer(p.priceMinor))||(p.available&&p.priceMinor===null)||!Array.isArray(p.options)||!unique(p.options.map((g:any)=>g?.id)))throw Error('LINKED_PRODUCT_INVALID');
    for(const rawGroup of p.options){
      const group=object(rawGroup);
      if(!text(group.id)||!text(group.name)||!integer(group.min)||!integer(group.max)||group.min>group.max||!Array.isArray(group.defaults)||!unique(group.defaults)||!Array.isArray(group.choices)||!unique(group.choices.map((c:any)=>c?.id)))throw Error('LINKED_OPTIONS_INVALID');
      for(const rawChoice of group.choices){const choice=object(rawChoice);if(!text(choice.id)||!text(choice.name)||!Number.isSafeInteger(choice.adjustmentMinor))throw Error('LINKED_CHOICE_INVALID');}
      if(group.min>group.choices.length||group.defaults.length>group.max||group.defaults.some((id:unknown)=>!group.choices.some((c:any)=>c.id===id)))throw Error('LINKED_DEFAULT_INVALID');
    }
  }
  return structuredClone(value) as LinkedCatalog;
}
export function linkedLine(catalog:LinkedCatalog,productId:string,quantity:number,selected:Record<string,string[]>):CustomerCloudCartLine{
  const product=catalog.products.find(p=>p.id===productId);
  if(!product?.available||product.priceMinor===null||!integer(quantity,1)||quantity>99)throw Error('LINKED_PRODUCT_UNAVAILABLE');
  if(Object.keys(selected).some(id=>!product.options.some(g=>g.id===id)))throw Error('LINKED_OPTION_INVALID');
  const selections=product.options.flatMap(group=>{
    const ids=selected[group.id]??[];
    if(!unique(ids)||ids.length<group.min||ids.length>group.max)throw Error('LINKED_OPTION_CARDINALITY_INVALID');
    return ids.map(id=>{const choice=group.choices.find(c=>c.id===id);if(!choice)throw Error('LINKED_OPTION_INVALID');return {optionGroupId:group.id,optionId:id,optionName:choice.name};});
  });
  return {lineId:crypto.randomUUID(),productId:product.id,productName:product.name,quantity,selections,publishedUnitPriceMinor:product.priceMinor};
}
export const linkedDefaults=(product:LinkedProduct)=>Object.fromEntries(product.options.map(group=>[group.id,[...group.defaults]]));
export function parseLinkedStatus(value:unknown,submissionId:string):LinkedRequestStatus{
  const row=object(value);rejectFormalClaims(row);
  if(row.submissionId!==submissionId||!['PENDING','PENDING_SMT','REJECTED'].includes(row.state)||!['UNSEEN','SEEN','REJECTED'].includes(row.reviewState)||row.formalOrderCreated!==false||row.paymentConfirmed!==false||typeof row.message!=='string'||!(row.reviewedAt===null||(typeof row.reviewedAt==='string'&&Number.isFinite(Date.parse(row.reviewedAt)))))throw Error('LINKED_STATUS_INVALID');
  return structuredClone(value) as LinkedRequestStatus;
}
type StoragePort=Pick<Storage,'getItem'|'setItem'>;
type RequestPort=(path:string,method?:string,body?:unknown)=>Promise<unknown>;
function restore(value:string):MfkCustomerOrderIntent{
  const raw=JSON.parse(value),intent=validateMfkCustomerOrderIntent(raw);
  if(!UUID.test(intent.submissionId)||intent.idempotencyKey!=='V3:'+intent.submissionId||intent.checkout.paymentMethod!=='PAY_AT_STORE'||raw.checkout.paymentEvidenceRef||raw.checkout.paymentChannelId||JSON.stringify(intent)!==JSON.stringify(raw))throw Error('LINKED_STORAGE_INVALID');
  return intent;
}
type RetryState={active:MfkCustomerOrderIntent|null;history:MfkCustomerOrderIntent[]};
function retryState(raw:string|null):RetryState{
  if(raw===null)return {active:null,history:[]};
  const parsed=JSON.parse(raw);
  if(parsed?.schema!=='MFP_LINKED_RETRY_STATE_V2')return {active:restore(raw),history:[]};
  if(Object.keys(parsed).some(key=>!['schema','active','history'].includes(key))||!Array.isArray(parsed.history))throw Error('LINKED_STORAGE_INVALID');
  const active=parsed.active===null?null:restore(JSON.stringify(parsed.active));
  const history=parsed.history.map((item:unknown)=>restore(JSON.stringify(item)));
  if(!unique(history.map((item:MfkCustomerOrderIntent)=>item.submissionId))||history.some((item:MfkCustomerOrderIntent)=>item.submissionId===active?.submissionId))throw Error('LINKED_STORAGE_INVALID');
  return {active,history};
}
/** localStorage holds retry identities and immutable test intents, never order/payment truth. */
export class LinkedSubmission{
  private saved:MfkCustomerOrderIntent|null=null;
  private history:MfkCustomerOrderIntent[]=[];
  private persisted:string|null=null;
  private inFlight:Promise<LinkedRequestStatus>|null=null;
  private rollover:Promise<void>|null=null;
  private storage:StoragePort;
  private request:RequestPort;
  constructor(storage:StoragePort,request:RequestPort){
    this.storage=storage;this.request=request;
    try{this.persisted=storage.getItem(LINKED_STORAGE_KEY);const state=retryState(this.persisted);this.saved=state.active;this.history=state.history;}catch{throw Error('LINKED_STORAGE_UNAVAILABLE_OR_INVALID');}
  }
  get intent(){return this.saved?structuredClone(this.saved):null;}
  get archived(){return structuredClone(this.history);}
  private unchanged(){
    let current:string|null;try{current=this.storage.getItem(LINKED_STORAGE_KEY);}catch{throw Error('LINKED_STORAGE_UNAVAILABLE');}
    if(current!==this.persisted)throw Error('LINKED_STORAGE_CHANGED');
  }
  private persist(active:MfkCustomerOrderIntent|null,history:MfkCustomerOrderIntent[]){
    this.unchanged();
    const bytes=JSON.stringify(history.length?{schema:'MFP_LINKED_RETRY_STATE_V2',active,history}:active);
    try{this.storage.setItem(LINKED_STORAGE_KEY,bytes);if(this.storage.getItem(LINKED_STORAGE_KEY)!==bytes)throw Error('write failed');}catch{throw Error('LINKED_STORAGE_UNAVAILABLE');}
    this.persisted=bytes;this.saved=active;this.history=history;
  }
  prepare(catalog:LinkedCatalog,cart:readonly CustomerCloudCartLine[]):MfkCustomerOrderIntent{
    if(this.saved||this.rollover)throw Error('LINKED_EXISTING_REQUEST');this.unchanged();
    parseLinkedCatalog(catalog);
    if(!cart.length||cart.length>40)throw Error('LINKED_CART_INVALID');
    for(const line of cart){
      const selected:Record<string,string[]>={};for(const s of line.selections)(selected[s.optionGroupId]??=[]).push(s.optionId);
      const canonical=linkedLine(catalog,line.productId,line.quantity,selected);
      if(line.combo||line.selectedVariationId||line.productName!==canonical.productName||line.publishedUnitPriceMinor!==canonical.publishedUnitPriceMinor||JSON.stringify(line.selections)!==JSON.stringify(canonical.selections))throw Error('LINKED_CART_CHANGED');
    }
    const id=crypto.randomUUID(),now=new Date().toISOString();
    const intent=validateMfkCustomerOrderIntent({schema:'MFK_CUSTOMER_ORDER_INTENT_V1',storeId:'MF01',submissionId:id,idempotencyKey:'V3:'+id,menuRevision:catalog.fingerprint,createdAt:now,updatedAt:now,cart,checkout:{name:'測試顧客',phone:'00000000',paymentMethod:'PAY_AT_STORE'}});
    this.persist(intent,this.history);return structuredClone(intent);
  }
  submit():Promise<LinkedRequestStatus>{
    if(this.rollover)return Promise.reject(Error('LINKED_REQUEST_BUSY'));
    if(this.inFlight)return this.inFlight;
    const intent=this.intent;if(!intent)return Promise.reject(Error('LINKED_REQUEST_MISSING'));
    this.inFlight=this.request('/submit','POST',intent).then(value=>parseLinkedStatus(value,intent.submissionId)).finally(()=>{this.inFlight=null;});return this.inFlight;
  }
  async readback():Promise<LinkedRequestStatus>{
    const intent=this.intent;if(!intent)throw Error('LINKED_REQUEST_MISSING');
    return parseLinkedStatus(await this.request('/readback','POST',{submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey}),intent.submissionId);
  }
  async readArchived(submissionId:string):Promise<LinkedRequestStatus>{
    const intent=this.history.find(item=>item.submissionId===submissionId);if(!intent)throw Error('LINKED_ARCHIVE_MISSING');
    return parseLinkedStatus(await this.request('/readback','POST',{submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey}),intent.submissionId);
  }
  startNew():Promise<void>{
    if(this.rollover)return this.rollover;
    if(this.inFlight)return Promise.reject(Error('LINKED_REQUEST_BUSY'));
    const intent=this.intent;if(!intent)return Promise.reject(Error('LINKED_REQUEST_MISSING'));
    this.rollover=(async()=>{
      this.unchanged();const status=await this.readback();
      if(status.state!=='REJECTED'&&status.reviewState!=='SEEN')throw Error('LINKED_REQUEST_NOT_RESOLVED');
      // Fresh canonical evidence does not grant permission to overwrite another tab's state.
      this.unchanged();if(this.saved?.submissionId!==intent.submissionId)throw Error('LINKED_STORAGE_CHANGED');
      this.persist(null,[...this.history,intent]);
    })().finally(()=>{this.rollover=null;});return this.rollover;
  }
}
/** Response-order fence only; the server remains the source of every archived status. */
export class LinkedArchiveRead{
  private ticket=0;
  private identity:string|null=null;
  invalidate(){this.ticket++;this.identity=null;}
  async run<T>(id:string,load:(id:string)=>Promise<T>,accept:(id:string,value:T)=>void,reject:(id:string,error:unknown)=>void){
    const ticket=++this.ticket;this.identity=id;
    try{const value=await load(id);if(ticket===this.ticket&&id===this.identity)accept(id,value);}
    catch(error){if(ticket===this.ticket&&id===this.identity)reject(id,error);}
  }
}
