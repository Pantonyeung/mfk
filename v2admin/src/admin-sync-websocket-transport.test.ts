import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdminSyncStore,adminSyncOuterResponse} from '../worker.ts';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readFileSync} from 'node:fs';

const NativeResponse=globalThis.Response;

afterEach(()=>{
  vi.unstubAllGlobals();
});

describe('Admin realtime transport recovery',()=>{
  it('passes the Durable Object WebSocket upgrade response through unchanged',()=>{
    const webSocket={readyState:1};
    const upgrade={status:101,headers:new Headers(),body:null,webSocket};
    const request=new Request('https://admin.morefunos.com/api/admin-sync/events?storeId=MF01',{headers:{upgrade:'websocket',origin:'https://appassets.androidplatform.net'}});

    expect(adminSyncOuterResponse('/api/admin-sync/events',upgrade,request)).toBe(upgrade);
    expect((adminSyncOuterResponse('/api/admin-sync/events',upgrade,request) as typeof upgrade).webSocket).toBe(webSocket);
  });

  it('opens a connection and immediately delivers ADMIN_CONFIG_AVAILABLE',async()=>{
    const sent:string[]=[];
    const client={side:'client'};
    const server={send:(message:string)=>sent.push(message)};
    vi.stubGlobal('WebSocketPair',class{0=client;1=server;});
    vi.stubGlobal('Response',class{
      status:number;webSocket:unknown;body:unknown;headers:Headers;
      constructor(body:unknown,init:any={}){this.body=body;this.status=init.status??200;this.webSocket=init.webSocket;this.headers=new Headers(init.headers);}
    });
    const active={storeId:'MF01',revision:42,fingerprint:'sha256:config-42',publishedAt:'2026-09-29T10:00:00.000Z'};
    const state={
      acceptWebSocket:vi.fn(),
      storage:{get:vi.fn(async(key:string)=>key==='active'?active:undefined)},
    };
    const store=new AdminSyncStore(state,{});

    const response:any=await store.fetch(new Request('https://internal/events',{headers:{upgrade:'websocket'}}));

    expect(response.status).toBe(101);
    expect(response.webSocket).toBe(client);
    expect(state.acceptWebSocket).toHaveBeenCalledWith(server);
    expect(JSON.parse(sent[0]!)).toMatchObject({type:'ADMIN_CONFIG_AVAILABLE',storeId:'MF01',revision:42});
  });

  it('makes Cloudflare the canonical publish sequencer instead of trusting browser-local Rxx',async()=>{
    const values=new Map<string,unknown>();
    const old=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:23,
      publishedAt:'2026-09-29T10:00:00.000Z',
      adminFingerprint:'admin-old',
      snapshot:{catalog:{products:[{id:'OLD'}]}},
    });
    values.set('active',old);
    values.set('activeMeta',{acceptedAt:'2026-09-29T10:00:00.500Z'});
    const sent:string[]=[];
    const state={
      storage:{
        get:vi.fn(async(key:string)=>values.get(key)),
        put:vi.fn(async(key:string,value:unknown)=>{values.set(key,value);}),
      },
      getWebSockets:()=>[{send:(message:string)=>sent.push(message)}],
    };
    const store=new AdminSyncStore(state,{});
    const fromStaleBrowser=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:22,
      publishedAt:'2026-09-29T09:59:00.000Z',
      adminFingerprint:'admin-new-data',
      snapshot:{catalog:{products:[{id:'NEW'}]}},
    });

    const result:any=await store.publishEnvelope(fromStaleBrowser);
    const active:any=result.body.active;

    expect(result.status).toBe(200);
    expect(result.body.state).toBe('PUBLISHED');
    expect(active.revision).toBe(24);
    expect(active.adminFingerprint).toBe('admin-new-data');
    expect(active.snapshot.catalog.products[0].id).toBe('NEW');
    expect(Date.parse(active.publishedAt)).toBeGreaterThan(Date.parse('2026-09-29T10:00:00.500Z'));
    expect(active.fingerprint).not.toBe(fromStaleBrowser.fingerprint);
    expect(JSON.parse(sent[0]!)).toMatchObject({
      type:'ADMIN_CONFIG_AVAILABLE',
      revision:24,
      fingerprint:active.fingerprint,
      publishedAt:active.publishedAt,
    });
  });

  it('treats the same Admin data fingerprint as idempotent without creating a later publish',async()=>{
    const active=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:40,
      publishedAt:'2026-09-29T11:00:00.000Z',
      adminFingerprint:'same-admin-data',
      snapshot:{catalog:{products:[]}},
    });
    const state={
      storage:{get:vi.fn(async(key:string)=>key==='active'?active:undefined),put:vi.fn()},
      getWebSockets:()=>[],
    };
    const store=new AdminSyncStore(state,{});
    const duplicate=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:1,
      publishedAt:'2026-09-29T01:00:00.000Z',
      adminFingerprint:'same-admin-data',
      snapshot:{catalog:{products:[]}},
    });

    const result:any=await store.publishEnvelope(duplicate);

    expect(result).toMatchObject({status:200,body:{state:'IDEMPOTENT',active}});
    expect(state.storage.put).not.toHaveBeenCalled();
  });

  it('does not let a reused browser fingerprint hide different Admin data',async()=>{
    const active=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:5,
      publishedAt:'2026-09-29T12:00:00.000Z',
      adminFingerprint:'collision-like-fingerprint',
      snapshot:{catalog:{products:[{id:'A'}]}},
    });
    const values=new Map<string,unknown>([['active',active],['activeMeta',{acceptedAt:'2026-09-29T12:00:00.000Z'}]]);
    const state={
      storage:{
        get:vi.fn(async(key:string)=>values.get(key)),
        put:vi.fn(async(key:string,value:unknown)=>{values.set(key,value);}),
      },
      getWebSockets:()=>[],
    };
    const store=new AdminSyncStore(state,{});
    const changed=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:1,
      publishedAt:'2026-09-29T01:00:00.000Z',
      adminFingerprint:'collision-like-fingerprint',
      snapshot:{catalog:{products:[{id:'B'}]}},
    });

    const result:any=await store.publishEnvelope(changed);

    expect(result.body.state).toBe('PUBLISHED');
    expect(result.body.active.revision).toBe(6);
    expect(result.body.active.snapshot.catalog.products[0].id).toBe('B');
  });

  it('keeps active HTTP response wrapping and CORS behavior',async()=>{
    vi.stubGlobal('Response',NativeResponse);
    const upstream=new NativeResponse(JSON.stringify({revision:42}),{headers:{'content-type':'application/json'}});
    const request=new Request('https://admin.morefunos.com/api/admin-sync/active?storeId=MF01',{headers:{origin:'https://appassets.androidplatform.net'}});

    const response=adminSyncOuterResponse('/api/admin-sync/active',upstream,request);

    expect(response).not.toBe(upstream);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://appassets.androidplatform.net');
    await expect(response.json()).resolves.toEqual({revision:42});
  });

  it('uses the doorbell to fetch current config without page refresh',()=>{
    const client=readFileSync(new URL('../../v2local/src/runtime/admin-config-sync.ts',import.meta.url),'utf8');
    const messageHandler=client.slice(client.indexOf("socket.addEventListener('message'"),client.indexOf("socket.addEventListener('close'"));
    expect(messageHandler).toContain("row.type==='ADMIN_CONFIG_AVAILABLE'");
    expect(messageHandler).toContain('void fetchAndApplyAdminConfig()');
    expect(messageHandler).not.toContain('Number(row.revision)>current.revision');
    expect(messageHandler).not.toMatch(/location\.reload|location\.replace/);
  });
});
