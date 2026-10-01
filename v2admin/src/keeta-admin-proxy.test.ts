import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import worker from '../worker.ts';

describe('Keeta admin proxy',()=>{
  it('authorizes with a synthetic GET then forwards POST status without reusing the request stream',async()=>{
    const adminFetch=vi.fn(async(request:Request)=>{
      expect(request.method).toBe('GET');
      expect(new URL(request.url).pathname).toBe('/authorize-admin');
      expect(request.headers.get('origin')).toBe('https://admin.morefunos.com');
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
    });
    const keetaFetch=vi.fn(async(request:Request)=>{
      expect(request.method).toBe('POST');
      expect(new URL(request.url).pathname).toBe('/admin/status');
      return new Response(JSON.stringify({provider:'KEETA',readyForAuthorization:true}),{
        status:200,
        headers:{'content-type':'application/json'},
      });
    });
    const env={
      ADMIN_SYNC:{
        idFromName:()=>({}),
        get:()=>({fetch:adminFetch}),
      },
      KEETA_RUNTIME:{
        idFromName:()=>({}),
        get:()=>({fetch:keetaFetch}),
      },
    };
    const request=new Request('https://admin.morefunos.com/api/keeta/admin/status?storeId=MF01',{
      method:'POST',
      headers:{
        origin:'https://admin.morefunos.com',
        'sec-fetch-site':'same-origin',
        'x-mfk-admin-publish-key':'a'.repeat(64),
      },
    });
    const response=await worker.fetch(request,env as never);
    expect(response.status).toBe(200);
    expect(adminFetch).toHaveBeenCalledTimes(1);
    expect(keetaFetch).toHaveBeenCalledTimes(1);
  });

  it('requires operator recovery context and forwards the exact KEETA HeadSeq to full-menu recovery',async()=>{
    const adminFetch=vi.fn(async(request:Request)=>{
      const path=new URL(request.url).pathname;
      if(path==='/authorize-admin')return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});
      if(path==='/active')return new Response(JSON.stringify({revision:9,fingerprint:'sha256:active',snapshot:{catalog:{categories:[],products:[]},optionCenter:{sets:[],productLinks:[]}}}),{headers:{'content-type':'application/json'}});
      if(path==='/internal/sync/head')return new Response(JSON.stringify({headSeq:77}),{headers:{'content-type':'application/json'}});
      throw new Error('UNEXPECTED_ADMIN_PATH:'+path);
    });
    const keetaFetch=vi.fn(async(request:Request)=>{
      expect(new URL(request.url).pathname).toBe('/admin/menu/sync');
      expect(await request.json()).toMatchObject({reason:'provider state lost',sourceToSeq:77,revision:9});
      return new Response(JSON.stringify({state:'PENDING',operation:'RECOVERY_FULL_MENU_SYNC',taskId:1}),{headers:{'content-type':'application/json'}});
    });
    const env={
      ADMIN_SYNC:{idFromName:()=>({}),get:()=>({fetch:adminFetch})},
      KEETA_RUNTIME:{idFromName:()=>({}),get:()=>({fetch:keetaFetch})},
    };
    const response=await worker.fetch(new Request('https://admin.morefunos.com/api/keeta/admin/menu/sync?storeId=MF01',{
      method:'POST',headers:{origin:'https://admin.morefunos.com','sec-fetch-site':'same-origin','x-mfk-admin-publish-key':'a'.repeat(64),'content-type':'application/json'},
      body:JSON.stringify({reason:'provider state lost'}),
    }),env as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({state:'PENDING',operation:'RECOVERY_FULL_MENU_SYNC'});
  });

  it('keeps Keeta Admin control usable in a clean browser session without the legacy publisher key',()=>{
    const client=readFileSync(new URL('./keeta-live-client.ts',import.meta.url),'utf8');
    const source=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    expect(client).toContain('readStoredAdminBrowserSession');
    expect(client).toContain("'x-mfk-admin-session':session.sessionToken");
    expect(source).toContain("request.headers.get('x-mfk-admin-session')");
    expect(source).toContain('await this.readAdminBrowserSession(request)');
  });

  it('recovers one stale normal-browser Admin session before Keeta operations fail',()=>{
    const client=readFileSync(new URL('./keeta-live-client.ts',import.meta.url),'utf8');
    expect(client).toContain('refreshAdminBrowserSession');
    expect(client).toContain('response.status===401');
    expect(client).toContain('await refreshAdminBrowserSession()');
    expect(client).toContain('response=await run()');
  });
});
