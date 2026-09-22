import {describe,expect,it} from 'vitest';
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

});
