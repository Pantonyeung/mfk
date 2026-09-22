import {useMemo} from 'react';
import {appendAdminAudit,readAdminStored,usePersistentAdminState} from './admin-local-store.ts';
import type {AdminSessionDraft} from './admin-draft.tsx';

export type OptionSetSelection='SINGLE'|'MULTI';

export interface OptionChildDraft{
  readonly id:string;
  readonly code:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
  readonly position:number;
}

export interface OptionSetDraft{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly forceShow:boolean;
  readonly selection:OptionSetSelection;
  readonly min:number;
  readonly max:number;
  readonly allowQuantities:boolean;
  readonly active:boolean;
  readonly options:readonly OptionChildDraft[];
}

export interface ProductOptionSetLink{
  readonly productId:string;
  readonly setId:string;
  readonly defaultOptionIds:readonly string[];
}

export interface OptionSetCenterState{
  readonly sets:readonly OptionSetDraft[];
  readonly productLinks:readonly ProductOptionSetLink[];
}

export interface MenuProjectedOption{
  readonly id:string;
  readonly code:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
  readonly position:number;
  readonly defaultSelected:boolean;
}

export interface MenuProjectedOptionSet{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly forceShow:boolean;
  readonly selection:OptionSetSelection;
  readonly min:number;
  readonly max:number;
  readonly allowQuantities:boolean;
  readonly active:boolean;
  readonly options:readonly MenuProjectedOption[];
}

export function projectOptionSetsForProduct(state:OptionSetCenterState,productId:string):readonly MenuProjectedOptionSet[]{
  const links=state.productLinks.filter(link=>link.productId===productId);
  const linkBySetId=new Map(links.map(link=>[link.setId,link]));
  return Object.freeze(
    state.sets
      .filter(set=>set.active&&linkBySetId.has(set.id))
      .map(set=>{
        const link=linkBySetId.get(set.id)!;
        const defaults=new Set(link.defaultOptionIds);
        const options=set.options
          .filter(option=>option.active)
          .slice()
          .sort((a,b)=>a.position-b.position||a.code.localeCompare(b.code))
          .map(option=>Object.freeze({...option,defaultSelected:defaults.has(option.id)}));
        return Object.freeze({...set,options:Object.freeze(options)});
      }),
  );
}


interface LegacyFlatOption{
  readonly id:string;
  readonly code:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
}
interface LegacyFlatGroup{
  readonly id:string;
  readonly name:string;
  readonly optionIds:readonly string[];
  readonly required:boolean;
  readonly forceShow:boolean;
  readonly selection:OptionSetSelection;
  readonly min:number;
  readonly max:number;
  readonly allowQuantities:boolean;
  readonly active:boolean;
}
interface LegacyFlatLink{
  readonly productId:string;
  readonly groupId:string;
  readonly optionIds?:readonly string[];
  readonly defaultOptionIds:readonly string[];
}

const SET_KEY='option-set-center.sets.v2';
const LINK_KEY='option-set-center.product-links.v2';
const DIRTY_KEY='option-set-center.dirty.v1';

function unique(values:readonly string[]){
  return [...new Set(values.filter(Boolean))];
}

function normalizeChild(option:Partial<OptionChildDraft>,fallbackId:string,position:number):OptionChildDraft{
  return Object.freeze({
    id:String(option.id??fallbackId),
    code:String(option.code??option.id??fallbackId).trim(),
    name:String(option.name??'').trim(),
    priceAdjustment:String(option.priceAdjustment??'0.00').trim(),
    active:option.active!==false,
    position:Number.isFinite(option.position)?Number(option.position):position,
  });
}

function normalizeSet(set:Partial<OptionSetDraft>,fallbackId:string):OptionSetDraft{
  const options=(set.options??[]).map((option,index)=>normalizeChild(option,option.id||fallbackId+'-option-'+(index+1),(index+1)*10));
  options.sort((a,b)=>a.position-b.position||a.code.localeCompare(b.code));
  const selection:OptionSetSelection=set.selection==='MULTI'?'MULTI':'SINGLE';
  const max=selection==='SINGLE'?1:Math.max(0,Number(set.max??1));
  const required=Boolean(set.required);
  const min=required?Math.max(1,Number(set.min??1)):Math.max(0,Number(set.min??0));
  return Object.freeze({
    id:String(set.id??fallbackId),
    name:String(set.name??'').trim(),
    required,
    forceShow:Boolean(set.forceShow??required),
    selection,
    min,
    max,
    allowQuantities:selection==='MULTI'&&Boolean(set.allowQuantities),
    active:set.active!==false,
    options:Object.freeze(options),
  });
}

export function migrateLegacyDraftToOptionSetCenter(draft:AdminSessionDraft):OptionSetCenterState{
  const sets=draft.modifierGroups.map(group=>normalizeSet({
    id:group.id,
    name:group.name,
    required:group.required,
    forceShow:group.forceShow,
    selection:group.selection,
    min:group.min,
    max:group.max,
    allowQuantities:group.allowQuantities,
    active:group.active,
    options:group.options.map((option,index)=>({
      id:option.id,
      code:option.code||option.id,
      name:option.name,
      priceAdjustment:option.priceAdjustment,
      active:option.active,
      position:(index+1)*10,
    })),
  },group.id));

  const productLinks:ProductOptionSetLink[]=[];
  for(const product of draft.products){
    for(const groupId of product.modifierGroupIds??[]){
      const group=draft.modifierGroups.find(row=>row.id===groupId);
      if(!group)continue;
      productLinks.push(Object.freeze({
        productId:product.id,
        setId:groupId,
        defaultOptionIds:Object.freeze(group.options.filter(option=>option.defaultSelected).map(option=>option.id)),
      }));
    }
  }
  return Object.freeze({sets:Object.freeze(sets),productLinks:Object.freeze(productLinks)});
}

function fromFlatV1(draft:AdminSessionDraft):OptionSetCenterState{
  const flatOptions=readAdminStored<LegacyFlatOption[]>('option-center.options.v1',[]);
  const flatGroups=readAdminStored<LegacyFlatGroup[]>('option-center.groups.v1',[]);
  const flatLinks=readAdminStored<LegacyFlatLink[]>('option-center.product-links.v1',[]);

  if(flatOptions.length===0&&flatGroups.length===0&&flatLinks.length===0)return migrateLegacyDraftToOptionSetCenter(draft);

  const optionById=new Map(flatOptions.map(option=>[option.id,option]));
  const usedOptionIds=new Set<string>();
  const sets:OptionSetDraft[]=flatGroups.map(group=>{
    const options=group.optionIds.map((optionId,index)=>{
      usedOptionIds.add(optionId);
      const option=optionById.get(optionId);
      return normalizeChild(option??{id:optionId,code:optionId,name:'待整理選項',priceAdjustment:'0.00',active:false},optionId,(index+1)*10);
    });
    return normalizeSet({...group,options},group.id);
  });

  const orphanOptions=flatOptions.filter(option=>!usedOptionIds.has(option.id));
  if(orphanOptions.length){
    sets.push(normalizeSet({
      id:'recovered-option-set',
      name:'待整理選項',
      required:false,
      forceShow:false,
      selection:'SINGLE',
      min:0,
      max:1,
      allowQuantities:false,
      active:false,
      options:orphanOptions.map((option,index)=>({...option,position:(index+1)*10})),
    },'recovered-option-set'));
  }

  const setIds=new Set(sets.map(set=>set.id));
  const productLinks=flatLinks
    .filter(link=>setIds.has(link.groupId))
    .map(link=>Object.freeze({
      productId:link.productId,
      setId:link.groupId,
      defaultOptionIds:Object.freeze(unique(link.defaultOptionIds)),
    }));

  return Object.freeze({sets:Object.freeze(sets),productLinks:Object.freeze(productLinks)});
}

export function readOptionSetCenterState(draft:AdminSessionDraft):OptionSetCenterState{
  const fallback=fromFlatV1(draft);
  return Object.freeze({
    sets:Object.freeze(readAdminStored<OptionSetDraft[]>(SET_KEY,[...fallback.sets]).map((set,index)=>normalizeSet(set,set.id||'option-set-'+(index+1)))),
    productLinks:Object.freeze(readAdminStored<ProductOptionSetLink[]>(LINK_KEY,[...fallback.productLinks])),
  });
}

export function validateOptionSetCenter(state:OptionSetCenterState){
  const errors:string[]=[];
  const setIds=new Set<string>();

  for(const set of state.sets){
    if(!set.id.trim())errors.push('選項組缺少 ID');
    if(setIds.has(set.id))errors.push('選項組 ID 重複：'+set.id);
    setIds.add(set.id);
    if(!set.name.trim())errors.push('選項組 '+set.id+' 未填名稱');
    if(set.min<0||set.max<set.min)errors.push('選項組 '+(set.name||set.id)+' 最少／最多選擇無效');
    if(set.required&&set.min<1)errors.push('必選組 '+(set.name||set.id)+' 最少選擇必須至少 1');
    if(set.selection==='SINGLE'&&set.max>1)errors.push('單選組 '+(set.name||set.id)+' 最多選擇不可大過 1');

    const childIds=new Set<string>();
    const childCodes=new Set<string>();
    for(const option of set.options){
      if(!option.id.trim())errors.push('選項組 '+(set.name||set.id)+' 有子選項缺少身份');
      if(childIds.has(option.id))errors.push('選項組 '+(set.name||set.id)+' 子選項身份重複：'+option.id);
      childIds.add(option.id);
      if(!option.code.trim())errors.push('選項 '+(option.name||option.id)+' 未填選項 ID');
      if(option.code.trim()&&childCodes.has(option.code.trim().toUpperCase()))errors.push('選項組 '+(set.name||set.id)+' 選項 ID 重複：'+option.code);
      if(option.code.trim())childCodes.add(option.code.trim().toUpperCase());
      if(!option.name.trim())errors.push('選項 '+(option.code||option.id)+' 未填名稱');
      if(!option.priceAdjustment.trim())errors.push('選項 '+(option.name||option.code||option.id)+' 未填價格');
      else if(Number.isNaN(Number(option.priceAdjustment)))errors.push('選項 '+(option.name||option.code||option.id)+' 價格格式錯誤');
    }
  }

  for(const link of state.productLinks){
    const set=state.sets.find(row=>row.id===link.setId);
    if(!set){errors.push('商品 '+link.productId+' 引用不存在選項組 '+link.setId);continue;}
    const childIds=new Set(set.options.map(option=>option.id));
    for(const optionId of link.defaultOptionIds){
      if(!childIds.has(optionId))errors.push('商品 '+link.productId+' 默認選項不存在：'+optionId);
    }
    if(set.selection==='SINGLE'&&link.defaultOptionIds.length>1)errors.push('商品 '+link.productId+' 單選組只可以有一個默認選項');
    if(link.defaultOptionIds.length>set.max)errors.push('商品 '+link.productId+' 默認選項超過選項組上限');
  }
  return errors;
}

function nextId(prefix:string,existing:readonly string[]){
  let i=1;
  while(existing.includes(prefix+'-'+String(i).padStart(3,'0')))i++;
  return prefix+'-'+String(i).padStart(3,'0');
}

export function useOptionSetCenter(draft:AdminSessionDraft){
  const fallback=useMemo(()=>fromFlatV1(draft),[]);
  const [sets,setSets]=usePersistentAdminState<OptionSetDraft[]>(SET_KEY,[...fallback.sets]);
  const [productLinks,setProductLinks]=usePersistentAdminState<ProductOptionSetLink[]>(LINK_KEY,[...fallback.productLinks]);
  const [dirty,setDirty]=usePersistentAdminState<boolean>(DIRTY_KEY,false);

  const addSet=()=>{
    setDirty(true);
    setSets(current=>{
      const id=nextId('option-set',current.map(row=>row.id));
      const row:OptionSetDraft={id,name:'新選項組',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,options:[]};
      appendAdminAudit({action:'新增選項組',target:id,after:row});
      return [...current,row];
    });
  };

  const updateSet=(id:string,patch:Partial<OptionSetDraft>)=>{
    setDirty(true);
    setSets(current=>current.map(row=>{
      if(row.id!==id)return row;
      const after=normalizeSet({...row,...patch},id);
      appendAdminAudit({action:'修改選項組',target:id,before:row,after});
      return after;
    }));
  };

  const removeSet=(id:string)=>{
    if(productLinks.some(link=>link.setId===id))return false;
    setDirty(true);
    setSets(current=>current.filter(row=>row.id!==id));
    appendAdminAudit({action:'刪除選項組',target:id});
    return true;
  };

  const addChild=(setId:string)=>{
    setDirty(true);
    setSets(current=>current.map(set=>{
      if(set.id!==setId)return set;
      const id=nextId(set.id+'-option',set.options.map(option=>option.id));
      const code=nextId('OPT',set.options.map(option=>option.code));
      const options=[...set.options,{id,code,name:'新選項',priceAdjustment:'0.00',active:true,position:(set.options.length+1)*10}];
      appendAdminAudit({action:'新增組內選項',target:setId,after:{id,code}});
      return normalizeSet({...set,options},set.id);
    }));
  };

  const updateChild=(setId:string,optionId:string,patch:Partial<OptionChildDraft>)=>{
    setDirty(true);
    setSets(current=>current.map(set=>{
      if(set.id!==setId)return set;
      const options=set.options.map(option=>option.id===optionId?{...option,...patch}:option);
      return normalizeSet({...set,options},set.id);
    }));
  };

  const removeChild=(setId:string,optionId:string)=>{
    setDirty(true);
    setSets(current=>current.map(set=>{
      if(set.id!==setId)return set;
      return normalizeSet({...set,options:set.options.filter(option=>option.id!==optionId)},set.id);
    }));
    setProductLinks(current=>current.map(link=>link.setId===setId?{...link,defaultOptionIds:link.defaultOptionIds.filter(id=>id!==optionId)}:link));
    appendAdminAudit({action:'刪除組內選項',target:optionId,after:{setId}});
  };

  const moveChild=(setId:string,optionId:string,direction:-1|1)=>{
    setDirty(true);
    setSets(current=>current.map(set=>{
      if(set.id!==setId)return set;
      const rows=[...set.options].sort((a,b)=>a.position-b.position);
      const index=rows.findIndex(row=>row.id===optionId);
      const target=index+direction;
      if(index<0||target<0||target>=rows.length)return set;
      const [item]=rows.splice(index,1);
      if(item)rows.splice(target,0,item);
      return normalizeSet({...set,options:rows.map((row,i)=>({...row,position:(i+1)*10}))},set.id);
    }));
  };

  const getProductLink=(productId:string,setId:string)=>productLinks.find(link=>link.productId===productId&&link.setId===setId);

  const setProductSetLinked=(productId:string,setId:string,linked:boolean)=>{
    setDirty(true);
    setProductLinks(current=>{
      const exists=current.some(link=>link.productId===productId&&link.setId===setId);
      if(linked&&exists)return current;
      if(!linked)return current.filter(link=>!(link.productId===productId&&link.setId===setId));
      const row:ProductOptionSetLink={productId,setId,defaultOptionIds:[]};
      appendAdminAudit({action:'商品加入選項組',target:productId,after:{setId}});
      return [...current,row];
    });
  };

  const setProductDefault=(productId:string,setId:string,optionId:string,selected:boolean)=>{
    setDirty(true);
    const set=sets.find(row=>row.id===setId);
    if(!set)return;
    setProductLinks(current=>current.map(link=>{
      if(link.productId!==productId||link.setId!==setId)return link;
      const defaults=selected
        ?set.selection==='SINGLE'?[optionId]:unique([...link.defaultOptionIds,optionId]).slice(0,Math.max(1,set.max))
        :link.defaultOptionIds.filter(id=>id!==optionId);
      return {...link,defaultOptionIds:defaults};
    }));
  };

  const markClean=()=>setDirty(false);
  const state:OptionSetCenterState={sets,productLinks};
  return {
    state,sets,productLinks,dirty,errors:validateOptionSetCenter(state),
    addSet,updateSet,removeSet,
    addChild,updateChild,removeChild,moveChild,
    getProductLink,setProductSetLinked,setProductDefault,markClean,
  };
}

export type OptionSetCenterController=ReturnType<typeof useOptionSetCenter>;

export const OPTION_SET_CENTER_STORAGE_KEYS=Object.freeze({
  sets:SET_KEY,
  productLinks:LINK_KEY,
  dirty:DIRTY_KEY,
});
