import {validateRuntimeStaffAuthSnapshot,type RuntimeStaffIdentity,type StaffPinVerifier} from '../contracts/staff-auth-v1.ts';
import {validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {projectSyncedOrderingCatalog} from '../v2local/src/runtime/admin-config-projection.ts';
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
function staffRows(active:Record<string,unknown>):readonly RuntimeStaffIdentity[]{
  const snapshot=record(active.snapshot);
  try{
    return validateRuntimeStaffAuthSnapshot(snapshot.staffAuth).staff
      .filter(row=>row.active&&row.role!=='VIEWER'&&Boolean(row.pinVerifier));
  }catch{
    return Object.freeze([]);
  }
}
function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new Error('SMM_AUTH_HEX_INVALID');
  const output=new Uint8Array(value.length/2);
  for(let i=0;i<output.length;i++)output[i]=Number.parseInt(value.slice(i*2,i*2+2),16);
  return output;
}
function bytesToHex(bytes:Uint8Array){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function sameHex(left:string,right:string){
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
async function hmacHex(keyHex:string,message:string){
  const key=await crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign'],
  );
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}
async function currentStaffVerifier(staffId:string,storeId:string):Promise<{staff:RuntimeStaffIdentity;verifier:StaffPinVerifier}|null>{
  if(!staffId)return null;
  let active:Record<string,unknown>;
  try{active=await fetchActive(storeId);}catch{return null;}
  const staff=staffRows(active).find(row=>row.staffId===staffId);
  if(!staff?.pinVerifier)return null;
  return Object.freeze({staff,verifier:staff.pinVerifier});
}

async function currentStaffIdentity(staffId:string,storeId:string){
  if(!staffId)return null;
  let active:Record<string,unknown>;
  try{active=await fetchActive(storeId);}catch{return null;}
  const staff=staffRows(active).find(row=>row.staffId===staffId);
  if(!staff)return null;
  return Object.freeze({
    staffId:staff.staffId,
    displayName:staff.name,
    role:staff.role,
    scope:staff.scope,
    permissions:Object.freeze([...staff.permissions]),
  });
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
  const envelope=validateMfkAdminConfigEnvelope(raw);
  const takeaway=projectSyncedOrderingCatalog('takeaway',envelope);
  const dineIn=projectSyncedOrderingCatalog('dine-in',envelope);
  const dineById=new Map(dineIn.products.map(row=>[row.id,row] as const));
  const now=new Date().toISOString();

  return{
    connectionPath:'INTERNET',
    menu:{
      revision:String(envelope.revision),
      observedAt:String(envelope.publishedAt||now),
      categories:takeaway.categories.map(row=>({
        categoryId:row.id,
        name:row.label,
        sortOrder:row.position,
      })),
      products:takeaway.products.map(row=>{
        const dine=dineById.get(row.id);
        return{
          productId:row.id,
          categoryId:row.categoryId,
          name:row.name,
          description:'',
          ...(row.imageUrl?{imageRef:row.imageUrl}:{}),
          available:row.sellable&&row.priceReady,
          ...(row.priceReady?{
            publishedTakeawayUnitPriceMinor:row.priceMinor,
            publishedDineInUnitPriceMinor:dine?.priceMinor??row.priceMinor,
          }:{}),
          optionGroups:row.optionSets.map(set=>({
            optionGroupId:set.id,
            name:set.name,
            required:set.required,
            minSelections:set.min,
            maxSelections:set.max,
            options:set.options.map(option=>({
              optionId:option.id,
              name:option.name,
              available:option.active,
              publishedAdjustmentMinor:option.priceAdjustmentMinor,
            })),
          })),
        };
      }),
    },
    orders:[],
    work:[],
    channels:[{channel:'INTERNET',state:'CONNECTED',detail:'Admin published menu/config projection',observedAt:now}],
    dineSessions:[],
    printHealth:[],
    refundRequests:[],
    staff:{actorId:'SMM-INTERNET',displayName:'店員模式',roleLabel:'SMM',storeId:envelope.storeId,deviceLabel:'Internet'},
    businessDay:undefined,
    observedAt:now,
  };
}

export class SmmIntentStore{
  state:any;
  env:any;
  constructor(state:any,env:any){this.state=state;this.env=env;}

  async fetch(request:Request){
    const url=new URL(request.url);

    if(url.pathname==='/auth/challenge/create'&&request.method==='POST'){
      const body=record(await request.json());
      const staffId=text(body.staffId,120);
      if(!staffId)return json({code:'SMM_AUTH_STAFF_ID_REQUIRED'},400);
      const challengeId=crypto.randomUUID();
      const nonce=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
      const expiresAt=new Date(Date.now()+2*60*1000).toISOString();
      await this.state.storage.put('challenge:'+challengeId,Object.freeze({challengeId,staffId,nonce,expiresAt}));
      return json({challengeId,staffId,nonce,expiresAt},201);
    }

    if(url.pathname==='/auth/challenge/consume'&&request.method==='POST'){
      const body=record(await request.json());
      const challengeId=text(body.challengeId,120);
      const staffId=text(body.staffId,120);
      if(!challengeId||!staffId)return json({code:'SMM_AUTH_CHALLENGE_ID_REQUIRED'},400);
      const key='challenge:'+challengeId;
      const row=await this.state.storage.get(key) as any;
      if(!row)return json({code:'SMM_AUTH_CHALLENGE_NOT_FOUND'},404);
      await this.state.storage.delete(key);
      if(String(row.staffId)!==staffId)return json({code:'SMM_AUTH_CHALLENGE_STAFF_MISMATCH'},409);
      if(!Number.isFinite(Date.parse(String(row.expiresAt||'')))||Date.parse(String(row.expiresAt))<=Date.now()){
        return json({code:'SMM_AUTH_CHALLENGE_EXPIRED'},410);
      }
      return json({challengeId,staffId,nonce:String(row.nonce||''),expiresAt:String(row.expiresAt||'')});
    }

    if(url.pathname==='/sessions/create'&&request.method==='POST'){
      const body=record(await request.json());
      const staff=record(body.staff);
      const staffId=text(staff.staffId,120);
      const displayName=text(staff.displayName,160);
      const role=text(staff.role,40);
      if(!staffId||!displayName)return json({code:'SMM_SESSION_STAFF_INVALID'},400);
      const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
      const now=new Date().toISOString();
      const expiresAt=new Date(Date.now()+10*365*24*60*60*1000).toISOString();
      await this.state.storage.put('session:'+token,Object.freeze({
        token,
        staff:Object.freeze({staffId,displayName,role,scope:text(staff.scope,40),permissions:list(staff.permissions).map(String)}),
        createdAt:now,
        lastSeenAt:now,
        expiresAt,
      }));
      return json({sessionToken:token,staff:{staffId,displayName,role},expiresAt},201);
    }

    if(url.pathname==='/sessions/read'&&request.method==='GET'){
      const token=text(request.headers.get('x-mfk-smm-session'),256);
      if(!token)return json({code:'SMM_SESSION_REQUIRED'},401);
      const row=await this.state.storage.get('session:'+token) as any;
      if(!row)return json({code:'SMM_SESSION_NOT_FOUND'},401);
      if(!Number.isFinite(Date.parse(String(row.expiresAt||'')))||Date.parse(String(row.expiresAt))<=Date.now()){
        await this.state.storage.delete('session:'+token);
        return json({code:'SMM_SESSION_EXPIRED'},401);
      }
      await this.state.storage.put('session:'+token,Object.freeze({...row,lastSeenAt:new Date().toISOString()}));
      return json({sessionToken:token,staff:row.staff,expiresAt:row.expiresAt});
    }

    if(url.pathname==='/sessions/logout'&&request.method==='POST'){
      const token=text(request.headers.get('x-mfk-smm-session'),256);
      if(token)await this.state.storage.delete('session:'+token);
      return json({state:'LOGGED_OUT'});
    }

    if(url.pathname==='/acceptance/orders/submit'&&request.method==='POST'){
      const body=record(await request.json());
      const orderRequest=record(body.request);
      const staff=record(body.staff);
      const submissionId=text(orderRequest.submissionId,180);
      const idempotencyKey=text(orderRequest.idempotencyKey,240);
      const staffId=text(staff.staffId,120);
      if(!submissionId||!idempotencyKey||!staffId)return json({code:'SMM_ACCEPTANCE_INTENT_INVALID'},400);
      const fingerprint=stable({orderRequest,staff:{staffId,displayName:String(staff.displayName||''),role:String(staff.role||'')}});
      const key='acceptance-order:'+submissionId;
      const existing=await this.state.storage.get(key) as any;
      if(existing){
        if(existing.idempotencyKey!==idempotencyKey||existing.fingerprint!==fingerprint){
          return json({code:'SMM_ACCEPTANCE_SUBMISSION_CONFLICT'},409);
        }
        return json({state:existing.state,submissionId},existing.state==='PENDING_WEB_SMT'?202:200);
      }
      const row=Object.freeze({
        request:orderRequest,
        staff:Object.freeze({staffId,displayName:String(staff.displayName||''),role:String(staff.role||'')}),
        idempotencyKey,
        fingerprint,
        state:'PENDING_WEB_SMT',
        receivedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,row);
      return json({state:'PENDING_WEB_SMT',submissionId},202);
    }

    if(url.pathname==='/acceptance/orders/readback'&&request.method==='GET'){
      const submissionId=text(url.searchParams.get('submissionId'),180);
      if(!submissionId)return json({code:'SMM_ACCEPTANCE_SUBMISSION_REQUIRED'},400);
      const row=await this.state.storage.get('acceptance-order:'+submissionId) as any;
      if(!row)return json({state:'UNKNOWN',submissionId},404);
      if(row.state==='CONFIRMED'){
        return json({
          state:'CONFIRMED',
          submissionId,
          canonicalOrderId:String(row.result?.orderId||''),
          canonicalRevision:Number(row.result?.canonicalRevision)||1,
        });
      }
      if(row.state==='REJECTED'){
        return json({
          state:'REJECTED',
          submissionId,
          code:String(row.result?.reasonCode||'SMM_ACCEPTANCE_REJECTED'),
        });
      }
      return json({state:'PENDING_WEB_SMT',submissionId});
    }

    if(url.pathname==='/acceptance/smt/pending'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'acceptance-order:'});
      const orders=[...rows.values()]
        .filter((row:any)=>row?.state==='PENDING_WEB_SMT')
        .sort((a:any,b:any)=>String(a.receivedAt||'').localeCompare(String(b.receivedAt||'')))
        .slice(0,50)
        .map((row:any)=>({request:row.request,staff:row.staff}));
      return json({orders});
    }

    if(url.pathname==='/acceptance/smt/ack'&&request.method==='POST'){
      const body=record(await request.json());
      const submissionId=text(body.submissionId,180);
      const idempotencyKey=text(body.idempotencyKey,240);
      const result=record(body.result);
      if(!submissionId||!idempotencyKey)return json({code:'SMM_ACCEPTANCE_ACK_IDENTITY_REQUIRED'},400);
      const key='acceptance-order:'+submissionId;
      const current=await this.state.storage.get(key) as any;
      if(!current)return json({code:'SMM_ACCEPTANCE_ORDER_NOT_FOUND'},404);
      if(current.idempotencyKey!==idempotencyKey)return json({code:'SMM_ACCEPTANCE_ACK_IDEMPOTENCY_MISMATCH'},409);
      if(current.state!=='PENDING_WEB_SMT')return json({state:'IDEMPOTENT',submissionId});
      const disposition=String(result.disposition||'');
      if(disposition!=='ACCEPTED'&&disposition!=='REJECTED')return json({code:'SMM_ACCEPTANCE_ACK_RESULT_INVALID'},400);
      const next=Object.freeze({
        ...current,
        state:disposition==='ACCEPTED'?'CONFIRMED':'REJECTED',
        result:Object.freeze({...result}),
        resolvedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,next);
      return json({state:'ACKED',submissionId});
    }

    if(url.pathname==='/bridge/create'&&request.method==='POST'){
      const body=record(await request.json());
      const submissionId=text(body.submissionId,180);
      const staffId=text(body.staffId,120);
      const menuRevision=text(body.menuRevision,120);
      const serviceMode=text(body.serviceMode,20);
      const tender=text(body.tender,20);
      const publishedTotalMinor=Number(body.publishedTotalMinor);
      if(!submissionId||!staffId||!menuRevision)return json({code:'SMM_BRIDGE_TICKET_INVALID'},400);
      if(!['TAKEAWAY','DINE_IN'].includes(serviceMode))return json({code:'SMM_BRIDGE_SERVICE_MODE_INVALID'},400);
      if(!['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(tender))return json({code:'SMM_BRIDGE_TENDER_INVALID'},400);
      if(!Number.isSafeInteger(publishedTotalMinor)||publishedTotalMinor<0)return json({code:'SMM_BRIDGE_TOTAL_INVALID'},400);

      const existingTicket=await this.state.storage.get('bridge-submission:'+submissionId) as string|undefined;
      if(existingTicket){
        const existing=await this.state.storage.get('bridge:'+existingTicket) as any;
        if(existing&&String(existing.staffId)===staffId&&String(existing.menuRevision)===menuRevision&&String(existing.serviceMode)===serviceMode&&String(existing.tender)===tender&&Number(existing.publishedTotalMinor)===publishedTotalMinor){
          return json({ticket:existingTicket,expiresAt:existing.expiresAt,state:existing.state||'TICKET_CREATED'},200);
        }
      }

      const ticket=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
      const createdAt=new Date().toISOString();
      const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
      const row=Object.freeze({
        ticket,submissionId,staffId,menuRevision,serviceMode,tender,publishedTotalMinor,
        state:'TICKET_CREATED',createdAt,expiresAt,claimCount:0,
      });
      await this.state.storage.put('bridge:'+ticket,row);
      await this.state.storage.put('bridge-submission:'+submissionId,ticket);
      return json({ticket,expiresAt,state:row.state},201);
    }

    if(url.pathname==='/bridge/update'&&request.method==='POST'){
      const body=record(await request.json());
      const submissionId=text(body.submissionId,180);
      let ticket=text(body.ticket,256);
      if(!ticket&&submissionId){
        ticket=String(await this.state.storage.get('bridge-submission:'+submissionId)||'');
      }
      if(!ticket)return json({code:'SMM_BRIDGE_TICKET_REQUIRED'},400);
      const key='bridge:'+ticket;
      const current=await this.state.storage.get(key) as any;
      if(!current)return json({code:'SMM_BRIDGE_TICKET_NOT_FOUND'},404);
      const next=Object.freeze({
        ...current,
        ...(typeof body.state==='string'?{state:body.state}:{}),
        ...(Number.isFinite(Number(body.relayStatus))?{relayStatus:Number(body.relayStatus)}:{}),
        ...(typeof body.relayState==='string'?{relayState:body.relayState}:{}),
        ...(typeof body.relayCode==='string'?{relayCode:body.relayCode}:{}),
        ...(typeof body.customerState==='string'?{customerState:body.customerState}:{}),
        ...(typeof body.customerCode==='string'?{customerCode:body.customerCode}:{}),
        updatedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,next);
      return json({state:'UPDATED'});
    }

    if(url.pathname==='/bridge/read'&&request.method==='GET'){
      const ticket=text(url.searchParams.get('ticket'),256);
      const submissionId=text(url.searchParams.get('submissionId'),180);
      if(!ticket||!submissionId)return json({code:'SMM_BRIDGE_TICKET_REQUIRED'},400);
      const key='bridge:'+ticket;
      const row=await this.state.storage.get(key) as any;
      if(!row)return json({code:'SMM_BRIDGE_TICKET_NOT_FOUND'},404);
      if(String(row.submissionId)!==submissionId)return json({code:'SMM_BRIDGE_SUBMISSION_MISMATCH'},409);
      if(!Number.isFinite(Date.parse(String(row.expiresAt||'')))||Date.parse(String(row.expiresAt))<=Date.now()){
        await this.state.storage.delete(key);
        await this.state.storage.delete('bridge-submission:'+submissionId);
        return json({code:'SMM_BRIDGE_TICKET_EXPIRED'},410);
      }
      const next=Object.freeze({
        ...row,
        state:'CLAIMED_BY_SMT',
        claimCount:(Number(row.claimCount)||0)+1,
        lastClaimAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      });
      await this.state.storage.put(key,next);
      return json(next);
    }

    if(url.pathname==='/bridge/list'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'bridge:'});
      const traces=[...rows.values()].filter((row:any)=>row&&typeof row==='object')
        .sort((a:any,b:any)=>String(b.updatedAt||b.createdAt||b.expiresAt||'').localeCompare(String(a.updatedAt||a.createdAt||a.expiresAt||'')))
        .slice(0,12)
        .map((row:any)=>({
          submissionId:String(row.submissionId||''),
          state:String(row.state||'TICKET_CREATED'),
          menuRevision:String(row.menuRevision||''),
          serviceMode:String(row.serviceMode||''),
          publishedTotalMinor:Number.isFinite(Number(row.publishedTotalMinor))?Number(row.publishedTotalMinor):null,
          createdAt:String(row.createdAt||''),
          updatedAt:String(row.updatedAt||''),
          expiresAt:String(row.expiresAt||''),
          relayStatus:Number.isFinite(Number(row.relayStatus))?Number(row.relayStatus):null,
          relayState:String(row.relayState||''),
          relayCode:String(row.relayCode||''),
          claimCount:Number(row.claimCount)||0,
          lastClaimAt:String(row.lastClaimAt||''),
          customerState:String(row.customerState||''),
          customerCode:String(row.customerCode||''),
        }));
      return json({traces});
    }









    return json({code:'NOT_FOUND'},404);
  }
}

async function readStaffSession(request:Request,storeId:string,env:{SMM_INTENT_STORE:any}){
  const token=text(request.headers.get('x-mfk-smm-session'),256);
  if(!token)return null;
  const id=env.SMM_INTENT_STORE.idFromName(storeId);
  const stub=env.SMM_INTENT_STORE.get(id);
  const response=await stub.fetch(new Request('https://internal/sessions/read',{
    method:'GET',
    headers:{'x-mfk-smm-session':token},
  }));
  if(!response.ok)return null;
  const body=record(await response.json());
  const sessionStaff=record(body.staff);
  const staffId=text(sessionStaff.staffId,120);
  const current=await currentStaffIdentity(staffId,storeId);
  if(!current){
    await stub.fetch(new Request('https://internal/sessions/logout',{method:'POST',headers:{'x-mfk-smm-session':token}})).catch(()=>{});
    return null;
  }
  return Object.freeze({...current,sessionToken:token});
}

export default{
  async fetch(request:Request,env:{ASSETS:{fetch(request:Request):Promise<Response>};SMM_INTENT_STORE:any;WEB_SMT_ACCEPTANCE_TOKEN?:string}){
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
      return json({staff:staffRows(active).map(item=>({
        staffId:item.staffId,
        displayName:item.name,
        role:item.role,
      }))});
    }

    if(url.pathname==='/api/smm/staff/challenge'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const body=record(await request.json().catch(()=>({})));
      const staffId=text(body.staffId,120);
      const current=await currentStaffVerifier(staffId,storeId);
      if(!current)return json({code:'SMM_STAFF_NOT_AVAILABLE',message:'呢個員工帳戶暫時未能登入'},404);
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const response=await stub.fetch(new Request('https://internal/auth/challenge/create',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({staffId}),
      }));
      if(!response.ok)return json({code:'SMM_AUTH_CHALLENGE_CREATE_FAILED'},503);
      const challenge=record(await response.json());
      return json({
        challengeId:challenge.challengeId,
        nonce:challenge.nonce,
        expiresAt:challenge.expiresAt,
        algorithm:current.verifier.algorithm,
        iterations:current.verifier.iterations,
        saltHex:current.verifier.saltHex,
      });
    }

    if(url.pathname==='/api/smm/staff/verify'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const body=record(await request.json().catch(()=>({})));
      const staffId=text(body.staffId,120);
      const challengeId=text(body.challengeId,120);
      const proofHex=text(body.proofHex,128).toLowerCase();
      if(!staffId||!challengeId||!/^[0-9a-f]{64}$/.test(proofHex)){
        return json({code:'SMM_STAFF_PROOF_INVALID',message:'員工驗證資料不完整'},400);
      }

      const current=await currentStaffVerifier(staffId,storeId);
      if(!current)return json({code:'SMM_STAFF_NOT_AVAILABLE',message:'呢個員工帳戶暫時未能登入'},404);

      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const challengeResponse=await stub.fetch(new Request('https://internal/auth/challenge/consume',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({challengeId,staffId}),
      }));
      if(!challengeResponse.ok){
        const failure=record(await challengeResponse.json().catch(()=>({})));
        return json({code:String(failure.code||'SMM_AUTH_CHALLENGE_INVALID'),message:'登入驗證已過期，請再試一次'},401);
      }
      const challenge=record(await challengeResponse.json());
      const message='MFK_SMM_STAFF_LOGIN_V1\n'+challengeId+'\n'+staffId+'\n'+String(challenge.nonce||'');
      let expectedProof:string;
      try{
        expectedProof=await hmacHex(current.verifier.hashHex,message);
      }catch(error){
        return json({code:'SMM_STAFF_PROOF_RUNTIME_ERROR',message:error instanceof Error?error.message:'員工驗證服務錯誤'},503);
      }
      if(!sameHex(expectedProof,proofHex)){
        return json({code:'SMM_STAFF_UNAUTHORIZED',message:'PIN 不正確'},401);
      }

      const staff=Object.freeze({
        staffId:current.staff.staffId,
        displayName:current.staff.name,
        role:current.staff.role,
        scope:current.staff.scope,
        permissions:Object.freeze([...current.staff.permissions]),
      });
      try{
        const response=await stub.fetch(new Request('https://internal/sessions/create',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({staff}),
        }));
        if(!response.ok)return json({code:'SMM_SESSION_CREATE_FAILED',message:'員工身份正確，但手機工作階段建立失敗'},503);
        const session=record(await response.json());
        if(!text(session.sessionToken,256))return json({code:'SMM_SESSION_TOKEN_MISSING',message:'員工身份正確，但手機工作階段建立失敗'},503);
        return json({ok:true,...staff,sessionToken:session.sessionToken,expiresAt:session.expiresAt});
      }catch(error){
        return json({code:'SMM_SESSION_STORE_UNAVAILABLE',message:error instanceof Error?error.message:'員工身份正確，但手機工作階段暫時不可用'},503);
      }
    }

    if(url.pathname==='/api/smm/auth-selftest'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      try{
        const key='11'.repeat(32);
        const message='MFK_SMM_AUTH_SELFTEST';
        const proof=await hmacHex(key,message);
        return /^[0-9a-f]{64}$/.test(proof)
          ?json({ok:true,proofAlgorithm:'HMAC-SHA256',pinDerivation:'CLIENT_PBKDF2'})
          :json({ok:false,code:'SMM_STAFF_HMAC_SELFTEST_FAILED'},503);
      }catch(error){
        return json({ok:false,code:'SMM_STAFF_HMAC_SELFTEST_ERROR',message:error instanceof Error?error.message:'unknown'},503);
      }
    }

    if(url.pathname==='/api/smm/staff/session'){
      if(request.method==='GET'){
        const session=await readStaffSession(request,storeId,env);
        return session?json({ok:true,...session}):json({code:'SMM_SESSION_UNAUTHORIZED'},401);
      }
      if(request.method==='POST'){
        const token=text(request.headers.get('x-mfk-smm-session'),256);
        const id=env.SMM_INTENT_STORE.idFromName(storeId);
        const stub=env.SMM_INTENT_STORE.get(id);
        await stub.fetch(new Request('https://internal/sessions/logout',{method:'POST',headers:{'x-mfk-smm-session':token}}));
        return json({state:'LOGGED_OUT'});
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }

    if(url.pathname==='/api/smm/acceptance/orders/submit'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);
      let orderRequest:Record<string,unknown>;
      try{orderRequest=validateOrderRequest(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_ACCEPTANCE_ORDER_INVALID'},400);}
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      return stub.fetch(new Request('https://internal/acceptance/orders/submit',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({request:orderRequest,staff}),
      }));
    }

    if(url.pathname==='/api/smm/acceptance/orders/readback'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);
      const submissionId=text(url.searchParams.get('submissionId'),180);
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const target=new URL('https://internal/acceptance/orders/readback');
      target.searchParams.set('submissionId',submissionId);
      return stub.fetch(new Request(target.toString(),{method:'GET'}));
    }

    if(url.pathname==='/api/smm/acceptance/smt/pending'||url.pathname==='/api/smm/acceptance/smt/ack'){
      const provided=text(request.headers.get('x-mfk-web-acceptance'),256);
      const expected=String(env.WEB_SMT_ACCEPTANCE_TOKEN||'');
      if(!expected||!provided||provided.length!==expected.length||!sameHex(provided,expected)){
        return json({code:'SMM_WEB_ACCEPTANCE_UNAUTHORIZED'},401);
      }
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      if(url.pathname.endsWith('/pending')){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
        return stub.fetch(new Request('https://internal/acceptance/smt/pending',{method:'GET'}));
      }
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      return stub.fetch(new Request('https://internal/acceptance/smt/ack',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:await request.text(),
      }));
    }

    if(url.pathname==='/api/smm/orders/submit'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);

      let orderRequest:Record<string,unknown>;
      try{orderRequest=validateOrderRequest(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'SMM_ORDER_INVALID'},400);}

      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const ticketResponse=await stub.fetch(new Request('https://internal/bridge/create',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          submissionId:orderRequest.submissionId,
          staffId:staff.staffId,
          menuRevision:orderRequest.menuRevision,
          serviceMode:orderRequest.serviceMode,
          tender:orderRequest.tender,
          publishedTotalMinor:orderRequest.publishedTotalMinor,
        }),
      }));
      if(!ticketResponse.ok)return json({code:'SMM_BRIDGE_TICKET_CREATE_FAILED'},503);
      const ticketBody=record(await ticketResponse.json());
      const ticket=text(ticketBody.ticket,256);
      if(!ticket)return json({code:'SMM_BRIDGE_TICKET_MISSING'},503);

      const lines=list(orderRequest.lines).map(raw=>{
        const line=record(raw);
        return{
          lineId:String(line.lineId||''),
          productId:String(line.productId||''),
          productName:String(line.productName||''),
          quantity:Number(line.quantity)||1,
          ...(line.selectedVariationId?{selectedVariationId:String(line.selectedVariationId)}:{}),
          ...(line.selectedVariationName?{selectedVariationName:String(line.selectedVariationName)}:{}),
          selections:list(line.selections).map(rawSelection=>{
            const selection=record(rawSelection);
            return{
              optionGroupId:String(selection.optionGroupId||''),
              optionId:String(selection.optionId||''),
              optionName:String(selection.optionName||''),
            };
          }),
          ...(Number.isSafeInteger(Number(line.publishedUnitPriceMinor))?{publishedUnitPriceMinor:Number(line.publishedUnitPriceMinor)}:{}),
        };
      });
      const now=new Date().toISOString();
      const customerIntent={
        schema:'MFK_CUSTOMER_ORDER_INTENT_V1',
        storeId:'MF01',
        submissionId:String(orderRequest.submissionId),
        idempotencyKey:String(orderRequest.idempotencyKey),
        createdAt:now,
        updatedAt:now,
        cart:lines,
        checkout:{
          name:'__MFK_SMM1__|'+ticket,
          phone:'00000000',
          paymentMethod:'PAY_AT_STORE',
        },
      };

      let response:Response;
      try{
        response=await fetch('https://admin.morefunos.com/api/customer/orders/submit?storeId='+encodeURIComponent(storeId),{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify(customerIntent),
        });
      }catch{
        await stub.fetch(new Request('https://internal/bridge/update',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({ticket,submissionId:orderRequest.submissionId,state:'RELAY_NETWORK_ERROR',relayCode:'SMM_CUSTOMER_BRIDGE_UNAVAILABLE'}),
        })).catch(()=>{});
        return json({code:'SMM_CUSTOMER_BRIDGE_UNAVAILABLE',message:'暫時未能連接門店 Internet 訂單橋'},503);
      }
      const raw=await response.text();
      let relayBody:Record<string,unknown>={};
      try{relayBody=raw?JSON.parse(raw) as Record<string,unknown>:{};}catch{}
      await stub.fetch(new Request('https://internal/bridge/update',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          ticket,
          submissionId:orderRequest.submissionId,
          state:response.ok||response.status===202?'RELAYED_TO_CUSTOMER_BRIDGE':'RELAY_REJECTED',
          relayStatus:response.status,
          relayState:String(relayBody.state||''),
          relayCode:String(relayBody.code||''),
        }),
      })).catch(()=>{});
      return new Response(raw,{status:response.status,statusText:response.statusText,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }

    if(url.pathname==='/api/smm/orders/readback'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);
      const submissionId=text(url.searchParams.get('submissionId'),180);
      let response:Response;
      try{
        response=await fetch(
          'https://admin.morefunos.com/api/customer/orders/readback?storeId='+encodeURIComponent(storeId)+'&submissionId='+encodeURIComponent(submissionId),
          {method:'GET',headers:{accept:'application/json'}},
        );
      }catch{
        return json({state:'UNKNOWN',submissionId},503);
      }
      const raw=await response.text();
      let readback:Record<string,unknown>={};
      try{readback=raw?JSON.parse(raw) as Record<string,unknown>:{};}catch{}
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      await stub.fetch(new Request('https://internal/bridge/update',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          submissionId,
          state:readback.state==='CONFIRMED'?'CUSTOMER_CONFIRMED':readback.state==='REJECTED'?'CUSTOMER_REJECTED':'WAITING_CUSTOMER_READBACK',
          customerState:String(readback.state||''),
          customerCode:String(readback.code||''),
        }),
      })).catch(()=>{});
      return new Response(raw,{status:response.status,statusText:response.statusText,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }

    if(url.pathname==='/api/smm/bridge/claim'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
      const deviceId=text(url.searchParams.get('deviceId'),180);
      const ticket=text(url.searchParams.get('ticket'),256);
      const submissionId=text(url.searchParams.get('submissionId'),180);
      if(!await authorizedSmtDevice(deviceId,storeId))return json({code:'SMM_SMT_UNAUTHORIZED'},401,cors(request));
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const target=new URL('https://internal/bridge/read');
      target.searchParams.set('ticket',ticket);
      target.searchParams.set('submissionId',submissionId);
      const response=await stub.fetch(new Request(target.toString(),{method:'GET'}));
      const body=await response.text();
      return new Response(body,{status:response.status,statusText:response.statusText,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors(request)}});
    }

    if(url.pathname==='/api/smm/bridge-diagnostics'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const id=env.SMM_INTENT_STORE.idFromName(storeId);
      const stub=env.SMM_INTENT_STORE.get(id);
      const traceResponse=await stub.fetch(new Request('https://internal/bridge/list',{method:'GET'}));
      const traceBody=record(await traceResponse.json().catch(()=>({})));
      const traces=list(traceBody.traces).map(raw=>record(raw));
      const enriched=[];
      for(const trace of traces){
        const submissionId=String(trace.submissionId||'');
        let customer:Record<string,unknown>={};
        if(submissionId){
          try{
            const response=await fetch('https://admin.morefunos.com/api/customer/orders/readback?storeId='+encodeURIComponent(storeId)+'&submissionId='+encodeURIComponent(submissionId),{headers:{accept:'application/json','cache-control':'no-cache'}});
            customer=record(await response.json().catch(()=>({})));
            if(response.status===404)customer={state:'NOT_FOUND'};
            else if(!response.ok)customer={state:'HTTP_ERROR',code:String(customer.code||response.status)};
          }catch{customer={state:'NETWORK_ERROR'};}
        }
        const relayStatus=Number(trace.relayStatus);
        const claimCount=Number(trace.claimCount)||0;
        const customerState=String(customer.state||trace.customerState||'');
        const firstBreak=
          Number.isFinite(relayStatus)&&relayStatus>=400?'SMM_TO_CUSTOMER_RELAY_REJECTED':
          String(trace.state)==='RELAY_NETWORK_ERROR'?'SMM_TO_CUSTOMER_RELAY_NETWORK':
          customerState==='NOT_FOUND'?'CUSTOMER_RUNTIME_NOT_RECEIVED':
          customerState==='PENDING_SMT'&&claimCount===0?'SMT_HAS_NOT_CLAIMED_SMM_TICKET':
          customerState==='PENDING_SMT'&&claimCount>0?'SMT_CLAIMED_BUT_NOT_ACKED':
          customerState==='REJECTED'?'SMT_REJECTED_SMM_ORDER':
          customerState==='CONFIRMED'?'GREEN':
          'WAITING_OR_UNKNOWN';
        enriched.push({
          traceId:submissionId?submissionId.slice(-10):'',
          state:String(trace.state||''),
          menuRevision:String(trace.menuRevision||''),
          serviceMode:String(trace.serviceMode||''),
          publishedTotalMinor:Number.isFinite(Number(trace.publishedTotalMinor))?Number(trace.publishedTotalMinor):null,
          relayStatus:Number.isFinite(relayStatus)?relayStatus:null,
          relayState:String(trace.relayState||''),
          relayCode:String(trace.relayCode||''),
          claimCount,
          lastClaimAt:String(trace.lastClaimAt||''),
          customerState,
          customerCode:String(customer.code||trace.customerCode||''),
          firstBreak,
          createdAt:String(trace.createdAt||''),
          updatedAt:String(trace.updatedAt||''),
        });
      }
      return json({ok:true,traces:enriched});
    }

    if(url.pathname==='/api/smm/config-diagnostics'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      let active:Record<string,unknown>;
      try{active=await fetchActive(storeId);}catch{return json({code:'SMM_CONFIG_NOT_PUBLISHED'},503);}
      let acks:Record<string,unknown>={};
      try{
        const ackUrl=new URL(ADMIN_ACKS);
        ackUrl.searchParams.set('storeId',storeId);
        const ackResponse=await fetch(ackUrl,{headers:{accept:'application/json','cache-control':'no-cache'}});
        if(ackResponse.ok)acks=record(await ackResponse.json());
      }catch{}
      const activeRevision=Number(active.revision)||0;
      const activeFingerprint=String(active.fingerprint||'');
      const rows=list(acks.acks).map(raw=>record(raw)).map(row=>({
        deviceId:String(row.deviceId||''),
        revision:Number(row.revision)||0,
        fingerprint:String(row.fingerprint||''),
        appliedAt:String(row.appliedAt||''),
      }));
      return json({
        active:{revision:activeRevision,fingerprint:activeFingerprint},
        devices:rows,
        mismatch:rows.some(row=>row.revision!==activeRevision||row.fingerprint!==activeFingerprint),
      });
    }

    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-smm-web',internetProjection:'admin-published-config',internetStaffOrders:'customer-bridge-shared'});
    return env.ASSETS.fetch(request);
  },
};
