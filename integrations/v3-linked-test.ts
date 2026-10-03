import {readFormalOptionCenter} from '../v3admin/src/formal-option-center.ts';
import {validateMfkCustomerOrderIntent} from '../contracts/customer-cloud-v1.ts';

export const LINKED_SCOPE='MFP_V3_LINKED_TEST_MF01_20261003';
export const LINKED_HEADER='x-mfp-linked-scope';
export const BUSINESS_SECTIONS=['catalog','optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile','storeSettings','businessDay','capacity','posTenders','channelPolicy','channelMapping','availability'] as const;
export interface Fetcher{fetch(request:Request):Promise<Response>}
export interface Namespace{idFromName(name:string):unknown;get(id:unknown):Fetcher}
export interface LinkedEnv{MFP_V3_LINKED_TEST_ENABLED?:string;ADMIN_SYNC?:Namespace;CUSTOMER_RUNTIME?:Namespace}
export interface LinkedChoice{id:string;name:string;adjustmentMinor:number}
export interface LinkedOption{id:string;name:string;min:number;max:number;defaults:string[];choices:LinkedChoice[]}
export interface LinkedProduct{id:string;name:string;description:string;categoryId:string;priceMinor:number|null;options:LinkedOption[];available:boolean;unavailableReason:string}
export interface LinkedCatalog{scope:typeof LINKED_SCOPE;mode:'CONNECTED_TEST';fingerprint:string;revision:number;publishedAt:string;categories:{id:string;name:string}[];products:LinkedProduct[];formalCheckoutConnected:false;physicalPrintConnected:false}
export function linkedJson(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-mfp-data-scope':LINKED_SCOPE}});}
export function record(v:unknown):Record<string,any>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};}
function sensitiveKey(key:string){return /^(?:staff|employee|customer)(?:.*(?:name|email|phone|address|record|profile|auth|contact).*)$/i.test(key.replace(/[^a-z0-9]/gi,''))||/password|passwd|passphrase|secret|credential|session|token|privatekey|apikey|authorization|cookie|pinverifier|pinhash|pinsalt|staffauth|customerphone|customeremail/i.test(key.replace(/[^a-z0-9]/gi,''))||/^(pin|auth|oauth|login|staff|employees|customers|orders|payments|transactions)$/i.test(key);}
function safeJson(v:unknown):unknown{
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'){
    if(/\bBearer\s+\S+|-----BEGIN .*PRIVATE KEY-----|[?&](token|access_token|api_key|secret|password)=|[a-z][a-z0-9+.-]*:\/\/[^/\s]*@/i.test(v))throw new Error('LINKED_PRIVATE_VALUE_BLOCKED');
    return v;
  }
  if(Array.isArray(v))return v.map(safeJson);
  if(v&&typeof v==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(v)))return Object.fromEntries(Object.entries(v).map(([k,x])=>{if(sensitiveKey(k)||['__proto__','constructor','prototype'].includes(k))throw new Error('LINKED_PRIVATE_FIELD_BLOCKED');return[k,safeJson(x)];}));
  throw new Error('LINKED_CONFIG_JSON_INVALID');
}
/** Project business configuration only; never copy staff, customer history, or credentials. */
export function businessSnapshot(value:unknown,strict=false):Record<string,any>{
  const source=record(value);if(strict&&Object.keys(source).some(k=>!(BUSINESS_SECTIONS as readonly string[]).includes(k)))throw new Error('LINKED_CONFIG_SECTION_BLOCKED');
  const catalog=record(source.catalog);if(!Array.isArray(catalog.products)||!Array.isArray(catalog.categories))throw new Error('LINKED_SOURCE_CATALOG_MISSING');
  return Object.fromEntries(BUSINESS_SECTIONS.filter(k=>Object.hasOwn(source,k)).map(k=>[k,safeJson(source[k])]));
}
export function exactMinor(value:unknown,signed=false):number|null{
  if(typeof value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(signed&&value.startsWith('-')?value.slice(1):value))return null;
  const neg=value.startsWith('-');if(neg&&!signed)return null;
  const [whole,fraction='']= (neg?value.slice(1):value).split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(amount)&&amount<=999999999?(neg?-amount:amount):null;
}
export function catalogProjection(envelope:any):LinkedCatalog{
  const snapshot=businessSnapshot(envelope.snapshot,true),catalog=record(snapshot.catalog);
  if(snapshot.optionCenter&&(!Array.isArray(snapshot.optionCenter.sets)||!Array.isArray(snapshot.optionCenter.productLinks)))throw new Error('LINKED_OPTION_CENTER_INVALID');
  const options=readFormalOptionCenter(snapshot);const sets=new Map(options.sets.map(s=>[s.id,s]));
  const categories=catalog.categories.filter((c:any)=>c.active!==false).map((c:any)=>({id:String(c.id),name:String(c.name)}));
  const categoryIds=new Set(categories.map((c:any)=>c.id));
  const products=catalog.products.filter((p:any)=>p.active!==false&&categoryIds.has(p.categoryId)).map((p:any):LinkedProduct=>{
    let reason='';const priceMinor=exactMinor(p.basePrice);if(priceMinor===null)reason='已發布價錢格式需要後台修正';
    const projected:LinkedOption[]=[];
    for(const link of options.productLinks.filter(l=>l.productId===p.id)){
      const s=sets.get(link.setId);if(!s||!s.active){reason='選項組未可用';continue;}
      if(s.allowQuantities){reason='選項數量模式尚未接通';continue;}
      const choices=s.options.filter(c=>c.active).map(c=>{const n=exactMinor(c.priceAdjustment,true);if(n===null)reason='選項價錢格式需要後台修正';return{id:c.id,name:c.name,adjustmentMinor:n??0};});
      if(s.min>s.max||s.min>choices.length||link.defaultOptionIds.some(id=>!choices.some(c=>c.id===id)))reason='選項設定需要後台修正';
      projected.push({id:s.id,name:s.name,min:s.min,max:s.max,defaults:link.defaultOptionIds,choices});
    }
    return{id:String(p.id),name:String(p.name),description:String(p.description??''),categoryId:String(p.categoryId),priceMinor,options:projected,available:!reason,unavailableReason:reason};
  });
  return{scope:LINKED_SCOPE,mode:'CONNECTED_TEST',fingerprint:envelope.fingerprint,revision:envelope.revision,publishedAt:envelope.publishedAt,categories,products,formalCheckoutConnected:false,physicalPrintConnected:false};
}
export function validateLinkedIntent(raw:unknown,catalog:LinkedCatalog){
  const intent=validateMfkCustomerOrderIntent(raw);
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(intent.submissionId)||intent.idempotencyKey!=='V3:'+intent.submissionId)throw new Error('LINKED_SUBMISSION_ID_INVALID');
  if(intent.menuRevision!==catalog.fingerprint)throw new Error('LINKED_MENU_CHANGED');
  if(intent.checkout.paymentMethod!=='PAY_AT_STORE'||intent.checkout.paymentEvidenceRef||intent.checkout.paymentChannelId)throw new Error('LINKED_ELECTRONIC_PAYMENT_UNAVAILABLE');
  if(intent.cart.length>40)throw new Error('LINKED_CART_TOO_LARGE');
  for(const line of intent.cart){
    const p=catalog.products.find(p=>p.id===line.productId);if(!p||!p.available||p.name!==line.productName)throw new Error('LINKED_PRODUCT_UNAVAILABLE');
    if(line.combo||line.selectedVariationId)throw new Error('LINKED_COMBO_VARIATION_NOT_CONNECTED');
    if(line.publishedUnitPriceMinor!==p.priceMinor)throw new Error('LINKED_PUBLISHED_PRICE_MISMATCH');
    const identities=new Set<string>();
    for(const choice of line.selections){const key=choice.optionGroupId+':'+choice.optionId;if(identities.has(key))throw new Error('LINKED_DUPLICATE_OPTION');identities.add(key);const group=p.options.find(g=>g.id===choice.optionGroupId);if(!group?.choices.some(c=>c.id===choice.optionId&&c.name===choice.optionName))throw new Error('LINKED_OPTION_INVALID');}
    for(const group of p.options){const n=line.selections.filter(s=>s.optionGroupId===group.id).length;if(n<group.min||n>group.max)throw new Error('LINKED_OPTION_CARDINALITY_INVALID');}
  }
  return intent;
}
export function stub(env:LinkedEnv,kind:'ADMIN_SYNC'|'CUSTOMER_RUNTIME',name=LINKED_SCOPE){const ns=env[kind];if(!ns)throw new Error('LINKED_BINDING_UNAVAILABLE');return ns.get(ns.idFromName(name));}
export function internal(path:string,method='GET',body?:unknown,headers?:HeadersInit){const h=new Headers(headers);h.set(LINKED_HEADER,LINKED_SCOPE);h.set('content-type','application/json');return new Request('https://internal'+path,{method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})});}
export async function ensureLinked(env:LinkedEnv){
  const target=stub(env,'ADMIN_SYNC');const ready=await target.fetch(internal('/linked-test/ready'));if(ready.status===200)return target;
  if(ready.status!==404)throw new Error('LINKED_SCOPE_NOT_READY');
  const source=await stub(env,'ADMIN_SYNC','MF01').fetch(internal('/linked-test/source'));if(!source.ok)throw new Error('LINKED_SOURCE_CONFIGURATION_UNAVAILABLE');
  const result=await target.fetch(internal('/linked-test/bootstrap','POST',await source.json()));if(!result.ok)throw new Error('LINKED_CONFIGURATION_INITIALIZATION_FAILED');return target;
}
export async function bodyJson(request:Request){
  if(Number(request.headers.get('content-length')||0)>512*1024)throw new Error('LINKED_BODY_TOO_LARGE');
  if(!request.body)return {};
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw new Error('LINKED_BODY_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes)||'{}');
}
export async function linkedGateway(request:Request,env:LinkedEnv,surface:'admin'|'customer'|'pos'):Promise<Response|null>{
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/v3-test/'))return null;
  if(env.MFP_V3_LINKED_TEST_ENABLED!=='1')return linkedJson({code:'LINKED_MODE_DISABLED'},503);
  const origin=request.headers.get('origin');if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return linkedJson({code:'LINKED_ORIGIN_FORBIDDEN'},403);
  const path=url.pathname.slice('/api/v3-test'.length);
  const publicReads=['/catalog','/catalog-events','/request-events','/health'];
  const adminRoutes=['/api/projection/orders','/api/projection/reports','/api/admin-sync/refunds','/api/admin-sync/acks','/api/admin-browser/active','/api/admin-browser/draft','/api/admin-browser/draft/products','/api/admin-browser/draft/publish','/api/admin-browser/versions'];
  const allowed=publicReads.includes(path)||(surface==='admin'&&(path==='/session'||path==='/api/health'||adminRoutes.includes(path)))||(surface==='customer'&&['/submit','/readback'].includes(path))||(['admin','pos'].includes(surface)&&['/requests','/review'].includes(path));
  if(!allowed)return linkedJson({code:'LINKED_ROUTE_NOT_ALLOWED'},403);
  try{
    if(surface==='admin'&&path==='/api/health'){if(request.method!=='GET')return linkedJson({code:'METHOD_NOT_ALLOWED'},405);return stub(env,'ADMIN_SYNC').fetch(internal('/linked-test/preservation-proof'));}
    if(path==='/health'||path==='/api/health')return linkedJson({ok:true,service:'mfk-admin',scope:LINKED_SCOPE,configurationWritesEnabled:surface==='admin',mode:'CONNECTED_TEST',catalogConnected:true,requestInboxConnected:true,formalCheckoutConnected:false,physicalPrintConnected:false});
    const admin=await ensureLinked(env);
    if(path==='/catalog'&&request.method==='GET')return admin.fetch(internal('/linked-test/catalog'));
    if(path==='/catalog-events'&&request.method==='GET')return admin.fetch(internal('/linked-test/events','GET',undefined,request.headers));
    if(path==='/request-events'&&request.method==='GET')return stub(env,'CUSTOMER_RUNTIME').fetch(internal('/linked-test/events','GET',undefined,request.headers));
    if(path==='/session'&&request.method==='POST')return admin.fetch(internal('/linked-test/session','POST'));
    if(surface==='admin'&&adminRoutes.includes(path)){
      const method=request.method;if(!['GET','PUT','POST','DELETE'].includes(method))return linkedJson({code:'METHOD_NOT_ALLOWED'},405);
      const route=path.startsWith('/api/admin-sync/')?path.slice('/api/admin-sync'.length):path.slice('/api'.length);
      const payload=method==='GET'?undefined:await bodyJson(request);if(payload?.snapshot)businessSnapshot(payload.snapshot,true);
      return admin.fetch(internal('/linked-test/dispatch','POST',{route,method,payload,sessionToken:request.headers.get('x-mfk-admin-session')||''}));
    }
    if(path==='/submit'&&request.method==='POST'){
      const raw=await bodyJson(request);const customer=stub(env,'CUSTOMER_RUNTIME');
      // Known identity is read first: an exact retry survives a later menu publication.
      const known=await customer.fetch(internal('/linked-test/retry','POST',raw));if(known.status!==404)return known;
      const catalog=await(await admin.fetch(internal('/linked-test/catalog'))).json();const intent=validateLinkedIntent(raw,catalog);
      return customer.fetch(internal('/linked-test/submit','POST',intent));
    }
    if(path==='/readback'&&request.method==='POST')return stub(env,'CUSTOMER_RUNTIME').fetch(internal('/linked-test/readback','POST',await bodyJson(request)));
    if(path==='/requests'&&request.method==='GET')return stub(env,'CUSTOMER_RUNTIME').fetch(internal('/linked-test/list'));
    if(path==='/review'&&request.method==='POST')return stub(env,'CUSTOMER_RUNTIME').fetch(internal('/linked-test/review','POST',await bodyJson(request)));
    return linkedJson({code:'METHOD_NOT_ALLOWED'},405);
  }catch(error){return linkedJson({code:error instanceof Error?error.message:'LINKED_REQUEST_FAILED'},error instanceof Error&&/UNAVAILABLE|INITIALIZATION_FAILED|NOT_READY/.test(error.message)?503:400);}
}
