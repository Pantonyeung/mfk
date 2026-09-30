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

  it('accepts every formal publish by Cloud Hong Kong time even when R goes 23 → 6',async()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const values=new Map<string,unknown>();
    const sent:string[]=[];
    const state={
      storage:{
        get:vi.fn(async(key:string)=>values.get(key)),
        put:vi.fn(async(key:string,value:unknown)=>{values.set(key,value);}),
        list:vi.fn(async({prefix}:{prefix:string})=>new Map([...values].filter(([key])=>key.startsWith(prefix)))),
      },
      getWebSockets:()=>[{send:(message:string)=>sent.push(message)}],
    };
    const store=new AdminSyncStore(state,{});

    const r23=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:23,publishedAt:'2020-01-01T00:00:00.000Z',adminFingerprint:'content-r23',
      snapshot:{catalog:{products:[{id:'r23'}]}},
    });
    const first=await store.publishEnvelope(r23);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      state:'PUBLISHED',
      cloudPublishedAt:'2026-09-30T09:00:00.000+08:00',
      active:{revision:23,publishedAt:'2026-09-30T09:00:00.000+08:00',adminFingerprint:'content-r23'},
      publishRequestFingerprint:r23.fingerprint,
    });

    vi.setSystemTime(new Date('2026-09-30T01:01:00.000Z'));
    const r6=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:6,publishedAt:'2010-01-01T00:00:00.000Z',adminFingerprint:'content-r6',
      snapshot:{catalog:{products:[{id:'r6'}]}},
    });
    const second=await store.publishEnvelope(r6);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      state:'PUBLISHED',
      cloudPublishedAt:'2026-09-30T09:01:00.000+08:00',
      active:{revision:6,publishedAt:'2026-09-30T09:01:00.000+08:00',adminFingerprint:'content-r6'},
      publishRequestFingerprint:r6.fingerprint,
    });
    expect(JSON.parse(sent.at(-1)!)).toMatchObject({
      type:'ADMIN_CONFIG_AVAILABLE',
      revision:6,
      publishedAt:'2026-09-30T09:01:00.000+08:00',
    });

    vi.setSystemTime(new Date('2026-09-30T01:02:00.000Z'));
    const retry=await store.publishEnvelope(r6);
    expect(retry.body).toMatchObject({
      state:'IDEMPOTENT',
      cloudPublishedAt:'2026-09-30T09:01:00.000+08:00',
      publishRequestFingerprint:r6.fingerprint,
    });
    expect(sent).toHaveLength(2);

    const history=await store.fetch(new Request(
      'https://internal/published-since?after='+encodeURIComponent('2026-09-30T08:59:00.000+08:00'),
      {method:'GET'},
    ));
    expect(history.status).toBe(200);
    const body=await history.json() as {items?:Array<{revision:number;publishedAt:string}>};
    expect(body.items?.map(row=>[row.revision,row.publishedAt])).toEqual([
      [23,'2026-09-30T09:00:00.000+08:00'],
      [6,'2026-09-30T09:01:00.000+08:00'],
    ]);
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
    expect(messageHandler).not.toContain('revision>');
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
