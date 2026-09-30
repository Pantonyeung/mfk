interface Env{
  ASSETS:{fetch(request:Request):Promise<Response>};
  MFK_SOURCE_SHA?:string;
  MFK_BUILD_ID?:string;
  MFK_VERSION?:{id?:string;timestamp?:string};
}

function json(value:unknown,status=200){
  return new Response(JSON.stringify(value),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}

async function proxyAdmin(request:Request,url:URL){
  const suffix=url.pathname.slice('/__mfk/admin'.length)||'/';
  const allowed=
    request.method==='GET'&&(suffix==='/api/admin-sync/active'||suffix==='/api/admin-sync/events')||
    request.method==='POST'&&suffix==='/api/admin-sync/ack';
  if(!allowed)return json({code:'SMT_PUBLIC_MIRROR_PROXY_BLOCKED'},403);

  if(request.method==='POST'&&suffix==='/api/admin-sync/ack'){
    return json({state:'PUBLIC_MIRROR_ACK_SKIPPED'});
  }

  const target=new URL('https://admin.morefunos.com'+suffix);
  target.search=url.search;
  const headers=new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('host');
  headers.set('origin','https://appassets.androidplatform.net');

  const upstream=new Request(target.toString(),{
    method:request.method,
    headers,
    body:request.method==='GET'||request.method==='HEAD'?undefined:request.body,
    redirect:'manual',
  });
  return fetch(upstream);
}

function assetResponse(response:Response,request:Request,url:URL,env:Env){
  const headers=new Headers(response.headers);
  const contentType=String(headers.get('content-type')||'').toLowerCase();
  const acceptsHtml=String(request.headers.get('accept')||'').toLowerCase().includes('text/html');
  if(contentType.includes('text/html')||acceptsHtml){
    headers.set('cache-control','no-cache, must-revalidate, max-age=0');
  }else if(url.pathname.startsWith('/assets/')){
    headers.set('cache-control','public, max-age=31536000, immutable');
  }
  headers.set('x-mfk-smt-mode','PUBLIC_MIRROR');
  headers.set('x-mfk-source-sha',String(env.MFK_SOURCE_SHA||'UNKNOWN'));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export default{
  async fetch(request:Request,env:Env){
    const url=new URL(request.url);

    if(url.pathname==='/__mfk/build'){
      return json({
        product:'MFK',
        surface:'SMT',
        mode:'PUBLIC_MIRROR',
        sourceSha:String(env.MFK_SOURCE_SHA||'UNKNOWN'),
        buildId:String(env.MFK_BUILD_ID||env.MFK_VERSION?.id||'UNKNOWN'),
        deployedAt:String(env.MFK_VERSION?.timestamp||'UNKNOWN'),
      });
    }

    if(url.pathname==='/__mfk/health'){
      return json({
        ok:true,
        mode:'PUBLIC_MIRROR',
        sourceSha:String(env.MFK_SOURCE_SHA||'UNKNOWN'),
        canonicalConfig:'ADMIN',
        transactionAuthority:false,
        physicalPrint:false,
        cashDrawer:false,
      });
    }

    if(url.pathname.startsWith('/__mfk/admin/'))return proxyAdmin(request,url);

    const response=await env.ASSETS.fetch(request);
    return assetResponse(response,request,url,env);
  },
};
