export interface FormalKeetaChannelPolicy{
  enabled:boolean;
  autoAccept:boolean;
  syncSellability:boolean;
  commissionPct:string;
  displayName:string;
  lateCutoffMinutes:number;
}
export interface FormalKeetaMappingComponent{
  canonicalProductId:string;
  quantity:number;
}
export interface FormalKeetaMapping{
  mappingId:string;
  enabled:boolean;
  skuOpenItemCode?:string;
  spuOpenItemCode?:string;
  providerSkuId?:string;
  providerSpuId?:string;
  channelName:string;
  components:FormalKeetaMappingComponent[];
  optionMappings:unknown[];
}

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}
function num(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

export function readFormalKeetaPolicy(snapshot:Record<string,unknown>):FormalKeetaChannelPolicy{
  const policy=row(snapshot.channelPolicy);
  return{
    enabled:policy.enabled===true,
    autoAccept:policy.autoAccept===true,
    syncSellability:policy.syncSellability===true,
    commissionPct:text(policy.commissionPct),
    displayName:text(policy.displayName)||'Keeta',
    lateCutoffMinutes:num(policy.lateCutoffMinutes,15),
  };
}

export function patchFormalKeetaPolicy(snapshot:Record<string,unknown>,patch:Partial<FormalKeetaChannelPolicy>){
  const policy=row(snapshot.channelPolicy);
  return{...snapshot,channelPolicy:{...policy,...patch}};
}

function normalizeMapping(value:unknown):FormalKeetaMapping{
  const item=row(value);
  return{
    mappingId:text(item.mappingId),
    enabled:item.enabled!==false,
    skuOpenItemCode:text(item.skuOpenItemCode)||undefined,
    spuOpenItemCode:text(item.spuOpenItemCode)||undefined,
    providerSkuId:text(item.providerSkuId)||undefined,
    providerSpuId:text(item.providerSpuId)||undefined,
    channelName:text(item.channelName),
    components:list(item.components).map(componentValue=>{
      const component=row(componentValue);
      return{canonicalProductId:text(component.canonicalProductId),quantity:Math.max(1,Math.trunc(num(component.quantity,1)))};
    }).filter(component=>component.canonicalProductId),
    optionMappings:list(item.optionMappings),
  };
}
function mappingSource(snapshot:Record<string,unknown>){
  if(Array.isArray(snapshot.channelMapping))return snapshot.channelMapping;
  const catalog=row(snapshot.catalog),channels=row(catalog.channelMappings);
  return list(channels.keeta);
}

export function readFormalKeetaMappings(snapshot:Record<string,unknown>){
  return mappingSource(snapshot).map(normalizeMapping).filter(mapping=>mapping.mappingId);
}

function mergeMapping(mapping:FormalKeetaMapping,existing?:Record<string,unknown>){
  const next:Record<string,unknown>={
    ...(existing??{}),
    mappingId:mapping.mappingId,
    enabled:mapping.enabled,
    channelName:mapping.channelName,
    components:mapping.components.map(component=>({...component})),
    optionMappings:[...mapping.optionMappings],
  };
  for(const key of ['skuOpenItemCode','spuOpenItemCode','providerSkuId','providerSpuId'] as const){
    const value=mapping[key];
    if(value)next[key]=value;else delete next[key];
  }
  return next;
}

function writeMappings(snapshot:Record<string,unknown>,mappings:FormalKeetaMapping[]){
  const topExisting=new Map(mappingSource(snapshot).map(value=>[text(row(value).mappingId),row(value)]));
  const merged=mappings.map(mapping=>mergeMapping(mapping,topExisting.get(mapping.mappingId)));
  const catalog=row(snapshot.catalog),channelMappings=row(catalog.channelMappings);
  return{
    ...snapshot,
    channelMapping:merged,
    catalog:{...catalog,channelMappings:{...channelMappings,keeta:merged}},
  };
}

export function upsertFormalKeetaMapping(snapshot:Record<string,unknown>,mapping:FormalKeetaMapping){
  const current=readFormalKeetaMappings(snapshot);
  const index=current.findIndex(item=>item.mappingId===mapping.mappingId);
  const next=index>=0?current.map(item=>item.mappingId===mapping.mappingId?mapping:item):[...current,mapping];
  const errors=validateFormalKeetaMappings(snapshot,next);
  if(errors.length)throw new Error('FORMAL_KEETA_MAPPING_INVALID: '+errors.join('；'));
  return writeMappings(snapshot,next);
}

export function removeFormalKeetaMapping(snapshot:Record<string,unknown>,mappingId:string){
  return writeMappings(snapshot,readFormalKeetaMappings(snapshot).filter(mapping=>mapping.mappingId!==mappingId));
}

export function validateFormalKeetaMappings(snapshot:Record<string,unknown>,mappings=readFormalKeetaMappings(snapshot)){
  const catalog=row(snapshot.catalog);
  const productIds=new Set(list(catalog.products).map(value=>text(row(value).id)).filter(Boolean));
  const errors:string[]=[];
  const aliases=new Set<string>();
  for(const mapping of mappings){
    const alias=mapping.skuOpenItemCode||mapping.spuOpenItemCode||mapping.providerSkuId||mapping.providerSpuId||'';
    if(!mapping.mappingId.trim())errors.push('Mapping 缺少 ID');
    if(!alias.trim())errors.push('Mapping '+mapping.mappingId+' 未設定 Provider Alias');
    if(alias&&aliases.has(alias))errors.push('Provider Alias 重複：'+alias);
    if(alias)aliases.add(alias);
    if(!mapping.components.length)errors.push('Mapping '+mapping.mappingId+' 未設定磨飯製作商品');
    for(const component of mapping.components){
      if(!productIds.has(component.canonicalProductId))errors.push('Mapping '+mapping.mappingId+' 指向不存在商品 '+component.canonicalProductId);
      if(!Number.isSafeInteger(component.quantity)||component.quantity<1)errors.push('Mapping '+mapping.mappingId+' 數量無效');
    }
  }
  return errors;
}

export const FORMAL_KEETA_PROVIDER_GAPS=Object.freeze({
  storeBinding:'Provider Shop binding remains integration/runtime authority; no canonical mutation seam verified in V3.',
  liveStatus:'V3 provider live read client not yet connected.',
  providerCommands:'Menu/sellability/store-hour provider commands require explicit live client wiring and readback.',
});
