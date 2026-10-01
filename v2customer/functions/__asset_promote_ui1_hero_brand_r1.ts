const SOURCE_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/0f574718-cf8e-4e74-84df-95ce1fbd750e.png';
const R2_KEY='customer/ui1/hero/master/hero-brand-r1.png';
const EXPECTED_SHA256='5a4c4d0a148bca33f22c31651c3fcf74b3c0d594687f3173dfb6a06b718692ce';
const TOKEN='ui1-hero-brand-r1-8e5c2a7f4d91c3b6';

const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');

export const onRequestGet=async(context:any)=>{
  const url=new URL(context.request.url);
  if(url.searchParams.get('token')!==TOKEN)return new Response('Forbidden',{status:403});

  const source=await fetch(SOURCE_URL,{cf:{cacheTtl:0}});
  if(!source.ok)return new Response(JSON.stringify({ok:false,stage:'fetch',status:source.status}),{status:502,headers:{'content-type':'application/json'}});

  const body=await source.arrayBuffer();
  const digest=hex(await crypto.subtle.digest('SHA-256',body));
  if(digest!==EXPECTED_SHA256)return new Response(JSON.stringify({ok:false,stage:'sha256',expected:EXPECTED_SHA256,actual:digest}),{status:409,headers:{'content-type':'application/json'}});

  await context.env.CUSTOMER_ASSETS.put(R2_KEY,body,{
    httpMetadata:{contentType:'image/png',cacheControl:'public, max-age=31536000, immutable'},
    customMetadata:{sha256:EXPECTED_SHA256,assetId:'HERO-UI1-BRAND-R1',ownerStatus:'OWNER_CONFIRMED'}
  });

  const check=await context.env.CUSTOMER_ASSETS.head(R2_KEY);
  return new Response(JSON.stringify({
    ok:Boolean(check),
    key:R2_KEY,
    size:check?.size??null,
    etag:check?.etag??null,
    sha256:check?.customMetadata?.sha256??null
  }),{status:check?200:500,headers:{'content-type':'application/json','cache-control':'no-store'}});
};
