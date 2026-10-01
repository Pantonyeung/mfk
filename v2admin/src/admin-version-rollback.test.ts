import {describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {AdminSyncStore} from '../worker.ts';

const STORE_ID='MF01';
const TOKEN='c'.repeat(64);

function snapshot(productId:string,role='OWNER',permissions=['PUBLISH_CONFIG']){
  return{
    catalog:{categories:[],products:[{id:productId}],modifierGroups:[],combos:[],comboPools:[]},
    staffAuth:{staff:[{
      staffId:'owner-1',loginId:'owner',name:'Owner',role,scope:'STORE',active:true,adminLogin:true,
      permissions,
      pinVerifier:{algorithm:'PBKDF2-SHA256',iterations:100000,saltHex:'aa',hashHex:'b'.repeat(64)},
    }]},
  };
}

function envelope(revision:number,publishedAt:string,productId:string,role='OWNER',permissions=['PUBLISH_CONFIG']){
  return createMfkAdminConfigEnvelope({
    storeId:STORE_ID,
    revision,
    publishedAt,
    adminFingerprint:'admin-'+productId,
    snapshot:snapshot(productId,role,permissions),
  });
}

async function sessionKey(){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(TOKEN));
  return 'admin-browser:session:'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

async function harness(options:{role?:string;permissions?:string[];failSuccessOperationWriteOnce?:boolean}={}){
  const role=options.role??'OWNER';
  const permissions=options.permissions??['PUBLISH_CONFIG'];
  const active=envelope(7,'2026-10-01T01:00:00.000Z','base',role,permissions);
  const values=new Map<string,any>([['active',active]]);
  values.set(await sessionKey(),{
    staffId:'owner-1',
    createdAt:'2026-10-01T00:00:00.000Z',
    lastSeenAt:'2026-10-01T00:00:00.000Z',
    expiresAt:'2036-10-01T00:00:00.000Z',
  });
  let failSuccessOperationWriteOnce=Boolean(options.failSuccessOperationWriteOnce);
  const state={
    storage:{
      get:vi.fn(async(key:string)=>values.get(key)),
      put:vi.fn(async(key:string,value:any)=>{
        if(failSuccessOperationWriteOnce&&key.startsWith('admin-browser:rollback-operation:')&&value?.state==='SUCCEEDED'){
          failSuccessOperationWriteOnce=false;
          throw new Error('simulated rollback result persistence failure');
        }
        values.set(key,value);
      }),
      delete:vi.fn(async(key:string)=>{values.delete(key);}),
      list:vi.fn(async(options:{prefix?:string}={})=>{
        const prefix=String(options.prefix??'');
        return new Map([...values.entries()].filter(([key])=>key.startsWith(prefix)));
      }),
    },
    getWebSockets:()=>[],
  };
  return{active,values,store:new AdminSyncStore(state as any,{})};
}

function request(path:string,body?:unknown,authenticated=true){
  return new Request('https://internal'+path,{
    method:body===undefined?'GET':'POST',
    headers:{
      ...(authenticated?{'x-mfk-admin-session':TOKEN}:{}),
      ...(body===undefined?{}:{'content-type':'application/json'}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

function rollbackBody(active:any,targetFingerprint:string,operationId='rollback-op-1',reason='回復到上一個已確認版本'){
  return{
    operationId,
    targetFingerprint,
    expectedActiveFingerprint:String(active.fingerprint),
    expectedActivePublishedAt:String(active.publishedAt),
    expectedActiveRevision:Number(active.revision),
    reason,
  };
}

async function json(response:Response){return await response.json() as any;}

describe('Admin rollback-as-new-version seam',()=>{
  it('requires an authenticated Admin browser session',async()=>{
    const h=await harness();
    const response=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',{},false));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'});
  });

  it('requires OWNER or PUBLISH_CONFIG',async()=>{
    const h=await harness({role:'STAFF',permissions:[]});
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next','STAFF',[]));
    const current=h.values.get('active');
    const response=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',rollbackBody(current,h.active.fingerprint)));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_BROWSER_ROLLBACK_FORBIDDEN'});
  });

  it('publishes the archived target snapshot as a new canonical revision',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const before=h.values.get('active');
    const response=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',rollbackBody(before,h.active.fingerprint)));
    expect(response.status).toBe(200);
    const result=await json(response);
    expect(result).toMatchObject({
      state:'ROLLED_BACK_AS_NEW_VERSION',
      operationId:'rollback-op-1',
      targetFingerprint:h.active.fingerprint,
      recoveredFromReadback:false,
    });
    expect(result.active.revision).toBe(Number(before.revision)+1);
    expect(result.active.snapshot).toEqual(snapshot('base'));
    expect(result.active.fingerprint).not.toBe(h.active.fingerprint);
    expect(Date.parse(result.active.publishedAt)).toBeGreaterThan(Date.parse(before.publishedAt));

    const list=await json(await h.store.fetch(request('/admin-browser/versions?storeId=MF01')));
    expect(list.versions.map((row:any)=>row.revision)).toEqual([9,8,7]);
    expect(list.versions.map((row:any)=>row.state)).toEqual(['ACTIVE','ARCHIVED','ARCHIVED']);
  });

  it('fails closed when the expected active version is stale',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const before=h.values.get('active');
    const body=rollbackBody(before,h.active.fingerprint);
    body.expectedActiveFingerprint='stale';
    const response=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_ROLLBACK_BASE_CONFLICT'});
    expect(h.values.get('active').fingerprint).toBe(before.fingerprint);
  });

  it('returns the exact prior result when the same operationId is retried',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const before=h.values.get('active');
    const body=rollbackBody(before,h.active.fingerprint);
    const first=await json(await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body)));
    const afterFirst=h.values.get('active');
    const second=await json(await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body)));
    expect(second).toEqual(first);
    expect(h.values.get('active').fingerprint).toBe(afterFirst.fingerprint);
    expect(h.values.get('active').revision).toBe(afterFirst.revision);
  });

  it('rejects reuse of an operationId for different intent',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const before=h.values.get('active');
    const body=rollbackBody(before,h.active.fingerprint);
    await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body));
    const conflicting={...body,reason:'另一個原因'};
    const response=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',conflicting));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_ROLLBACK_OPERATION_CONFLICT'});
  });

  it('recovers a successful publish from authoritative readback if final operation-result persistence failed',async()=>{
    const h=await harness({failSuccessOperationWriteOnce:true});
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const before=h.values.get('active');
    const body=rollbackBody(before,h.active.fingerprint,'rollback-crash-recovery');
    await expect(h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body))).rejects.toThrow('simulated rollback result persistence failure');
    const landed=h.values.get('active');
    expect(landed.snapshot).toEqual(snapshot('base'));

    const retry=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',body));
    expect(retry.status).toBe(200);
    const recovered=await json(retry);
    expect(recovered).toMatchObject({
      state:'ROLLED_BACK_AS_NEW_VERSION',
      operationId:'rollback-crash-recovery',
      recoveredFromReadback:true,
    });
    expect(h.values.get('active').fingerprint).toBe(landed.fingerprint);
  });

  it('rejects missing history targets and empty reasons',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T02:00:00.000Z','next'));
    const current=h.values.get('active');

    const missing=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',rollbackBody(current,'missing-fingerprint')));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({code:'ADMIN_ROLLBACK_TARGET_NOT_FOUND'});

    const noReason=rollbackBody(current,h.active.fingerprint,'rollback-no-reason','');
    const invalid=await h.store.fetch(request('/admin-browser/versions/rollback?storeId=MF01',noReason));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({code:'ADMIN_ROLLBACK_INPUT_INVALID'});
  });
});
