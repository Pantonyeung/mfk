import {validateMfkAdminConfigAck,validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {validateSmtProjectionBatch} from '../contracts/smt-projection-v1.ts';
import {KeetaRuntimeStore} from './keeta-runtime.ts';
export {KeetaRuntimeStore};

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const ADMIN_ORIGIN='https://admin.morefunos.com';
const SMT_ORIGIN='https://appassets.androidplatform.net';
const CORS_ORIGINS=new Set([ADMIN_ORIGIN,SMT_ORIGIN]);

function json(value,status=200,extra={}){
  return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extra}});
}
function cors(request){
  const origin=request.headers.get('origin')||'';
  return CORS_ORIGINS.has(origin)?{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type,x-mfk-admin-publish-key',
    'access-control-allow-credentials':'true',
    'vary':'origin',
  }:{};
}
async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function storeIdFrom(url){return (url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';}

export class AdminSyncStore{
  constructor(state,env){this.state=state;this.env=env;}

  async authorizePublish(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const incoming=await sha256(key);
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled){
      await this.state.storage.put('publisherKeyHash',incoming);
      await this.state.storage.put('publisherEnrolledAt',new Date().toISOString());
      return true;
    }
    return enrolled===incoming;
  }

  async authorizeAdminRead(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled)return false;
    return enrolled===await sha256(key);
  }

  async authorizeProjectionWrite(request,events){
    if(request.headers.get('origin')!==SMT_ORIGIN)return false;
    const acks=await this.state.storage.get('acks')||{};
    return events.every(event=>Boolean(acks[event.deviceId]));
  }

  async projectionOrders(){
    const rows=await this.state.storage.list({prefix:'projection:order:'});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  }

  async projectionCashRows(prefix){
    const rows=await this.state.storage.list({prefix});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.businessDate||'').localeCompare(String(a.businessDate||'')));
  }

  async projectionReports(){
    const [orders,openings,closes]=await Promise.all([
      this.projectionOrders(),
      this.projectionCashRows('projection:cash-opening:'),
      this.projectionCashRows('projection:day-close:'),
    ]);
    const byDate=new Map();
    for(const order of orders){
      const date=String(order.businessDate||'');
      if(!date)continue;
      const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0};
      const cancelled=String(order.fulfillmentLabel||'')==='已取消';
      if(!cancelled){
        const total=Math.max(0,Number(order.totalMinor)||0);
        row.grossMinor+=total;
        row.netMinor+=total;
        row.orders+=1;
        const label=String(order.paymentLabel||'');
        if(label.toUpperCase().startsWith('COMBO')){
          const match=label.match(/\bCASH\s+\$?([0-9]+(?:\.[0-9]{1,2})?)/i);
          if(match)row.cashSalesMinor+=Math.round(Number(match[1])*100);
        }else if(label.toUpperCase().includes('CASH')||label.includes('現金')){
          row.cashSalesMinor+=total;
        }
      }
      byDate.set(date,row);
    }
    const openingByDate=new Map(openings.map(row=>[String(row.businessDate||''),row]));
    const closeByDate=new Map(closes.map(row=>[String(row.businessDate||''),row]));
    const dates=new Set([...byDate.keys(),...openingByDate.keys(),...closeByDate.keys()]);
    return [...dates].sort((a,b)=>b.localeCompare(a)).map(date=>({
      ...(byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0}),
      openingCash:openingByDate.get(date)||null,
      dayClose:closeByDate.get(date)||null,
    }));
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/authorize-admin'){
      if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_READ_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/active'){
      const active=await this.state.storage.get('active');
      return active?json(active):json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},404);
    }
    if(url.pathname==='/publish'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizePublish(request))return json({code:'ADMIN_CONFIG_PUBLISH_UNAUTHORIZED'},401);
      let envelope;
      try{envelope=validateMfkAdminConfigEnvelope(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_INVALID'},400);}
      const current=await this.state.storage.get('active');
      if(current){
        if(envelope.revision<current.revision)return json({code:'ADMIN_CONFIG_REVISION_STALE',currentRevision:current.revision},409);
        if(envelope.revision===current.revision){
          if(envelope.fingerprint!==current.fingerprint)return json({code:'ADMIN_CONFIG_REVISION_CONFLICT',currentFingerprint:current.fingerprint},409);
          return json({state:'IDEMPOTENT',active:current});
        }
      }
      await this.state.storage.put('active',envelope);
      await this.state.storage.put('activeMeta',{revision:envelope.revision,fingerprint:envelope.fingerprint,publishedAt:envelope.publishedAt});
      const doorbell=JSON.stringify({
        type:'ADMIN_CONFIG_AVAILABLE',
        storeId:envelope.storeId,
        revision:envelope.revision,
        fingerprint:envelope.fingerprint,
        publishedAt:envelope.publishedAt,
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(doorbell);}catch{}
      }
      return json({state:'PUBLISHED',active:{revision:envelope.revision,fingerprint:envelope.fingerprint,publishedAt:envelope.publishedAt}});
    }
    if(url.pathname==='/ack'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let ack;
      try{ack=validateMfkAdminConfigAck(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_ACK_INVALID'},400);}
      const active=await this.state.storage.get('active');
      if(!active)return json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},409);
      if(ack.revision!==active.revision||ack.fingerprint!==active.fingerprint){
        return json({code:'ADMIN_CONFIG_ACK_MISMATCH',expectedRevision:active.revision,expectedFingerprint:active.fingerprint},409);
      }
      const acks=await this.state.storage.get('acks')||{};
      acks[ack.deviceId]=ack;
      await this.state.storage.put('acks',acks);
      return json({state:'ACKED',ack});
    }
    if(url.pathname==='/acks'){
      const acks=await this.state.storage.get('acks')||{};
      return json({acks:Object.values(acks).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)))});
    }
    if(url.pathname==='/events'){
      if(request.headers.get('upgrade')!=='websocket')return json({code:'WEBSOCKET_REQUIRED'},426);
      const pair=new WebSocketPair();
      const client=pair[0],server=pair[1];
      this.state.acceptWebSocket(server);
      const active=await this.state.storage.get('active');
      if(active){
        server.send(JSON.stringify({type:'ADMIN_CONFIG_AVAILABLE',storeId:active.storeId,revision:active.revision,fingerprint:active.fingerprint,publishedAt:active.publishedAt}));
      }
      return new Response(null,{status:101,webSocket:client});
    }

    if(url.pathname==='/projection/events'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let batch;
      try{batch=validateSmtProjectionBatch(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'PROJECTION_BATCH_INVALID'},400);}
      if(!await this.authorizeProjectionWrite(request,batch.events))return json({code:'PROJECTION_WRITE_UNAUTHORIZED'},401);
      const accepted=[];
      const eventTypes=new Set();
      for(const event of batch.events){
        const eventKey='projection:event:'+event.eventId;
        const existing=await this.state.storage.get(eventKey);
        if(existing){accepted.push(event.eventId);continue;}
        if(event.type==='ORDER_UPSERT'){
          const key='projection:order:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||!Number.isFinite(currentAt)||incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }else if(event.type==='CASH_OPENING_CONFIRMED'){
          await this.state.storage.put('projection:cash-opening:'+event.entityId,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
        }else if(event.type==='DAY_CLOSE_RECORDED'){
          const key='projection:day-close:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingVersion=Number(event.payload?.version)||0;
          const currentVersion=Number(current?.payload?.version)||0;
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||incomingVersion>currentVersion||incomingVersion===currentVersion&&incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }
        await this.state.storage.put(eventKey,{type:event.type,entityId:event.entityId,occurredAt:event.occurredAt});
        accepted.push(event.eventId);
        eventTypes.add(event.type);
      }
      if(eventTypes.size){
        const doorbell=JSON.stringify({
          type:'SMT_PROJECTION_AVAILABLE',
          storeId:batch.events[0]?.storeId||'MF01',
          eventTypes:[...eventTypes],
          receivedAt:new Date().toISOString(),
        });
        for(const socket of this.state.getWebSockets()){
          try{socket.send(doorbell);}catch{}
        }
      }
      return json({state:'ACKED',accepted});
    }

    if(url.pathname==='/projection/orders'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({orders:await this.projectionOrders()});
    }

    if(url.pathname==='/projection/reports'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({days:await this.projectionReports()});
    }

    return json({code:'NOT_FOUND'},404);
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname.startsWith('/api/keeta/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const keetaId=env.KEETA_RUNTIME.idFromName(storeId);
      const keeta=env.KEETA_RUNTIME.get(keetaId);

      if(url.pathname.startsWith('/api/keeta/admin/')){
        const adminId=env.ADMIN_SYNC.idFromName(storeId);
        const admin=env.ADMIN_SYNC.get(adminId);
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-admin';
        authorizeUrl.search='';
        let authResponse;
        try{
          authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{
            method:'GET',
            headers:new Headers(request.headers),
          }));
        }catch{
          return json({code:'KEETA_ADMIN_AUTH_RUNTIME_FAILED'},500,cors(request));
        }
        if(!authResponse.ok)return json({code:'KEETA_ADMIN_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/admin/'+url.pathname.slice('/api/keeta/admin/'.length);
        target.search=url.search;
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        let response;
        try{
          response=await keeta.fetch(new Request(target.toString(),init));
        }catch{
          return json({code:'KEETA_RUNTIME_DO_FETCH_FAILED'},500,cors(request));
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      const target=new URL(request.url);
      target.pathname=url.pathname==='/api/keeta/webhook'
        ?'/webhook'
        :url.pathname==='/api/keeta/oauth/callback'
          ?'/oauth/callback'
          :'/not-found';
      const forwardedHeaders=new Headers(request.headers);
      if(url.pathname==='/api/keeta/webhook'){
        forwardedHeaders.set('x-mfk-keeta-external-url',request.url);
      }else{
        forwardedHeaders.delete('x-mfk-keeta-external-url');
      }
      const init={method:request.method,headers:forwardedHeaders};
      if(request.method!=='GET'&&request.method!=='HEAD'){
        const body=await request.arrayBuffer();
        if(body.byteLength)init.body=body;
      }
      const response=await keeta.fetch(new Request(target.toString(),init));
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname.startsWith('/api/admin-sync/')||url.pathname.startsWith('/api/projection/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const id=env.ADMIN_SYNC.idFromName(storeId);
      const stub=env.ADMIN_SYNC.get(id);
      const targetPath=url.pathname.startsWith('/api/projection/')
        ?'/projection/'+url.pathname.slice('/api/projection/'.length)
        :url.pathname.replace('/api/admin-sync','')||'/active';
      const target=new URL(request.url);
      target.pathname=targetPath;
      target.search='';
      const forwarded=new Request(target.toString(),request);
      const response=await stub.fetch(forwarded);
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-admin'});
    return env.ASSETS.fetch(request);
  },
};
