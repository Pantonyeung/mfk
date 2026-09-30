const UI0_KEY='ui/ui0/opening-mobile-v1.MP4';

export const onRequest=async(context)=>{
  const method=context.request.method;
  if(method!=='GET'&&method!=='HEAD')return new Response('Method Not Allowed',{status:405});
  const raw=context.params.path;
  const path=Array.isArray(raw)?raw.join('/'):String(raw||'');
  if(path!=='ui0/opening-mobile-v1.mp4')return new Response('Not Found',{status:404});
  const object=await context.env.CUSTOMER_ASSETS.get(UI0_KEY);
  if(!object)return new Response('Not Found',{status:404});
  const headers=new Headers();
  headers.set('content-type','video/mp4');
  headers.set('cache-control','public, max-age=86400');
  headers.set('etag',object.httpEtag);
  if(method==='HEAD')return new Response(null,{status:200,headers});
  return new Response(object.body,{status:200,headers});
};
