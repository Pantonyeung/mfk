import original,{AdminSyncStore as BaseAdmin,CustomerRuntimeStore as BaseCustomer,KeetaRuntimeStore} from './worker.ts';
import {createMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {LINKED_SCOPE,LINKED_HEADER,businessSnapshot,catalogProjection,linkedGateway,linkedJson,record,bodyJson,internal} from '../integrations/v3-linked-test.ts';
export {KeetaRuntimeStore};
declare const WebSocketPair:any;
async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function publicState(row:any){const rejected=row.state==='REJECTED';return {submissionId:row.submissionId,state:row.state,reviewState:rejected?'REJECTED':row.linkedReviewState??'UNSEEN',reviewedAt:row.linkedReviewedAt??null,message:rejected?'店舖未能接受呢個要求':row.linkedReviewState==='SEEN'?'POS 已查看點餐要求；尚未成交或收款':'已送達共用待處理單；等候 POS 查看',formalOrderCreated:false,paymentConfirmed:false};}
function socket(state:any){const pair=new WebSocketPair();state.acceptWebSocket(pair[1]);pair[1].send(JSON.stringify({type:'REFRESH_REQUIRED'}));return new Response(null,{status:101,webSocket:pair[0]} as any);}
function notify(state:any){for(const ws of state.getWebSockets()){try{ws.send(JSON.stringify({type:'REFRESH_REQUIRED'}));}catch{}}}
/** Same published Admin authority and namespace; only an explicitly isolated test instance gets anonymous sessions. */
export class AdminSyncStore extends BaseAdmin{
  async readAdminBrowserSession(request:any){
    if(request.headers.get(LINKED_HEADER)===LINKED_SCOPE&&this.env.MFP_V3_LINKED_TEST_ENABLED==='1'&&await this.state.storage.get('linked-test:scope')===LINKED_SCOPE){
      const token=request.headers.get('x-mfk-admin-session')||'';if(token.length<32||token.length>256)return null;
      const session=await this.state.storage.get('admin-browser:session:'+await hash(token));
      if(session?.linkedScope===LINKED_SCOPE&&Date.parse(session.expiresAt)>Date.now())return {...session,sessionToken:token};
    }
    return super.readAdminBrowserSession(request);
  }
  async fetch(request:any){
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/linked-test/'))return super.fetch(request);
    if(this.env.MFP_V3_LINKED_TEST_ENABLED!=='1'||request.headers.get(LINKED_HEADER)!==LINKED_SCOPE)return linkedJson({code:'LINKED_INTERNAL_ADMISSION_REQUIRED'},403);
    if(path==='/linked-test/source'&&request.method==='GET'){
      if(String(this.state.id)!==String(this.env.ADMIN_SYNC.idFromName('MF01')))return linkedJson({code:'LINKED_SOURCE_SCOPE_INVALID'},403);
      const active=await this.state.storage.get('active');if(!active)return linkedJson({code:'SOURCE_NOT_PUBLISHED'},404);
      try{return linkedJson({snapshot:businessSnapshot(active.snapshot),sourceFingerprint:active.fingerprint,sourcePublishedAt:active.publishedAt});}catch{return linkedJson({code:'LINKED_SOURCE_PRIVACY_PROJECTION_FAILED'},503);}
    }
    if(String(this.state.id)!==String(this.env.ADMIN_SYNC.idFromName(LINKED_SCOPE)))return linkedJson({code:'LINKED_TARGET_SCOPE_INVALID'},403);
    if(path==='/linked-test/bootstrap'&&request.method==='POST'){
      const input=await bodyJson(request);
      return this.state.blockConcurrencyWhile(async()=>{
        if(await this.state.storage.get('linked-test:scope')===LINKED_SCOPE)return linkedJson({state:'EXISTING'});
        if(await this.state.storage.get('active'))return linkedJson({code:'LINKED_NONEMPTY_TARGET_BLOCKED'},409);
        const snapshot=businessSnapshot(input.snapshot,true);
        const envelope=createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:new Date().toISOString(),adminFingerprint:'LINKED_TEST:'+String(input.sourceFingerprint),snapshot});
        const result=await this.publishEnvelope(envelope);if(result.status!==200)return linkedJson(result.body,result.status);
        await this.state.storage.put('linked-test:source',{fingerprint:input.sourceFingerprint,publishedAt:input.sourcePublishedAt});
        await this.state.storage.put('linked-test:scope',LINKED_SCOPE);return linkedJson({state:'INITIALIZED'},201);
      });
    }
    if(await this.state.storage.get('linked-test:scope')!==LINKED_SCOPE)return linkedJson({code:'LINKED_NOT_INITIALIZED'},404);
    if(path==='/linked-test/ready')return linkedJson({ready:true,scope:LINKED_SCOPE});
    if(path==='/linked-test/catalog')return linkedJson(catalogProjection(await this.state.storage.get('active')));
    if(path==='/linked-test/events'){if(this.state.getWebSockets().length>=100)return linkedJson({code:'LINKED_SOCKET_LIMIT'},429);return super.fetch(new Request('https://internal/events',request));}
    if(path==='/linked-test/session'&&request.method==='POST'){
      const sessions=await this.state.storage.list({prefix:'admin-browser:session:'});let remaining=sessions.size;for(const [key,value] of sessions){if(value?.linkedScope===LINKED_SCOPE&&Date.parse(value.expiresAt)<=Date.now()){await this.state.storage.delete(key);remaining--;}}if(remaining>=250)return linkedJson({code:'LINKED_SESSION_LIMIT'},429);
      const token=crypto.randomUUID()+crypto.randomUUID();const value={staffId:'V3_TEST_OPERATOR',loginId:'V3_TEST_OPERATOR',displayName:'共用測試工作區',role:'OWNER',scope:'STORE',permissions:['PUBLISH_CONFIG'],linkedScope:LINKED_SCOPE,expiresAt:new Date(Date.now()+12*60*60*1000).toISOString()};
      await this.state.storage.put('admin-browser:session:'+await hash(token),value);return linkedJson({...value,sessionToken:token});
    }
    if(path==='/linked-test/dispatch'&&request.method==='POST'){
      const {route,method,payload,sessionToken}=await bodyJson(request);
      const allowed:Record<string,string[]>={'/projection/orders':['GET'],'/projection/reports':['GET'],'/refunds':['GET'],'/acks':['GET'],'/admin-browser/active':['GET'],'/admin-browser/draft':['GET','PUT','DELETE'],'/admin-browser/draft/products':['POST'],'/admin-browser/draft/publish':['POST'],'/admin-browser/versions':['GET']};
      if(!allowed[route]?.includes(method))return linkedJson({code:'LINKED_ADMIN_ROUTE_BLOCKED'},403);
      if(payload?.snapshot)businessSnapshot(payload.snapshot,true);
      const target=internal(route,method,payload,{'x-mfk-admin-session':String(sessionToken),origin:'https://admin.morefunos.com','sec-fetch-site':'same-origin'});
      // Per-call view only: never turn the live MF01/global preservation gate off.
      const context=Object.create(this);context.env={...this.env,MFP_V3_CONFIG_WRITES_ENABLED:'1'};
      return this.state.blockConcurrencyWhile(()=>BaseAdmin.prototype.fetch.call(context,target));
    }
    return linkedJson({code:'LINKED_NOT_FOUND'},404);
  }
}
/** Same intent inbox; review is NOT a formal transaction, payment, or synthetic kernel ACK. */
export class CustomerRuntimeStore extends BaseCustomer{
  webSocketMessage(_socket:any,_message:any){}
  webSocketClose(socket:any,code:number){try{socket.close(code);}catch{}}
  webSocketError(socket:any){try{socket.close(1011,'連線錯誤');}catch{}}
  async fetch(request:Request):Promise<Response>{
    const path=new URL(request.url).pathname;if(!path.startsWith('/linked-test/'))return super.fetch(request);
    if(this.env.MFP_V3_LINKED_TEST_ENABLED!=='1'||request.headers.get(LINKED_HEADER)!==LINKED_SCOPE||String(this.state.id)!==String(this.env.CUSTOMER_RUNTIME.idFromName(LINKED_SCOPE)))return linkedJson({code:'LINKED_INTERNAL_ADMISSION_REQUIRED'},403);
    if(path==='/linked-test/events'){if(this.state.getWebSockets().length>=100)return linkedJson({code:'LINKED_SOCKET_LIMIT'},429);return socket(this.state);}
    if(path==='/linked-test/list'&&request.method==='GET'){
      const found=await this.state.storage.list({prefix:'order:',limit:200});
      return linkedJson({scope:LINKED_SCOPE,requests:[...found.values()].map((r:any)=>({...publicState(r),cart:r.cart,checkout:r.checkout,receivedAt:r.receivedAt,idempotencyKey:r.idempotencyKey})),formalOrders:false});
    }
    if(request.method!=='POST')return linkedJson({code:'METHOD_NOT_ALLOWED'},405);
    const body=await bodyJson(request);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(body.submissionId))||body.idempotencyKey!=='V3:'+body.submissionId)return linkedJson({code:'LINKED_SUBMISSION_ID_INVALID'},400);
    return this.state.blockConcurrencyWhile(async()=>{
      const key='order:'+body.submissionId;const found=await this.state.storage.get(key);
      if(path==='/linked-test/retry'){
        if(!found)return linkedJson({state:'UNKNOWN'},404);
        const result=await BaseCustomer.prototype.fetch.call(this,internal('/public/orders/submit','POST',body));if(!result.ok)return result;return linkedJson(publicState(found));
      }
      if(path==='/linked-test/readback')return found?linkedJson(publicState(found)):linkedJson({state:'UNKNOWN',submissionId:body.submissionId},404);
      if(path==='/linked-test/submit'){
        const limit=await this.state.storage.list({prefix:'order:',limit:201});if(!found&&limit.size>=200)return linkedJson({code:'LINKED_TEST_INBOX_LIMIT'},429);
        const r=await BaseCustomer.prototype.fetch.call(this,internal('/public/orders/submit','POST',body));if(!r.ok)return r;
        const saved=await this.state.storage.get(key);notify(this.state);return linkedJson(publicState(saved),found?200:202);
      }
      if(path==='/linked-test/review'){
        if(!found)return linkedJson({code:'LINKED_REQUEST_UNKNOWN'},404);
        if(!['SEEN','REJECTED'].includes(body.reviewState))return linkedJson({code:'LINKED_FORMAL_ACK_NOT_ALLOWED'},400);
        if(found.state==='REJECTED')return linkedJson(publicState(found));
        if(body.reviewState==='REJECTED'){
          const ack=await BaseCustomer.prototype.fetch.call(this,internal('/smt/orders/ack','POST',{submissionId:body.submissionId,idempotencyKey:body.idempotencyKey,state:'REJECTED',message:'店舖未能接受呢個測試要求'}));if(!ack.ok)return ack;
        }else await this.state.storage.put(key,{...found,linkedReviewState:'SEEN',linkedReviewedAt:new Date().toISOString()});
        notify(this.state);return linkedJson(publicState(await this.state.storage.get(key)));
      }
      return linkedJson({code:'LINKED_NOT_FOUND'},404);
    });
  }
}
export default{async fetch(request:Request,env:any){return await linkedGateway(request,env,'admin')??original.fetch(request,env);}};
