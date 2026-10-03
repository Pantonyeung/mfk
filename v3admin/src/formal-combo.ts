export type FormalComboPoolKind='MAIN_COURSE'|'ADDON';
export type FormalComboAddonKind='SNACK'|'DRINK';
export type FormalComboChoiceType='PRODUCT'|'NONE'|'LABEL';

export interface FormalComboBand{
  id:string;
  name:string;
  priceAdjustment:string;
  priceStatus:'READY'|'OWNER_VALUE_REQUIRED';
  active:boolean;
  position:number;
}
export interface FormalComboChoice{
  id:string;
  choiceType:FormalComboChoiceType;
  productId?:string;
  label:string;
  bandId:string;
  priceAdjustment:string;
  priceStatus:'READY'|'OWNER_VALUE_REQUIRED';
  active:boolean;
  position:number;
}
export interface FormalComboPoolGroup{
  id:string;
  name:string;
  required:boolean;
  min:number;
  max:number;
  position:number;
  bands:FormalComboBand[];
  choices:FormalComboChoice[];
}
export interface FormalComboPool{
  id:string;
  name:string;
  kind:FormalComboPoolKind;
  addonKind?:FormalComboAddonKind;
  active:boolean;
  position:number;
  groups:FormalComboPoolGroup[];
}
export interface FormalCombo{
  id:string;
  name:string;
  active:boolean;
  basePrice:string;
  takeawayAdjustment:string;
  takeawaySurchargeEnabled:boolean;
  productId?:string;
  mainPoolId?:string;
  addonPoolIds:string[];
}

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}
function bool(value:unknown,fallback=false){return typeof value==='boolean'?value:fallback;}
function num(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}

function normalizeBand(value:unknown,index:number):FormalComboBand{
  const item=row(value);
  return{
    id:text(item.id),
    name:text(item.name),
    priceAdjustment:text(item.priceAdjustment)||'0.00',
    priceStatus:item.priceStatus==='OWNER_VALUE_REQUIRED'?'OWNER_VALUE_REQUIRED':'READY',
    active:item.active!==false,
    position:num(item.position,(index+1)*10),
  };
}
function normalizeChoice(value:unknown,index:number):FormalComboChoice{
  const item=row(value);
  const choiceType:FormalComboChoiceType=item.choiceType==='NONE'||item.choiceType==='LABEL'?item.choiceType:'PRODUCT';
  return{
    id:text(item.id),
    choiceType,
    productId:choiceType==='PRODUCT'?text(item.productId)||undefined:undefined,
    label:text(item.label),
    bandId:text(item.bandId),
    priceAdjustment:text(item.priceAdjustment)||'0.00',
    priceStatus:item.priceStatus==='OWNER_VALUE_REQUIRED'?'OWNER_VALUE_REQUIRED':'READY',
    active:item.active!==false,
    position:num(item.position,(index+1)*10),
  };
}
function normalizeGroup(value:unknown,index:number):FormalComboPoolGroup{
  const item=row(value);
  return{
    id:text(item.id),
    name:text(item.name),
    required:bool(item.required,true),
    min:num(item.min,1),
    max:num(item.max,1),
    position:num(item.position,(index+1)*10),
    bands:list(item.bands).map(normalizeBand).filter(band=>band.id).sort((a,b)=>a.position-b.position),
    choices:list(item.choices).map(normalizeChoice).filter(choice=>choice.id).sort((a,b)=>a.position-b.position),
  };
}
function normalizePool(value:unknown,index:number):FormalComboPool{
  const item=row(value);
  const kind:FormalComboPoolKind=item.kind==='ADDON'?'ADDON':'MAIN_COURSE';
  const addonKind:FormalComboAddonKind|undefined=kind==='ADDON'?(item.addonKind==='DRINK'?'DRINK':'SNACK'):undefined;
  return{
    id:text(item.id),
    name:text(item.name),
    kind,
    addonKind,
    active:item.active!==false,
    position:num(item.position,(index+1)*10),
    groups:list(item.groups).map(normalizeGroup).filter(group=>group.id).sort((a,b)=>a.position-b.position),
  };
}
function normalizeCombo(value:unknown):FormalCombo{
  const item=row(value);
  return{
    id:text(item.id),
    name:text(item.name),
    active:item.active!==false,
    basePrice:text(item.basePrice),
    takeawayAdjustment:text(item.takeawayAdjustment)||'0.00',
    takeawaySurchargeEnabled:bool(item.takeawaySurchargeEnabled,false),
    productId:text(item.productId)||undefined,
    mainPoolId:text(item.mainPoolId)||undefined,
    addonPoolIds:list(item.addonPoolIds).map(String).filter(Boolean),
  };
}

export function readFormalCombos(snapshot:Record<string,unknown>){
  const catalog=row(snapshot.catalog);
  return{
    combos:list(catalog.combos).map(normalizeCombo).filter(combo=>combo.id),
    pools:list(catalog.comboPools).map(normalizePool).filter(pool=>pool.id).sort((a,b)=>a.position-b.position),
  };
}

function mergeBand(value:FormalComboBand,existing?:Record<string,unknown>){
  return{...(existing??{}),...value};
}
function mergeChoice(value:FormalComboChoice,existing?:Record<string,unknown>){
  const next={...(existing??{}),...value};
  if(value.choiceType!=='PRODUCT')delete next.productId;
  return next;
}
function mergeGroup(value:FormalComboPoolGroup,existing?:Record<string,unknown>){
  const oldBands=new Map(list(existing?.bands).map(item=>[text(row(item).id),row(item)]));
  const oldChoices=new Map(list(existing?.choices).map(item=>[text(row(item).id),row(item)]));
  return{
    ...(existing??{}),
    id:value.id,name:value.name,required:value.required,min:value.min,max:value.max,position:value.position,
    bands:value.bands.map(item=>mergeBand(item,oldBands.get(item.id))),
    choices:value.choices.map(item=>mergeChoice(item,oldChoices.get(item.id))),
  };
}
function mergePool(value:FormalComboPool,existing?:Record<string,unknown>){
  const oldGroups=new Map(list(existing?.groups).map(item=>[text(row(item).id),row(item)]));
  const next:Record<string,unknown>={
    ...(existing??{}),
    id:value.id,name:value.name,kind:value.kind,active:value.active,position:value.position,
    groups:value.groups.map(item=>mergeGroup(item,oldGroups.get(item.id))),
  };
  if(value.kind==='ADDON')next.addonKind=value.addonKind??'SNACK'; else delete next.addonKind;
  return next;
}
function mergeCombo(value:FormalCombo,existing?:Record<string,unknown>){
  const next:Record<string,unknown>={
    ...(existing??{}),
    id:value.id,name:value.name,active:value.active,basePrice:value.basePrice,
    takeawayAdjustment:value.takeawayAdjustment,takeawaySurchargeEnabled:value.takeawaySurchargeEnabled,
    addonPoolIds:[...value.addonPoolIds],
  };
  if(value.productId)next.productId=value.productId;else delete next.productId;
  if(value.mainPoolId)next.mainPoolId=value.mainPoolId;else delete next.mainPoolId;
  return next;
}

export function replaceFormalCombo(snapshot:Record<string,unknown>,combo:FormalCombo){
  const catalog=row(snapshot.catalog);
  const current=list(catalog.combos);
  const oldById=new Map(current.map(item=>[text(row(item).id),row(item)]));
  if(!oldById.has(combo.id))throw new Error('FORMAL_COMBO_NOT_FOUND');
  const combos=current.map(item=>text(row(item).id)===combo.id?mergeCombo(combo,oldById.get(combo.id)):item);
  return{...snapshot,catalog:{...catalog,combos}};
}
export function addFormalCombo(snapshot:Record<string,unknown>,id:string){
  const catalog=row(snapshot.catalog);
  const combo:FormalCombo={id,name:'新套餐',active:true,basePrice:'',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,addonPoolIds:[]};
  return{...snapshot,catalog:{...catalog,combos:[...list(catalog.combos),mergeCombo(combo)]}};
}
export function removeFormalCombo(snapshot:Record<string,unknown>,id:string){
  const catalog=row(snapshot.catalog);
  return{...snapshot,catalog:{...catalog,combos:list(catalog.combos).filter(item=>text(row(item).id)!==id)}};
}

export function replaceFormalComboPool(snapshot:Record<string,unknown>,pool:FormalComboPool){
  const catalog=row(snapshot.catalog);
  const current=list(catalog.comboPools);
  const oldById=new Map(current.map(item=>[text(row(item).id),row(item)]));
  if(!oldById.has(pool.id))throw new Error('FORMAL_COMBO_POOL_NOT_FOUND');
  const comboPools=current.map(item=>text(row(item).id)===pool.id?mergePool(pool,oldById.get(pool.id)):item);
  return{...snapshot,catalog:{...catalog,comboPools}};
}
export function addFormalComboPool(snapshot:Record<string,unknown>,id:string,kind:FormalComboPoolKind,addonKind?:FormalComboAddonKind){
  const catalog=row(snapshot.catalog);
  const pools=list(catalog.comboPools);
  const maxPos=pools.reduce((max,item)=>Math.max(max,num(row(item).position,0)),0);
  const pool:FormalComboPool={id,name:kind==='MAIN_COURSE'?'新主食 Pool':'新加配 Pool',kind,addonKind:kind==='ADDON'?(addonKind??'SNACK'):undefined,active:true,position:maxPos+10,groups:[]};
  return{...snapshot,catalog:{...catalog,comboPools:[...pools,mergePool(pool)]}};
}
export function removeFormalComboPool(snapshot:Record<string,unknown>,id:string){
  const catalog=row(snapshot.catalog);
  for(const comboValue of list(catalog.combos)){
    const combo=normalizeCombo(comboValue);
    if(combo.mainPoolId===id||combo.addonPoolIds.includes(id))throw new Error('FORMAL_COMBO_POOL_IN_USE');
  }
  return{...snapshot,catalog:{...catalog,comboPools:list(catalog.comboPools).filter(item=>text(row(item).id)!==id)}};
}

export function validateFormalComboData(snapshot:Record<string,unknown>){
  const {combos,pools}=readFormalCombos(snapshot);
  const errors:string[]=[];
  const poolIds=new Set(pools.map(pool=>pool.id));
  const productIds=new Set(list(row(snapshot.catalog).products).map(item=>text(row(item).id)).filter(Boolean));
  for(const pool of pools){
    if(!pool.name.trim())errors.push('Pool '+pool.id+' 未填名稱');
    for(const group of pool.groups){
      if(!group.name.trim())errors.push('Pool '+pool.name+' 有分組未填名稱');
      if(group.min<0||group.max<group.min)errors.push('Pool 分組 '+(group.name||group.id)+' 最少／最多無效');
      if(group.required&&group.min<1)errors.push('Pool 分組 '+(group.name||group.id)+' 必選時最少要 1');
      const bandIds=new Set(group.bands.map(band=>band.id));
      for(const band of group.bands){
        if(!band.name.trim())errors.push('價格帶 '+band.id+' 未填名稱');
        if(band.priceStatus==='READY'&&(!band.priceAdjustment.trim()||Number.isNaN(Number(band.priceAdjustment))))errors.push('價格帶 '+band.name+' 差價無效');
      }
      for(const choice of group.choices){
        if(!bandIds.has(choice.bandId))errors.push('Choice '+choice.id+' 未指向有效價格帶');
        if(choice.choiceType==='PRODUCT'&&(!choice.productId||!productIds.has(choice.productId)))errors.push('Choice '+choice.id+' 商品不存在');
        if(choice.choiceType!=='PRODUCT'&&!choice.label.trim())errors.push('Choice '+choice.id+' 未填名稱');
        if(choice.priceStatus==='READY'&&(!choice.priceAdjustment.trim()||Number.isNaN(Number(choice.priceAdjustment))))errors.push('Choice '+choice.id+' 額外差價無效');
      }
    }
  }
  for(const combo of combos){
    if(!combo.name.trim())errors.push('套餐 '+combo.id+' 未填名稱');
    if(combo.basePrice.trim()&&Number.isNaN(Number(combo.basePrice)))errors.push('套餐 '+combo.name+' 基本價無效');
    if(combo.mainPoolId&&!poolIds.has(combo.mainPoolId))errors.push('套餐 '+combo.name+' 主食 Pool 不存在');
    for(const id of combo.addonPoolIds)if(!poolIds.has(id))errors.push('套餐 '+combo.name+' 加配 Pool 不存在：'+id);
  }
  return errors;
}
