import {verifyConfiguredStaffPin} from '../contracts/staff-auth-v1.ts';
const ADMIN_ACTIVE='https://admin.morefunos.com/api/admin-sync/active';
const ADMIN_ACKS='https://admin.morefunos.com/api/admin-sync/acks';
const SMT_ORIGIN='https://appassets.androidplatform.net';

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function minor(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}
function text(value:unknown,max=240){
  const out=String(value??'').trim();
  return out&&out.length<=max?out:'';
}
function stable(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function cors(request:Request){
  return request.headers.get('origin')===SMT_ORIGIN?{
    'access-control-allow-origin':SMT_ORIGIN,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    'vary':'origin',
  }:{};
}
function json(value:unknown,status=200,extra:Record<string,string>={}){
  return new Response(JSON.stringify(value),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra},
  });
}
async function fetchActive(storeId:string){
  const upstream=new URL(ADMIN_ACTIVE);
  upstream.searchParams.set('storeId',storeId);
  const response=await fetch(upstream,{headers:{accept:'application/json','cache-control':'no-cache'}});
  if(!response.ok)throw new Error('SMM_CONFIG_NOT_PUBLISHED');
  return await response.json() as Record<string,unknown>;
}
function staffRows(active:Record<string,unknown>){
  const snapshot=record(active.snapshot);
  return list(snapshot.staff).flatMap(raw=>{
    const row=record(raw);
    const staffId=text(row.id,120);
    const displayName=text(row.name,160);
    const role=text(row.role,40)||'STAFF';
    const pin=String(row.pin??'').replace(/\D/g,'');
    const activeRow=row.active!==false;
    if(!staffId||!displayName||!activeRow||role==='VIEWER'||pin.length<4||pin.length>8)return[];
    return[{staffId,displayName,role,pin}];
  });
}
async function verifyStaff(request:Request,storeId:string){
  const staffId=text(request.headers.get('x-mfk-staff-id'),120);
  const pin=String(request.headers.get('x-mfk-staff-pin')??'').replace(/\D/g,'');
  if(!staffId||pin.length<4||pin.length>8)return null;
  let active;
  try{active=await fetchActive(storeId);}catch{return null;}
  const staff=staffRows(active).find(row=>row.staffId===staffId);
  if(!staff||!verifyConfiguredStaffPin(pin,staff.pin))return null;
  return Object.freeze({staffId:staff.staffId,displayName:staff.displayName,role:staff.role});
}
async function authorizedSmtDevice(deviceId:string,storeId:string){
  if(!deviceId)return false;
  const url=new URL(ADMIN_ACKS);
  url.searchParams.set('storeId',storeId);
  try{
    const response=await fetch(url,{headers:{accept:'application/json','cache-control':'no-cache'}});
    if(!response.ok)return false;
    const body=record(await response.json());
    return list(body.acks).some(raw=>text(record(raw).deviceId,180)===deviceId);
  }catch{return false;}
}
function validateOrderRequest(value:unknown){
  const row=record(value);
  if(row.protocolVersion!==1||row.type!=='smm.lan.order.submit.v1')throw new Error('SMM_ORDER_PROTOCOL_INVALID');
  for(const field of ['requestId','submissionId','idempotencyKey','storeId','menuRevision']){
    if(!text(row[field],240))throw new Error('SMM_ORDER_'+field.toUpperCase()+'_INVALID');
  }
  if(row.storeId!=='MF01')throw new Error('SMM_ORDER_STORE_INVALID');
  if(!Array.isArray(row.lines)||row.lines.length<1||row.lines.length>100)throw new Error('SMM_ORDER_LINES_INVALID');
  if(!Number.isSafeInteger(Number(row.publishedTotalMinor))||Number(row.publishedTotalMinor)<0)throw new Error('SMM_ORDER_TOTAL_INVALID');
  if(!['TAKEAWAY','DINE_IN'].includes(String(row.serviceMode)))throw new Error('SMM_ORDER_SERVICE_MODE_INVALID');
  if(!['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(String(row.tender)))throw new Error('SMM_ORDER_TENDER_INVALID');
  return row;
}
function mapPublishedSnapshot(raw:unknown){
  const active=record(raw);
  const snapshot=record(active.snapshot);
  const catalog=record(snapshot.catalog);
  const optionCenter=record(snapshot.optionCenter);
  const availability=record(snapshot.availability);
  const productMedia=record(snapshot.productMedia);
  const storeSettings=record(snapshot.storeSettings);
  const now=new Date().toISOString();

  const categories=list(catalog.categories).map((rawCategory,index)=>{
    const item=record(rawCategory);
    return{
      categoryId:String(item.id??''),
      name:String(item.name??''),
      sortOrder:Number(item.position??index*10)||0,
      active:item.active!==false,
    };
  }).filter(item=>item.categoryId&&item.name&&item.active)
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.categoryId.localeCompare(b.categoryId));
  const categoryIds=new Set(categories.map(item=>item.categoryId));

  const optionSets=new Map(
    list(optionCenter.sets).map(rawSet=>{
      const set=record(rawSet);
      return[String(set.id??''),set] as const;
    }).filter(([id])=>Boolean(id))
  );
  const linksByProduct=new Map<string,Record<string,unknown>[]>();
  for(const rawLink of list(optionCenter.productLinks)){
    const link=record(rawLink);
    const productId=String(link.productId??'');
    if(!productId)continue;
    const rows=linksByProduct.get(productId)??[];
    rows.push(link);
    linksByProduct.set(productId,rows);
  }

  const products=list(catalog.products).map(rawProduct=>{
    const item=record(rawProduct);
    const productId=String(item.id??'');
    const categoryId=String(item.categoryId??'');
    const priceText=String(item.basePrice??'').trim();
    const priceReady=priceText!==''&&Number.isFinite(Number(priceText));
    const baseMinor=minor(priceText);
    const takeawayMinor=baseMinor+minor(item.takeawayAdjustment)+(item.takeawaySurchargeEnabled===true?100:0);
    const sellability=record(availability[productId]);
    const media=record(productMedia[productId]);
    const imageRef=String(media.publicUrl??media.canonicalImageRef??item.imageRef??'').trim();

    const optionGroups=(linksByProduct.get(productId)??[]).flatMap(link=>{
      const set=optionSets.get(String(link.setId??''));
      if(!set||set.active===false)return[];
      const options=list(set.options).map(rawOption=>{
        const option=record(rawOption);
        return{
          optionId:String(option.id??option.code??''),
          name:String(option.name??option.id??option.code??''),
          available:option.active!==false,
          publishedAdjustmentMinor:minor(option.priceAdjustment),
          position:Number(option.position??0)||0,
        };
      }).filter(option=>option.optionId&&option.name&&option.available)
        .sort((a,b)=>a.position-b.position||a.optionId.localeCompare(b.optionId))
        .map(({position,...option})=>option);
      return[{
        optionGroupId:String(set.id??''),
        name:String(set.name??set.id??'選項'),
        required:set.required===true,
        minSelections:Math.max(0,Number(set.min)||0),
        maxSelections:Math.max(1,Number(set.max)||1),
        options,
      }];
    });

    return{
      productId,
      categoryId,
      name:String(item.name??productId),
      description:String(item.description??''),
      ...(imageRef?{imageRef}:{}),
      available:item.active!==false&&sellability.sellable!==false&&priceReady,
      ...(priceReady?{
        publishedTakeawayUnitPriceMinor:takeawayMinor,
        publishedDineInUnitPriceMinor:baseMinor,
      }:{}),
      optionGroups,
      position:Number(item.legacySourcePosition??item.position??0)||0,
    };
  }).filter(item=>item.productId&&categoryIds.has(item.categoryId)&&item.available)
    .sort((a,b)=>a.position-b.position||a.productId.localeCompare(b.productId))
    .map(({position,...item})=>item);

  return{
    connectionPath:'INTERNET',
    menu:{
      revision:String(active.revision??'0'),
      observedAt:String(active.publishedAt??now),
      categories:categories.map(({active,...item})=>item),
      products,
    },
    orders:[],
    work:[],
    channels:[{channel:'INTERNET',state:'CONNECTED',detail:'Admin published menu/config projection',observedAt:now}],
    dineSessions:[],
    printHealth:[],
    refundRequests:[],
    staff:{actorId:'SMM-INTERNET',displayName:'店員模式',roleLabel:'SMM',storeId:String(active.storeId??'MF01'),deviceLabel:'Internet'},
    businessDay:undefined,
    observedAt:now,
    storeName:String(storeSettings.storeName??'磨飯'),
  };
}

export class SmmIntentStore{
  state:any;
  env:any;
  constructor(state:any,env:any){this.state=state;this.env=env;}

  async fetch(request:Request){
    const url=new URL(request.url);
    if(url.pathname==='/orders/submit'&&request.method==='POST'){
      const envelope=record(await request.json());
      const orderRequest=validateOrderRequest(envelope.request);
      const staff=record(envelope.staff);
      const submissionId=String(orderRequest.submissionId);
      const key='order:'+submissionId;
      const existing=await this.state.storage.get(key) as any;
      const fingerprint=stable(orderRequest);
      if(existing){
        if(existing.idempotencyKey!==orderRequest.idempotencyKey||existing.requestFingerprint!==fingerprint){
          return json({code:'SMM_SUBMISSION_ID_CONFLICT'},409);
        }
        return json({state:existing.state,submissionId},existing.state==='PENDING_SMT'?202:200);
      }
      const row=Object.freeze({
        request:orderRequest,
        staff:Object.freeze({
          staffId:text(staff.staffId,120),
          displayName:text(staff.displayName,160),
          role:text(staff.role,40),
        }),
        idempotencyKey:String(orderRequest.idempotencyKey),
        requestFingerprint:fingerprint,
        state:'PENDING_SMT',
        receivedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,row);
      return json({state:'PENDING',submissionId},202);
    }

    if(url.pathname==='/orders/readback'&&request.method==='GET'){
      const submissionId=text(url.searchParams.get('submissionId'),180);
      if(!submissionId)return json({code:'SMM_SUBMISSION_ID_REQUIRED'},400);
      const row=await this.state.storage.get('order:'+submissionId) as any;
      if(!row)return json({state:'UNKNOWN',submissionId},404);
      return json({state:row.state,submissionId,result:row.result??null,staff:row.staff??null});
    }

    if(url.pathname==='/smt/orders/pending'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'order:'});
      const orders=[...rows.values()]
        .filter((row:any)=>row?.state==='PENDING_SMT')
        .sort((a:any,b:any)=>String(a.receivedAt||'').localeCompare(String(b.receivedAt||'')))
        .slice(0,50)
        .map((row:any)=>({request:row.request,staff:row.staff}));
      return json({orders});
    }

    if(url.pathname==='/smt/orders/ack'&&request.method==='POST'){
      const body=record(await request.json());
      const submissionId=text(body.submissionId,180);
      const idempotencyKey=text(body.idempotencyKey,240);
      const result=record(body.result);
      if(!submissionId||!idempotencyKey)return json({code:'SMM_ACK_IDENTITY_REQUIRED'},400);
      const key='order:'+submissionId;
      const current=await this.state.storage.get(key) as any;
      if(!current)return json({code:'SMM_ORDER_NOT_FOUND'},404);
      if(current.idempotencyKey!==idempotencyKey)return json({code:'SMM_ACK_IDEMPOTENCY_MISMATCH'},409);
      if(current.state!=='PENDING_SMT')return json({state:'IDEMPOTENT',order:current});
      const disposition=result.disposition;
      if(disposition!=='ACCEPTED'&&disposition!=='REJECTED')return json({code:'SMM_ACK_RESULT_INVALID'},400);
      const next=Object.freeze({
        ...current,
        state:disposition==='ACCEPTED'?'CONFIRMED':'REJECTED',
        result:Object.freeze({...result}),
        resolvedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,next);
      return json({state:'ACKED',submissionId});
    }

    return json({code:'NOT_FOUND'},404);
  }
}

export default{
  async fetch(request:Request,env:{ASSETS:{fetch(request:Request):Promise<Response>};SMM_INTENT_STORE:any}){
    const url=new URL(request.url);
    const storeId=(url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';

    if(url.pathname==='/api/smm/snapshot'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      let active;
      try{active=await fetchActive(storeId);}catch{return json({code:'SMM_CONFIG_NOT_PUBLISHED'},503);}
      return json(mapPublishedSnapshot(active));
    }

    if(url.pathname==='/api/smm/staff'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      let active;
      try{active=await fetchActive(storeId);}catch{return json({code:'SMM_CONFIG_NOT_PUBLISHED'},503);}
      return json({staff:staffRows(active).map(({pin,...item})=>item)});
    }

    if(url.pathname==='/api/smm/staff/verify'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const body=record(await request.json().catch(()=>({})));
      const synthetic=new Request(request.url,{headers:{
        'x-mfk-staff-id':text(body.staffId,120),
        'x-mfk-staff-pin':String(body.pin??''),
      }});
      const staff=await verifyStaff(synthetic,storeId);
      return staff?json({ok:true,...staff}):json({code:'SMM_STAFF_UNAUTHORIZED',message:'員工編號或 PIN 不正確'},401);
    }

    if(url.pathname==='/api/smm/orders/submit'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await verifyStaff(request,storeId);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先完成員工登入'},401);
      let orderRequest;
      try{orderRequest=validateOrderRequest(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_ORDER_INVALID'},400);}
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      return stub.fetch(new Request('https://internal/orders/submit',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request:orderRequest,staff}),
      }));
    }

    if(url.pathname==='/api/smm/orders/readback'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await verifyStaff(request,storeId);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先完成員工登入'},401);
      const submissionId=text(url.searchParams.get('submissionId'),180);
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      return stub.fetch(new Request('https://internal/orders/readback?submissionId='+encodeURIComponent(submissionId),{method:'GET'}));
    }

    if(url.pathname.startsWith('/api/smm/smt/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const deviceId=text(url.searchParams.get('deviceId'),180);
      if(!await authorizedSmtDevice(deviceId,storeId))return json({code:'SMM_SMT_UNAUTHORIZED'},401,cors(request));
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      if(url.pathname==='/api/smm/smt/orders/pending'&&request.method==='GET'){
        const response=await stub.fetch(new Request('https://internal/smt/orders/pending',{method:'GET'}));
        return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...cors(request)}});
      }
      if(url.pathname==='/api/smm/smt/orders/ack'&&request.method==='POST'){
        const body=await request.text();
        const response=await stub.fetch(new Request('https://internal/smt/orders/ack',{method:'POST',headers:{'content-type':'application/json'},body}));
        return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...cors(request)}});
      }
      return json({code:'NOT_FOUND'},404,cors(request));
    }

    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-smm-web',internetProjection:'admin-published-config',internetStaffOrders:'durable-intent-only'});
    return env.ASSETS.fetch(request);
  },
};
