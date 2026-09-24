function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function rows(value:unknown):unknown[]{return Array.isArray(value)?value:[];}
function text(value:unknown,fallback=''){return typeof value==='string'?value:fallback;}
function bool(value:unknown,fallback=false){return typeof value==='boolean'?value:fallback;}
function integer(value:unknown,fallback=0){
  const n=Number(value);return Number.isSafeInteger(n)?n:fallback;
}
function minorFromDollar(value:unknown){
  const n=Number(value);return Number.isFinite(n)?Math.round(n*100):0;
}
function moneyLabel(minor:number){return 'HK$'+(minor/100).toFixed(2);}
function unique<T>(values:readonly T[]):T[]{return [...new Set(values)];}

export function projectCustomerPublicSnapshot(active:any,customerOrders:any[]=[]){
  const snapshot=record(active?.snapshot);
  const catalog=record(snapshot.catalog);
  const optionCenter=record(snapshot.optionCenter);
  const availability=record(snapshot.availability);
  const productMedia=record(snapshot.productMedia);
  const settings=record(snapshot.storeSettings);
  const presentation=record(record(snapshot.presentation).customer);
  const customerChannel=record(snapshot.customerChannelPolicy);

  const categories=rows(catalog.categories)
    .map((raw,index)=>{
      const item=record(raw);
      return {
        id:text(item.id),
        name:text(item.name),
        position:integer(item.position,(index+1)*10),
        active:bool(item.active,true),
      };
    })
    .filter(item=>item.id&&item.name&&item.active)
    .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const categoryIds=new Set(categories.map(item=>item.id));

  const sets=new Map(
    rows(optionCenter.sets)
      .map(raw=>{const item=record(raw);return[text(item.id),item] as const;})
      .filter(([id])=>Boolean(id))
  );
  const linksByProduct=new Map<string,Record<string,unknown>[]>();
  for(const raw of rows(optionCenter.productLinks)){
    const link=record(raw);
    const productId=text(link.productId);
    if(!productId)continue;
    const list=linksByProduct.get(productId)??[];
    list.push(link);
    linksByProduct.set(productId,list);
  }

  const products=rows(catalog.products)
    .map((raw,index)=>{
      const item=record(raw);
      const productId=text(item.id);
      const categoryId=text(item.categoryId);
      const sellability=record(availability[productId]);
      const media=record(productMedia[productId]);
      const basePrice=text(item.basePrice);
      const priceReady=basePrice.trim()!==''&&Number.isFinite(Number(basePrice));
      const takeawaySurcharge=bool(item.takeawaySurchargeEnabled,false)?100:0;
      const takeawayAdjustment=minorFromDollar(item.takeawayAdjustment);
      const priceMinor=minorFromDollar(basePrice)+takeawaySurcharge+takeawayAdjustment;

      const optionGroups=(linksByProduct.get(productId)??[]).flatMap(link=>{
        const set=sets.get(text(link.setId));
        if(!set||set.active===false)return[];
        const options=rows(set.options)
          .map((optionRaw,optionIndex)=>{
            const option=record(optionRaw);
            const optionId=text(option.id)||text(option.code);
            return {
              optionId,
              name:text(option.name,optionId),
              available:bool(option.active,true),
              position:integer(option.position,optionIndex*10),
            };
          })
          .filter(option=>option.optionId&&option.name&&option.available)
          .sort((a,b)=>a.position-b.position||a.optionId.localeCompare(b.optionId))
          .map(({position:_,...option})=>option);

        return [{
          optionGroupId:text(set.id),
          name:text(set.name,text(set.id,'選項')),
          required:bool(set.required,false),
          minSelections:Math.max(0,integer(set.min,0)),
          maxSelections:Math.max(1,integer(set.max,1)),
          options,
        }];
      });

      const imageUrl=text(media.publicUrl)||text(media.canonicalImageRef)||text(item.imageRef);
      const tags=rows(item.tags).map(value=>text(value)).filter(Boolean);

      return {
        productId,
        categoryId,
        name:text(item.name,productId),
        description:text(item.description),
        ...(tags[0]?{badge:tags[0]}:{}),
        available:bool(item.active,true)&&sellability.sellable!==false,
        ...(priceReady?{displayPriceLabel:moneyLabel(priceMinor)}:{}),
        ...(imageUrl?{imageUrl,imageAlt:text(item.name,productId)}:{}),
        optionGroups,
        position:integer(item.legacySourcePosition,integer(item.position,index)),
      };
    })
    .filter(item=>item.productId&&categoryIds.has(item.categoryId)&&item.available)
    .sort((a,b)=>{
      const ac=categories.find(category=>category.id===a.categoryId)?.position??9999;
      const bc=categories.find(category=>category.id===b.categoryId)?.position??9999;
      return ac-bc||a.position-b.position||a.productId.localeCompare(b.productId);
    })
    .map(({position:_,...item})=>item);

  const stageFor=(label:string)=>{
    if(label==='待處理')return'RECEIVED';
    if(label==='進行中')return'PREPARING';
    if(label==='可取餐')return'READY';
    if(label==='已完成')return'COMPLETED';
    if(label==='已取消')return'REJECTED';
    return'RECEIVED';
  };

  const projectedOrders=customerOrders.map(raw=>{
    const order=record(raw);
    const stage=stageFor(text(order.fulfillmentLabel));
    const observedAt=text(order.updatedAt)||text(order.createdAt)||new Date().toISOString();
    const itemRows=rows(order.items);
    const display=text(order.display);
    const totalMinor=Math.max(0,Number(order.totalMinor)||0);
    return {
      orderId:text(order.orderId),
      displayCode:display,
      stage,
      itemSummary:itemRows.map(item=>text(record(item).name)).filter(Boolean).join('、'),
      amountLabel:moneyLabel(totalMinor),
      pickupCode:display||undefined,
      observedAt,
      readback:'CONFIRMED',
      timeline:[{at:observedAt,stage,label:text(order.fulfillmentLabel,stage)}],
    };
  }).filter(order=>order.orderId&&order.displayCode);

  const notice=text(presentation.body)||text(presentation.notice);
  const channelAvailable=customerChannel.enabled!==false;

  return Object.freeze({
    store:Object.freeze({
      storeId:text(active?.storeId,'MF01'),
      storeName:text(settings.storeName,'磨飯'),
      channelAvailable,
      ...(notice?{notice}:{}),
      observedAt:new Date().toISOString(),
    }),
    menu:Object.freeze({
      revision:String(active?.revision??'0'),
      observedAt:new Date().toISOString(),
      categories:Object.freeze(categories.map(item=>Object.freeze({
        categoryId:item.id,
        name:item.name,
        sortOrder:item.position,
      }))),
      products:Object.freeze(products.map(item=>Object.freeze(item))),
    }),
    activeOrders:Object.freeze(projectedOrders.filter(order=>order.stage!=='COMPLETED'&&order.stage!=='REJECTED')),
    history:Object.freeze(projectedOrders.filter(order=>order.stage==='COMPLETED').map(order=>Object.freeze({
      orderId:order.orderId,
      displayCode:order.displayCode,
      completedAt:order.observedAt,
      itemSummary:order.itemSummary,
      amountLabel:order.amountLabel,
      reorderEligible:true,
    }))),
    observedAt:new Date().toISOString(),
  });
}

export function filterCustomerOwnedOrders(orders:any[],submissionIds:readonly string[]){
  const wanted=new Set(unique(submissionIds.map(value=>String(value).trim()).filter(Boolean)).slice(0,24));
  if(!wanted.size)return [];
  return orders.filter(raw=>{
    const order=record(raw);
    const ref=text(order.providerRef)||text(order.externalRef);
    return ref.startsWith('CUSTOMER:')&&wanted.has(ref.slice('CUSTOMER:'.length));
  });
}
