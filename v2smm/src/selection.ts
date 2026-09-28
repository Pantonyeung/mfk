import type {
  SmmCartComboIntent,
  SmmCartSelection,
  SmmCombo,
  SmmComboGroup,
  SmmComboPool,
  SmmMenuSnapshot,
  SmmOptionGroup,
  SmmProduct,
} from './product-types';

export type SmmSelectionState=Readonly<Record<string,readonly string[]>>;
export type SmmComboSelectionState=Readonly<Record<string,readonly string[]>>;

export interface SmmSelectionValidation {
  readonly ok:boolean;
  readonly issues:readonly string[];
}

export interface SmmResolvedComboChoice{
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
  readonly choiceType:'PRODUCT'|'LABEL'|'NONE';
  readonly choiceLabel:string;
  readonly productId?:string;
  readonly available:boolean;
  readonly publishedAdjustmentMinor:number;
}

export interface SmmResolvedComboGroup{
  readonly pool:SmmComboPool;
  readonly group:SmmComboGroup;
  readonly key:string;
  readonly effectiveRequired:boolean;
  readonly effectiveMinSelections:number;
  readonly effectiveMaxSelections:number;
  readonly choices:readonly SmmResolvedComboChoice[];
}

export interface SmmResolvedCombo{
  readonly combo:SmmCombo;
  readonly groups:readonly SmmResolvedComboGroup[];
}

export function toggleSmmSelection(
  state:SmmSelectionState,
  group:SmmOptionGroup,
  optionId:string,
):SmmSelectionState{
  const current=state[group.optionGroupId]??[];
  const exists=current.includes(optionId);
  const next=exists
    ?current.filter(id=>id!==optionId)
    :group.maxSelections===1
      ?[optionId]
      :current.length<group.maxSelections?[...current,optionId]:current;
  return Object.freeze({...state,[group.optionGroupId]:Object.freeze(next)});
}

export function validateSmmSelections(product:SmmProduct,state:SmmSelectionState):SmmSelectionValidation{
  const issues:string[]=[];
  for(const group of product.optionGroups){
    const selected=state[group.optionGroupId]??[];
    const min=Math.max(group.required?1:0,group.minSelections);
    if(selected.length<min)issues.push(`${group.name}最少選擇 ${min} 項`);
    if(selected.length>group.maxSelections)issues.push(`${group.name}最多選擇 ${group.maxSelections} 項`);
    for(const optionId of selected){
      const option=group.options.find(candidate=>candidate.optionId===optionId);
      if(!option||!option.available)issues.push(`${group.name}包含不可用選項`);
    }
  }
  return Object.freeze({ok:issues.length===0,issues:Object.freeze(issues)});
}

export function selectedSmmCartOptions(product:SmmProduct,state:SmmSelectionState):readonly SmmCartSelection[]{
  return Object.freeze(product.optionGroups.flatMap(group=>
    (state[group.optionGroupId]??[]).flatMap(optionId=>{
      const option=group.options.find(candidate=>candidate.optionId===optionId);
      return option?[Object.freeze({
        optionGroupId:group.optionGroupId,
        optionId:option.optionId,
        optionName:option.name,
        ...(Number.isSafeInteger(Number(option.publishedAdjustmentMinor))?{publishedAdjustmentMinor:Number(option.publishedAdjustmentMinor)}:{}),
      })]:[];
    })
  ));
}

export function smmComboGroupKey(poolId:string,groupId:string){
  return poolId+'::'+groupId;
}

function comboMainPoolContainsProduct(combo:SmmCombo,product:SmmProduct,menu:SmmMenuSnapshot){
  if(!combo.mainPoolId)return false;
  const pool=(menu.comboPools??[]).find(row=>row.poolId===combo.mainPoolId&&row.kind==='MAIN_COURSE');
  if(!pool)return false;
  return pool.groups.some(group=>group.subPools.some(subPool=>subPool.choices.some(choice=>
    choice.choiceType==='PRODUCT'&&choice.productId===product.productId&&choice.available
  )));
}

export function resolveSmmProductCombo(product:SmmProduct,menu:SmmMenuSnapshot|undefined):SmmResolvedCombo|null{
  if(!menu||!product.comboId)return null;
  const combo=(menu.combos??[]).find(row=>row.comboId===product.comboId);
  if(!combo||!comboMainPoolContainsProduct(combo,product,menu))return null;
  const poolById=new Map((menu.comboPools??[]).map(pool=>[pool.poolId,pool] as const));
  const groups:SmmResolvedComboGroup[]=[];
  for(const poolId of combo.addonPoolIds){
    const pool=poolById.get(poolId);
    if(!pool||pool.kind!=='ADDON')continue;
    for(const group of pool.groups){
      // Owner-confirmed SMT A3c: DRINK is optional supplement even when the
      // Admin source group is marked required. Blank drink means no delta.
      const effectiveRequired=pool.addonKind==='DRINK'?false:group.required;
      const effectiveMinSelections=pool.addonKind==='DRINK'
        ?0
        :Math.max(effectiveRequired?1:0,group.minSelections);
      const effectiveMaxSelections=Math.max(effectiveMinSelections,group.maxSelections);
      const choices=group.subPools.flatMap(subPool=>subPool.choices.map(choice=>Object.freeze({
        poolId:pool.poolId,
        groupId:group.groupId,
        subPoolId:subPool.subPoolId,
        choiceId:choice.choiceId,
        choiceType:choice.choiceType,
        choiceLabel:choice.label,
        ...(choice.productId?{productId:choice.productId}:{}),
        available:choice.available,
        publishedAdjustmentMinor:subPool.publishedAdjustmentMinor+choice.publishedAdjustmentMinor,
      })));
      groups.push(Object.freeze({
        pool,
        group,
        key:smmComboGroupKey(pool.poolId,group.groupId),
        effectiveRequired,
        effectiveMinSelections,
        effectiveMaxSelections,
        choices:Object.freeze(choices),
      }));
    }
  }
  return Object.freeze({combo,groups:Object.freeze(groups)});
}

export function toggleSmmComboSelection(
  state:SmmComboSelectionState,
  group:SmmResolvedComboGroup,
  choiceId:string,
):SmmComboSelectionState{
  const current=state[group.key]??[];
  const exists=current.includes(choiceId);
  const next=exists
    ?current.filter(id=>id!==choiceId)
    :group.effectiveMaxSelections===1
      ?[choiceId]
      :current.length<group.effectiveMaxSelections?[...current,choiceId]:current;
  return Object.freeze({...state,[group.key]:Object.freeze(next)});
}

export function validateSmmComboSelections(
  product:SmmProduct,
  menu:SmmMenuSnapshot|undefined,
  enabled:boolean,
  state:SmmComboSelectionState,
):SmmSelectionValidation{
  if(!enabled)return Object.freeze({ok:true,issues:Object.freeze([])});
  const resolved=resolveSmmProductCombo(product,menu);
  if(!resolved)return Object.freeze({ok:false,issues:Object.freeze(['套餐資料未完整，請重新同步'])});
  const issues:string[]=[];
  const knownKeys=new Set(resolved.groups.map(group=>group.key));
  for(const key of Object.keys(state)){
    if((state[key]?.length??0)>0&&!knownKeys.has(key))issues.push('套餐選項已更新，請重新選擇');
  }
  for(const group of resolved.groups){
    const selected=state[group.key]??[];
    const unique=[...new Set(selected)];
    if(unique.length!==selected.length)issues.push(`${group.group.name}有重複選項`);
    if(unique.length<group.effectiveMinSelections)issues.push(`${group.group.name}最少選擇 ${group.effectiveMinSelections} 項`);
    if(unique.length>group.effectiveMaxSelections)issues.push(`${group.group.name}最多選擇 ${group.effectiveMaxSelections} 項`);
    for(const choiceId of unique){
      const choice=group.choices.find(row=>row.choiceId===choiceId);
      if(!choice||!choice.available)issues.push(`${group.group.name}包含不可用選項`);
    }
  }
  return Object.freeze({ok:issues.length===0,issues:Object.freeze(issues)});
}

export function selectedSmmComboIntent(
  product:SmmProduct,
  menu:SmmMenuSnapshot|undefined,
  enabled:boolean,
  state:SmmComboSelectionState,
):SmmCartComboIntent|undefined{
  if(!enabled)return undefined;
  const validation=validateSmmComboSelections(product,menu,enabled,state);
  if(!validation.ok)return undefined;
  const resolved=resolveSmmProductCombo(product,menu);
  if(!resolved)return undefined;
  const selections=resolved.groups.flatMap(group=>{
    const selected=state[group.key]??[];
    return selected.flatMap(choiceId=>{
      const choice=group.choices.find(row=>row.choiceId===choiceId);
      return choice?[Object.freeze({
        poolId:choice.poolId,
        groupId:choice.groupId,
        subPoolId:choice.subPoolId,
        choiceId:choice.choiceId,
        choiceType:choice.choiceType,
        choiceLabel:choice.choiceLabel,
        ...(choice.productId?{productId:choice.productId}:{}),
        publishedAdjustmentMinor:choice.publishedAdjustmentMinor,
      })]:[];
    });
  });
  return Object.freeze({
    comboId:resolved.combo.comboId,
    comboName:resolved.combo.name,
    publishedBasePriceMinor:resolved.combo.publishedBasePriceMinor,
    selections:Object.freeze(selections),
  });
}

export function comboSelectionStateFromIntent(intent:SmmCartComboIntent):SmmComboSelectionState{
  const out:Record<string,string[]>={};
  for(const selection of intent.selections){
    const key=smmComboGroupKey(selection.poolId,selection.groupId);
    (out[key]??=[]).push(selection.choiceId);
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(out).map(([key,value])=>[key,Object.freeze(value)])
  ));
}

export function revalidateSmmCartComboIntent(
  product:SmmProduct,
  menu:SmmMenuSnapshot|undefined,
  intent:SmmCartComboIntent,
):SmmCartComboIntent|null{
  if(product.comboId!==intent.comboId)return null;
  const state=comboSelectionStateFromIntent(intent);
  const rebuilt=selectedSmmComboIntent(product,menu,true,state);
  if(!rebuilt||rebuilt.comboId!==intent.comboId)return null;
  if(rebuilt.selections.length!==intent.selections.length)return null;
  return rebuilt;
}

export function publishedSmmComboUnitMinor(intent:SmmCartComboIntent,mainOptionAdjustmentMinor:number){
  const total=intent.publishedBasePriceMinor
    +mainOptionAdjustmentMinor
    +intent.selections.reduce((sum,row)=>sum+row.publishedAdjustmentMinor,0);
  return Number.isSafeInteger(total)&&total>=0?total:null;
}
