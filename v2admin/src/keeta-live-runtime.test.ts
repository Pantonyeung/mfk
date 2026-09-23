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

  it('fails closed after signed provider authorization removal without deleting encrypted token custody',async()=>{
    const key=Buffer.alloc(32,13).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      setAlarm:async()=>{},
      getAlarm:async()=>null,
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',KEETA_TOKEN_ENCRYPTION_KEY:key,
      KEETA_PROVIDER_SHOP_ID:'721578302',KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'access-custody',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh-custody',scope:'all',issuedAtTime:Date.now()}),
    }));
    expect(imported.status).toBe(200);
    const tokenBefore=storage.get('oauth:token');
    expect(tokenBefore).toBeTruthy();

    const url='https://internal/webhook';
    const signed=await signKeetaRuntimeParams(url,{
      eventId:1302,appId:3419700273,messageId:'auth-remove-1',shopId:721578302,
      message:JSON.stringify({authId:'1294288',opType:2,shopId:721578302}),timestamp:1790092904,
    },'test-secret');
    const response=await runtime.fetch(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(signed)}));
    expect(response.status).toBe(200);
    expect(storage.get('oauth:token')).toEqual(tokenBefore);

    const statusResponse=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
    const status=await statusResponse.json() as {oauth:{state:string;authorization:{state:string;eventId:number}|null}};
    expect(status.oauth.state).toBe('REAUTH_REQUIRED');
    expect(status.oauth.authorization).toMatchObject({state:'REMOVED',eventId:1302});

    const readiness=await runtime.fetch(new Request('https://internal/admin/token/readiness',{method:'POST'}));
    expect(readiness.status).toBe(409);
    expect(await readiness.json()).toMatchObject({state:'TOKEN_UNAVAILABLE',code:'KEETA_ACCESS_TOKEN_REAUTHORIZE_REQUIRED'});
  });

  it('treats signed brand authorization revocation as fail-closed provider custody evidence',async()=>{
    const key=Buffer.alloc(32,14).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{get:async(key:string)=>storage.get(key),put:async(key:string,value:unknown)=>{storage.set(key,value);},delete:async(key:string)=>{storage.delete(key);}}};
    const env={KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback'};
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const url='https://internal/webhook';
    const signed=await signKeetaRuntimeParams(url,{eventId:1303,appId:3419700273,messageId:'auth-revoke-1',shopId:721578302,message:JSON.stringify({shopId:721578302}),timestamp:1790092905},'test-secret');
    expect((await runtime.fetch(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(signed)}))).status).toBe(200);
    const status=await (await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}))).json() as {oauth:{authorization:{state:string;eventId:number}|null}};
    expect(status.oauth.authorization).toMatchObject({state:'REVOKED',eventId:1303});
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


  it('accepts the observed nested provider token data envelope without weakening token validation',async()=>{
    const key=Buffer.alloc(32,16).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{get:async(key:string)=>storage.get(key),put:async(key:string,value:unknown)=>{storage.set(key,value);},delete:async(key:string)=>{storage.delete(key);}}};
    const env={KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback'};
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const issuedAtTime=Date.now();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:0,message:'Success',data:{code:0,message:'Success',data:{accessToken:'nested-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'nested-refresh',scope:'all',issuedAtTime}}}),{status:200})));
    try{
      const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:'expired-access',tokenType:'bearer',expiresIn:1,refreshToken:'old-refresh',scope:'all',issuedAtTime:issuedAtTime-10000})}));
      expect(imported.status).toBe(200);
      const status=await (await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}))).json() as {oauth:{state:string;tokenSource:string}};
      expect(status.oauth).toMatchObject({state:'CONNECTED',tokenSource:'TEST_PROVIDER_PORTAL_REFRESH'});
      const serialized=JSON.stringify([...storage.entries()]);
      expect(serialized).not.toContain('nested-access');
      expect(serialized).not.toContain('nested-refresh');
    }finally{vi.unstubAllGlobals();}
  });

  it('accepts the provider token material inside the standard data envelope without weakening token validation',async()=>{
    const key=Buffer.alloc(32,15).toString('base64');
    const storage=new Map<string,unknown>();
    const state={storage:{get:async(key:string)=>storage.get(key),put:async(key:string,value:unknown)=>{storage.set(key,value);},delete:async(key:string)=>{storage.delete(key);}}};
    const env={KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback'};
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const issuedAtTime=Date.now();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:0,message:'Success',data:{accessToken:'enveloped-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'enveloped-refresh',scope:'all',issuedAtTime}}),{status:200})));
    try{
      const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:'expired-access',tokenType:'bearer',expiresIn:1,refreshToken:'old-refresh',scope:'all',issuedAtTime:issuedAtTime-10000})}));
      expect(imported.status).toBe(200);
      const status=await (await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}))).json() as {oauth:{state:string;tokenSource:string}};
      expect(status.oauth).toMatchObject({state:'CONNECTED',tokenSource:'TEST_PROVIDER_PORTAL_REFRESH'});
      const serialized=JSON.stringify([...storage.entries()]);
      expect(serialized).not.toContain('enveloped-access');
      expect(serialized).not.toContain('enveloped-refresh');
    }finally{vi.unstubAllGlobals();}
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


  it('automatically rotates and persists Keeta tokens from a Durable Object alarm without manual token re-entry',async()=>{
    const key=Buffer.alloc(32,32).toString('base64');
    const storage=new Map<string,unknown>();
    let alarmAt:number|null=null;
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      setAlarm:async(value:number)=>{alarmAt=value;},
      getAlarm:async()=>alarmAt,
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

    const importedAt=Date.now();
    const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        accessToken:'bootstrap-access',
        tokenType:'bearer',
        expiresIn:120,
        refreshToken:'bootstrap-refresh',
        scope:'all',
        issuedAtTime:importedAt,
      }),
    }));
    expect(imported.status).toBe(200);
    expect(alarmAt).not.toBeNull();
    expect(Number(alarmAt)).toBeGreaterThanOrEqual(importedAt+60_000);

    const providerFetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url==='https://open.mykeeta.com/api/open/base/oauth/token'){
        const requestBody=JSON.parse(String(init?.body??'{}')) as {grantType?:string;refreshToken?:string};
        expect(requestBody).toMatchObject({grantType:'refresh_token',refreshToken:'bootstrap-refresh'});
        return new Response(JSON.stringify({
          accessToken:'rotated-access',
          tokenType:'bearer',
          expiresIn:7776000,
          refreshToken:'rotated-refresh',
          scope:'all',
          issuedAtTime:Date.now(),
        }),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url==='https://open.mykeeta.com/api/open/scm/shop/base/get'){
        const requestBody=JSON.parse(String(init?.body??'{}')) as {accessToken?:string};
        expect(requestBody.accessToken).toBe('rotated-access');
        return new Response(JSON.stringify({code:0,message:'Success',data:{shopId:721578302}}),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('UNEXPECTED_PROVIDER_URL:'+url);
    });
    vi.stubGlobal('fetch',providerFetch);
    try{
      await runtime.alarm();
      const readiness=await runtime.fetch(new Request('https://internal/admin/token/readiness',{method:'POST'}));
      expect(readiness.status).toBe(200);
      expect(await readiness.json()).toEqual({state:'TOKEN_USABLE_PROVIDER_CONFIRMED'});

      const statusResponse=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
      const status=await statusResponse.json() as {oauth:{tokenSource:string;autoRefresh:{state:string;nextRefreshAt:string|null;lastSuccessAt:string|null;lastError:string|null}}};
      expect(status.oauth.tokenSource).toBe('OAUTH_REFRESH');
      expect(status.oauth.autoRefresh.state).toBe('SCHEDULED');
      expect(status.oauth.autoRefresh.nextRefreshAt).toBeTruthy();
      expect(status.oauth.autoRefresh.lastSuccessAt).toBeTruthy();
      expect(status.oauth.autoRefresh.lastError).toBeNull();

      const serialized=JSON.stringify([...storage.entries()]);
      expect(serialized).not.toContain('bootstrap-access');
      expect(serialized).not.toContain('bootstrap-refresh');
      expect(serialized).not.toContain('rotated-access');
      expect(serialized).not.toContain('rotated-refresh');
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

    const pending=await runtime.fetch(new Request('https://internal/smt/orders/pending?deviceId=SMT-TEST-1',{method:'GET'}));
    const batch=await pending.json() as {orders:Array<{providerOrderId:string;providerMessageId:string;state:string}>};
    expect(batch.orders).toHaveLength(1);
    expect(batch.orders[0]).toMatchObject({providerOrderId:'998',providerMessageId:'msg-order-998',state:'PENDING_SMT'});

    const adminBefore=await runtime.fetch(new Request('https://internal/admin/orders/intake',{method:'POST'}));
    const intakeBefore=await adminBefore.json() as {pending:number;committed:number;items:Array<{providerOrderId:string;state:string;canonicalOrderId:null}>};
    expect(intakeBefore.pending).toBe(1);
    expect(intakeBefore.committed).toBe(0);
    expect((intakeBefore as unknown as {lastSmtPull:{deviceId:string;pendingCount:number}}).lastSmtPull).toMatchObject({deviceId:'SMT-TEST-1',pendingCount:1});
    expect(intakeBefore.items[0]).toMatchObject({providerOrderId:'998',state:'PENDING_SMT',canonicalOrderId:null});

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

    const adminAfter=await runtime.fetch(new Request('https://internal/admin/orders/intake',{method:'POST'}));
    const intakeAfter=await adminAfter.json() as {pending:number;committed:number;items:Array<{state:string;canonicalOrderId:string;canonicalDisplay:string}>};
    expect(intakeAfter.pending).toBe(0);
    expect(intakeAfter.committed).toBe(1);
    expect(intakeAfter.items[0]).toMatchObject({state:'COMMITTED',canonicalOrderId:'MFK-local-1',canonicalDisplay:'P001'});
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


  it('refreshes an explicitly rejected access token once before retrying menu sync',async()=>{
    const key=Buffer.alloc(32,31).toString('base64');
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
    const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'stale-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refresh-ok',scope:'all',issuedAtTime:Date.now()}),
    }));
    expect(imported.status).toBe(200);
    const snapshot={catalog:{categories:[{id:'cat',name:'主食',position:10,active:true}],products:[{
      id:'p1',productCode:'SKU-P1',name:'商品一',categoryId:'cat',active:true,basePrice:'42.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,modifierGroupIds:[],
    }]},optionCenter:{sets:[],productLinks:[]}};
    const providerFetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url==='https://open.mykeeta.com/api/open/product/menu/sync'){
        const sent=JSON.parse(String(init?.body??'{}')) as {accessToken?:string};
        if(sent.accessToken==='stale-access')return new Response(JSON.stringify({code:115000200,message:'The access token does not exist, please check if the access token is correct.'}),{status:200});
        expect(sent.accessToken).toBe('fresh-access');
        return new Response(JSON.stringify({code:0,message:'Success',data:778899}),{status:200});
      }
      if(url==='https://open.mykeeta.com/api/open/base/oauth/token'){
        return new Response(JSON.stringify({accessToken:'fresh-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'fresh-refresh',scope:'all',issuedAtTime:Date.now()}),{status:200});
      }
      throw new Error('UNEXPECTED_PROVIDER_URL:'+url);
    });
    vi.stubGlobal('fetch',providerFetch);
    try{
      const sync=await runtime.fetch(new Request('https://internal/admin/menu/sync',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:8,adminFingerprint:'fnv1a32:menu8',snapshot}),
      }));
      expect(sync.status).toBe(200);
      expect(await sync.json()).toMatchObject({state:'SUBMITTED',taskId:778899});
      expect(providerFetch).toHaveBeenCalledTimes(3);
      const status=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
      expect((await status.json() as {oauth:{state:string;tokenSource:string}}).oauth).toMatchObject({state:'CONNECTED',tokenSource:'OAUTH_REFRESH'});
    }finally{vi.unstubAllGlobals();}
  });

  it('schedules and executes automatic token rotation without another manual token import',async()=>{
    const key=Buffer.alloc(32,32).toString('base64');
    const storage=new Map<string,unknown>();
    let alarmAt:number|null=null;
    const state={storage:{
      get:async(key:string)=>storage.get(key),
      put:async(key:string,value:unknown)=>{storage.set(key,value);},
      delete:async(key:string)=>{storage.delete(key);},
      list:async({prefix}:{prefix:string})=>new Map([...storage.entries()].filter(([key])=>key.startsWith(prefix))),
      setAlarm:async(value:number)=>{alarmAt=value;},
      getAlarm:async()=>alarmAt,
    }};
    const env={
      KEETA_APP_ID:'3419700273',KEETA_APP_SECRET:'test-secret',
      KEETA_TOKEN_ENCRYPTION_KEY:key,KEETA_PROVIDER_SHOP_ID:'721578302',
      KEETA_OAUTH_REDIRECT_URI:'https://admin.morefunos.com/api/keeta/oauth/callback',
    };
    const {KeetaRuntimeStore}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const baseNow=1_800_000_000_000;
    const dateSpy=vi.spyOn(Date,'now').mockReturnValue(baseNow);
    const providerFetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url!=='https://open.mykeeta.com/api/open/base/oauth/token')throw new Error('UNEXPECTED_PROVIDER_URL:'+url);
      const sent=JSON.parse(String(init?.body??'{}')) as {grantType?:string;refreshToken?:string};
      expect(sent.grantType).toBe('refresh_token');
      expect(sent.refreshToken).toBe('auto-refresh-1');
      return new Response(JSON.stringify({
        accessToken:'auto-access-2',tokenType:'bearer',expiresIn:7776000,
        refreshToken:'auto-refresh-2',scope:'all',issuedAtTime:baseNow+85*24*60*60*1000,
      }),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',providerFetch);
    try{
      const imported=await runtime.fetch(new Request('https://internal/admin/token/import-test',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          accessToken:'auto-access-1',tokenType:'bearer',expiresIn:7776000,
          refreshToken:'auto-refresh-1',scope:'all',issuedAtTime:baseNow,
        }),
      }));
      expect(imported.status).toBe(200);
      expect(alarmAt).toBe(baseNow+(7776000*1000)-(5*24*60*60*1000));

      dateSpy.mockReturnValue(Number(alarmAt)+1);
      await runtime.alarm();

      expect(providerFetch).toHaveBeenCalledTimes(1);
      const status=await runtime.fetch(new Request('https://internal/admin/status',{method:'POST'}));
      const body=await status.json() as {oauth:{state:string;tokenSource:string;autoRefresh:{state:string;nextRefreshAt:string|null;lastSuccessAt:string|null;lastError:string|null}}};
      expect(body.oauth.state).toBe('CONNECTED');
      expect(body.oauth.tokenSource).toBe('OAUTH_REFRESH');
      expect(body.oauth.autoRefresh.state).toBe('SCHEDULED');
      expect(body.oauth.autoRefresh.nextRefreshAt).toBeTruthy();
      expect(body.oauth.autoRefresh.lastSuccessAt).toBeTruthy();
      expect(body.oauth.autoRefresh.lastError).toBeNull();

      const serialized=JSON.stringify([...storage.entries()]);
      expect(serialized).not.toContain('auto-access-1');
      expect(serialized).not.toContain('auto-refresh-1');
      expect(serialized).not.toContain('auto-access-2');
      expect(serialized).not.toContain('auto-refresh-2');
    }finally{
      vi.unstubAllGlobals();
      dateSpy.mockRestore();
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


  it('queues verified 1004 lifecycle evidence and links it idempotently to the committed canonical order',async()=>{
    const key=Buffer.alloc(32,18).toString('base64');
    const storage=new Map<string,unknown>([
      ['order:intent:998',{
        schema:'MFK_KEETA_ORDER_INTENT_V1',storeId:'MF01',provider:'KEETA',state:'COMMITTED',
        providerShopId:721578302,providerOrderId:'998',providerMessageId:'msg-placement-998',
        providerPushedAt:'2026-09-23T00:00:00.000Z',receivedAt:'2026-09-23T00:00:01.000Z',
        fingerprint:'b'.repeat(64),rawMessage:'{}',
        canonicalOrderId:'MFK-998',canonicalDisplay:'P998',committedAt:'2026-09-23T00:00:02.000Z',
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
    const {KeetaRuntimeStore,signKeetaRuntimeParams}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const externalUrl='https://admin.morefunos.com/api/keeta/webhook';
    const signed=await signKeetaRuntimeParams(externalUrl,{
      eventId:1004,appId:3419700273,messageId:'msg-cancel-998',shopId:721578302,
      message:JSON.stringify({orderViewId:998,shopId:721578302,status:50,opType:20,opTime:1790120000000,cancelReason:'provider cancel'}),
      timestamp:1790120000,
    },'test-secret');
    const webhook=await runtime.fetch(new Request('https://internal/webhook',{
      method:'POST',headers:{'content-type':'application/json','x-mfk-keeta-external-url':externalUrl},
      body:JSON.stringify(signed),
    }));
    expect(webhook.status).toBe(200);

    const pending=await runtime.fetch(new Request('https://internal/smt/orders/events/pending',{method:'GET'}));
    const batch=await pending.json() as {events:Array<{providerOrderId:string;providerMessageId:string;eventId:number;state:string}>};
    expect(batch.events).toEqual([expect.objectContaining({
      providerOrderId:'998',providerMessageId:'msg-cancel-998',eventId:1004,state:'PENDING_SMT',
    })]);

    const ackBody={providerOrderId:'998',providerMessageId:'msg-cancel-998',canonicalOrderId:'MFK-998'};
    const ack=await runtime.fetch(new Request('https://internal/smt/orders/events/ack',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ackBody),
    }));
    expect(ack.status).toBe(200);
    expect((await ack.json() as {state:string}).state).toBe('ACKED');

    const retry=await runtime.fetch(new Request('https://internal/smt/orders/events/ack',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ackBody),
    }));
    expect((await retry.json() as {state:string}).state).toBe('IDEMPOTENT');

    const after=await runtime.fetch(new Request('https://internal/smt/orders/events/pending',{method:'GET'}));
    expect((await after.json() as {events:unknown[]}).events).toHaveLength(0);
  });


  it('queues verified 1005 refund evidence, links it to the committed order and sends one idempotent approve decision',async()=>{
    const key=Buffer.alloc(32,19).toString('base64');
    const storage=new Map<string,unknown>([
      ['order:intent:998',{
        schema:'MFK_KEETA_ORDER_INTENT_V1',storeId:'MF01',provider:'KEETA',state:'COMMITTED',
        providerShopId:721578302,providerOrderId:'998',providerMessageId:'msg-placement-998',
        providerPushedAt:'2026-09-23T00:00:00.000Z',receivedAt:'2026-09-23T00:00:01.000Z',
        fingerprint:'d'.repeat(64),rawMessage:'{}',
        canonicalOrderId:'MFK-998',canonicalDisplay:'P998',committedAt:'2026-09-23T00:00:02.000Z',
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
    const {KeetaRuntimeStore,signKeetaRuntimeParams}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'refund-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'refund-refresh',scope:'all',issuedAtTime:Date.now()}),
    }));

    const externalUrl='https://admin.morefunos.com/api/keeta/webhook';
    const message=JSON.stringify({
      orderViewId:998,shopId:721578302,status:2000,afterSaleOrderId:88001,isAppeal:0,
      money:2800,currency:'HKD',applyOpType:10,applyReason:'Customer requested refund',
      handleOpType:0,handleReason:'Pending merchant decision',opTime:1790120000000,
    });
    const signed=await signKeetaRuntimeParams(externalUrl,{
      eventId:1005,appId:3419700273,messageId:'refund-msg-1',shopId:721578302,message,timestamp:1790120000,
    },'test-secret');
    const webhook=await runtime.fetch(new Request('https://internal/webhook',{
      method:'POST',headers:{'content-type':'application/json','x-mfk-keeta-external-url':externalUrl},body:JSON.stringify(signed),
    }));
    expect(webhook.status).toBe(200);

    const pending=await runtime.fetch(new Request('https://internal/smt/orders/after-sales/pending',{method:'GET'}));
    const batch=await pending.json() as {events:Array<{afterSaleOrderId:string;providerOrderId:string;eventId:number;state:string}>};
    expect(batch.events).toEqual([expect.objectContaining({
      afterSaleOrderId:'88001',providerOrderId:'998',eventId:1005,state:'PENDING_SMT',
    })]);

    const ackBody={providerOrderId:'998',providerMessageId:'refund-msg-1',afterSaleOrderId:'88001',canonicalOrderId:'MFK-998'};
    const ack=await runtime.fetch(new Request('https://internal/smt/orders/after-sales/ack',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(ackBody),
    }));
    expect(ack.status).toBe(200);

    const providerFetch=vi.fn(async(input:string|URL|Request)=>new Response(
      JSON.stringify({code:0,message:'Success'}),{status:200,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const decisionBody={providerOrderId:'998',canonicalOrderId:'MFK-998',afterSaleOrderId:'88001',decision:'APPROVE'};
      const decision=await runtime.fetch(new Request('https://internal/smt/orders/after-sales/decision',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(decisionBody),
      }));
      expect(decision.status).toBe(200);
      expect((await decision.json() as {state:string}).state).toBe('SUCCESS');
      expect(String(providerFetch.mock.calls[0]?.[0])).toBe('https://open.mykeeta.com/api/open/order/agree');

      const retry=await runtime.fetch(new Request('https://internal/smt/orders/after-sales/decision',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(decisionBody),
      }));
      expect((await retry.json() as {state:string}).state).toBe('IDEMPOTENT');
      expect(providerFetch).toHaveBeenCalledTimes(1);
    }finally{vi.unstubAllGlobals();}
  });

  it('requires matching partial-refund preview before apply and sends documented preview/apply endpoints',async()=>{
    const key=Buffer.alloc(32,20).toString('base64');
    const storage=new Map<string,unknown>([
      ['order:intent:999',{
        schema:'MFK_KEETA_ORDER_INTENT_V1',storeId:'MF01',provider:'KEETA',state:'COMMITTED',
        providerShopId:721578302,providerOrderId:'999',providerMessageId:'msg-placement-999',
        providerPushedAt:'2026-09-23T00:00:00.000Z',receivedAt:'2026-09-23T00:00:01.000Z',
        fingerprint:'e'.repeat(64),rawMessage:'{}',
        canonicalOrderId:'MFK-999',canonicalDisplay:'P999',committedAt:'2026-09-23T00:00:02.000Z',
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
      body:JSON.stringify({accessToken:'partial-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'partial-refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    const providerFetch=vi.fn(async(input:string|URL|Request)=>{
      const url=String(input);
      if(url.endsWith('/preview'))return new Response(JSON.stringify({code:0,message:'Success',data:{products:[{orderProductId:555,refundCount:1}],refundPrice:{amount:1200}}}),{status:200});
      return new Response(JSON.stringify({code:0,message:'Success',data:{afterSaleOrderId:88002}}),{status:200});
    });
    vi.stubGlobal('fetch',providerFetch);
    try{
      const products=[{orderProductId:555,refundCount:1}];
      const applyBeforePreview=await runtime.fetch(new Request('https://internal/smt/orders/partial-refund/apply',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({providerOrderId:'999',canonicalOrderId:'MFK-999',products,partRefundType:200001}),
      }));
      expect(applyBeforePreview.status).toBe(409);
      expect((await applyBeforePreview.json() as {code:string}).code).toBe('KEETA_PARTIAL_REFUND_PREVIEW_REQUIRED');

      const preview=await runtime.fetch(new Request('https://internal/smt/orders/partial-refund/preview',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({providerOrderId:'999',canonicalOrderId:'MFK-999',products}),
      }));
      expect(preview.status).toBe(200);
      expect(String(providerFetch.mock.calls[0]?.[0])).toBe('https://open.mykeeta.com/api/open/order/refund/part/products/preview');

      const apply=await runtime.fetch(new Request('https://internal/smt/orders/partial-refund/apply',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({providerOrderId:'999',canonicalOrderId:'MFK-999',products,partRefundType:200001}),
      }));
      expect(apply.status).toBe(200);
      expect((await apply.json() as {state:string}).state).toBe('APPLIED');
      expect(String(providerFetch.mock.calls[1]?.[0])).toBe('https://open.mykeeta.com/api/open/order/refund/part/apply');
    }finally{vi.unstubAllGlobals();}
  });


  it('captures 1001 commercial evidence, links it on canonical ACK and refreshes from provider order/get without mutating canonical truth',async()=>{
    const key=Buffer.alloc(32,21).toString('base64');
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
    const orderInfo={
      baseOrder:{orderViewIdStr:'998',currency:'HKD'},
      merchantOrder:{orderViewIdStr:'998',seqNoStr:'K998'},
      products:[{
        id:1,skuId:11,spuId:22,skuOpenItemCode:'SKU-P1',spuOpenItemCode:'SPU-P1',
        name:'Provider 商品',count:2,currency:'HKD',
        priceWithGroup:{originUnitPrice:4100,unitPrice:4200,originAmount:8200,amount:8400},
        groups:[],
      }],
      feeDtls:[
        {code:'productPrice',currency:'HKD',price:8400},
        {code:'payTotal',currency:'HKD',price:8600},
        {code:'platformFee',currency:'HKD',price:200},
      ],
      feeDtl:{merchantFee:{basicCommission:900,activityFee:100,earnings:7400}},
      orderPromotionDtlList:[],
    };
    const {KeetaRuntimeStore,signKeetaRuntimeParams}=await import('../keeta-runtime.ts');
    const runtime=new KeetaRuntimeStore(state as never,env as never);
    const externalUrl='https://admin.morefunos.com/api/keeta/webhook';
    const signed=await signKeetaRuntimeParams(externalUrl,{
      eventId:1001,appId:3419700273,messageId:'commercial-msg-1',shopId:721578302,
      message:JSON.stringify({orderInfo}),timestamp:1790120000,
    },'test-secret');
    const webhook=await runtime.fetch(new Request('https://internal/webhook',{
      method:'POST',headers:{'content-type':'application/json','x-mfk-keeta-external-url':externalUrl},body:JSON.stringify(signed),
    }));
    expect(webhook.status).toBe(200);

    const beforeAck=await runtime.fetch(new Request('https://internal/admin/commercial/list',{method:'POST'}));
    const beforeRows=await beforeAck.json() as {items:Array<{state:string;canonicalOrderId:null;snapshot:Record<string,unknown>}>};
    expect(beforeRows.items).toHaveLength(1);
    expect(beforeRows.items[0]).toMatchObject({state:'WEBHOOK_CAPTURED',canonicalOrderId:null});
    expect(beforeRows.items[0]?.snapshot).toMatchObject({
      merchandiseSubtotalMinor:8400,customerPaidMinor:8600,customerPlatformFeeMinor:200,
      merchantCommissionMinor:900,merchantActivityFeeMinor:100,merchantEarningsMinor:7400,
    });
    expect(beforeRows.items[0]?.snapshot.shippingFeeMinor).toBeUndefined();

    const ack=await runtime.fetch(new Request('https://internal/smt/orders/ack',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        schema:'MFK_KEETA_ORDER_ACK_V1',storeId:'MF01',provider:'KEETA',
        providerOrderId:'998',providerMessageId:'commercial-msg-1',
        canonicalOrderId:'MFK-998',canonicalDisplay:'P998',committedAt:'2026-09-23T00:01:00.000Z',
      }),
    }));
    expect(ack.status).toBe(200);

    await runtime.fetch(new Request('https://internal/admin/token/import-test',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({accessToken:'commercial-access',tokenType:'bearer',expiresIn:7776000,refreshToken:'commercial-refresh',scope:'all',issuedAtTime:Date.now()}),
    }));
    const providerFetch=vi.fn(async(input:string|URL|Request)=>new Response(
      JSON.stringify({code:0,message:'Success',data:{orderInfo}}),{status:200,headers:{'content-type':'application/json'}},
    ));
    vi.stubGlobal('fetch',providerFetch);
    try{
      const refresh=await runtime.fetch(new Request('https://internal/admin/commercial/refresh',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({providerOrderId:'998'}),
      }));
      expect(refresh.status).toBe(200);
      const row=await refresh.json() as {state:string;canonicalOrderId:string;snapshot:Record<string,unknown>};
      expect(row.state).toBe('PROVIDER_CONFIRMED');
      expect(row.canonicalOrderId).toBe('MFK-998');
      expect(row.snapshot).toMatchObject({merchantEarningsMinor:7400,merchantCommissionMinor:900});
      expect(row.snapshot.shippingFeeMinor).toBeUndefined();
      expect(String(providerFetch.mock.calls[0]?.[0])).toBe('https://open.mykeeta.com/api/open/order/get');
    }finally{vi.unstubAllGlobals();}
  });

});
