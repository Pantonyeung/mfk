import {describe,expect,it,vi} from 'vitest';
import {
  assessKeetaRuntimeReadiness,
  buildKeetaRuntimeSignaturePreimage,
  signKeetaRuntimeParams,
} from '../keeta-runtime.ts';

describe('Keeta live edge runtime',()=>{
  it('preserves the BANKED official signature ordering/serialization contract',async()=>{
    const url='https://open.mykeeta.com/api/open/product/shopcategory/update';
    const shopCategory=JSON.stringify({id:123,name:'test',type:0,description:null});
    const params={
      appId:123,
      timestamp:1682566749,
      accessToken:'abc',
      shopId:'123',
      shopCategory,
      sig:'excluded',
    };
    const preimage=buildKeetaRuntimeSignaturePreimage(url,params,'abc');
    expect(preimage).toBe(
      url+'?accessToken=abc&appId=123&shopCategory='+shopCategory+'&shopId=123&timestamp=1682566749abc',
    );
    const signed=await signKeetaRuntimeParams(url,params,'abc');
    expect(signed.sig).toBe('48eb6d562bb0673e3db753831f032be237fc19d1e5c33fcb5386d89c0eebca86');
  });

  it('fails closed until all live runtime bindings are present',()=>{
    const empty=assessKeetaRuntimeReadiness({});
    expect(empty.ready).toBe(false);
    expect(empty.missing).toEqual([
      'KEETA_APP_ID',
      'KEETA_APP_SECRET',
      'KEETA_TOKEN_ENCRYPTION_KEY',
      'KEETA_PROVIDER_SHOP_ID',
    ]);
    expect(empty.config.redirectUri).toBe('https://admin.morefunos.com/api/keeta/oauth/callback');

    const key=Buffer.alloc(32,7).toString('base64');
    const ready=assessKeetaRuntimeReadiness({
      KEETA_APP_ID:'123',
      KEETA_APP_SECRET:'secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'456',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    });
    expect(ready.ready).toBe(true);
    expect(ready.missing).toEqual([]);
    expect(ready.config.providerShopConfigured).toBe(true);
  });

  it('rejects invalid encryption-key material before authorization can start',()=>{
    const result=assessKeetaRuntimeReadiness({
      KEETA_APP_ID:'123',
      KEETA_APP_SECRET:'secret',
      KEETA_TOKEN_ENCRYPTION_KEY:'not-a-32-byte-key',
      KEETA_PROVIDER_SHOP_ID:'456',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('KEETA_TOKEN_ENCRYPTION_KEY');
  });

  it('serves POST admin status before OAuth token exists',async()=>{
    const key=Buffer.alloc(32,9).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const response=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
    expect(response.status).toBe(200);
    const body=await response.json() as {readyForAuthorization:boolean;providerShopId:number;oauth:{state:string}};
    expect(body.readyForAuthorization).toBe(true);
    expect(body.providerShopId).toBe(721578302);
    expect(body.oauth.state).toBe('NOT_CONNECTED');
  });


  it('accepts Keeta store authorization event 1301 under the current signed-envelope contract',async()=>{
    const key=Buffer.alloc(32,3).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const url='https://internal/webhook';
    const params={
      eventId:1301,
      appId:3419700273,
      messageId:'auth-msg-1',
      shopId:721578302,
      message:JSON.stringify({authId:'1294288',opType:1,shopId:721578302}),
      timestamp:1790092903,
    };
    const signed=await signKeetaRuntimeParams(url,params,'test-secret');
    const response=await runtime.fetch(new Request(url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(signed),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({code:0,message:'Success',data:{}});
    const journal=storage.get('webhook:event:auth-msg-1') as {eventId:number;eventName:string}|undefined;
    expect(journal?.eventId).toBe(1301);
    expect(journal?.eventName).toBe('STORE_AUTHORIZATION_ADDED');
  });

  it('records sanitized OAuth callback failure diagnostics without storing code or state',async()=>{
    const key=Buffer.alloc(32,4).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const callback=await runtime.fetch(new Request('https://internal/oauth/callback?state=opaque-state',{method:'GET'}));
    expect(callback.status).toBe(302);
    const statusResponse=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
    const body=await statusResponse.json() as {oauth:{lastCallbackResult:string;lastCallbackError:string;lastCallbackMethod:string;lastCallbackParamNames:string[]}};
    expect(body.oauth.lastCallbackResult).toBe('FAILED');
    expect(body.oauth.lastCallbackError).toBe('KEETA_OAUTH_CODE_REQUIRED');
    expect(body.oauth.lastCallbackMethod).toBe('GET');
    expect(body.oauth.lastCallbackParamNames).toEqual(['state']);
    const diagnostic=JSON.stringify(storage.get('oauth:callback-status'));
    expect(diagnostic).not.toContain('opaque-state');
  });


  it('verifies a forwarded webhook against the external configured URL, not the internal DO path',async()=>{
    const key=Buffer.alloc(32,5).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const externalUrl='https://admin.morefunos.com/api/keeta/webhook';
    const internalUrl='https://admin.morefunos.com/webhook';
    const params={
      eventId:1301,
      appId:3419700273,
      messageId:'auth-msg-external-url',
      shopId:721578302,
      message:JSON.stringify({authId:'1294288',opType:1,shopId:721578302}),
      timestamp:1790092903,
    };
    const signed=await signKeetaRuntimeParams(externalUrl,params,'test-secret');
    const response=await runtime.fetch(new Request(internalUrl,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-mfk-keeta-external-url':externalUrl,
      },
      body:JSON.stringify(signed),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({code:0,message:'Success',data:{}});
  });


  it('accepts signed event-1 authorization code callback and persists an encrypted token',async()=>{
    const key=Buffer.alloc(32,6).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const issuedAtTime=Date.now();
    const providerFetch=vi.fn(async()=>new Response(JSON.stringify({
      accessToken:'access-token',
      tokenType:'bearer',
      expiresIn:7776000,
      refreshToken:'refresh-token',
      scope:'all',
      issuedAtTime,
    }),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const externalUrl='https://admin.morefunos.com/api/keeta/oauth/callback';
      const body=await signKeetaRuntimeParams(externalUrl,{
        code:'authorization-code',
        state:'',
        appId:3419700273,
        timestamp:Date.now(),
      },'test-secret');
      const response=await runtime.fetch(new Request('https://admin.morefunos.com/oauth/callback',{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-mfk-keeta-external-url':externalUrl,
        },
        body:JSON.stringify(body),
      }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({code:0,message:'Success'});
      const tokenRow=storage.get('oauth:token') as {ciphertext?:string;iv?:string}|undefined;
      expect(tokenRow?.ciphertext).toBeTruthy();
      expect(tokenRow?.iv).toBeTruthy();
      const status=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
      const statusBody=await status.json() as {oauth:{state:string;lastCallbackResult:string}};
      expect(statusBody.oauth.state).toBe('CONNECTED');
      expect(statusBody.oauth.lastCallbackResult).toBe('CONNECTED');
    }finally{
      vi.unstubAllGlobals();
    }
  });


  it('imports a SIT token through admin-only runtime path and stores only encrypted material',async()=>{
    const key=Buffer.alloc(32,8).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const issuedAtTime=Date.now()-1000;
    const response=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        accessToken:'test-access-token',
        tokenType:'bearer',
        expiresIn:7776000,
        refreshToken:'test-refresh-token',
        scope:'all',
        issuedAtTime,
      }),
    }));
    expect(response.status).toBe(200);
    const body=await response.json() as {state:string;source:string;expiresAt:string};
    expect(body.state).toBe('CONNECTED');
    expect(body.source).toBe('TEST_PROVIDER_PORTAL_IMPORT');
    expect(body.expiresAt).toBeTruthy();

    const stored=storage.get('oauth:token') as {ciphertext?:string;iv?:string;expiresAtMs?:number}|undefined;
    expect(stored?.ciphertext).toBeTruthy();
    expect(stored?.iv).toBeTruthy();
    const serialized=JSON.stringify([...storage.entries()]);
    expect(serialized).not.toContain('test-access-token');
    expect(serialized).not.toContain('test-refresh-token');

    const statusResponse=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
    const status=await statusResponse.json() as {oauth:{state:string;tokenSource:string;expiresAt:string}};
    expect(status.oauth.state).toBe('CONNECTED');
    expect(status.oauth.tokenSource).toBe('TEST_PROVIDER_PORTAL_IMPORT');
    expect(status.oauth.expiresAt).toBeTruthy();
  });


  it('refreshes an expired provider-portal token without OAuth reauthorization',async()=>{
    const key=Buffer.alloc(32,10).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const refreshedIssuedAt=Date.now();
    const providerFetch=vi.fn(async()=>new Response(JSON.stringify({
      accessToken:'refreshed-access-token',
      tokenType:'bearer',
      expiresIn:7776000,
      refreshToken:'refreshed-refresh-token',
      scope:'all',
      issuedAtTime:refreshedIssuedAt,
    }),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const expiredIssuedAt=Date.now()-(7776000+3600)*1000;
      const response=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          accessToken:'expired-access-token',
          tokenType:'bearer',
          expiresIn:7776000,
          refreshToken:'still-usable-refresh-token',
          scope:'all',
          issuedAtTime:expiredIssuedAt,
        }),
      }));
      expect(response.status).toBe(200);
      const body=await response.json() as {state:string;source:string;expiresAt:string};
      expect(body.state).toBe('CONNECTED');
      expect(body.source).toBe('TEST_PROVIDER_PORTAL_REFRESH');
      expect(providerFetch).toHaveBeenCalledTimes(1);
      const requestBody=JSON.parse(String(providerFetch.mock.calls[0]?.[1]?.body??'{}')) as Record<string,unknown>;
      expect(requestBody.grantType).toBe('refresh_token');
      expect(requestBody.refreshToken).toBe('still-usable-refresh-token');

      const serialized=JSON.stringify([...storage.entries()]);
      expect(serialized).not.toContain('expired-access-token');
      expect(serialized).not.toContain('still-usable-refresh-token');
      expect(serialized).not.toContain('refreshed-access-token');
      expect(serialized).not.toContain('refreshed-refresh-token');

      const statusResponse=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
      const status=await statusResponse.json() as {oauth:{state:string;tokenSource:string;expiresAt:string}};
      expect(status.oauth.state).toBe('CONNECTED');
      expect(status.oauth.tokenSource).toBe('TEST_PROVIDER_PORTAL_REFRESH');
      expect(status.oauth.expiresAt).toBeTruthy();
    }finally{
      vi.unstubAllGlobals();
    }
  });


  it('clears the generic signing blocker after a live signed webhook has been accepted',async()=>{
    const key=Buffer.alloc(32,11).toString('base64');
    const storage=new Map<string,unknown>([
      ['webhook:status',{acceptedCount:1,lastAcceptedAt:new Date().toISOString(),lastEventId:1301,lastMessageId:'live-proof'}],
    ]);
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const response=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
    const body=await response.json() as {knownExternalBlocker:string|null;webhook:{acceptedCount:number}};
    expect(body.webhook.acceptedCount).toBe(1);
    expect(body.knownExternalBlocker).toBeNull();
  });


  it('queues one 1001 provider order intent for SMT and ACKs the same canonical order idempotently',async()=>{
    const key=Buffer.alloc(32,12).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const url='https://admin.morefunos.com/api/keeta/webhook';
    const message=JSON.stringify({orderInfo:{baseOrder:{orderViewIdStr:'998'}}});
    const signed=await signKeetaRuntimeParams(url,{
      eventId:1001,
      appId:3419700273,
      messageId:'msg-order-998',
      shopId:721578302,
      message,
      timestamp:1790115000,
    },'test-secret');
    const webhook=await runtime.fetch(new Request('https://internal/webhook',{
      method:'POST',
      headers:{'content-type':'application/json','x-mfk-keeta-external-url':url},
      body:JSON.stringify(signed),
    }));
    expect(webhook.status).toBe(200);

    const pending=await runtime.fetch(new Request('https://internal/smt/orders/pending',{method:'GET'}));
    const batch=await pending.json() as {orders:Array<{providerOrderId:string;providerMessageId:string;state:string}>};
    expect(batch.orders).toHaveLength(1);
    expect(batch.orders[0]).toMatchObject({providerOrderId:'998',providerMessageId:'msg-order-998',state:'PENDING_SMT'});

    const ackBody={
      schema:'MFK_KEETA_ORDER_ACK_V1',
      storeId:'MF01',
      provider:'KEETA',
      providerOrderId:'998',
      providerMessageId:'msg-order-998',
      canonicalOrderId:'MFK-local-1',
      canonicalDisplay:'P001',
      committedAt:'2026-09-23T00:05:00.000Z',
    };
    const ack=await runtime.fetch(new Request('https://internal/smt/orders/ack',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ackBody),
    }));
    expect(ack.status).toBe(200);
    const retry=await runtime.fetch(new Request('https://internal/smt/orders/ack',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ackBody),
    }));
    expect(retry.status).toBe(200);
    expect((await retry.json() as {state:string}).state).toBe('IDEMPOTENT');

    const after=await runtime.fetch(new Request('https://internal/smt/orders/pending',{method:'GET'}));
    expect((await after.json() as {orders:unknown[]}).orders).toHaveLength(0);
  });


  it('submits a canonical full-menu task and banks 1202 completion readback',async()=>{
    const key=Buffer.alloc(32,13).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',
      KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);

    const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        accessToken:'menu-access',
        tokenType:'bearer',
        expiresIn:7776000,
        refreshToken:'menu-refresh',
        scope:'all',
        issuedAtTime:Date.now(),
      }),
    }));
    expect(imported.status).toBe(200);

    const providerFetch=vi.fn(async()=>new Response(JSON.stringify({
      code:0,message:'Success',data:897354,
    }),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const snapshot={
        catalog:{
          categories:[{id:'cat',name:'主食',position:10,active:true}],
          products:[{
            id:'p1',productCode:'SKU-P1',name:'商品一',categoryId:'cat',active:true,
            basePrice:'42.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,modifierGroupIds:[],
          }],
        },
        optionCenter:{sets:[],productLinks:[]},
      };
      const sync=await runtime.fetch(new Request('https://internal/admin/menu/sync',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({revision:7,adminFingerprint:'fnv1a32:menu7',snapshot}),
      }));
      expect(sync.status).toBe(200);
      const submitted=await sync.json() as {state:string;taskId:number;summary:{spus:number}};
      expect(submitted).toMatchObject({state:'SUBMITTED',taskId:897354});
      expect(submitted.summary.spus).toBe(1);

      const providerCall=providerFetch.mock.calls[0];
      expect(String(providerCall?.[0])).toBe('https://open.mykeeta.com/api/open/product/menu/sync');
      const sent=JSON.parse(String(providerCall?.[1]?.body??'{}')) as Record<string,unknown>;
      expect(sent.shopId).toBe(721578302);
      expect(sent.accessToken).toBe('menu-access');
      expect(Array.isArray(sent.spuList)).toBe(true);

      const externalUrl='https://admin.morefunos.com/api/keeta/webhook';
      const completionMessage=JSON.stringify({
        shopId:721578302,
        taskId:897354,
        pictureTaskId:266675845,
        errorSpuDTOList:[],
      });
      const signed=await signKeetaRuntimeParams(externalUrl,{
        eventId:1202,
        appId:3419700273,
        messageId:'menu-complete-897354',
        shopId:721578302,
        message:completionMessage,
        timestamp:Math.floor(Date.now()/1000),
      },'test-secret');
      const webhook=await runtime.fetch(new Request('https://internal/webhook',{
        method:'POST',
        headers:{'content-type':'application/json','x-mfk-keeta-external-url':externalUrl},
        body:JSON.stringify(signed),
      }));
      expect(webhook.status).toBe(200);

      const status=await runtime.fetch(new Request('https://internal/admin/menu/status',{method:'POST'}));
      const readback=await status.json() as {state:string;taskId:number;completion:{pictureTaskId:number;errors:unknown[]}};
      expect(readback.state).toBe('COMPLETED');
      expect(readback.taskId).toBe(897354);
      expect(readback.completion.pictureTaskId).toBe(266675845);
      expect(readback.completion.errors).toEqual([]);
    }finally{
      vi.unstubAllGlobals();
    }
  });


  it('gates Keeta CONFIRM and READY on the committed canonical order and makes success idempotent',async()=>{
    const key=Buffer.alloc(32,14).toString('base64');
    const storage=new Map<string,unknown>([
      ['order:intent:998',{
        schema:'MFK_KEETA_ORDER_INTENT_V1',storeId:'MF01',provider:'KEETA',state:'COMMITTED',
        providerShopId:721578302,providerOrderId:'998',providerMessageId:'msg-998',
        providerPushedAt:'2026-09-23T00:00:00.000Z',receivedAt:'2026-09-23T00:00:01.000Z',
        fingerprint:'f'.repeat(64),rawMessage:'{}',
        canonicalOrderId:'MFK-1',canonicalDisplay:'P001',committedAt:'2026-09-23T00:00:02.000Z',
      }],
    ]);
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    expect(imported.status).toBe(200);

    const providerFetch=vi.fn(async(input:string|URL|Request)=>new Response(
      JSON.stringify({code:0,message:'Success',data:{}}),
      {status:200,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const confirmBody={providerOrderId:'998',canonicalOrderId:'MFK-1',action:'CONFIRM'};
      const confirm=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(confirmBody),
      }));
      expect(confirm.status).toBe(200);
      expect((await confirm.json() as {state:string}).state).toBe('SUCCESS');
      expect(String(providerFetch.mock.calls[0]?.[0])).toBe('https://open.mykeeta.com/api/open/order/confirm');

      const duplicate=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(confirmBody),
      }));
      expect((await duplicate.json() as {state:string}).state).toBe('IDEMPOTENT');
      expect(providerFetch).toHaveBeenCalledTimes(1);

      const mismatch=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({providerOrderId:'998',canonicalOrderId:'MFK-WRONG',action:'READY'}),
      }));
      expect(mismatch.status).toBe(409);
      expect((await mismatch.json() as {code:string}).code).toBe('KEETA_PROVIDER_COMMAND_CANONICAL_ORDER_MISMATCH');

      const ready=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({providerOrderId:'998',canonicalOrderId:'MFK-1',action:'READY'}),
      }));
      expect(ready.status).toBe(200);
      expect(String(providerFetch.mock.calls[1]?.[0])).toBe('https://open.mykeeta.com/api/open/order/prepare');
    }finally{vi.unstubAllGlobals();}
  });

  it('banks ambiguous Keeta provider command transport as UNKNOWN and never blind-retries',async()=>{
    const key=Buffer.alloc(32,15).toString('base64');
    const storage=new Map<string,unknown>([
      ['order:intent:999',{
        schema:'MFK_KEETA_ORDER_INTENT_V1',storeId:'MF01',provider:'KEETA',state:'COMMITTED',
        providerShopId:721578302,providerOrderId:'999',providerMessageId:'msg-999',
        providerPushedAt:'2026-09-23T00:00:00.000Z',receivedAt:'2026-09-23T00:00:01.000Z',
        fingerprint:'a'.repeat(64),rawMessage:'{}',
        canonicalOrderId:'MFK-9',canonicalDisplay:'P009',committedAt:'2026-09-23T00:00:02.000Z',
      }],
    ]);
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    const providerFetch=vi.fn(async()=>{throw new TypeError('network uncertain');});
    vi.stubGlobal('fetch',providerFetch);
    try{
      const body={providerOrderId:'999',canonicalOrderId:'MFK-9',action:'CONFIRM'};
      const first=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
      }));
      expect(first.status).toBe(409);
      expect((await first.json() as {state:string}).state).toBe('UNKNOWN');
      const second=await runtime.fetch(new Request('https://internal/smt/orders/command',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
      }));
      const secondBody=await second.json() as {state:string;code:string};
      expect(second.status).toBe(409);
      expect(secondBody.state).toBe('UNKNOWN');
      expect(secondBody.code).toBe('KEETA_PROVIDER_COMMAND_UNKNOWN_READBACK_REQUIRED');
      expect(providerFetch).toHaveBeenCalledTimes(1);
    }finally{vi.unstubAllGlobals();}
  });


  it('syncs published product sellability in bounded Keeta SPU batches without reverse authority',async()=>{
    const key=Buffer.alloc(32,16).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    const providerFetch=vi.fn(async()=>new Response(JSON.stringify({code:0,message:'Success',data:['ok'],errorList:[]}),{
      status:200,headers:{'content-type':'application/json'},
    }));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const response=await runtime.fetch(new Request('https://internal/admin/sellability/sync',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          revision:9,adminFingerprint:'fp-9',
          snapshot:{
            channelPolicy:{syncSellability:true},
            availability:{p1:{sellable:true},p2:{sellable:false}},
            catalog:{products:[
              {id:'p1',productCode:'RB-A',active:true},
              {id:'p2',productCode:'BX 2',active:true},
            ]},
          },
        }),
      }));
      expect(response.status).toBe(200);
      const body=await response.json() as {state:string;available:number;unavailable:number};
      expect(body).toMatchObject({state:'COMPLETED',available:1,unavailable:1});
      expect(providerFetch).toHaveBeenCalledTimes(2);
      const payloads=providerFetch.mock.calls.map(call=>JSON.parse(String(call[1]?.body??'{}')) as Record<string,unknown>);
      expect(payloads.map(row=>row.status).sort()).toEqual([0,1]);
      expect(payloads.every(row=>row.needLinkage===0)).toBe(true);
    }finally{vi.unstubAllGlobals();}
  });

  it('updates weekly hours then reads back store state, and avoids duplicate REST when already suspended',async()=>{
    const key=Buffer.alloc(32,17).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    const providerFetch=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input);
      if(url.includes('/scm/shop/base/get'))return new Response(JSON.stringify({code:0,message:'Success',data:{shopId:721578302,status:4}}),{status:200});
      if(url.includes('/business/hour/effective/get'))return new Response(JSON.stringify({code:0,message:'Success',data:{mon:[{startTime:39600,endTime:72000}]}}),{status:200});
      return new Response(JSON.stringify({code:0,message:'Success'}),{status:200});
    });
    vi.stubGlobal('fetch',providerFetch);
    try{
      const weeklyHours=Object.fromEntries(['MON','TUE','WED','THU','FRI','SAT','SUN'].map(day=>[
        day,{closed:day==='SAT',opensAt:'11:00',closesAt:'20:00'},
      ]));
      const synced=await runtime.fetch(new Request('https://internal/admin/store/hours/sync',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({revision:10,adminFingerprint:'fp-10',snapshot:{storeSettings:{weeklyHours}}}),
      }));
      expect(synced.status).toBe(200);
      const urls=providerFetch.mock.calls.map(call=>String(call[0]));
      expect(urls.some(url=>url.includes('/business/hour/effective/update'))).toBe(true);
      expect(urls.some(url=>url.includes('/scm/shop/base/get'))).toBe(true);
      expect(urls.some(url=>url.includes('/business/hour/effective/get'))).toBe(true);

      providerFetch.mockClear();
      const rest=await runtime.fetch(new Request('https://internal/admin/store/status/rest',{method:'POST'}));
      expect(rest.status).toBe(200);
      expect((await rest.json() as {state:string}).state).toBe('IDEMPOTENT');
      expect(providerFetch.mock.calls.map(call=>String(call[0])).some(url=>url.includes('/status/rest'))).toBe(false);
    }finally{vi.unstubAllGlobals();}
  });

});
