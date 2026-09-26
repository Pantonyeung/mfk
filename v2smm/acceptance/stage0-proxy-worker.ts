export interface Env {
  readonly ASSETS: Fetcher;
}

const UPSTREAM='https://smm.morefunos.com';
const PRODUCT_SOURCE='aad53d5b76a1ca6ac2e9ae175b755c69fd2f58be';

const ALLOWED_STAGE0_ROUTES=new Set([
  'GET /api/smm/snapshot',
  'GET /api/smm/staff',
  'POST /api/smm/staff/challenge',
  'POST /api/smm/staff/verify',
  'GET /api/smm/staff/session',
  'POST /api/smm/staff/session',
]);

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
    },
  });
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);

    if(url.pathname==='/api/health'){
      return json({
        ok:true,
        service:'mfk-smm-stage0-ui-acceptance',
        productSource:PRODUCT_SOURCE,
        stage:'STAGE0_ONLY',
        upstream:'smm.morefunos.com',
      });
    }

    if(url.pathname.startsWith('/api/')){
      const route=request.method.toUpperCase()+' '+url.pathname;
      if(!ALLOWED_STAGE0_ROUTES.has(route)){
        return json({
          code:'SMM_STAGE0_ACCEPTANCE_ROUTE_BLOCKED',
          message:'Stage 0 驗收環境只開放啟動、連線及員工登入所需 API。',
        },403);
      }

      const upstream=new URL(url.pathname+url.search,UPSTREAM);
      const headers=new Headers(request.headers);
      headers.delete('host');
      headers.set('x-mfk-acceptance-surface','SMM_STAGE0_UI');

      return fetch(new Request(upstream.toString(),{
        method:request.method,
        headers,
        body:request.method==='GET'||request.method==='HEAD'?undefined:request.body,
        redirect:'manual',
      }));
    }

    return env.ASSETS.fetch(request);
  },
};
