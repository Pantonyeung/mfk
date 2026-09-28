import type {
  CustomerCartComboIntent,
  CustomerCartComboSelection,
  CustomerCartSelection,
  CustomerCombo,
  CustomerComboGroup,
  CustomerComboPool,
  CustomerMenuSnapshot,
  CustomerOptionGroup,
  CustomerProduct,
} from './product-types';

export type CustomerSelectionState=Readonly<Record<string,readonly string[]>>;

export interface CustomerSelectionValidation {
  readonly ok:boolean;
  readonly issues:readonly string[];
}

export function toggleCustomerSelection(
  state:CustomerSelectionState,
  group:CustomerOptionGroup,
  optionId:string,
):CustomerSelectionState{
  const current=state[group.optionGroupId]??[];
  const exists=current.includes(optionId);
  const next=exists
    ?current.filter(id=>id!==optionId)
    :group.maxSelections===1
      ?[optionId]
      :current.length<group.maxSelections?[...current,optionId]:current;
  return Object.freeze({...state,[group.optionGroupId]:Object.freeze(next)});
}

export function validateCustomerSelections(product:CustomerProduct,state:CustomerSelectionState):CustomerSelectionValidation{
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

export function selectedCustomerOptions(product:CustomerProduct,state:CustomerSelectionState):readonly CustomerCartSelection[]{
  return Object.freeze(product.optionGroups.flatMap(group=>
    (state[group.optionGroupId]??[]).flatMap(optionId=>{
      const option=group.options.find(candidate=>candidate.optionId===optionId);
      return option?[Object.freeze({
        optionGroupId:group.optionGroupId,
        optionId:option.optionId,
        optionName:option.name,
        publishedAdjustmentMinor:option.publishedAdjustmentMinor,
      })]:[];
    })
  ));
}

export interface CustomerComboDraftSelection {
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
}

export type CustomerComboSelectionState=readonly CustomerComboDraftSelection[];

export interface CustomerComboSelectionValidation {
  readonly ok:boolean;
  readonly issues:readonly string[];
  readonly combo?:CustomerCombo;
}

const comboKey=(row:CustomerComboDraftSelection)=>[
  row.poolId,row.groupId,row.subPoolId,row.choiceId,
].join('::');

export function customerComboEffectiveMin(pool:CustomerComboPool,group:CustomerComboGroup){
  // Banked SMT A3c semantic: DRINK is an optional supplement even if the
  // published group itself carries required/min metadata.
  return pool.addonKind==='DRINK'?0:Math.max(group.required?1:0,group.minSelections);
}

function exactCombo(product:CustomerProduct,menu:CustomerMenuSnapshot|null|undefined){
  if(!product.comboId||!menu)return undefined;
  return menu.combos?.find(combo=>combo.comboId===product.comboId);
}

function exactPool(menu:CustomerMenuSnapshot,poolId:string){
  return menu.comboPools?.find(pool=>pool.poolId===poolId);
}

function selectedForGroup(state:CustomerComboSelectionState,poolId:string,groupId:string){
  return state.filter(row=>row.poolId===poolId&&row.groupId===groupId);
}

export function customerComboChoiceSelected(
  state:CustomerComboSelectionState,
  poolId:string,
  groupId:string,
  subPoolId:string,
  choiceId:string,
){
  return state.some(row=>
    row.poolId===poolId&&
    row.groupId===groupId&&
    row.subPoolId===subPoolId&&
    row.choiceId===choiceId
  );
}

export function customerComboGroupSelectionCount(
  state:CustomerComboSelectionState,
  poolId:string,
  groupId:string,
){
  return selectedForGroup(state,poolId,groupId).length;
}

export function toggleCustomerComboSelection(
  state:CustomerComboSelectionState,
  pool:CustomerComboPool,
  group:CustomerComboGroup,
  subPoolId:string,
  choiceId:string,
):CustomerComboSelectionState{
  const subPool=group.subPools.find(row=>row.subPoolId===subPoolId);
  const choice=subPool?.choices.find(row=>row.choiceId===choiceId);
  if(!subPool||!choice||!choice.available)return state;

  const canonicalGroupState=state.filter(row=>{
    if(row.poolId!==pool.poolId||row.groupId!==group.groupId)return true;
    const currentSubPool=group.subPools.find(candidate=>candidate.subPoolId===row.subPoolId);
    const currentChoice=currentSubPool?.choices.find(candidate=>candidate.choiceId===row.choiceId);
    return Boolean(currentSubPool&&currentChoice?.available);
  });
  const draft:CustomerComboDraftSelection=Object.freeze({
    poolId:pool.poolId,
    groupId:group.groupId,
    subPoolId,
    choiceId,
  });
  const exists=canonicalGroupState.some(row=>comboKey(row)===comboKey(draft));
  if(exists)return Object.freeze(canonicalGroupState.filter(row=>comboKey(row)!==comboKey(draft)));

  const current=selectedForGroup(canonicalGroupState,pool.poolId,group.groupId);
  const min=customerComboEffectiveMin(pool,group);
  const max=Math.max(min,group.maxSelections);
  if(max<=1){
    return Object.freeze([
      ...canonicalGroupState.filter(row=>!(row.poolId===pool.poolId&&row.groupId===group.groupId)),
      draft,
    ]);
  }
  if(current.length>=max)return Object.freeze(canonicalGroupState);
  return Object.freeze([...canonicalGroupState,draft]);
}

export function validateCustomerComboSelection(
  product:CustomerProduct,
  menu:CustomerMenuSnapshot|null|undefined,
  state:CustomerComboSelectionState,
):CustomerComboSelectionValidation{
  const issues:string[]=[];
  if(!product.comboId){
    if(state.length)issues.push('商品未綁定套餐，請重新同步菜單');
    return Object.freeze({ok:issues.length===0,issues:Object.freeze(issues)});
  }
  if(!menu){
    return Object.freeze({ok:false,issues:Object.freeze(['套餐資料需要重新同步'])});
  }

  const combo=menu.combos?.find(row=>row.comboId===product.comboId);
  if(!combo){
    return Object.freeze({ok:false,issues:Object.freeze(['套餐資料需要重新同步'])});
  }
  const exactBound=combo.comboId===product.comboId;
  if(!exactBound)issues.push('套餐綁定已更新，請重新同步');
  if(!Number.isSafeInteger(Number(combo.publishedBasePriceMinor))||Number(combo.publishedBasePriceMinor)<0){
    issues.push('套餐價格資料待同步');
  }

  const mainPool=combo.mainPoolId?exactPool(menu,combo.mainPoolId):undefined;
  const mainMatches=mainPool?.kind==='MAIN_COURSE'
    ?mainPool.groups.flatMap(group=>group.subPools.flatMap(subPool=>subPool.choices)).filter(choice=>
      choice.choiceType==='PRODUCT'&&choice.productId===product.productId&&choice.available
    )
    :[];
  if(!mainPool||mainPool.kind!=='MAIN_COURSE'||mainMatches.length!==1){
    issues.push('套餐主餐綁定已更新，請重新同步');
  }

  const allowedPoolIds=new Set(combo.addonPoolIds);
  const seen=new Set<string>();
  for(const draft of state){
    const key=comboKey(draft);
    if(seen.has(key)){
      issues.push('套餐選項重複');
      continue;
    }
    seen.add(key);
    if(!allowedPoolIds.has(draft.poolId)){
      issues.push('套餐包含未知選項群組');
      continue;
    }
    const pool=exactPool(menu,draft.poolId);
    const group=pool?.groups.find(row=>row.groupId===draft.groupId);
    const subPool=group?.subPools.find(row=>row.subPoolId===draft.subPoolId);
    const choice=subPool?.choices.find(choice=>choice.choiceId===draft.choiceId);
    if(!pool||pool.kind!=='ADDON'||!group||!subPool||!choice||!choice.available){
      issues.push('套餐包含已更新或不可用選項');
      continue;
    }
    if(choice.choiceType==='PRODUCT'&&!choice.productId)issues.push('套餐商品選項資料未完整');
    const adjustment=Number(subPool.publishedAdjustmentMinor)+Number(choice.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(adjustment))issues.push('套餐選項價格資料待同步');
  }

  for(const poolId of combo.addonPoolIds){
    const pool=exactPool(menu,poolId);
    if(!pool||pool.kind!=='ADDON'){
      issues.push('套餐加配資料需要重新同步');
      continue;
    }
    for(const group of pool.groups){
      const count=selectedForGroup(state,pool.poolId,group.groupId).length;
      const min=customerComboEffectiveMin(pool,group);
      const max=Math.max(min,group.maxSelections);
      if(count<min)issues.push(`${group.name}最少選擇 ${min} 項`);
      if(count>max)issues.push(`${group.name}最多選擇 ${max} 項`);
    }
  }

  return Object.freeze({
    ok:issues.length===0,
    issues:Object.freeze(issues),
    combo,
  });
}

export function selectedCustomerComboIntent(
  product:CustomerProduct,
  menu:CustomerMenuSnapshot|null|undefined,
  state:CustomerComboSelectionState,
):CustomerCartComboIntent|null{
  const validation=validateCustomerComboSelection(product,menu,state);
  if(!validation.ok||!validation.combo||!menu)return null;
  const combo=validation.combo;
  const selections:CustomerCartComboSelection[]=[];

  for(const poolId of combo.addonPoolIds){
    const pool=exactPool(menu,poolId);
    if(!pool)continue;
    for(const group of pool.groups){
      for(const subPool of group.subPools){
        for(const choice of subPool.choices){
          const draft=state.find(row=>
            row.poolId===pool.poolId&&
            row.groupId===group.groupId&&
            row.subPoolId===subPool.subPoolId&&
            row.choiceId===choice.choiceId
          );
          if(!draft)continue;
          if(choice.choiceId===draft.choiceId){
            const adjustment=Number(subPool.publishedAdjustmentMinor)+Number(choice.publishedAdjustmentMinor);
            if(!Number.isSafeInteger(adjustment))return null;
            selections.push(Object.freeze({
              poolId:pool.poolId,
              groupId:group.groupId,
              subPoolId:subPool.subPoolId,
              choiceId:choice.choiceId,
              choiceType:choice.choiceType,
              choiceLabel:choice.label,
              ...(choice.productId?{productId:choice.productId}:{}),
              publishedAdjustmentMinor:adjustment,
            }));
          }
        }
      }
    }
  }

  return Object.freeze({
    comboId:combo.comboId,
    comboName:combo.name,
    publishedBasePriceMinor:combo.publishedBasePriceMinor,
    selections:Object.freeze(selections),
  });
}

export function restoreCustomerComboSelectionState(
  intent:CustomerCartComboIntent|undefined,
):CustomerComboSelectionState{
  if(!intent)return Object.freeze([]);
  return Object.freeze(intent.selections.map(selection=>Object.freeze({
    poolId:selection.poolId,
    groupId:selection.groupId,
    subPoolId:selection.subPoolId,
    choiceId:selection.choiceId,
  })));
}

export function customerStandalonePublishedUnitMinor(
  product:CustomerProduct,
  ordinarySelections:readonly CustomerCartSelection[],
):number|null{
  const base=Number(product.publishedUnitPriceMinor);
  if(!Number.isSafeInteger(base)||base<0)return null;
  let unitMinor=base;
  for(const selection of ordinarySelections){
    if(selection.publishedAdjustmentMinor===undefined)return null;
    const adjustment=Number(selection.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(adjustment))return null;
    unitMinor+=adjustment;
  }
  return Number.isSafeInteger(unitMinor)&&unitMinor>=0?unitMinor:null;
}

export function customerComboPublishedUnitMinor(
  intent:CustomerCartComboIntent,
  ordinarySelections:readonly CustomerCartSelection[],
):number|null{
  const base=Number(intent.publishedBasePriceMinor);
  if(!Number.isSafeInteger(base)||base<0)return null;
  let unitMinor=base;
  for(const selection of intent.selections){
    const adjustment=Number(selection.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(adjustment))return null;
    unitMinor+=adjustment;
  }
  for(const selection of ordinarySelections){
    if(selection.publishedAdjustmentMinor===undefined)return null;
    const adjustment=Number(selection.publishedAdjustmentMinor);
    if(!Number.isSafeInteger(adjustment))return null;
    unitMinor+=adjustment;
  }
  return Number.isSafeInteger(unitMinor)&&unitMinor>=0?unitMinor:null;
}
