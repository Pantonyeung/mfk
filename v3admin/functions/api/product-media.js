const MAX_BYTES=8*1024*1024;
const TYPES=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/avif','avif']]);

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});}
function safePart(value,max=96){
  const text=String(value||'').trim();
  return text&&text.length<=max&&/^[A-Za-z0-9._:-]+$/.test(text)?text:'';
}
async function sha256(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

export async function onRequestOptions(){
  return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600'}});
}

export async function onRequestPost(context){
  const request=context.request;
  const url=new URL(request.url);
  const storeId=safePart(url.searchParams.get('storeId'),32);
  const productId=safePart(url.searchParams.get('productId'));
  const surface=String(url.searchParams.get('surface')||'').toUpperCase();
  if(!storeId||!productId)return json({code:'PRODUCT_MEDIA_ID_INVALID'},400);
  if(surface!=='CUSTOMER'&&surface!=='KEETA')return json({code:'PRODUCT_MEDIA_SURFACE_INVALID'},400);

  const contentType=String(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
  const ext=TYPES.get(contentType);
  if(!ext)return json({code:'PRODUCT_MEDIA_TYPE_INVALID'},415);
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength<1||bytes.byteLength>MAX_BYTES)return json({code:'PRODUCT_MEDIA_SIZE_INVALID'},413);
  const sha=await sha256(bytes);
  const objectKey='product-media/'+storeId+'/'+productId+'/'+surface.toLowerCase()+'/'+sha+'.'+ext;
  await context.env.PRODUCT_MEDIA.put(objectKey,bytes,{
    httpMetadata:{contentType},
    customMetadata:{storeId,productId,surface,sha256:sha,kind:'PRODUCT_MEDIA',uploadedAt:new Date().toISOString()},
  });
  const mediaUrl=url.origin+'/media/products?ref='+encodeURIComponent(objectKey);
  return json({state:'UPLOADED',storage:'R2',objectKey,mediaUrl,sha256:sha,surface,uploadedAt:new Date().toISOString()},201);
}
