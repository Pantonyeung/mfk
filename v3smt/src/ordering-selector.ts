import type {
  MfpOrderingCatalog,
  MfpOrderingCombo,
  MfpOrderingComboChoice,
  MfpOrderingComboGroup,
  MfpOrderingComboPool,
  MfpOrderingComboSubPool,
  MfpOrderingOption,
  MfpOrderingOptionSet,
  MfpOrderingProduct,
  MfpPublishedMoneyFact,
  MfpServiceMode,
} from './ordering-domain.ts';
import type {MfpSyncActiveProjection,MfpSyncEntity} from './sync-port.ts';

function record(value:unknown):Readonly<Record<string,unknown>>|null{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,unknown>>:null;
}

function rows(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'&&value.trim()===value&&value?value:null;}
function integer(value:unknown){return Number.isSafeInteger(value)?Number(value):null;}

function priceFact(value:unknown):MfpPublishedMoneyFact|null{
  const row=record(value);
  if(!row)return null;
  const factId=text(row.factId);
  const amountMinor=integer(row.amountMinor);
  const currency=text(row.currency);
  const revision=typeof row.revision==='string'||typeof row.revision==='number'?row.revision:null;
  if(!factId||amountMinor===null||!currency||revision===null)return null;
  return Object.freeze({factId,amountMinor,currency,revision});
}

function serviceModeAdjustments(value:unknown){
  const row=record(value)??{};
  const out:Partial<Record<MfpServiceMode,MfpPublishedMoneyFact>>={};
  for(const mode of ['takeaway','dine-in'] as const){
    const fact=priceFact(row[mode]);
    if(fact)out[mode]=fact;
  }
  return Object.freeze(out);
}

function entitiesOf(projection:MfpSyncActiveProjection,entityType:string){
  return Object.values(projection.entities)
    .filter(entity=>entity.entityType===entityType)
    .sort((a,b)=>a.entityId.localeCompare(b.entityId));
}

function optionSet(entity:MfpSyncEntity):MfpOrderingOptionSet|null{
  const payload=record(entity.payload);
  const name=text(payload?.name);
  const selection=payload?.selection;
  const min=integer(payload?.min);
  const max=integer(payload?.max);
  if(payload?.active!==true||!name||(selection!=='SINGLE'&&selection!=='MULTI')||min===null||max===null||min<0||max<min)return null;
  const options:MfpOrderingOption[]=rows(payload.options).flatMap(raw=>{
    const row=record(raw);
    const id=text(row?.id);
    const optionName=text(row?.name);
    const position=integer(row?.position);
    const priceAdjustment=priceFact(row?.priceAdjustment);
    if(row?.active!==true||!id||!optionName||position===null||!priceAdjustment)return [];
    return [Object.freeze({
      id,name:optionName,defaultSelected:false,sellable:row.sellable===true,position,priceAdjustment,
    })];
  }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  return Object.freeze({
    id:entity.entityId,name,required:payload.required===true,selection,min,max,options:Object.freeze(options),
  });
}

function comboPool(entity:MfpSyncEntity):MfpOrderingComboPool|null{
  const payload=record(entity.payload);
  const name=text(payload?.name);
  const kind=payload?.kind;
  if(payload?.active!==true||!name||(kind!=='MAIN_COURSE'&&kind!=='ADDON'))return null;
  const groups:MfpOrderingComboGroup[]=rows(payload.groups).flatMap(rawGroup=>{
    const group=record(rawGroup);
    if(!group)return [];
    const id=text(group?.id);
    const groupName=text(group?.name);
    const min=integer(group?.min);
    const max=integer(group?.max);
    const position=integer(group?.position);
    if(!id||!groupName||min===null||max===null||position===null||min<0||max<min)return [];
    const subPools:MfpOrderingComboSubPool[]=rows(group.subPools).flatMap(rawSubPool=>{
      const subPool=record(rawSubPool);
      if(!subPool)return [];
      const subPoolId=text(subPool?.id);
      const subPoolName=text(subPool?.name);
      const subPoolPosition=integer(subPool?.position);
      const priceAdjustment=priceFact(subPool?.priceAdjustment);
      if(!subPoolId||!subPoolName||subPoolPosition===null||!priceAdjustment)return [];
      const choices:MfpOrderingComboChoice[]=rows(subPool.choices).flatMap(rawChoice=>{
        const choice=record(rawChoice);
        if(!choice)return [];
        const choiceId=text(choice?.id);
        const choiceType=choice?.type;
        const label=text(choice?.label);
        const choicePosition=integer(choice?.position);
        const choicePrice=priceFact(choice?.priceAdjustment);
        const productId=text(choice?.productId);
        if(!choiceId||!label||choicePosition===null||!choicePrice||!['PRODUCT','LABEL','NONE'].includes(String(choiceType)))return [];
        if(choiceType==='PRODUCT'&&!productId)return [];
        return [Object.freeze({
          id:choiceId,type:choiceType as MfpOrderingComboChoice['type'],...(productId?{productId}:{}),label,
          sellable:choice.sellable===true,position:choicePosition,priceAdjustment:choicePrice,
        })];
      }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
      return [Object.freeze({
        id:subPoolId,name:subPoolName,sellable:subPool.sellable===true,position:subPoolPosition,
        priceAdjustment,choices:Object.freeze(choices),
      })];
    }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
    return [Object.freeze({
      id,name:groupName,required:group.required===true,min,max,position,subPools:Object.freeze(subPools),
    })];
  }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const addonKind=kind==='ADDON'&&(payload.addonKind==='SNACK'||payload.addonKind==='DRINK')?payload.addonKind:undefined;
  return Object.freeze({id:entity.entityId,name,kind,...(addonKind?{addonKind}:{}),groups:Object.freeze(groups)});
}

export function selectMfpOrderingCatalog(projection:MfpSyncActiveProjection|null):MfpOrderingCatalog|null{
  if(!projection)return null;
  const categories=entitiesOf(projection,'CATEGORY').flatMap(entity=>{
    const payload=record(entity.payload);
    const label=text(payload?.label);
    const position=integer(payload?.position);
    if(payload?.active!==true||!label||position===null)return [];
    return [Object.freeze({id:entity.entityId,label,position})];
  }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const categoryIds=new Set(categories.map(category=>category.id));

  const optionSets=new Map(entitiesOf(projection,'OPTION_SET').flatMap(entity=>{
    const selected=optionSet(entity);
    return selected?[[selected.id,selected] as const]:[];
  }));

  const products:MfpOrderingProduct[]=entitiesOf(projection,'PRODUCT').flatMap(entity=>{
    const payload=record(entity.payload);
    const categoryId=text(payload?.categoryId);
    const name=text(payload?.name);
    if(payload?.active!==true||!categoryId||!categoryIds.has(categoryId)||!name)return [];
    const links=rows(payload.optionSets);
    const projectedSets:MfpOrderingOptionSet[]=[];
    for(const rawLink of links){
      const link=record(rawLink);
      const optionSetId=text(link?.optionSetId);
      const set=optionSetId?optionSets.get(optionSetId):undefined;
      if(!set)return [];
      const defaults=new Set(rows(link?.defaultOptionIds).map(text).filter((id):id is string=>Boolean(id)));
      projectedSets.push(Object.freeze({
        ...set,
        options:Object.freeze(set.options.map(option=>Object.freeze({...option,defaultSelected:defaults.has(option.id)}))),
      }));
    }
    const publishedUnitPrice=priceFact(payload.publishedUnitPrice);
    const description=text(payload.description);
    const imageUrl=text(payload.imageUrl);
    return [Object.freeze({
      productId:entity.entityId,categoryId,name,...(description?{description}:{}),...(imageUrl?{imageUrl}:{}),
      sellable:payload.sellable===true,priceReady:payload.priceReady===true&&Boolean(publishedUnitPrice),
      publishedUnitPrice,serviceModeAdjustments:serviceModeAdjustments(payload.serviceModeAdjustments),
      optionSets:Object.freeze(projectedSets),
    })];
  }).sort((a,b)=>{
    const aCategory=categories.findIndex(category=>category.id===a.categoryId);
    const bCategory=categories.findIndex(category=>category.id===b.categoryId);
    return aCategory-bCategory||a.productId.localeCompare(b.productId);
  });

  const comboPools=entitiesOf(projection,'COMBO_POOL').flatMap(entity=>{
    const pool=comboPool(entity);
    if(!pool)return [];
    return [Object.freeze({
      ...pool,
      groups:Object.freeze(pool.groups.map(group=>Object.freeze({
        ...group,
        subPools:Object.freeze(group.subPools.map(subPool=>Object.freeze({
          ...subPool,
          choices:Object.freeze(subPool.choices.map(choice=>choice.type==='PRODUCT'
            ?Object.freeze({...choice,sellable:choice.sellable&&products.some(product=>product.productId===choice.productId&&product.sellable)})
            :choice)),
        }))),
      }))),
    })];
  });
  const poolIds=new Set(comboPools.map(pool=>pool.id));

  const combos:MfpOrderingCombo[]=entitiesOf(projection,'COMBO').flatMap(entity=>{
    const payload=record(entity.payload);
    const name=text(payload?.name);
    const mainPoolId=text(payload?.mainPoolId)??undefined;
    const addonPoolIds=rows(payload?.addonPoolIds).map(text).filter((id):id is string=>Boolean(id));
    if(payload?.active!==true||!name||[mainPoolId,...addonPoolIds].filter(Boolean).some(id=>!poolIds.has(id!)))return [];
    const publishedBasePrice=priceFact(payload.publishedBasePrice);
    return [Object.freeze({
      id:entity.entityId,name,sellable:payload.sellable===true,
      priceReady:payload.priceReady===true&&Boolean(publishedBasePrice),publishedBasePrice,
      serviceModeAdjustments:serviceModeAdjustments(payload.serviceModeAdjustments),
      ...(mainPoolId?{mainPoolId}:{}),addonPoolIds:Object.freeze(addonPoolIds),
    })];
  });

  return Object.freeze({
    source:Object.freeze({
      storeId:projection.storeId,port:projection.port,schemaVersion:projection.schemaVersion,
      appliedSeq:projection.appliedSeq,projectionHash:projection.projectionHash,appliedAt:projection.appliedAt,
    }),
    categories:Object.freeze(categories),products:Object.freeze(products),
    combos:Object.freeze(combos),comboPools:Object.freeze(comboPools),
  });
}
