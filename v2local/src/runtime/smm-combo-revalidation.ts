import type {SmmLanLineIntent} from '../../../contracts/smm-lan-v1.ts';
import type {
  SyncedCombo,
  SyncedComboPool,
  SyncedOrderingProduct,
} from './admin-config-projection.ts';
import {
  applyRiceballPairings,
  buildRiceballPairingDraft,
  pairingAssignmentsFromDraft,
  type PairingCartLine,
} from '../features/ordering/riceball-pairing-model.ts';

export interface SmmCanonicalComboLineResult{
  readonly items:readonly {
    readonly id:string;
    readonly name:string;
    readonly qty:number;
    readonly unitMinor:number;
    readonly serviceMode:'takeaway'|'dine-in';
    readonly detail?:string;
  }[];
  readonly unitMinor:number;
}

function mainComboMatches(
  productId:string,
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
){
  const poolById=new Map(pools.map(pool=>[pool.id,pool] as const));
  return combos.filter(combo=>{
    if(!combo.active||!combo.mainPoolId)return false;
    const pool=poolById.get(combo.mainPoolId);
    if(!pool||pool.kind!=='MAIN_COURSE')return false;
    return pool.groups.some(group=>group.subPools.some(subPool=>subPool.choices.some(choice=>
      choice.type==='PRODUCT'&&choice.productId===productId
    )));
  });
}

function mainConfigurationDetail(line:SmmLanLineIntent,product:SyncedOrderingProduct){
  const byGroup=new Map<string,string[]>();
  for(const selection of line.selections){
    const rows=byGroup.get(selection.optionGroupId)??[];
    rows.push(selection.optionId);
    byGroup.set(selection.optionGroupId,rows);
  }
  return product.optionSets.flatMap(set=>{
    const selected=new Set(byGroup.get(set.id)??[]);
    const names=set.options.filter(option=>selected.has(option.id)).map(option=>option.name);
    return names.length?[set.name+'：'+names.join('、')]:[];
  }).join(' · ');
}

function effectiveGroupMin(pool:SyncedComboPool,required:boolean,min:number){
  // Reuse the banked SMT A3c rule: drink is an optional supplement.
  if(pool.addonKind==='DRINK')return 0;
  return Math.max(required?1:0,min);
}

function findSelection(
  line:SmmLanLineIntent,
  pool:SyncedComboPool,
  groupId:string,
){
  return line.combo?.selections.filter(selection=>selection.poolId===pool.id&&selection.groupId===groupId)??[];
}

export function revalidateSmmComboLine(
  line:SmmLanLineIntent,
  serviceMode:'takeaway'|'dine-in',
  products:readonly SyncedOrderingProduct[],
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  standaloneMainUnitMinor:number,
):SmmCanonicalComboLineResult{
  const intent=line.combo;
  if(!intent)throw new Error('SMM_COMBO_INTENT_REQUIRED');

  const mainProduct=products.find(product=>product.id===line.productId&&product.sellable&&product.priceReady);
  if(!mainProduct)throw new Error('SMM_COMBO_MAIN_PRODUCT_UNAVAILABLE');

  const matches=mainComboMatches(line.productId,combos,pools);
  if(matches.length!==1||matches[0]!.id!==intent.comboId)throw new Error('SMM_COMBO_BINDING_CHANGED');
  const combo=matches[0]!;
  if(intent.comboName!==combo.name||intent.publishedBasePriceMinor!==combo.basePriceMinor){
    throw new Error('SMM_COMBO_PUBLISHED_FACT_CHANGED');
  }

  const poolById=new Map(pools.map(pool=>[pool.id,pool] as const));
  const allowedPoolIds=new Set(combo.addonPoolIds);
  const seenIntentKeys=new Set<string>();
  const canonicalSelections:{
    pool:SyncedComboPool;
    choiceType:'PRODUCT'|'LABEL'|'NONE';
    productId?:string;
    choiceLabel:string;
    publishedAdjustmentMinor:number;
  }[]=[];

  for(const selection of intent.selections){
    const key=[
      selection.poolId,
      selection.groupId,
      selection.subPoolId,
      selection.choiceId,
    ].join('::');
    if(seenIntentKeys.has(key))throw new Error('SMM_COMBO_SELECTION_DUPLICATE');
    seenIntentKeys.add(key);
    if(!allowedPoolIds.has(selection.poolId))throw new Error('SMM_COMBO_POOL_NOT_ALLOWED');
  }

  for(const poolId of combo.addonPoolIds){
    const pool=poolById.get(poolId);
    if(!pool||pool.kind!=='ADDON')throw new Error('SMM_COMBO_ADDON_POOL_MISSING');

    for(const group of pool.groups){
      const selected=findSelection(line,pool,group.id);
      const min=effectiveGroupMin(pool,group.required,group.min);
      const max=Math.max(min,group.max);
      if(selected.length<min)throw new Error('SMM_COMBO_REQUIRED:'+pool.id+':'+group.id);
      if(selected.length>max)throw new Error('SMM_COMBO_MAX_EXCEEDED:'+pool.id+':'+group.id);

      for(const selection of selected){
        const subPool=group.subPools.find(row=>row.id===selection.subPoolId&&row.active);
        if(!subPool)throw new Error('SMM_COMBO_SUBPOOL_UNAVAILABLE');
        const choice=subPool.choices.find(row=>row.id===selection.choiceId&&row.active);
        if(!choice)throw new Error('SMM_COMBO_CHOICE_UNAVAILABLE');
        if(selection.choiceType!==choice.type)throw new Error('SMM_COMBO_CHOICE_TYPE_CHANGED');
        if((selection.productId??'')!==(choice.productId??''))throw new Error('SMM_COMBO_PRODUCT_CHANGED');
        const adjustment=subPool.priceAdjustmentMinor+choice.priceAdjustmentMinor;
        if(selection.publishedAdjustmentMinor!==adjustment)throw new Error('SMM_COMBO_PUBLISHED_PRICE_CHANGED');

        if(choice.type==='PRODUCT'){
          const child=products.find(product=>product.id===choice.productId&&product.sellable&&product.priceReady);
          if(!child)throw new Error('SMM_COMBO_CHILD_PRODUCT_UNAVAILABLE');
          // Stage 2 does not contain a nested child-product configurator. Fail closed
          // rather than silently bypass any product-level option semantics.
          if(child.optionSets.length>0)throw new Error('SMM_COMBO_CHILD_CONFIGURATION_REQUIRED');
        }

        canonicalSelections.push({
          pool,
          choiceType:choice.type,
          ...(choice.productId?{productId:choice.productId}:{}),
          choiceLabel:choice.type==='PRODUCT'
            ?(products.find(product=>product.id===choice.productId)?.name??choice.label)
            :choice.label,
          publishedAdjustmentMinor:adjustment,
        });
      }
    }
  }

  const expectedCount=intent.selections.length;
  if(canonicalSelections.length!==expectedCount)throw new Error('SMM_COMBO_SELECTION_UNKNOWN');

  const snackSelections=canonicalSelections.filter(row=>row.pool.addonKind==='SNACK');
  const drinkSelections=canonicalSelections.filter(row=>row.pool.addonKind==='DRINK');
  if(snackSelections.length!==1||snackSelections[0]!.choiceType!=='PRODUCT'||!snackSelections[0]!.productId){
    throw new Error('SMM_COMBO_SNACK_PRODUCT_REQUIRED');
  }
  if(drinkSelections.length>1)throw new Error('SMM_COMBO_DRINK_MAX_EXCEEDED');

  const snackProduct=products.find(product=>product.id===snackSelections[0]!.productId);
  if(!snackProduct)throw new Error('SMM_COMBO_SNACK_PRODUCT_UNAVAILABLE');

  const mainOptionDelta=standaloneMainUnitMinor-mainProduct.priceMinor;
  if(!Number.isSafeInteger(mainOptionDelta))throw new Error('SMM_COMBO_MAIN_OPTION_PRICE_INVALID');

  const mainDetail=mainConfigurationDetail(line,mainProduct);
  const pairingLines:PairingCartLine[]=[
    {
      id:line.lineId+'::main',
      productId:mainProduct.id,
      name:mainProduct.name,
      qty:line.quantity,
      unitMinor:standaloneMainUnitMinor,
      serviceMode,
      ...(mainDetail?{detail:mainDetail}:{}),
    },
    {
      id:line.lineId+'::snack',
      productId:snackProduct.id,
      name:snackProduct.name,
      qty:line.quantity,
      unitMinor:snackProduct.priceMinor,
      serviceMode,
    },
  ];
  const pairingProducts=products.map(product=>Object.freeze({
    id:product.id,
    name:product.name,
    priceMinor:product.priceMinor,
    optionSets:product.optionSets,
  }));
  const draft=buildRiceballPairingDraft(pairingLines,pairingProducts,combos,pools);
  if(draft.slots.length!==line.quantity||draft.snacks.length!==line.quantity||draft.pairableCount!==line.quantity){
    throw new Error('SMM_COMBO_PAIRING_REVALIDATION_FAILED');
  }
  if(draft.slots.some(slot=>slot.comboId!==combo.id))throw new Error('SMM_COMBO_PAIRING_COMBO_CHANGED');

  let createdSequence=0;
  const applied=applyRiceballPairings(
    pairingLines,
    pairingProducts,
    combos,
    pools,
    draft,
    pairingAssignmentsFromDraft(draft),
    ()=>line.lineId+'::combo-'+String(++createdSequence),
  );
  if(applied.groups.length!==line.quantity)throw new Error('SMM_COMBO_PAIRING_APPLY_FAILED');

  const items=applied.lines.map(row=>Object.freeze({
    id:row.productId,
    name:row.name,
    qty:row.qty,
    unitMinor:row.unitMinor,
    serviceMode:row.serviceMode,
    ...(row.detail?{detail:row.detail}:{}),
  }));

  for(const drink of drinkSelections){
    const perUnit=drink.publishedAdjustmentMinor;
    if(!Number.isSafeInteger(perUnit))throw new Error('SMM_COMBO_DRINK_PRICE_INVALID');
    items.push(Object.freeze({
      id:'drink-supplement:'+(drink.productId??drink.choiceLabel),
      name:'飲品｜'+drink.choiceLabel,
      qty:line.quantity,
      unitMinor:perUnit,
      serviceMode,
      detail:'套餐：'+combo.name,
    }));
  }

  const unitMinor=combo.basePriceMinor
    +mainOptionDelta
    +canonicalSelections.reduce((sum,row)=>sum+row.publishedAdjustmentMinor,0);
  if(!Number.isSafeInteger(unitMinor)||unitMinor<0)throw new Error('SMM_COMBO_UNIT_PRICE_INVALID');

  const expandedTotal=items.reduce((sum,item)=>sum+item.unitMinor*item.qty,0);
  if(expandedTotal!==unitMinor*line.quantity)throw new Error('SMM_COMBO_EXPANSION_TOTAL_MISMATCH');

  return Object.freeze({items:Object.freeze(items),unitMinor});
}
