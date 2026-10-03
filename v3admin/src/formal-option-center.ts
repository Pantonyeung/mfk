import {assertFormalOptionReadiness,isFormalOptionPrice} from './formal-option-readiness.ts';
export {isFormalOptionPrice} from './formal-option-readiness.ts';

export type FormalOptionSelection='SINGLE'|'MULTI';

export interface FormalOptionChild{
  id:string;
  code:string;
  name:string;
  priceAdjustment:string;
  active:boolean;
  position:number;
}
export interface FormalOptionSet{
  id:string;
  name:string;
  required:boolean;
  forceShow:boolean;
  selection:FormalOptionSelection;
  min:number;
  max:number;
  allowQuantities:boolean;
  active:boolean;
  options:FormalOptionChild[];
}
export interface FormalProductOptionLink{
  productId:string;
  setId:string;
  defaultOptionIds:string[];
}
export interface FormalOptionCenterState{
  sets:FormalOptionSet[];
  productLinks:FormalProductOptionLink[];
}

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}
function unique(values:readonly string[]){return [...new Set(values.filter(Boolean))];}

function normalizeChild(value:unknown,index:number):FormalOptionChild{
  const item=row(value);
  return{
    id:text(item.id),
    code:text(item.code)||text(item.id),
    name:text(item.name),
    priceAdjustment:text(item.priceAdjustment)||'0.00',
    active:item.active!==false,
    position:Number.isFinite(Number(item.position))?Number(item.position):(index+1)*10,
  };
}
function normalizeSet(value:unknown,index:number):FormalOptionSet{
  const item=row(value);
  const selection:FormalOptionSelection=item.selection==='MULTI'?'MULTI':'SINGLE';
  const required=Boolean(item.required);
  const rawMax=Number(item.max);
  const max=selection==='SINGLE'?1:(Number.isFinite(rawMax)?Math.max(0,rawMax):1);
  const rawMin=Number(item.min);
  const min=required?Math.max(1,Number.isFinite(rawMin)?rawMin:1):Math.max(0,Number.isFinite(rawMin)?rawMin:0);
  return{
    id:text(item.id),
    name:text(item.name),
    required,
    forceShow:Boolean(item.forceShow??required),
    selection,
    min,
    max,
    allowQuantities:selection==='MULTI'&&Boolean(item.allowQuantities),
    active:item.active!==false,
    options:list(item.options).map(normalizeChild).filter(option=>option.id).sort((a,b)=>a.position-b.position||a.code.localeCompare(b.code)),
  };
}

function deriveLegacy(snapshot:Record<string,unknown>):FormalOptionCenterState{
  const catalog=row(snapshot.catalog);
  const sets=list(catalog.modifierGroups).map(normalizeSet).filter(set=>set.id);
  const defaultsBySet=new Map(list(catalog.modifierGroups).map(value=>{
    const group=row(value);
    return [text(group.id),list(group.options).filter(option=>row(option).defaultSelected===true).map(option=>text(row(option).id)).filter(Boolean)];
  }));
  const productLinks:FormalProductOptionLink[]=[];
  for(const productValue of list(catalog.products)){
    const product=row(productValue);
    const productId=text(product.id);
    for(const setIdValue of list(product.modifierGroupIds)){
      const setId=String(setIdValue||'');
      if(productId&&setId)productLinks.push({productId,setId,defaultOptionIds:[...(defaultsBySet.get(setId)??[])]});
    }
  }
  return{sets,productLinks};
}

export function readFormalOptionCenter(snapshot:Record<string,unknown>):FormalOptionCenterState{
  const center=row(snapshot.optionCenter);
  if(Array.isArray(center.sets)&&Array.isArray(center.productLinks)){
    const sets=list(center.sets).map(normalizeSet).filter(set=>set.id);
    const setIds=new Set(sets.map(set=>set.id));
    const productLinks=list(center.productLinks).map(value=>{
      const item=row(value);
      return{
        productId:text(item.productId),
        setId:text(item.setId),
        defaultOptionIds:list(item.defaultOptionIds).map(String).filter(Boolean),
      };
    }).filter(link=>link.productId&&link.setId&&setIds.has(link.setId));
    return{sets,productLinks};
  }
  return deriveLegacy(snapshot);
}

function unchanged(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
/** Only changed modeled fields replace raw facts; absent optional fields stay absent. */
function mergeModeled(existing:Record<string,unknown>|undefined,before:Record<string,unknown>,after:Record<string,unknown>){
  if(!existing)return {...after};
  const result={...existing};
  for(const [key,value] of Object.entries(after))if(!unchanged(before[key],value))result[key]=value;
  return result;
}
function mergeOptions(set:FormalOptionSet,existing:Record<string,unknown>|undefined,legacy:boolean,authorityBefore?:FormalOptionSet){
  const raw=list(existing?.options),normalized=existing?normalizeSet(existing,0).options:[];
  const byId=new Map(raw.map(value=>[text(row(value).id),row(value)]));
  const modeledById=new Map(raw.map((value,index)=>[text(row(value).id),normalizeChild(value,index)]));
  const ordering=(options:FormalOptionChild[])=>options.map(option=>[option.id,option.position]);
  const order=existing&&unchanged(ordering(authorityBefore?.options??normalized),ordering(set.options))?raw.map(value=>text(row(value).id)):set.options.map(option=>option.id);
  const nextById=new Map(set.options.map(option=>[option.id,option]));
  return order.map(id=>{
    const option=nextById.get(id)!;
    const after:Record<string,unknown>={...option};
    // Legacy projection has no new position field, but preserves/updates one already present.
    if(legacy&&(!Object.hasOwn(byId.get(id)??{},'position')||authorityBefore?.options.find(previous=>previous.id===id)?.position===option.position))delete after.position;
    return mergeModeled(byId.get(id),{...modeledById.get(id)},after);
  });
}
function mergeSet(set:FormalOptionSet,existing:Record<string,unknown>|undefined,legacy=false,authorityBefore?:FormalOptionSet){
  const {options:_options,...after}=set;
  const before=existing?normalizeSet(existing,0):undefined;
  return {...mergeModeled(existing,{...before},after),options:mergeOptions(set,existing,legacy,authorityBefore)};
}
function toLegacyModifierGroup(set:FormalOptionSet,existing:Record<string,unknown>|undefined,authorityBefore?:FormalOptionSet){
  return mergeSet(set,existing,true,authorityBefore);
}

function assertFormalOptionPriceEdits(snapshot:Record<string,unknown>,state:FormalOptionCenterState){
  const hasCenter=Object.hasOwn(snapshot,'optionCenter'),center=row(snapshot.optionCenter);
  if(hasCenter&&(!Array.isArray(center.sets)||!Array.isArray(center.productLinks)))throw new Error('FORMAL_OPTION_SOURCE_INVALID');
  const rawSets=hasCenter?center.sets:row(snapshot.catalog).modifierGroups;
  if(rawSets!==undefined&&!Array.isArray(rawSets))throw new Error('FORMAL_OPTION_SOURCE_INVALID');
  const existing=new Map<string,string>(),setIds=new Set<string>();
  for(const value of list(rawSets)){
    const set=row(value),setId=text(set.id);
    if(!setId||setIds.has(setId)||!Array.isArray(set.options))throw new Error('FORMAL_OPTION_SOURCE_INVALID');
    setIds.add(setId);
    for(const child of set.options){
      const option=row(child),id=text(option.id),key=JSON.stringify([setId,id]),price=option.priceAdjustment;
      if(!id||existing.has(key)||typeof price!=='string'||!price.trim()||!Number.isFinite(Number(price)))throw new Error('FORMAL_OPTION_SOURCE_INVALID');
      existing.set(key,price);
    }
  }
  for(const set of state.sets)for(const option of set.options){
    // Keep raw historical values, but any new/changed amount must meet the native contract.
    if(existing.get(JSON.stringify([set.id,option.id]))!==option.priceAdjustment&&!isFormalOptionPrice(option.priceAdjustment))throw new Error('FORMAL_MODIFIER_PRICE_INVALID');
  }
}

export function writeFormalOptionCenter(snapshot:Record<string,unknown>,state:FormalOptionCenterState){
  assertFormalOptionReadiness(snapshot,'EDIT_SOURCE');
  assertFormalOptionPriceEdits(snapshot,state);
  const center=row(snapshot.optionCenter);
  const catalog=row(snapshot.catalog);
  const previousState=readFormalOptionCenter(snapshot);
  const previousSets=new Map(previousState.sets.map(set=>[set.id,set]));
  const legacyGroups=new Map(list(catalog.modifierGroups).map(value=>[text(row(value).id),row(value)]));
  const existingSets=new Map(list(center.sets).map(value=>[text(row(value).id),row(value)]));
  const existingLinks=new Map(list(center.productLinks).map(value=>{const link=row(value);return [JSON.stringify([link.productId,link.setId]),link];}));
  const linksByProduct=new Map<string,string[]>();
  for(const link of state.productLinks){
    const current=linksByProduct.get(link.productId)??[];
    current.push(link.setId);
    linksByProduct.set(link.productId,current);
  }
  const products=list(catalog.products).map(value=>{
    const product=row(value);
    const id=text(product.id);
    if(!id)return value;
    const nextGroups=unique(linksByProduct.get(id)??[]);
    const previousGroups=previousState.productLinks.filter(link=>link.productId===id).map(link=>link.setId);
    if(!Object.hasOwn(product,'modifierGroupIds')&&unchanged(previousGroups,nextGroups))return value;
    const rawGroups=list(product.modifierGroupIds);
    if(unchanged([...rawGroups].sort(),[...nextGroups].sort()))return value;
    return{...product,modifierGroupIds:nextGroups};
  });
  const nextSets=new Map(state.sets.map(set=>[set.id,set]));
  const mirrorOrder=unchanged(previousState.sets.map(set=>set.id),state.sets.map(set=>set.id))
    ?list(catalog.modifierGroups).map(value=>text(row(value).id)):state.sets.map(set=>set.id);
  const result={
    ...snapshot,
    optionCenter:{
      ...center,
      sets:state.sets.map(set=>mergeSet(set,existingSets.get(set.id)??legacyGroups.get(set.id))),
      productLinks:state.productLinks.map(link=>({...existingLinks.get(JSON.stringify([link.productId,link.setId])),...link,defaultOptionIds:[...link.defaultOptionIds]})),
    },
    catalog:{
      ...catalog,
      ...(Object.hasOwn(catalog,'modifierGroups')?{modifierGroups:mirrorOrder.map(id=>toLegacyModifierGroup(nextSets.get(id)!,legacyGroups.get(id),previousSets.get(id)))}:{}),
      ...(Object.hasOwn(catalog,'products')?{products}:{}),
    },
  };
  assertFormalOptionReadiness(result,'EDIT_SOURCE');
  return result;
}

export function validateFormalOptionCenter(state:FormalOptionCenterState){
  const errors:string[]=[];
  const setIds=new Set<string>();
  for(const set of state.sets){
    if(!set.id.trim())errors.push('選項組缺少 ID');
    if(setIds.has(set.id))errors.push('選項組 ID 重複：'+set.id);
    setIds.add(set.id);
    if(!set.name.trim())errors.push('選項組 '+set.id+' 未填名稱');
    if(set.min<0||set.max<set.min)errors.push('選項組 '+(set.name||set.id)+' 最少／最多選擇無效');
    if(set.required&&set.min<1)errors.push('必選組 '+(set.name||set.id)+' 最少選擇必須至少 1');
    if(set.selection==='SINGLE'&&set.max>1)errors.push('單選組 '+(set.name||set.id)+' 最多只可以 1');
    const optionIds=new Set<string>(),codes=new Set<string>();
    for(const option of set.options){
      if(!option.id.trim())errors.push('選項缺少 ID');
      if(optionIds.has(option.id))errors.push('選項 ID 重複：'+option.id);
      optionIds.add(option.id);
      const code=option.code.trim().toUpperCase();
      if(!code)errors.push('選項 '+(option.name||option.id)+' 未填選項 Code');
      if(code&&codes.has(code))errors.push('選項組 '+set.name+' Code 重複：'+option.code);
      if(code)codes.add(code);
      if(!option.name.trim())errors.push('選項 '+option.id+' 未填名稱');
      if(typeof option.priceAdjustment!=='string'||!option.priceAdjustment.trim()||!Number.isFinite(Number(option.priceAdjustment)))errors.push('選項 '+(option.name||option.id)+' 價格格式錯誤');
    }
  }
  for(const link of state.productLinks){
    const set=state.sets.find(item=>item.id===link.setId);
    if(!set){errors.push('商品 '+link.productId+' 引用不存在選項組 '+link.setId);continue;}
    const optionIds=new Set(set.options.map(option=>option.id));
    for(const optionId of link.defaultOptionIds)if(!optionIds.has(optionId))errors.push('商品 '+link.productId+' 默認選項不存在：'+optionId);
    if(set.selection==='SINGLE'&&link.defaultOptionIds.length>1)errors.push('商品 '+link.productId+' 單選組只可以有一個默認選項');
    if(link.defaultOptionIds.length>set.max)errors.push('商品 '+link.productId+' 默認選項超過上限');
  }
  return errors;
}

export function addFormalOptionSet(snapshot:Record<string,unknown>,id:string){
  assertFormalOptionReadiness(snapshot,'EDIT_SOURCE');
  const state=readFormalOptionCenter(snapshot);
  const next:FormalOptionSet={id,name:'新選項組',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,options:[]};
  return writeFormalOptionCenter(snapshot,{...state,sets:[...state.sets,next]});
}

/** Captured when an editor opens; scoped to the set and its product/default links. */
export function formalOptionSetEditBaseline(snapshot:Record<string,unknown>,setId:string){
  const state=readFormalOptionCenter(snapshot);
  return JSON.stringify({set:state.sets.find(set=>set.id===setId)??null,links:state.productLinks.filter(link=>link.setId===setId)});
}

export function replaceFormalOptionSet(snapshot:Record<string,unknown>,set:FormalOptionSet,productIds:readonly string[],expectedBaseline?:string){
  assertFormalOptionReadiness(snapshot,'EDIT_SOURCE');
  if(expectedBaseline!==undefined&&formalOptionSetEditBaseline(snapshot,set.id)!==expectedBaseline)throw new Error('FORMAL_OPTION_SET_STALE');
  const state=readFormalOptionCenter(snapshot);
  if(!state.sets.some(item=>item.id===set.id))throw new Error('FORMAL_OPTION_SET_NOT_FOUND');
  const targets=new Set(productIds);
  const retained=state.productLinks.filter(link=>link.setId!==set.id||targets.has(link.productId));
  const existingProducts=new Set(retained.filter(link=>link.setId===set.id).map(link=>link.productId));
  const additions=[...targets].filter(productId=>!existingProducts.has(productId)).map(productId=>({productId,setId:set.id,defaultOptionIds:[]} as FormalProductOptionLink));
  const next={sets:state.sets.map(item=>item.id===set.id?set:item),productLinks:[...retained,...additions]};
  const errors=validateFormalOptionCenter(next);
  if(errors.length)throw new Error('FORMAL_OPTION_SET_INVALID: '+errors.join('；'));
  return writeFormalOptionCenter(snapshot,next);
}

export function removeFormalOptionSet(snapshot:Record<string,unknown>,setId:string){
  assertFormalOptionReadiness(snapshot,'EDIT_SOURCE');
  const state=readFormalOptionCenter(snapshot);
  if(state.productLinks.some(link=>link.setId===setId))throw new Error('FORMAL_OPTION_SET_IN_USE');
  return writeFormalOptionCenter(snapshot,{sets:state.sets.filter(set=>set.id!==setId),productLinks:state.productLinks});
}
