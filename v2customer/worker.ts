const UI0_OBJECT_KEY='ui/ui0/opening-mobile-v1.MP4';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
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
    return env.ASSETS.fetch(request);
  },
};
