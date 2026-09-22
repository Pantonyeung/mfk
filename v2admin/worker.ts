import {validateMfkAdminConfigAck,validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';

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

  async fetch(request){
    const url=new URL(request.url);
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
    return json({code:'NOT_FOUND'},404);
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/admin-sync/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const id=env.ADMIN_SYNC.idFromName(storeId);
      const stub=env.ADMIN_SYNC.get(id);
      const targetPath=url.pathname.replace('/api/admin-sync','')||'/active';
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
