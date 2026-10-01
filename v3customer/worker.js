const HERO_MEDIA=Object.freeze({
  '/media/customer/hero/hero-background-main.png':'customer/brand/hero/hero-background-main.png',
  '/media/customer/hero/hero-male-main.png':'customer/brand/hero/hero-male-main.png',
  '/media/customer/hero/hero-female-main.png':'customer/brand/hero/hero-female-main.png',
  '/media/customer/hero/hero-doodle-morefun-main.png':'customer/brand/hero/hero-doodle-morefun-main.png',
  '/media/customer/hero/hero-doodle-goodtaste-main.png':'customer/brand/hero/hero-doodle-goodtaste-main.png',
  '/media/customer/home/chef-product-01.png':'customer/brand/home/chef-product-01.png',
  '/media/customer/home/chef-product-02.png':'customer/brand/home/chef-product-02.png',
  '/media/customer/home/chef-product-03.png':'customer/brand/home/chef-product-03.png',
  '/media/customer/home/chef-product-04.png':'customer/brand/home/chef-product-04.png',
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
      headers.set('content-type','image/png');
      headers.set('cache-control','public, max-age=0, must-revalidate');
      headers.set('etag',object.httpEtag);
      headers.set('x-mfk-asset-key',objectKey);

      if(request.method==='HEAD')return new Response(null,{status:200,headers});
      return new Response(object.body,{status:200,headers});
    }

    return env.ASSETS.fetch(request);
  },
};
