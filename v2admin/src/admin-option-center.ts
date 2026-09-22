import {useMemo} from 'react';
import {appendAdminAudit,usePersistentAdminState} from './admin-local-store.ts';
import type {AdminSessionDraft,ModifierGroupDraft} from './admin-draft.tsx';

export interface OptionMasterDraft{
  readonly id:string;
  readonly code:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
}

export interface OptionGroupDraft{
  readonly id:string;
  readonly name:string;
  readonly optionIds:readonly string[];
  readonly required:boolean;
  readonly forceShow:boolean;
  readonly selection:'SINGLE'|'MULTI';
  readonly min:number;
  readonly max:number;
  readonly allowQuantities:boolean;
  readonly active:boolean;
}

export interface ProductOptionLinkDraft{
  readonly productId:string;
  readonly groupId:string;
  readonly optionIds:readonly string[];
  readonly defaultOptionIds:readonly string[];
}

export interface OptionCenterState{
  readonly options:readonly OptionMasterDraft[];
  readonly groups:readonly OptionGroupDraft[];
  readonly productLinks:readonly ProductOptionLinkDraft[];
}

const OPTION_KEY='option-center.options.v1';
const GROUP_KEY='option-center.groups.v1';
const LINK_KEY='option-center.product-links.v1';

function unique(values:readonly string[]){
  return [...new Set(values.filter(Boolean))];
}

export function migrateLegacyOptionCenter(draft:AdminSessionDraft):OptionCenterState{
  const optionByCode=new Map<string,OptionMasterDraft>();
  const canonicalByLegacyOptionId=new Map<string,string>();

  for(const group of draft.modifierGroups){
    for(const option of group.options){
      const code=option.code?.trim()||option.id;
      const key=code.toUpperCase();
      let canonical=optionByCode.get(key);
      if(!canonical){
        canonical=Object.freeze({
          id:option.id,
          code,
          name:option.name,
          priceAdjustment:option.priceAdjustment?.trim()||'0.00',
          active:option.active!==false,
        });
        optionByCode.set(key,canonical);
      }
      canonicalByLegacyOptionId.set(option.id,canonical.id);
    }
  }

  const groups:OptionGroupDraft[]=draft.modifierGroups.map((group:ModifierGroupDraft)=>Object.freeze({
    id:group.id,
    name:group.name,
    optionIds:Object.freeze(unique(group.options.map(option=>canonicalByLegacyOptionId.get(option.id)??option.id))),
    required:group.required,
    forceShow:group.forceShow??group.required,
    selection:group.selection,
    min:group.min,
    max:group.max,
    allowQuantities:group.allowQuantities??false,
    active:group.active,
  }));

  const productLinks:ProductOptionLinkDraft[]=[];
  for(const product of draft.products){
    for(const groupId of product.modifierGroupIds??[]){
      const legacyGroup=draft.modifierGroups.find(group=>group.id===groupId);
      const normalizedGroup=groups.find(group=>group.id===groupId);
      if(!legacyGroup||!normalizedGroup)continue;
      const defaults=legacyGroup.options
        .filter(option=>option.defaultSelected)
        .map(option=>canonicalByLegacyOptionId.get(option.id)??option.id)
        .filter(optionId=>normalizedGroup.optionIds.includes(optionId));
      productLinks.push(Object.freeze({
        productId:product.id,
        groupId,
        optionIds:Object.freeze([...normalizedGroup.optionIds]),
        defaultOptionIds:Object.freeze(unique(defaults)),
      }));
    }
  }

  return Object.freeze({
    options:Object.freeze([...optionByCode.values()]),
    groups:Object.freeze(groups),
    productLinks:Object.freeze(productLinks),
  });
}

export function validateOptionCenter(state:OptionCenterState){
  const errors:string[]=[];
  const optionIds=new Set<string>();
  const optionCodes=new Set<string>();

  for(const option of state.options){
    if(!option.id.trim())errors.push('選項缺少內部身份');
    if(optionIds.has(option.id))errors.push('選項身份重複：'+option.id);
    optionIds.add(option.id);

    const code=option.code.trim();
    if(!code)errors.push('選項 '+(option.name||option.id)+' 未填選項 ID');
    if(code&&optionCodes.has(code.toUpperCase()))errors.push('選項 ID 重複：'+code);
    if(code)optionCodes.add(code.toUpperCase());

    if(!option.name.trim())errors.push('選項 '+(code||option.id)+' 未填名稱');
    if(!option.priceAdjustment.trim())errors.push('選項 '+(option.name||code||option.id)+' 未填價格');
    else if(Number.isNaN(Number(option.priceAdjustment)))errors.push('選項 '+(option.name||code||option.id)+' 價格格式錯誤');
  }

  const groupIds=new Set<string>();
  for(const group of state.groups){
    if(groupIds.has(group.id))errors.push('選項組 ID 重複：'+group.id);
    groupIds.add(group.id);
    if(!group.name.trim())errors.push('選項組 '+group.id+' 未填名稱');
    if(group.min<0||group.max<group.min)errors.push('選項組 '+(group.name||group.id)+' 最少／最多選擇無效');
    if(group.required&&group.min<1)errors.push('必選組 '+(group.name||group.id)+' 最少選擇必須至少 1');
    if(group.selection==='SINGLE'&&group.max>1)errors.push('單選組 '+(group.name||group.id)+' 最多選擇不可大過 1');
    for(const optionId of group.optionIds){
      if(!optionIds.has(optionId))errors.push('選項組 '+(group.name||group.id)+' 引用不存在選項 '+optionId);
    }
  }

  for(const link of state.productLinks){
    const group=state.groups.find(row=>row.id===link.groupId);
    if(!group){errors.push('商品 '+link.productId+' 引用不存在選項組 '+link.groupId);continue;}
    for(const optionId of link.optionIds){
      if(!group.optionIds.includes(optionId))errors.push('商品 '+link.productId+' 引用咗唔屬於組別嘅選項 '+optionId);
    }
    for(const optionId of link.defaultOptionIds){
      if(!link.optionIds.includes(optionId))errors.push('商品 '+link.productId+' 默認選項未有套用：'+optionId);
    }
    if(group.selection==='SINGLE'&&link.defaultOptionIds.length>1)errors.push('商品 '+link.productId+' 單選組只可以有一個默認選項');
    if(group.max>=0&&link.defaultOptionIds.length>group.max)errors.push('商品 '+link.productId+' 默認選項超過組別上限');
  }
  return errors;
}

function nextIdentity(prefix:string,existing:readonly string[]){
  let index=1;
  while(existing.includes(prefix+'-'+String(index).padStart(3,'0')))index++;
  return prefix+'-'+String(index).padStart(3,'0');
}

export function useOptionCenter(draft:AdminSessionDraft){
  const migrated=useMemo(()=>migrateLegacyOptionCenter(draft),[]);
  const [options,setOptions]=usePersistentAdminState<OptionMasterDraft[]>(OPTION_KEY,[...migrated.options]);
  const [groups,setGroups]=usePersistentAdminState<OptionGroupDraft[]>(GROUP_KEY,[...migrated.groups]);
  const [productLinks,setProductLinks]=usePersistentAdminState<ProductOptionLinkDraft[]>(LINK_KEY,[...migrated.productLinks]);

  const addOption=()=>{
    setOptions(current=>{
      const id=nextIdentity('option',current.map(row=>row.id));
      const code=nextIdentity('OPT',current.map(row=>row.code));
      const row:OptionMasterDraft={id,code,name:'新選項',priceAdjustment:'0.00',active:true};
      appendAdminAudit({action:'選項中心新增選項',target:id,after:row});
      return [...current,row];
    });
  };
  const updateOption=(id:string,patch:Partial<OptionMasterDraft>)=>{
    setOptions(current=>current.map(row=>{
      if(row.id!==id)return row;
      const after={...row,...patch};
      appendAdminAudit({action:'選項中心修改選項',target:id,before:row,after});
      return after;
    }));
  };
  const removeOption=(id:string)=>{
    if(groups.some(group=>group.optionIds.includes(id)))return false;
    setOptions(current=>current.filter(row=>row.id!==id));
    appendAdminAudit({action:'選項中心刪除選項',target:id});
    return true;
  };

  const addGroup=()=>{
    setGroups(current=>{
      const id=nextIdentity('option-group',current.map(row=>row.id));
      const row:OptionGroupDraft={id,name:'新選項組',optionIds:[],required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true};
      appendAdminAudit({action:'選項中心新增選項組',target:id,after:row});
      return [...current,row];
    });
  };
  const updateGroup=(id:string,patch:Partial<OptionGroupDraft>)=>{
    setGroups(current=>current.map(row=>{
      if(row.id!==id)return row;
      const next={...row,...patch};
      const normalized:OptionGroupDraft={
        ...next,
        max:next.selection==='SINGLE'?Math.min(1,next.max):next.max,
        allowQuantities:next.selection==='SINGLE'?false:next.allowQuantities,
      };
      appendAdminAudit({action:'選項中心修改選項組',target:id,before:row,after:normalized});
      return normalized;
    }));
    if(patch.optionIds){
      const allowed=new Set(patch.optionIds);
      setProductLinks(current=>current.map(link=>link.groupId===id?{
        ...link,
        optionIds:link.optionIds.filter(optionId=>allowed.has(optionId)),
        defaultOptionIds:link.defaultOptionIds.filter(optionId=>allowed.has(optionId)),
      }:link));
    }
  };
  const setGroupOption=(groupId:string,optionId:string,included:boolean)=>{
    const group=groups.find(row=>row.id===groupId);
    if(!group)return;
    updateGroup(groupId,{optionIds:included?unique([...group.optionIds,optionId]):group.optionIds.filter(id=>id!==optionId)});
  };
  const removeGroup=(id:string)=>{
    setGroups(current=>current.filter(row=>row.id!==id));
    setProductLinks(current=>current.filter(link=>link.groupId!==id));
    appendAdminAudit({action:'選項中心刪除選項組',target:id});
  };

  const getLink=(productId:string,groupId:string)=>productLinks.find(link=>link.productId===productId&&link.groupId===groupId);
  const setProductGroupLinked=(productId:string,groupId:string,linked:boolean)=>{
    const group=groups.find(row=>row.id===groupId);
    if(!group)return;
    setProductLinks(current=>{
      const exists=current.some(link=>link.productId===productId&&link.groupId===groupId);
      if(linked&&exists)return current;
      if(!linked)return current.filter(link=>!(link.productId===productId&&link.groupId===groupId));
      const row:ProductOptionLinkDraft={productId,groupId,optionIds:[...group.optionIds],defaultOptionIds:[]};
      appendAdminAudit({action:'商品連結選項組',target:productId,after:{groupId}});
      return [...current,row];
    });
  };
  const setProductOptionLinked=(productId:string,groupId:string,optionId:string,linked:boolean)=>{
    setProductLinks(current=>current.map(link=>{
      if(link.productId!==productId||link.groupId!==groupId)return link;
      const optionIds=linked?unique([...link.optionIds,optionId]):link.optionIds.filter(id=>id!==optionId);
      const defaultOptionIds=link.defaultOptionIds.filter(id=>optionIds.includes(id));
      return {...link,optionIds,defaultOptionIds};
    }));
  };
  const setProductDefault=(productId:string,groupId:string,optionId:string,selected:boolean)=>{
    const group=groups.find(row=>row.id===groupId);
    if(!group)return;
    setProductLinks(current=>current.map(link=>{
      if(link.productId!==productId||link.groupId!==groupId)return link;
      if(!link.optionIds.includes(optionId))return link;
      const defaults=selected
        ?group.selection==='SINGLE'?[optionId]:unique([...link.defaultOptionIds,optionId]).slice(0,Math.max(group.max,1))
        :link.defaultOptionIds.filter(id=>id!==optionId);
      return {...link,defaultOptionIds:defaults};
    }));
  };

  const state:OptionCenterState={options,groups,productLinks};
  return {
    state,
    options,
    groups,
    productLinks,
    errors:validateOptionCenter(state),
    addOption,updateOption,removeOption,
    addGroup,updateGroup,setGroupOption,removeGroup,
    getLink,setProductGroupLinked,setProductOptionLinked,setProductDefault,
  };
}

export const OPTION_CENTER_STORAGE_KEYS=Object.freeze({
  options:OPTION_KEY,
  groups:GROUP_KEY,
  productLinks:LINK_KEY,
});
