const MAX_BYTES=8*1024*1024;
const ALLOWED_TYPES=new Map([
  ['image/jpeg','jpg'],
  ['image/png','png'],
  ['image/webp','webp'],
  ['image/avif','avif'],
]);
const PREVIEW_ORIGIN='https://mfk-admin-v3-ui-preview.pages.dev';

function cors(request){
  const origin=request.headers.get('origin')||'';
  const allowed=origin===PREVIEW_ORIGIN||origin.endsWith('.mfk-admin-v3-ui-preview.pages.dev');
  return {
    'access-control-allow-origin':allowed?origin:PREVIEW_ORIGIN,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type,x-mfk-preview',
    'access-control-max-age':'600',
    'vary':'Origin',
  };
}
function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
}
function safePart(value,max=96){
  const text=String(value||'').trim();
  if(!text||text.length>max||!/^[A-Za-z0-9._:-]+$/.test(text))return '';
  return text;
}
async function sha256(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});

    if(url.pathname==='/api/health'){
      return json({ok:true,service:'mfk-admin-v3-preview-media',storage:'R2_ONLY'},200,cors(request));
    }

    if(url.pathname==='/api/product-media'&&request.method==='POST'){
      const origin=request.headers.get('origin')||'';
      if(origin!==PREVIEW_ORIGIN&&!origin.endsWith('.mfk-admin-v3-ui-preview.pages.dev')){
        return json({code:'PREVIEW_ORIGIN_FORBIDDEN'},403,cors(request));
      }
      const storeId=safePart(url.searchParams.get('storeId'),32);
      const productId=safePart(url.searchParams.get('productId'));
      const surface=String(url.searchParams.get('surface')||'').toUpperCase();
      if(!storeId||!productId)return json({code:'PRODUCT_MEDIA_ID_INVALID'},400,cors(request));
      if(surface!=='CUSTOMER'&&surface!=='KEETA')return json({code:'PRODUCT_MEDIA_SURFACE_INVALID'},400,cors(request));

      const contentType=String(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
      const ext=ALLOWED_TYPES.get(contentType);
      if(!ext)return json({code:'PRODUCT_MEDIA_TYPE_INVALID'},415,cors(request));
      const declared=Number(request.headers.get('content-length')||0);
      if(declared>MAX_BYTES)return json({code:'PRODUCT_MEDIA_TOO_LARGE'},413,cors(request));
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength<1||bytes.byteLength>MAX_BYTES)return json({code:'PRODUCT_MEDIA_SIZE_INVALID'},413,cors(request));

      const sha=await sha256(bytes);
      const objectKey='product-media/'+storeId+'/'+productId+'/'+surface.toLowerCase()+'/'+sha+'.'+ext;
      await env.PRODUCT_MEDIA.put(objectKey,bytes,{
        httpMetadata:{contentType},
        customMetadata:{storeId,productId,surface,sha256:sha,kind:'PRODUCT_MEDIA',uploadedAt:new Date().toISOString()},
      });
      const mediaUrl=url.origin+'/media/products?ref='+encodeURIComponent(objectKey);
      return json({state:'UPLOADED',storage:'R2',objectKey,mediaUrl,sha256:sha,surface,uploadedAt:new Date().toISOString()},201,cors(request));
    }

    if(url.pathname==='/media/products'&&request.method==='GET'){
      const ref=String(url.searchParams.get('ref')||'').trim();
      if(!ref.startsWith('product-media/'))return new Response('Bad Request',{status:400});
      const object=await env.PRODUCT_MEDIA.get(ref);
      if(!object||object.customMetadata?.kind!=='PRODUCT_MEDIA')return new Response('Not Found',{status:404});
      const headers=new Headers();
      headers.set('content-type',object.httpMetadata?.contentType||'application/octet-stream');
      headers.set('cache-control','public, max-age=31536000, immutable');
      headers.set('etag',object.httpEtag);
      headers.set('x-mfk-media-storage','R2');
      return new Response(object.body,{status:200,headers});
    }

    return json({code:'NOT_FOUND'},404,cors(request));
  },
};
