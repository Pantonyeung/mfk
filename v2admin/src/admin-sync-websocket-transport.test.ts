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
    expect(state.acceptWebSocket).toHaveBeenCalledWith(server,['PORT:SMT']);
    expect(JSON.parse(sent[0]!)).toMatchObject({type:'ADMIN_CONFIG_AVAILABLE',storeId:'MF01',revision:42});
  });

  it('keeps SMM HEAD and WebSocket transport behind the same live staff session',async()=>{
    const sent:string[]=[];
    const client={side:'client'};
    const server={send:(message:string)=>sent.push(message)};
    const active={storeId:'MF01',revision:42,fingerprint:'sha256:config-42',publishedAt:'2026-09-29T10:00:00.000Z'};
    const state={
      acceptWebSocket:vi.fn(),
      storage:{get:vi.fn(async(key:string)=>key==='active'?active:undefined)},
    };
    const store=new AdminSyncStore(state,{});
    const baseHeaders={origin:'https://smm.morefunos.com'};

    const denied=await store.fetch(new Request('https://internal/sync/head?storeId=MF01&port=SMM',{headers:baseHeaders}));
    expect(denied.status).toBe(401);

    vi.stubGlobal('fetch',vi.fn(async()=>({
      ok:true,
      json:async()=>({staffId:'STAFF-1',displayName:'店員一',role:'STAFF'}),
    })));
    const authorizedHeaders={...baseHeaders,'x-mfk-smm-session':'a'.repeat(64)};
    const allowed=await store.fetch(new Request('https://internal/sync/head?storeId=MF01&port=SMM',{headers:authorizedHeaders}));
    expect(allowed.status).toBe(200);

    vi.stubGlobal('WebSocketPair',class{0=client;1=server;});
    vi.stubGlobal('Response',class{
      status:number;webSocket:unknown;body:unknown;headers:Headers;
      constructor(body:unknown,init:any={}){this.body=body;this.status=init.status??200;this.webSocket=init.webSocket;this.headers=new Headers(init.headers);}
    });
    const upgrade:any=await store.fetch(new Request('https://internal/events?storeId=MF01&port=SMM',{
      headers:{...authorizedHeaders,upgrade:'websocket'},
    }));
    expect(upgrade.status).toBe(101);
    expect(upgrade.headers.get('sec-websocket-protocol')).toBe('mfk-smm-sync-v1');
    expect(state.acceptWebSocket).toHaveBeenCalledWith(server,['PORT:SMM']);
    expect(JSON.parse(sent[0]!)).toMatchObject({type:'PORT_HEAD_AVAILABLE',port:'SMM',headSeq:0});
  });

  it('assigns a fresh Cloud canonical time to every distinct formal Admin publish',async()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T01:00:00.000Z'));
    const values=new Map<string,unknown>();
    const sent:string[]=[];
    const state={
      storage:{
        get:vi.fn(async(key:string)=>values.get(key)),
        put:vi.fn(async(key:string,value:unknown)=>{values.set(key,value);}),
        delete:vi.fn(async(key:string)=>{values.delete(key);}),
      },
      getWebSockets:(tag?:string)=>tag==='PORT:SMT'?[{send:(message:string)=>sent.push(message)}]:[],
    };
    const store=new AdminSyncStore(state,{});

    const first=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:23,publishedAt:'2026-09-30T00:00:00.000Z',adminFingerprint:'admin-first',
      snapshot:{catalog:{products:[{id:'first'}]}},
    });
    const firstResult=await store.publishEnvelope(first);
    expect(firstResult.body).toMatchObject({
      state:'PUBLISHED',
      publishRequestFingerprint:first.fingerprint,
      cloudPublishedAt:'2026-09-30T01:00:00.000Z',
      active:{revision:23,publishedAt:'2026-09-30T01:00:00.000Z',adminFingerprint:'admin-first'},
    });

    vi.setSystemTime(new Date('2026-09-30T01:00:10.000Z'));
    const second=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:22,publishedAt:'2026-09-29T23:59:00.000Z',adminFingerprint:'admin-second',
      snapshot:{catalog:{products:[{id:'second'}]}},
    });
    const secondResult=await store.publishEnvelope(second);
    expect(secondResult.body).toMatchObject({
      state:'PUBLISHED',
      publishRequestFingerprint:second.fingerprint,
      cloudPublishedAt:'2026-09-30T01:00:10.000Z',
      active:{revision:22,publishedAt:'2026-09-30T01:00:10.000Z',adminFingerprint:'admin-second'},
    });

    expect(sent.filter(message=>JSON.parse(message).type==='ADMIN_CONFIG_AVAILABLE')).toHaveLength(2);
    expect(sent.filter(message=>JSON.parse(message).type==='PORT_HEAD_AVAILABLE')).toHaveLength(2);
    expect(JSON.parse(sent[0]!)).toMatchObject({type:'ADMIN_CONFIG_AVAILABLE',publishedAt:'2026-09-30T01:00:00.000Z'});
    expect(JSON.parse(sent[2]!)).toMatchObject({type:'ADMIN_CONFIG_AVAILABLE',publishedAt:'2026-09-30T01:00:10.000Z'});

    const active=(secondResult.body as any).active;
    expect(values.get('admin:published:'+active.fingerprint)).toMatchObject({
      publishedAt:'2026-09-30T01:00:10.000Z',
      publishRequestFingerprint:second.fingerprint,
    });

    vi.setSystemTime(new Date('2026-09-30T01:00:20.000Z'));
    const retry=await store.publishEnvelope(second);
    expect(retry.body).toMatchObject({
      state:'IDEMPOTENT',
      publishRequestFingerprint:second.fingerprint,
      cloudPublishedAt:'2026-09-30T01:00:10.000Z',
    });
    expect(sent).toHaveLength(4);
  });

  it('delivers a one-Product Admin change as KEETA Delta and never calls full-menu sync',async()=>{
    const values=new Map<string,unknown>();
    const tasks:Promise<unknown>[]=[];
    const providerRequests:Request[]=[];
    let providerAppliedSeq=0;
    const state={
      storage:{
        get:async(key:string)=>values.get(key),
        put:async(key:string,value:unknown)=>{values.set(key,value);},
        delete:async(key:string)=>{values.delete(key);},
      },
      getWebSockets:()=>[],
      waitUntil:(task:Promise<unknown>)=>tasks.push(task),
    };
    const env={KEETA_RUNTIME:{
      idFromName:()=>({}),
      get:()=>({fetch:async(request:Request)=>{
        providerRequests.push(request.clone());
        const path=new URL(request.url).pathname;
        if(path==='/internal/provider/status')return new Response(JSON.stringify({providerAppliedSeq}),{headers:{'content-type':'application/json'}});
        if(path==='/internal/provider/delta'){
          const body=await request.json() as {batch:{toInclusive:number}};
          providerAppliedSeq=body.batch.toInclusive;
          return new Response(JSON.stringify({state:'APPLIED',providerAppliedSeq}),{headers:{'content-type':'application/json'}});
        }
        throw new Error('UNEXPECTED_KEETA_ROUTE:'+path);
      }}),
    }};
    const store=new AdminSyncStore(state as never,env as never);
    const snapshot=(price:string,receiptEnabled=true)=>({
      catalog:{
        categories:[{id:'cat',name:'主食',position:10,active:true}],
        products:[{id:'p1',productCode:'SKU-P1',name:'商品一',categoryId:'cat',active:true,basePrice:price,takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,modifierGroupIds:[]}],
      },
      optionCenter:{sets:[],productLinks:[]},
      printRules:{receipt:{enabled:receiptEnabled}},
    });
    await store.publishEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:1,publishedAt:'2026-10-01T00:00:00.000Z',adminFingerprint:'admin-1',snapshot:snapshot('42.00'),
    }));
    await Promise.all(tasks.splice(0));
    providerRequests.length=0;

    await store.publishEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:2,publishedAt:'2026-10-01T00:01:00.000Z',adminFingerprint:'admin-2',snapshot:snapshot('43.00'),
    }));
    await Promise.all(tasks.splice(0));

    const deltaRequest=providerRequests.find(request=>new URL(request.url).pathname==='/internal/provider/delta');
    expect(deltaRequest).toBeDefined();
    const delivered=await deltaRequest!.json() as {batch:{changes:Array<{entityType:string;entityId:string}>}};
    expect(delivered.batch.changes).toEqual([expect.objectContaining({entityType:'KEETA_SPU',entityId:'SPU:SKU-P1'})]);
    expect(providerRequests.some(request=>new URL(request.url).pathname==='/admin/menu/sync')).toBe(false);

    const secondCommitChanges=[...values.values()].filter((value):value is Record<string,unknown>=>
      Boolean(value)&&typeof value==='object'&&(value as Record<string,unknown>).schema==='MFK_PORT_CHANGE_V1'&&
      (value as Record<string,unknown>).sourceCommitSeq===2,
    );
    expect(secondCommitChanges.map(change=>`${change.port}:${change.entityType}:${change.entityId}`).sort()).toEqual([
      'CUSTOMER:CUSTOMER_PRODUCT:p1',
      'KEETA:KEETA_SPU:SPU:SKU-P1',
      'SMM:SMM_PRODUCT:p1',
      'SMT:PRODUCT:p1',
    ]);

    const beforeIrrelevant=Object.fromEntries(['SMT','SMM','CUSTOMER','KEETA'].map(port=>[
      port,(values.get('sync:head:'+port) as {headSeq:number}).headSeq,
    ]));
    providerRequests.length=0;
    await store.publishEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:3,publishedAt:'2026-10-01T00:02:00.000Z',adminFingerprint:'admin-3',snapshot:snapshot('43.00',false),
    }));
    await Promise.all(tasks.splice(0));
    const afterIrrelevant=Object.fromEntries(['SMT','SMM','CUSTOMER','KEETA'].map(port=>[
      port,(values.get('sync:head:'+port) as {headSeq:number}).headSeq,
    ]));
    expect(afterIrrelevant.SMT).toBeGreaterThan(beforeIrrelevant.SMT);
    expect(afterIrrelevant).toMatchObject({
      SMM:beforeIrrelevant.SMM,CUSTOMER:beforeIrrelevant.CUSTOMER,KEETA:beforeIrrelevant.KEETA,
    });
    expect(providerRequests.some(request=>new URL(request.url).pathname==='/internal/provider/delta')).toBe(false);
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
    expect(messageHandler).toContain("row.type==='PORT_HEAD_AVAILABLE'&&row.port==='SMT'");
    expect(messageHandler).toContain('void reconcileSmtCheckpointedSync()');
    expect(messageHandler).not.toContain('void fetchAndApplyAdminConfig()');
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
