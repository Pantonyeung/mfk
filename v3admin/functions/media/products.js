export async function onRequestGet(context){
  const url=new URL(context.request.url);
  const ref=String(url.searchParams.get('ref')||'').trim();
  if(!ref.startsWith('product-media/'))return new Response('Bad Request',{status:400});
  const object=await context.env.PRODUCT_MEDIA.get(ref);
  if(!object||object.customMetadata?.kind!=='PRODUCT_MEDIA')return new Response('Not Found',{status:404});
  const headers=new Headers();
  headers.set('content-type',object.httpMetadata?.contentType||'application/octet-stream');
  headers.set('cache-control','public, max-age=31536000, immutable');
  headers.set('etag',object.httpEtag);
  headers.set('x-mfk-media-storage','R2');
  return new Response(object.body,{status:200,headers});
}
