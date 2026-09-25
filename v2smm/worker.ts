const ADMIN_CUSTOMER_SNAPSHOT='https://admin.morefunos.com/api/customer/snapshot';

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function json(value:unknown,status=200){
  return new Response(JSON.stringify(value),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}
function mapInternetSnapshot(raw:unknown){
  const source=record(raw);
  const store=record(source.store);
  const menu=record(source.menu);
  const now=new Date().toISOString();
  return{
    connectionPath:'INTERNET',
    menu:{
      revision:String(menu.revision??'0'),
      observedAt:String(menu.observedAt??now),
      categories:list(menu.categories).map(rawCategory=>{
        const item=record(rawCategory);
        return{
          categoryId:String(item.categoryId??''),
          name:String(item.name??''),
          sortOrder:Number(item.sortOrder)||0,
        };
      }).filter(item=>item.categoryId&&item.name),
      products:list(menu.products).map(rawProduct=>{
        const item=record(rawProduct);
        const imageRef=String(item.imageUrl??item.imageRef??'').trim();
        return{
          productId:String(item.productId??''),
          categoryId:String(item.categoryId??''),
          name:String(item.name??''),
          description:String(item.description??''),
          ...(imageRef?{imageRef}:{}),
          available:item.available!==false,
          optionGroups:list(item.optionGroups).map(rawGroup=>{
            const group=record(rawGroup);
            return{
              optionGroupId:String(group.optionGroupId??''),
              name:String(group.name??''),
              required:group.required===true,
              minSelections:Math.max(0,Number(group.minSelections)||0),
              maxSelections:Math.max(1,Number(group.maxSelections)||1),
              options:list(group.options).map(rawOption=>{
                const option=record(rawOption);
                return{
                  optionId:String(option.optionId??''),
                  name:String(option.name??''),
                  available:option.available!==false,
                };
              }).filter(option=>option.optionId&&option.name),
            };
          }).filter(group=>group.optionGroupId&&group.name),
        };
      }).filter(item=>item.productId&&item.categoryId&&item.name),
    },
    orders:[],
    work:[],
    channels:[{
      channel:'INTERNET',
      state:'CONNECTED',
      detail:'Admin published menu/config projection',
      observedAt:now,
    }],
    dineSessions:[],
    printHealth:[],
    refundRequests:[],
    staff:{
      actorId:'SMM-INTERNET',
      displayName:'店員模式',
      roleLabel:'SMM',
      storeId:String(store.storeId??'MF01'),
      deviceLabel:'Internet',
    },
    observedAt:now,
  };
}

export default{
  async fetch(request:Request,env:{ASSETS:{fetch(request:Request):Promise<Response>}}){
    const url=new URL(request.url);
    if(url.pathname==='/api/smm/snapshot'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const storeId=(url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';
      const upstream=new URL(ADMIN_CUSTOMER_SNAPSHOT);
      upstream.searchParams.set('storeId',storeId);
      let response:Response;
      try{
        response=await fetch(upstream,{headers:{accept:'application/json','cache-control':'no-cache'}});
      }catch{
        return json({code:'SMM_INTERNET_UPSTREAM_UNAVAILABLE'},503);
      }
      if(!response.ok)return json({code:'SMM_INTERNET_UPSTREAM_'+response.status},response.status===404?503:response.status);
      let body:unknown;
      try{body=await response.json();}catch{return json({code:'SMM_INTERNET_UPSTREAM_INVALID'},502);}
      return json(mapInternetSnapshot(body));
    }
    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-smm-web',internetProjection:'admin-public-read'});
    return env.ASSETS.fetch(request);
  },
};
