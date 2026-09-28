import {describe,expect,it,vi} from 'vitest';
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
});
