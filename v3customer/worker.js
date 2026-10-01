const HERO_BACKGROUND_KEY='customer/brand/hero/hero-background-main.png';

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname==='/media/customer/hero/hero-background-main.png'){
      if(request.method!=='GET'&&request.method!=='HEAD'){
        return new Response('Method Not Allowed',{status:405});
      }

      const object=await env.CUSTOMER_ASSETS.get(HERO_BACKGROUND_KEY);
      if(!object)return new Response('Not Found',{status:404});

      const headers=new Headers();
      headers.set('content-type','image/png');
      headers.set('cache-control','public, max-age=0, must-revalidate');
      headers.set('etag',object.httpEtag);
      headers.set('x-mfk-asset-key',HERO_BACKGROUND_KEY);

      if(request.method==='HEAD')return new Response(null,{status:200,headers});
      return new Response(object.body,{status:200,headers});
    }

    return env.ASSETS.fetch(request);
  },
};
