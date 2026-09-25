const ADMIN_ACTIVE='https://admin.morefunos.com/api/admin-sync/active';

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function minor(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}
function json(value:unknown,status=200){
  return new Response(JSON.stringify(value),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
  });
}
function mapPublishedSnapshot(raw:unknown){
  const active=record(raw);
  const snapshot=record(active.snapshot);
  const catalog=record(snapshot.catalog);
  const optionCenter=record(snapshot.optionCenter);
  const availability=record(snapshot.availability);
  const productMedia=record(snapshot.productMedia);
  const storeSettings=record(snapshot.storeSettings);
  const now=new Date().toISOString();

  const categories=list(catalog.categories).map((rawCategory,index)=>{
    const item=record(rawCategory);
    return{
      categoryId:String(item.id??''),
      name:String(item.name??''),
      sortOrder:Number(item.position??index*10)||0,
      active:item.active!==false,
    };
  }).filter(item=>item.categoryId&&item.name&&item.active)
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.categoryId.localeCompare(b.categoryId));
  const categoryIds=new Set(categories.map(item=>item.categoryId));

  const optionSets=new Map(
    list(optionCenter.sets).map(rawSet=>{
      const set=record(rawSet);
      return[String(set.id??''),set] as const;
    }).filter(([id])=>Boolean(id))
  );
  const linksByProduct=new Map<string,Record<string,unknown>[]>();
  for(const rawLink of list(optionCenter.productLinks)){
    const link=record(rawLink);
    const productId=String(link.productId??'');
    if(!productId)continue;
    const rows=linksByProduct.get(productId)??[];
    rows.push(link);
    linksByProduct.set(productId,rows);
  }

  const products=list(catalog.products).map(rawProduct=>{
    const item=record(rawProduct);
    const productId=String(item.id??'');
    const categoryId=String(item.categoryId??'');
    const priceText=String(item.basePrice??'').trim();
    const priceReady=priceText!==''&&Number.isFinite(Number(priceText));
    const baseMinor=minor(priceText);
    const takeawayMinor=baseMinor+minor(item.takeawayAdjustment)+(item.takeawaySurchargeEnabled===true?100:0);
    const sellability=record(availability[productId]);
    const media=record(productMedia[productId]);
    const imageRef=String(media.publicUrl??media.canonicalImageRef??item.imageRef??'').trim();

    const optionGroups=(linksByProduct.get(productId)??[]).flatMap(link=>{
      const set=optionSets.get(String(link.setId??''));
      if(!set||set.active===false)return[];
      const options=list(set.options).map(rawOption=>{
        const option=record(rawOption);
        return{
          optionId:String(option.id??option.code??''),
          name:String(option.name??option.id??option.code??''),
          available:option.active!==false,
          publishedAdjustmentMinor:minor(option.priceAdjustment),
          position:Number(option.position??0)||0,
        };
      }).filter(option=>option.optionId&&option.name&&option.available)
        .sort((a,b)=>a.position-b.position||a.optionId.localeCompare(b.optionId))
        .map(({position,...option})=>option);
      return[{
        optionGroupId:String(set.id??''),
        name:String(set.name??set.id??'選項'),
        required:set.required===true,
        minSelections:Math.max(0,Number(set.min)||0),
        maxSelections:Math.max(1,Number(set.max)||1),
        options,
      }];
    });

    return{
      productId,
      categoryId,
      name:String(item.name??productId),
      description:String(item.description??''),
      ...(imageRef?{imageRef}:{}),
      available:item.active!==false&&sellability.sellable!==false&&priceReady,
      ...(priceReady?{
        publishedTakeawayUnitPriceMinor:takeawayMinor,
        publishedDineInUnitPriceMinor:baseMinor,
      }:{}),
      optionGroups,
      position:Number(item.legacySourcePosition??item.position??0)||0,
    };
  }).filter(item=>item.productId&&categoryIds.has(item.categoryId)&&item.available)
    .sort((a,b)=>a.position-b.position||a.productId.localeCompare(b.productId))
    .map(({position,...item})=>item);

  return{
    connectionPath:'INTERNET',
    menu:{
      revision:String(active.revision??'0'),
      observedAt:String(active.publishedAt??now),
      categories:categories.map(({active,...item})=>item),
      products,
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
      storeId:String(active.storeId??'MF01'),
      deviceLabel:'Internet',
    },
    businessDay:undefined,
    observedAt:now,
    storeName:String(storeSettings.storeName??'磨飯'),
  };
}

export default{
  async fetch(request:Request,env:{ASSETS:{fetch(request:Request):Promise<Response>}}){
    const url=new URL(request.url);
    if(url.pathname==='/api/smm/snapshot'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const storeId=(url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';
      const upstream=new URL(ADMIN_ACTIVE);
      upstream.searchParams.set('storeId',storeId);
      let response:Response;
      try{
        response=await fetch(upstream,{headers:{accept:'application/json','cache-control':'no-cache'}});
      }catch{
        return json({code:'SMM_INTERNET_UPSTREAM_UNAVAILABLE'},503);
      }
      if(!response.ok)return json({code:'SMM_CONFIG_NOT_PUBLISHED'},response.status===404?503:response.status);
      let body:unknown;
      try{body=await response.json();}catch{return json({code:'SMM_INTERNET_UPSTREAM_INVALID'},502);}
      return json(mapPublishedSnapshot(body));
    }
    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-smm-web',internetProjection:'admin-published-config'});
    return env.ASSETS.fetch(request);
  },
};
