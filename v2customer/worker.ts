const UI0_OBJECT_KEY='ui/ui0/opening-mobile-v1.MP4';
const CUSTOMER_UI1_CONTRACT='five-state-home-v1';

function assetResponse(response,request,url,env){
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
    if(url.pathname==='/__mfk/build'){
      return new Response(JSON.stringify({buildId:String(env.MFK_SOURCE_SHA||env.MFK_VERSION?.id||'UNKNOWN'),ui1:CUSTOMER_UI1_CONTRACT}),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    }
    if(url.pathname==='/media/ui0/opening-mobile-v1.mp4'){
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405});
      const object=await env.CUSTOMER_ASSETS.get(UI0_OBJECT_KEY);
      if(!object)return new Response('Not Found',{status:404});
      const headers=new Headers();
      headers.set('content-type','video/mp4');
      headers.set('cache-control','public, max-age=86400, immutable');
      headers.set('etag',object.httpEtag);
      if(request.method==='HEAD')return new Response(null,{status:200,headers});
      return new Response(object.body,{status:200,headers});
    }
    const response=await env.ASSETS.fetch(request);
    return assetResponse(response,request,url,env);
  },
};
