interface Env{
  ASSETS:{fetch(request:Request):Promise<Response>};
  WEB_ACCEPTANCE_TOKEN:string;
}

const COOKIE='mfk_smt_web_acceptance';
const MAX_AGE=72*60*60;

function cookieValue(request:Request,name:string){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){
    const [key,...rest]=part.trim().split('=');
    if(key===name)return decodeURIComponent(rest.join('='));
  }
  return '';
}

function authorized(request:Request,env:Env){
  const token=String(env.WEB_ACCEPTANCE_TOKEN||'');
  if(!token)return false;
  return cookieValue(request,COOKIE)===token;
}

function gateResponse(){
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMT Web Acceptance</title><body style="font-family:system-ui;padding:32px"><h1>SMT Web 驗收模式</h1><p>需要使用臨時驗收連結先可以進入。</p></body>',
    {status:401,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}},
  );
}

async function smmAcceptanceHealth(env:Env){
  try{
    const target='https://smm.morefunos.com/api/smm/acceptance/smt/pending?storeId=MF01';
    const response=await fetch(target,{
      method:'GET',
      headers:{
        accept:'application/json',
        'x-mfk-web-acceptance':String(env.WEB_ACCEPTANCE_TOKEN||''),
      },
    });
    return Object.freeze({ok:response.ok,status:response.status});
  }catch{
    return Object.freeze({ok:false,status:0});
  }
}

async function proxySmmAcceptance(request:Request,url:URL,env:Env){
  const suffix=url.pathname.slice('/__mfk/smm-acceptance'.length)||'/';
  const allowed=
    request.method==='GET'&&suffix==='/pending'||
    request.method==='POST'&&suffix==='/ack';
  if(!allowed)return new Response(JSON.stringify({code:'WEB_ACCEPTANCE_SMM_PROXY_BLOCKED'}),{
    status:403,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });

  const targetPath=suffix==='/pending'
    ?'/api/smm/acceptance/smt/pending'
    :'/api/smm/acceptance/smt/ack';
  const target=new URL('https://smm.morefunos.com'+targetPath);
  target.searchParams.set('storeId','MF01');

  const headers=new Headers();
  headers.set('accept','application/json');
  headers.set('x-mfk-web-acceptance',String(env.WEB_ACCEPTANCE_TOKEN||''));
  if(request.method==='POST')headers.set('content-type','application/json');

  const response=await fetch(target.toString(),{
    method:request.method,
    headers,
    body:request.method==='POST'?await request.text():undefined,
  });
  const outHeaders=new Headers(response.headers);
  outHeaders.set('cache-control','no-store');
  outHeaders.set('content-type','application/json; charset=utf-8');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outHeaders});
}

async function proxyAdmin(request:Request,url:URL){
  const suffix=url.pathname.slice('/__mfk/admin'.length)||'/';
  const allowed=
    request.method==='GET'&&(suffix==='/api/admin-sync/active'||suffix==='/api/admin-sync/events')||
    request.method==='POST'&&suffix==='/api/admin-sync/ack';

  if(!allowed)return new Response(JSON.stringify({code:'WEB_ACCEPTANCE_PROXY_BLOCKED'}),{
    status:403,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });

  if(request.method==='POST'&&suffix==='/api/admin-sync/ack'){
    return new Response(JSON.stringify({
      state:'WEB_ACCEPTANCE_ACK_SKIPPED',
      detail:'Temporary public SMT is not registered as a production device.',
    }),{
      status:200,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
    });
  }

  const target=new URL('https://admin.morefunos.com'+suffix);
  target.search=url.search;

  const headers=new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('host');
  headers.set('origin','https://appassets.androidplatform.net');
  headers.set('x-mfk-web-acceptance','1');

  const upstream=new Request(target.toString(),{
    method:request.method,
    headers,
    body:request.method==='GET'||request.method==='HEAD'?undefined:request.body,
    redirect:'manual',
  });
  return fetch(upstream);
}

export default{
  async fetch(request:Request,env:Env){
    const url=new URL(request.url);
    const supplied=url.searchParams.get('access')||'';
    const expected=String(env.WEB_ACCEPTANCE_TOKEN||'');

    if(expected&&supplied===expected){
      url.searchParams.delete('access');
      const location=url.pathname+(url.search?url.search:'')+(url.hash?url.hash:'');
      return new Response(null,{
        status:302,
        headers:{
          location:location||'/',
          'set-cookie':COOKIE+'='+encodeURIComponent(expected)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+MAX_AGE,
          'cache-control':'no-store',
        },
      });
    }

    if(!authorized(request,env))return gateResponse();

    if(url.pathname==='/__mfk/health'){
      const smmAcceptance=await smmAcceptanceHealth(env);
      return new Response(JSON.stringify({
        ok:true,
        mode:'WEB_ACCEPTANCE_ONLY',
        productionConsumers:false,
        physicalPrint:false,
        cashDrawer:false,
        smmAcceptance,
        expiresInHours:72,
      }),{
        headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
      });
    }

    if(url.pathname.startsWith('/__mfk/smm-acceptance/')){
      return proxySmmAcceptance(request,url,env);
    }

    if(url.pathname.startsWith('/__mfk/admin/')){
      return proxyAdmin(request,url);
    }

    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('cache-control',url.pathname.startsWith('/assets/')?'public, max-age=300':'no-store');
    headers.set('x-mfk-smt-mode','WEB_ACCEPTANCE_ONLY');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};
