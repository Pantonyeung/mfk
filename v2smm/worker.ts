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

    if(url.pathname==='/api/smm/orders/submit'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);
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
      const staff=await readStaffSession(request,storeId,env);
      if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'請先使用同一個員工帳戶登入'},401);
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

    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-smm-web',internetProjection:'admin-published-config',internetStaffOrders:'durable-intent-only'});
    return env.ASSETS.fetch(request);
  },
};
