import {describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import worker,{AdminSyncStore} from '../worker.ts';

const STORE_ID='MF01';
const BASE_PUBLISHED_AT='2026-10-01T01:00:00.000Z';
const TOKEN='a'.repeat(64);

function adminSnapshot(productId='base'){
  return{
    catalog:{categories:[],products:[{id:productId}],modifierGroups:[],combos:[],comboPools:[]},
    staffAuth:{staff:[{
      staffId:'owner-1',loginId:'owner',name:'Owner',role:'OWNER',scope:'STORE',active:true,adminLogin:true,
      permissions:['PUBLISH_CONFIG'],
      pinVerifier:{algorithm:'PBKDF2-SHA256',iterations:100000,saltHex:'aa',hashHex:'b'.repeat(64)},
    }]},
  };
}

function canonical(revision=7,publishedAt=BASE_PUBLISHED_AT,productId='base'){
  return createMfkAdminConfigEnvelope({
    storeId:STORE_ID,
    revision,
    publishedAt,
    adminFingerprint:'admin-'+productId,
    snapshot:adminSnapshot(productId),
  });
}

async function sessionKey(){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(TOKEN));
  return 'admin-browser:session:'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

async function harness(options:{role?:string;permissions?:string[]}={}){
  const active=canonical();
  const snapshot=structuredClone(active.snapshot) as ReturnType<typeof adminSnapshot>;
  snapshot.staffAuth.staff[0]!.role=options.role??'OWNER';
  snapshot.staffAuth.staff[0]!.permissions=options.permissions??['PUBLISH_CONFIG'];
  const seeded={...active,snapshot};
  const values=new Map<string,any>([['active',seeded]]);
  values.set(await sessionKey(),{
    staffId:'owner-1',createdAt:'2026-10-01T00:00:00.000Z',lastSeenAt:'2026-10-01T00:00:00.000Z',expiresAt:'2036-10-01T00:00:00.000Z',
  });
  let onGet:((key:string,values:Map<string,any>)=>void|Promise<void>)|undefined;
  let failPublishWrite=false;
  const sent:string[]=[];
  const state={
    storage:{
      get:vi.fn(async(key:string)=>{await onGet?.(key,values);return values.get(key);}),
      put:vi.fn(async(key:string,value:any)=>{
        if(failPublishWrite&&key==='active')throw new Error('simulated publish write failure');
        values.set(key,value);
      }),
      delete:vi.fn(async(key:string)=>{values.delete(key);}),
    },
    getWebSockets:()=>[{send:(message:string)=>sent.push(message)}],
  };
  return{
    active:seeded,
    values,
    sent,
    state,
    store:new AdminSyncStore(state as any,{}),
    setOnGet:(hook:typeof onGet)=>{onGet=hook;},
    failNextPublish:()=>{failPublishWrite=true;},
    reopen:()=>new AdminSyncStore(state as any,{}),
  };
}

function request(path:string,method='GET',body?:unknown,authenticated=true){
  return new Request('https://internal'+path,{
    method,
    headers:{
      ...(authenticated?{'x-mfk-admin-session':TOKEN}:{}),
      ...(body===undefined?{}:{'content-type':'application/json'}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

function saveBody(active:any,snapshot:unknown=adminSnapshot('draft')){
  return{baseFingerprint:active.fingerprint,basePublishedAt:active.publishedAt,snapshot};
}

async function json(response:Response){return await response.json() as any;}

describe('Admin V3 formal server Draft seam',()=>{
  it('forwards public Draft routes with exact store scope and PUT/DELETE CORS',async()=>{
    let forwarded:Request|undefined;
    const env={ADMIN_SYNC:{
      idFromName:vi.fn((storeId:string)=>storeId),
      get:vi.fn(()=>({fetch:vi.fn(async(request:Request)=>{forwarded=request;return new Response('{}');})})),
    }};
    const preflight=await worker.fetch(new Request('https://admin.morefunos.com/api/admin-browser/draft?storeId=MF02',{
      method:'OPTIONS',headers:{origin:'https://admin.morefunos.com'},
    }),env as any);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(preflight.headers.get('access-control-allow-methods')).toContain('DELETE');

    await worker.fetch(new Request('https://admin.morefunos.com/api/admin-browser/draft?storeId=MF02'),env as any);
    expect(env.ADMIN_SYNC.idFromName).toHaveBeenCalledWith('MF02');
    expect(forwarded?.url).toBe('https://admin.morefunos.com/admin-browser/draft?storeId=MF02');
  });

  it.each([
    ['GET','/admin-browser/draft'],
    ['PUT','/admin-browser/draft'],
    ['DELETE','/admin-browser/draft'],
    ['POST','/admin-browser/draft/publish'],
  ])('rejects unauthorized %s %s',async(method,path)=>{
    const {store}=await harness();
    const response=await store.fetch(request(path,method,method==='GET'?undefined:{},false));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'});
  });

  it('rejects a valid session used against the wrong store scope',async()=>{
    const {store}=await harness();
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF02'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_BROWSER_STORE_FORBIDDEN'});
  });

  it('returns ADMIN_DRAFT_NOT_FOUND when no server Draft exists',async()=>{
    const {store}=await harness();
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01'));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({code:'ADMIN_DRAFT_NOT_FOUND'});
  });

  it('saves the first Draft only against the exact canonical base',async()=>{
    const {active,store}=await harness();
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(active)));
    expect(response.status).toBe(200);
    const draft=await json(response);
    expect(draft).toMatchObject({
      schema:'MFK_ADMIN_DRAFT_V1',storeId:STORE_ID,baseFingerprint:active.fingerprint,
      basePublishedAt:active.publishedAt,draftRevision:1,updatedByStaffId:'owner-1',snapshot:adminSnapshot('draft'),
    });
    expect(draft.draftId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isFinite(Date.parse(draft.updatedAt))).toBe(true);
  });

  it('rejects a stale fingerprint on first save',async()=>{
    const {active,store}=await harness();
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{...saveBody(active),baseFingerprint:'stale'}));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_BASE_CONFLICT'});
  });

  it('rejects a stale publishedAt on first save',async()=>{
    const {active,store}=await harness();
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{...saveBody(active),basePublishedAt:'2026-09-30T00:00:00.000Z'}));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_BASE_CONFLICT'});
  });

  it('updates with the exact server draftRevision and increments it',async()=>{
    const {active,store}=await harness();
    const created=await json(await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(active))));
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{
      ...saveBody(active,adminSnapshot('updated')),expectedDraftRevision:created.draftRevision,
    }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({draftId:created.draftId,draftRevision:2,snapshot:adminSnapshot('updated')});
  });

  it('rejects an update with stale draftRevision',async()=>{
    const {active,store}=await harness();
    await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(active)));
    const response=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{
      ...saveBody(active),expectedDraftRevision:0,
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
  });

  it('reads the same authoritative Draft after a new server instance is opened',async()=>{
    const h=await harness();
    const saved=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.reopen().fetch(request('/admin-browser/draft?storeId=MF01'));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual(saved);
  });

  it('rejects a stale second-tab save instead of last-write-wins',async()=>{
    const {active,store}=await harness();
    const first=await json(await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(active))));
    const tabA=await json(await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{
      ...saveBody(active,adminSnapshot('tab-a')),expectedDraftRevision:first.draftRevision,
    })));
    const tabB=await store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',{
      ...saveBody(active,adminSnapshot('tab-b')),expectedDraftRevision:first.draftRevision,
    }));
    expect(tabA.draftRevision).toBe(2);
    expect(tabB.status).toBe(409);
    await expect(tabB.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
  });

  it('discards only the exact draftId and draftRevision',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft?storeId=MF01','DELETE',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({state:'DISCARDED'});
    expect(h.values.has('admin-browser:draft')).toBe(false);
  });

  it('rejects discard with a stale draftRevision',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft?storeId=MF01','DELETE',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision+1,
    }));
    expect(response.status).toBe(409);
    expect(h.values.has('admin-browser:draft')).toBe(true);
  });

  it('fails closed when discard names the wrong draftId',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft?storeId=MF01','DELETE',{
      draftId:'wrong',expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(409);
    expect(h.values.has('admin-browser:draft')).toBe(true);
  });

  it('publishes the exact Draft through the existing canonical writer',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(200);
    const body=await json(response);
    expect(body).toMatchObject({state:'PUBLISHED',active:{storeId:STORE_ID,snapshot:adminSnapshot('draft')}});
    expect(h.sent).toHaveLength(1);
  });

  it('rejects publish with stale draftRevision',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision+1,
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
  });

  it('fails closed when publish names the wrong draftId',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:'wrong',expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_ID_CONFLICT'});
    expect(h.values.has('admin-browser:draft')).toBe(true);
  });

  it('rejects publish when canonical changed after Draft creation',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    h.values.set('active',canonical(8,'2026-10-01T02:00:00.000Z','other-publish'));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({code:'ADMIN_DRAFT_BASE_CONFLICT'});
  });

  it('rechecks the base at the final canonical write boundary',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const changed=canonical(8,'2026-10-01T02:00:00.000Z','racing-publish');
    let injected=false;
    h.setOnGet((key,values)=>{
      if(key==='activeMeta'&&!injected){injected=true;values.set('active',changed);}
    });
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(409);
    expect((h.values.get('active') as any).fingerprint).toBe(changed.fingerprint);
    expect(h.values.has('admin-browser:draft')).toBe(true);
  });

  it('clears the Draft only after successful publish',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(h.values.has('admin-browser:draft')).toBe(false);
  });

  it('preserves the Draft on canonical base conflict',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    h.values.set('active',canonical(8,'2026-10-01T02:00:00.000Z','other-publish'));
    await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(h.values.get('admin-browser:draft')).toEqual(draft);
  });

  it('preserves an incomplete Draft when publish validation fails',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active,{unfinished:true}))));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(400);
    expect(h.values.get('admin-browser:draft')).toEqual(draft);
  });

  it('preserves the Draft when the canonical publish write fails',async()=>{
    const h=await harness();
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    h.failNextPublish();
    await expect(h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }))).rejects.toThrow('simulated publish write failure');
    expect(h.values.get('admin-browser:draft')).toEqual(draft);
  });

  it('keeps the existing admin-browser publish contract working',async()=>{
    const h=await harness();
    const envelope=canonical(8,'2026-10-01T01:30:00.000Z','legacy-route');
    const response=await h.store.fetch(request('/admin-browser/publish','POST',envelope));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({state:'PUBLISHED',active:{adminFingerprint:'admin-legacy-route'}});
  });

  it('requires OWNER or PUBLISH_CONFIG for publish-from-Draft',async()=>{
    const h=await harness({role:'STAFF',permissions:[]});
    const draft=await json(await h.store.fetch(request('/admin-browser/draft?storeId=MF01','PUT',saveBody(h.active))));
    const response=await h.store.fetch(request('/admin-browser/draft/publish?storeId=MF01','POST',{
      draftId:draft.draftId,expectedDraftRevision:draft.draftRevision,
    }));
    expect(response.status).toBe(403);
    expect(h.values.has('admin-browser:draft')).toBe(true);
  });
});
