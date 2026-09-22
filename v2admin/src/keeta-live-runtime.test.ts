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
      'KEETA_OAUTH_REDIRECT_URI',
    ]);

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
});
