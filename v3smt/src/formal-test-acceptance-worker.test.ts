import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import worker,{type FormalTestAcceptanceEnv} from './formal-test-acceptance-worker.ts';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

function makeEnv(){
  const assetFetch=vi.fn(async()=>new Response('<!doctype html><title>MoreFun POS V3</title>',{headers:{'content-type':'text/html; charset=utf-8'}}));
  const env:FormalTestAcceptanceEnv={
    ASSETS:{fetch:assetFetch},
    MFK_SOURCE_SHA:'0123456789abcdef0123456789abcdef01234567',
    MFK_BUILD_ID:'mfp-v3-test-build',
    MFK_VERSION:{id:'version-test',timestamp:'2026-10-03T00:00:00.000Z'},
  };
  return {env,assetFetch};
}

describe('formal POS TEST_ACCEPTANCE worker',()=>{
  it('exposes an anonymous exact build identity',async()=>{
    const {env,assetFetch}=makeEnv();
    const response=await worker.fetch(new Request('https://smt.morefunos.com/__mfk/build'),env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product:'MFK',surface:'SMT',mode:'TEST_ACCEPTANCE',
      sourceSha:'0123456789abcdef0123456789abcdef01234567',
      buildId:'mfp-v3-test-build',deployedAt:'2026-10-03T00:00:00.000Z',authRequired:false,
    });
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('states every intentionally disconnected capability',async()=>{
    const {env}=makeEnv();
    const response=await worker.fetch(new Request('https://smt.morefunos.com/__mfk/health'),env);
    expect(await response.json()).toMatchObject({
      ok:true,mode:'TEST_ACCEPTANCE',authRequired:false,backendProxy:false,
      checkoutConnected:false,physicalPrintConnected:false,cashDrawerConnected:false,
    });
  });

  it.each(['/api/orders','/api/checkout','/__mfk/admin/status','/__mfk/smm-acceptance/pending'])('never proxies legacy route %s',async(path)=>{
    const {env,assetFetch}=makeEnv();
    const response=await worker.fetch(new Request('https://smt.morefunos.com'+path),env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({code:'MFP_V3_TEST_ACCEPTANCE_BACKEND_NOT_BOUND',state:'UNAVAILABLE'});
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it.each(['POST','PUT','PATCH','DELETE'])('blocks unsupported %s requests before assets',async(method)=>{
    const {env,assetFetch}=makeEnv();
    const response=await worker.fetch(new Request('https://smt.morefunos.com/cart',{method}),env);
    expect(response.status).toBe(405);
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('serves V3 assets anonymously with explicit acceptance headers',async()=>{
    const {env,assetFetch}=makeEnv();
    const response=await worker.fetch(new Request('https://smt.morefunos.com/'),env);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-mfk-smt-mode')).toBe('TEST_ACCEPTANCE');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('MoreFun POS V3');
    expect(assetFetch).toHaveBeenCalledOnce();
  });

  it('uses the formal service and introduces no credential requirement',()=>{
    const config=read('../wrangler.formal-test-acceptance.jsonc');
    expect(config).toContain('"name": "mfk-smt-web"');
    expect(config).toContain('"binding": "ASSETS"');
    expect(config).not.toContain('"secrets"');
    expect(config).not.toContain('WEB_ACCEPTANCE_TOKEN');
  });

  it('renders visible truth labels for checkout, print and backend state',()=>{
    const app=read('./App.tsx');
    expect(app).toContain('測試驗收模式');
    expect(app).toContain('結帳：尚未接通正式交易');
    expect(app).toContain('打印：尚未接通實體打印');
    expect(app).toContain('後端：不代理舊系統 API');
  });
});
