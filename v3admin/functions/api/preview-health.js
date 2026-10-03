export async function onRequestGet(context){
  const binding=Boolean(context.env.PRODUCT_MEDIA);
  return new Response(JSON.stringify({ok:binding,service:'mfk-admin-v3-preview-pages',storage:binding?'R2_ONLY':'MISSING'}),{
    status:binding?200:503,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
