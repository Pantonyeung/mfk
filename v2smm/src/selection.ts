import type {SmmCartSelection,SmmOptionGroup,SmmProduct} from './product-types';

export type SmmSelectionState=Readonly<Record<string,readonly string[]>>;

export interface SmmSelectionValidation {
  readonly ok:boolean;
  readonly issues:readonly string[];
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
