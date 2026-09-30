function ownerAssetResponse(response,request,url,env){
  const headers=new Headers(response.headers);
  const contentType=String(headers.get('content-type')||'').toLowerCase();
  const acceptsHtml=String(request.headers.get('accept')||'').toLowerCase().includes('text/html');
  if(contentType.includes('text/html')||acceptsHtml){
    headers.set('cache-control','no-cache, must-revalidate, max-age=0');
    headers.set('x-mfk-build-id',String(env.MFK_SOURCE_SHA||env.MFK_VERSION?.id||'UNKNOWN'));
  }else if(url.pathname.startsWith('/assets/')){
    headers.set('cache-control','public, max-age=31536000, immutable');
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/__mfk/build')return new Response(JSON.stringify({buildId:String(env.MFK_SOURCE_SHA||env.MFK_VERSION?.id||'UNKNOWN'),deployedAt:String(env.MFK_VERSION?.timestamp||'UNKNOWN')}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    if(url.pathname==='/api/health'){
      return new Response(JSON.stringify({
        ok:true,
        service:'mfk-owner',
        mode:'PRESENTATION_AND_AUTHENTICATED_READ_ONLY',
      }),{
        status:200,
        headers:{
          'content-type':'application/json; charset=utf-8',
          'cache-control':'no-store',
        },
      });
    }
    const response=await env.ASSETS.fetch(request);
    return ownerAssetResponse(response,request,url,env);
  },
};
