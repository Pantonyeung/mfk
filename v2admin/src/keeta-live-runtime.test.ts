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
    const body=await statusResponse.json() as {oauth:{lastCallbackResult:string;lastCallbackError:string}};
    expect(body.oauth.lastCallbackResult).toBe('FAILED');
    expect(body.oauth.lastCallbackError).toBe('KEETA_OAUTH_CODE_REQUIRED');
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

});
