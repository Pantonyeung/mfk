import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdminSyncStore,adminSyncOuterResponse} from '../worker.ts';
import {readFileSync} from 'node:fs';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';

const NativeResponse=globalThis.Response;

afterEach(()=>{
  vi.useRealTimers();
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

  it('accepts a newer publish time even when the diagnostic revision goes backwards',async()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const values=new Map<string,unknown>();
    const sent:string[]=[];
    const state={
      storage:{
        get:vi.fn(async(key:string)=>values.get(key)),
        put:vi.fn(async(key:string,value:unknown)=>{values.set(key,value);}),
      },
      getWebSockets:()=>[{send:(message:string)=>sent.push(message)}],
    };
    const store=new AdminSyncStore(state,{});
    const oldEnvelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:23,publishedAt:'2026-09-30T00:00:00.000Z',adminFingerprint:'admin-old',
      snapshot:{catalog:{products:[{id:'old'}]}},
    });
    const oldResult=await store.publishEnvelope(oldEnvelope);
    expect(oldResult.status).toBe(200);
    expect(oldResult.body).toMatchObject({state:'PUBLISHED',cloudPublishedAt:'2026-09-30T09:00:00.000+08:00',active:{publishedAt:'2026-09-30T09:00:00.000+08:00'}});

    vi.setSystemTime(new Date('2026-09-30T01:01:00.000Z'));
    const newerEnvelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:22,publishedAt:'2026-09-30T00:30:00.000Z',adminFingerprint:'admin-new',
      snapshot:{catalog:{products:[{id:'new'}]}},
    });
    const newerResult=await store.publishEnvelope(newerEnvelope);
    expect(newerResult.status).toBe(200);
    expect(newerResult.body).toMatchObject({
      state:'PUBLISHED',
      cloudPublishedAt:'2026-09-30T09:01:00.000+08:00',
      active:{revision:22,publishedAt:'2026-09-30T09:01:00.000+08:00',adminFingerprint:'admin-new'},
    });
    expect(JSON.parse(sent.at(-1)!)).toMatchObject({type:'ADMIN_CONFIG_AVAILABLE',revision:22,publishedAt:'2026-09-30T09:01:00.000+08:00'});

    vi.setSystemTime(new Date('2026-09-30T01:02:00.000Z'));
    const retry=await store.publishEnvelope(newerEnvelope);
    expect(retry.body).toMatchObject({state:'IDEMPOTENT',cloudPublishedAt:'2026-09-30T09:01:00.000+08:00'});
    expect(sent).toHaveLength(2);
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
    expect(messageHandler).not.toContain("Date.parse(String(row.publishedAt||''))");
    expect(messageHandler).not.toMatch(/location\.reload|location\.replace/);
  });

  it('uses event-driven reconcile on resume without interval polling',()=>{
    const client=readFileSync(new URL('../../v2local/src/runtime/admin-config-sync.ts',import.meta.url),'utf8');
    expect(client).toContain("window.addEventListener('focus',onFocus)");
    expect(client).toContain("window.addEventListener('pageshow',onPageShow)");
    expect(client).toContain("document.addEventListener('visibilitychange',onVisibility)");
    expect(client).not.toMatch(/setInterval\s*\(/);
  });
});
