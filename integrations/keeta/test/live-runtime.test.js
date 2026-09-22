import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exchangeKeetaAuthorizationCodeRuntime,
  sendKeetaSignedJsonRuntime,
} from '../src/live-runtime.js';
import {signKeetaShape} from '../src/signature.js';

test('live runtime signs and POSTs official Keeta JSON shape only',async()=>{
  const calls=[];
  const fetcher=async(url,init)=>{
    calls.push({url,init});
    return new Response(JSON.stringify({code:0,message:'ok',data:{shopId:123}}),{
      status:200,
      headers:{'content-type':'application/json'},
    });
  };
  const url='https://open.mykeeta.com/api/open/scm/shop/base/get';
  const params={accessToken:'TOKEN',appId:123,timestamp:1770000000,shopId:456};
  const result=await sendKeetaSignedJsonRuntime({url,params,appSecret:'SECRET',fetcher});
  assert.equal(result.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].init.method,'POST');
  const body=JSON.parse(calls[0].init.body);
  assert.equal(body.sig,signKeetaShape(url,params,'SECRET').sig);
  assert.equal(body.shopId,456);
});

test('live runtime exchanges OAuth code through signed token endpoint',async()=>{
  const fetcher=async(url,init)=>{
    assert.equal(url,'https://open.mykeeta.com/api/open/base/oauth/token');
    const body=JSON.parse(init.body);
    assert.equal(body.appId,123);
    assert.equal(body.grantType,'authorization_code');
    assert.equal(body.code,'CODE-1');
    assert.match(body.sig,/^[0-9a-f]{64}$/);
    return new Response(JSON.stringify({
      accessToken:'ACCESS',
      tokenType:'bearer',
      expiresIn:3600,
      refreshToken:'REFRESH',
      scope:'all',
      issuedAtTime:1770000000000,
    }),{status:200});
  };
  const token=await exchangeKeetaAuthorizationCodeRuntime({
    appId:123,
    code:'CODE-1',
    timestamp:1770000000,
    appSecret:'SECRET',
    fetcher,
  });
  assert.equal(token.accessToken,'ACCESS');
  assert.equal(token.refreshToken,'REFRESH');
});

test('live runtime rejects non-HTTPS provider target',async()=>{
  await assert.rejects(
    ()=>sendKeetaSignedJsonRuntime({
      url:'http://open.mykeeta.com/api/open/scm/shop/base/get',
      params:{appId:1},
      appSecret:'SECRET',
      fetcher:async()=>new Response('{}',{status:200}),
    }),
    /KEETA_HTTPS_REQUIRED/,
  );
});
