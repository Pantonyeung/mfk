import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdminSyncStore,adminSyncOuterResponse} from '../worker.ts';
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
    expect(messageHandler).not.toMatch(/location\.reload|location\.replace/);
  });
});
