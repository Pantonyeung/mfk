import type {LinkedCatalog,LinkedOption,LinkedProduct} from '../../integrations/v3-linked-test.ts';
import {LINKED_SCOPE} from '../../integrations/v3-linked-test.ts';
import {linkedRequest,subscribeLinked,type LinkedInboxRow,type LinkedRequestStatus} from '../../integrations/v3-linked-client.ts';

export const isLinkedPosEnabled=(value:unknown)=>value==='1';
const invalid=(code:string):never=>{throw new Error(code);};
function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,empty=false):string{
  if(typeof value!=='string'||(!empty&&!value.trim())||value.length>4000)return invalid(code);
  return value;
}
function array(value:unknown,code:string,max=500):unknown[]{
  if(!Array.isArray(value)||value.length>max)return invalid(code);
  return value;
}
function integer(value:unknown,code:string,min=0,max=999999999):number{
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)return invalid(code);
  return value;
}
function instant(value:unknown,code:string):string{const result=text(value,code);if(!Number.isFinite(Date.parse(result)))return invalid(code);return result;}
function unique(values:string[],code:string){if(new Set(values).size!==values.length)invalid(code);}
function noFormalClaims(value:Record<string,unknown>,code:string){
  for(const key of ['formalOrderCreated','paymentConfirmed','formalCheckoutConnected','physicalPrintConnected']){
    if(Object.hasOwn(value,key)&&value[key]!==false)invalid(code);
  }
}

/** Decode at the public test boundary. Unknown/formal states never become POS truth. */
export function decodeLinkedStatus(value:unknown):LinkedRequestStatus{
  const code='LINKED_STATUS_INVALID',raw=object(value,code);noFormalClaims(raw,code);
  const submissionId=text(raw.submissionId,code);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)||!['PENDING_SMT','REJECTED'].includes(String(raw.state))||!['UNSEEN','SEEN','REJECTED'].includes(String(raw.reviewState))||raw.formalOrderCreated!==false||raw.paymentConfirmed!==false)invalid(code);
  const reviewedAt=raw.reviewedAt===null?null:instant(raw.reviewedAt,code);
  if(raw.state==='PENDING_SMT'&&raw.reviewState==='REJECTED')invalid(code);
  if(raw.reviewState==='SEEN'&&reviewedAt===null)invalid(code);
  return{submissionId,state:String(raw.state),reviewState:String(raw.reviewState),reviewedAt,message:text(raw.message,code,true),formalOrderCreated:false,paymentConfirmed:false};
}
export function decodeLinkedInbox(value:unknown):LinkedInboxRow[]{
  const code='LINKED_INBOX_INVALID',raw=object(value,code);noFormalClaims(raw,code);
  if(raw.scope!==LINKED_SCOPE||raw.formalOrders!==false)invalid(code);
  const rows=array(raw.requests,code,200).map(value=>{
    const row=object(value,code),status=decodeLinkedStatus(row),checkout=object(row.checkout,code);
    if(row.idempotencyKey!=='V3:'+status.submissionId)invalid(code);
    const cart=array(row.cart,code,40).map(value=>{
      const line=object(value,code);
      return{productName:text(line.productName,code),quantity:integer(line.quantity,code,1,999),...(line.note===undefined?{}:{note:text(line.note,code,true)}),selections:array(line.selections,code,200).map(value=>({optionName:text(object(value,code).optionName,code)}))};
    });
    if(!cart.length)invalid(code);
    return{...status,cart,checkout:{name:text(checkout.name,code,true),phone:text(checkout.phone,code,true)},receivedAt:instant(row.receivedAt,code),idempotencyKey:String(row.idempotencyKey)};
  });
  unique(rows.map(row=>row.submissionId),code);
  return rows.sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));
}
export function decodeLinkedCatalog(value:unknown):LinkedCatalog{
  const code='LINKED_CATALOG_INVALID',raw=object(value,code);noFormalClaims(raw,code);
  if(raw.scope!==LINKED_SCOPE||raw.mode!=='CONNECTED_TEST'||raw.formalCheckoutConnected!==false||raw.physicalPrintConnected!==false)invalid(code);
  const categories=array(raw.categories,code).map(value=>{const row=object(value,code);return{id:text(row.id,code),name:text(row.name,code)};});
  unique(categories.map(row=>row.id),code);
  const products=array(raw.products,code,5000).map((value):LinkedProduct=>{
    const row=object(value,code),categoryId=text(row.categoryId,code);
    if(!categories.some(category=>category.id===categoryId)||typeof row.available!=='boolean')invalid(code);
    const priceMinor=row.priceMinor===null?null:integer(row.priceMinor,code);
    if(row.available&&priceMinor===null)invalid(code);
    const options=array(row.options,code,200).map((value):LinkedOption=>{
      const option=object(value,code),min=integer(option.min,code),max=integer(option.max,code);
      const choices=array(option.choices,code).map(value=>{const choice=object(value,code);return{id:text(choice.id,code),name:text(choice.name,code),adjustmentMinor:integer(choice.adjustmentMinor,code,-999999999)};});
      const defaults=array(option.defaults,code).map(value=>text(value,code));
      unique(choices.map(choice=>choice.id),code);unique(defaults,code);
      if(min>max||defaults.some(id=>!choices.some(choice=>choice.id===id)))invalid(code);
      return{id:text(option.id,code),name:text(option.name,code),min,max,defaults,choices};
    });
    unique(options.map(option=>option.id),code);
    return{id:text(row.id,code),name:text(row.name,code),description:text(row.description,code,true),categoryId,priceMinor,options,available:row.available as boolean,unavailableReason:text(row.unavailableReason,code,true)};
  });
  unique(products.map(product=>product.id),code);
  return{scope:LINKED_SCOPE,mode:'CONNECTED_TEST',fingerprint:text(raw.fingerprint,code),revision:integer(raw.revision,code),publishedAt:instant(raw.publishedAt,code),categories,products,formalCheckoutConnected:false,physicalPrintConnected:false};
}

export interface LinkedPosSnapshot{
  enabled:boolean;
  catalog:LinkedCatalog|null;
  inbox:LinkedInboxRow[]|null;
  loading:boolean;
  reviewing:readonly string[];
  error:string;
}
export interface LinkedPosDependencies{
  enabled:boolean;
  request?:(path:string,method?:string,body?:unknown,signal?:AbortSignal)=>Promise<unknown>;
  subscribe?:(topic:'catalog'|'request',onChange:()=>void)=>()=>void;
}

/** Ephemeral view state only. Every mount, invalidation and review rereads the same canonical test API. */
export function createLinkedPosController({enabled,request=linkedRequest,subscribe=subscribeLinked}:LinkedPosDependencies){
  let snapshot:LinkedPosSnapshot={enabled,catalog:null,inbox:null,loading:false,reviewing:[],error:''};
  const listeners=new Set<()=>void>();
  const pending=new Map<string,Promise<void>>();
  let generation=0,lifetime=0,stopped=false,started=false,readAbort:AbortController|undefined;
  const writeAborts=new Set<AbortController>();
  let unsubscribe:(()=>void)[]=[];
  const update=(patch:Partial<LinkedPosSnapshot>)=>{if(stopped)return;snapshot={...snapshot,...patch};for(const listener of listeners)listener();};
  // Per-operation watchdog only; it never schedules a business refresh or retries a write.
  const bounded=async<T,>(run:()=>Promise<T>,abort:AbortController):Promise<T>=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    let onAbort:()=>void=()=>undefined;
    const interrupted=new Promise<never>((_resolve,reject)=>{
      onAbort=()=>reject(new Error('LINKED_REQUEST_ABORTED'));
      abort.signal.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>{reject(new Error('LINKED_REQUEST_TIMEOUT'));abort.abort();},15000);
    });
    try{return await Promise.race([run(),interrupted]);}
    finally{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);}
  };
  const refresh=async()=>{
    if(!enabled||stopped)return;
    const ticket=++generation;readAbort?.abort();const abort=new AbortController();readAbort=abort;
    update({loading:true,error:''});
    try{
      const [catalog,inbox]=await bounded(()=>Promise.all([request('/catalog','GET',undefined,abort.signal),request('/requests','GET',undefined,abort.signal)]),abort);
      if(ticket!==generation||stopped)return;
      update({catalog:decodeLinkedCatalog(catalog),inbox:decodeLinkedInbox(inbox),loading:false});
    }catch(error){
      if(ticket!==generation||stopped)return;
      update({catalog:null,inbox:null,loading:false,error:error instanceof Error?error.message:'LINKED_READ_FAILED'});
    }
  };
  const review=(submissionId:string,reviewState:'SEEN'|'REJECTED'):Promise<void>=>{
    if(!enabled||stopped)return Promise.resolve();
    if(!['SEEN','REJECTED'].includes(reviewState)){update({error:'LINKED_FORMAL_ACK_NOT_ALLOWED'});return Promise.resolve();}
    if(pending.has(submissionId))return pending.get(submissionId)!;
    const row=snapshot.inbox?.find(row=>row.submissionId===submissionId);
    if(!row||row.state==='REJECTED'||(reviewState==='SEEN'&&row.reviewState==='SEEN'))return Promise.resolve();
    const abort=new AbortController(),reviewLifetime=lifetime;writeAborts.add(abort);
    update({reviewing:[...snapshot.reviewing,submissionId],error:''});
    const result=(async()=>{
      let errorMessage='';
      try{
        const response=decodeLinkedStatus(await bounded(()=>request('/review','POST',{submissionId,idempotencyKey:row.idempotencyKey,reviewState},abort.signal),abort));
        if(response.submissionId!==submissionId)invalid('LINKED_REVIEW_IDENTITY_MISMATCH');
      }catch(error){errorMessage=error instanceof Error?error.message:'LINKED_REVIEW_FAILED';}
      // A timeout may have persisted a review. Read canonical state before offering a retry.
      if(!stopped&&reviewLifetime===lifetime){await refresh();if(errorMessage&&reviewLifetime===lifetime)update({error:errorMessage});}
    })().finally(()=>{if(pending.get(submissionId)===result)pending.delete(submissionId);writeAborts.delete(abort);if(reviewLifetime===lifetime)update({reviewing:snapshot.reviewing.filter(id=>id!==submissionId)});});
    pending.set(submissionId,result);
    return result;
  };
  return{
    getSnapshot:()=>snapshot,
    subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},
    refresh,review,
    start(){if(started||!enabled)return;started=true;stopped=false;update({reviewing:[]});unsubscribe=[subscribe('catalog',()=>{void refresh();}),subscribe('request',()=>{void refresh();})];void refresh();},
    stop(){stopped=true;started=false;generation++;lifetime++;readAbort?.abort();for(const abort of writeAborts)abort.abort();writeAborts.clear();pending.clear();for(const stop of unsubscribe)stop();unsubscribe=[];},
  };
}
