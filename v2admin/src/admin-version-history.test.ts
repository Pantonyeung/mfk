import {describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {AdminSyncStore} from '../worker.ts';

const STORE_ID='MF01';
const TOKEN='a'.repeat(64);

function snapshot(productId:string){
  return{
    catalog:{categories:[],products:[{id:productId}],modifierGroups:[],combos:[],comboPools:[]},
    staffAuth:{staff:[{
      staffId:'owner-1',loginId:'owner',name:'Owner',role:'OWNER',scope:'STORE',active:true,adminLogin:true,
      permissions:['PUBLISH_CONFIG'],
      pinVerifier:{algorithm:'PBKDF2-SHA256',iterations:100000,saltHex:'aa',hashHex:'b'.repeat(64)},
    }]},
  };
}

function envelope(revision:number,publishedAt:string,productId:string){
  return createMfkAdminConfigEnvelope({
    storeId:STORE_ID,
    revision,
    publishedAt,
    adminFingerprint:'admin-'+productId,
    snapshot:snapshot(productId),
  });
}

async function sessionKey(){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(TOKEN));
  return 'admin-browser:session:'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

async function harness(){
  const active=envelope(7,'2026-10-01T01:00:00.000Z','base');
  const values=new Map<string,any>([['active',active]]);
  values.set(await sessionKey(),{
    staffId:'owner-1',
    createdAt:'2026-10-01T00:00:00.000Z',
    lastSeenAt:'2026-10-01T00:00:00.000Z',
    expiresAt:'2036-10-01T00:00:00.000Z',
  });
  const state={
    storage:{
      get:vi.fn(async(key:string)=>values.get(key)),
      put:vi.fn(async(key:string,value:any)=>{values.set(key,value);}),
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

function request(path:string,authenticated=true){
  return new Request('https://internal'+path,{
    method:'GET',
    headers:authenticated?{'x-mfk-admin-session':TOKEN}:{},
  });
}

async function body(response:Response){return await response.json() as any;}

describe('Admin immutable canonical version history seam',()=>{
  it('requires a current Admin browser session',async()=>{
    const h=await harness();
    const response=await h.store.fetch(request('/admin-browser/versions?storeId=MF01',false));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'});
  });

  it('returns only the current canonical before a later publish and does not leak snapshot data',async()=>{
    const h=await harness();
    const response=await h.store.fetch(request('/admin-browser/versions?storeId=MF01'));
    expect(response.status).toBe(200);
    const result=await body(response);
    expect(result).toMatchObject({
      schema:'MFK_ADMIN_VERSION_LIST_V1',
      storeId:STORE_ID,
      activeFingerprint:h.active.fingerprint,
      historyCompleteness:'FORWARD_ONLY',
    });
    expect(result.versions).toEqual([{
      revision:7,
      publishedAt:h.active.publishedAt,
      fingerprint:h.active.fingerprint,
      adminFingerprint:h.active.adminFingerprint,
      state:'ACTIVE',
    }]);
    expect(JSON.stringify(result)).not.toContain('"snapshot"');
  });

  it('preserves the previous full canonical snapshot before a distinct publish replaces active',async()=>{
    const h=await harness();
    const result=await h.store.publishEnvelope(envelope(8,'2026-10-01T01:30:00.000Z','next'));
    expect(result.status).toBe(200);
    expect(result.body.state).toBe('PUBLISHED');

    const recorded=h.values.get('admin-browser:version:'+h.active.fingerprint);
    expect(recorded).toMatchObject({
      schema:'MFK_ADMIN_VERSION_V1',
      storeId:STORE_ID,
      revision:7,
      publishedAt:h.active.publishedAt,
      fingerprint:h.active.fingerprint,
      adminFingerprint:h.active.adminFingerprint,
      snapshot:snapshot('base'),
    });

    const list=await body(await h.store.fetch(request('/admin-browser/versions?storeId=MF01')));
    expect(list.versions).toHaveLength(2);
    expect(list.versions[0]).toMatchObject({revision:8,state:'ACTIVE'});
    expect(list.versions[1]).toMatchObject({revision:7,state:'ARCHIVED'});
  });

  it('keeps forward history across multiple distinct publishes in newest-first order',async()=>{
    const h=await harness();
    await h.store.publishEnvelope(envelope(8,'2026-10-01T01:30:00.000Z','r8'));
    await h.store.publishEnvelope(envelope(9,'2026-10-01T02:00:00.000Z','r9'));

    const list=await body(await h.store.fetch(request('/admin-browser/versions?storeId=MF01')));
    expect(list.versions.map((row:any)=>row.revision)).toEqual([9,8,7]);
    expect(list.versions.map((row:any)=>row.state)).toEqual(['ACTIVE','ARCHIVED','ARCHIVED']);
    expect(h.values.get('admin-browser:version:'+h.active.fingerprint)?.snapshot).toEqual(snapshot('base'));
  });

  it('does not create a duplicate history entry for an idempotent publish retry',async()=>{
    const h=await harness();
    const next=envelope(8,'2026-10-01T01:30:00.000Z','same');
    const first=await h.store.publishEnvelope(next);
    const second=await h.store.publishEnvelope(next);
    expect(first.body.state).toBe('PUBLISHED');
    expect(second.body.state).toBe('IDEMPOTENT');

    const versionKeys=[...h.values.keys()].filter(key=>key.startsWith('admin-browser:version:'));
    expect(versionKeys).toHaveLength(1);
    const list=await body(await h.store.fetch(request('/admin-browser/versions?storeId=MF01')));
    expect(list.versions).toHaveLength(2);
  });

  it('fails closed for a store scope mismatch',async()=>{
    const h=await harness();
    const response=await h.store.fetch(request('/admin-browser/versions?storeId=MF02'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_BROWSER_STORE_FORBIDDEN'});
  });
});
