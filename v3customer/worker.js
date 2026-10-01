const HERO_MEDIA=Object.freeze({
  '/media/customer/hero/hero-background-main.png':'customer/brand/hero/hero-background-main.png',
  '/media/customer/hero/hero-male-main.png':'customer/brand/hero/hero-male-main.png',
  '/media/customer/hero/hero-female-main.png':'customer/brand/hero/hero-female-main.png',
  '/media/customer/hero/hero-doodle-morefun-main.png':'customer/brand/hero/hero-doodle-morefun-main.png',
  '/media/customer/hero/hero-doodle-goodtaste-main.png':'customer/brand/hero/hero-doodle-goodtaste-main.png',
  '/media/customer/hero-carousel/home-hero-01.webp':'customer/brand/hero-carousel/home-hero-01.webp',
  '/media/customer/hero-carousel/home-hero-02.webp':'customer/brand/hero-carousel/home-hero-02.webp',
  '/media/customer/hero-carousel/home-hero-03.webp':'customer/brand/hero-carousel/home-hero-03.webp',
  '/media/customer/hero-carousel/home-hero-04.webp':'customer/brand/hero-carousel/home-hero-04.webp',
});

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const objectKey=HERO_MEDIA[url.pathname];

    if(objectKey){
      if(request.method!=='GET'&&request.method!=='HEAD'){
        return new Response('Method Not Allowed',{status:405});
      }

      const object=await env.CUSTOMER_ASSETS.get(objectKey);
      if(!object)return new Response('Not Found',{status:404});

      const headers=new Headers();
      headers.set('content-type',objectKey.endsWith('.webp')?'image/webp':'image/png');
      headers.set('cache-control',objectKey.endsWith('.webp')?'public, max-age=300, stale-while-revalidate=86400':'public, max-age=0, must-revalidate');
      headers.set('etag',object.httpEtag);
      headers.set('x-mfk-asset-key',objectKey);

      if(request.method==='HEAD')return new Response(null,{status:200,headers});
      return new Response(object.body,{status:200,headers});
    }

    return env.ASSETS.fetch(request);
  },
};
