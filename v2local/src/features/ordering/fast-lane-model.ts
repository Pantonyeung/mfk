import type {SyncedCombo,SyncedComboPool,SyncedOptionSet} from '../../runtime/admin-config-projection.ts';
import type {ServiceMode} from './ordering-workspace-model.ts';
import {MFK_ORDER_LINE_COMPOSITION_SCHEMA,normalizeMfkOrderLineCompositionV1,type MfkOrderLineCompositionV1} from '../../../../contracts/order-line-composition-v1.ts';

export interface FastLaneProduct{
  readonly id:string;
  readonly name:string;
  readonly priceMinor:number;
  readonly optionSets:readonly SyncedOptionSet[];
}

export interface FastLaneComponentSnapshot{
  readonly productId:string;
  readonly name:string;
  readonly unitMinor:number;
  readonly serviceMode:ServiceMode;
  readonly detail?:string;
  readonly optionSelections?:Readonly<Record<string,readonly string[]>>;
  readonly freeNote?:string;
}

export interface FastLaneComboComponent{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:FastLaneComboRole;
  readonly choiceId:string;
  readonly choiceLabel:string;
  readonly sourceLineId:string;
  readonly snapshot:FastLaneComponentSnapshot;
}

export interface FastLaneComboResolvedChoice{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:FastLaneComboRole;
  readonly choiceId:string;
  readonly choiceLabel:string;
  readonly priceAdjustmentMinor:number;
}

export interface FastLaneComboPendingGroup{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:FastLaneComboRole;
  readonly required:boolean;
}

export interface FastLaneComboDraft{
  readonly comboId:string;
  readonly comboName:string;
  readonly pairingLabel:string;
  readonly source:'AUTO'|'SPECIFIED';
  readonly components:readonly FastLaneComboComponent[];
  readonly resolvedChoices:readonly FastLaneComboResolvedChoice[];
  readonly pendingGroups:readonly FastLaneComboPendingGroup[];
}

export interface FastLaneCartLine{
  readonly id:string;
  readonly productId:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly serviceMode:ServiceMode;
  readonly detail?:string;
  readonly optionSelections?:Readonly<Record<string,readonly string[]>>;
  readonly freeNote?:string;
  readonly comboDraft?:FastLaneComboDraft;
}

export type FastLaneComboRole='MAIN_COURSE'|'SNACK'|'DRINK';

export interface FastLaneRequiredTask{
  readonly id:string;
  readonly lineId:string;
  readonly lineName:string;
  readonly groupId:string;
  readonly groupName:string;
  readonly selection:'SINGLE'|'MULTI';
  readonly min:number;
  readonly max:number;
  readonly missingCount:number;
  readonly selectedOptionIds:readonly string[];
  readonly options:readonly {id:string;name:string;priceAdjustmentMinor:number}[];
}

export interface FastLaneComboChoice{
  readonly id:string;
  readonly type:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
  readonly label:string;
  readonly subPoolId:string;
  readonly subPoolName:string;
  readonly priceAdjustmentMinor:number;
}

export interface FastLaneComboSlot{
  readonly poolId:string;
  readonly groupId:string;
  readonly groupName:string;
  readonly role:FastLaneComboRole;
  readonly required:boolean;
  readonly min:number;
  readonly max:number;
  readonly choices:readonly FastLaneComboChoice[];
}

export interface FastLanePairSelection{
  readonly groupId:string;
  readonly choiceId?:string;
  readonly sourceLineId?:string;
  readonly deferred?:boolean;
}

export interface FastLanePairPlan{
  readonly comboId:string;
  readonly comboName:string;
  readonly pairingLabel:string;
  readonly source:'AUTO'|'SPECIFIED';
  readonly selections:readonly FastLanePairSelection[];
}

const letter=(index:number)=>{
  let value=Math.max(0,index);
  let out='';
  do{
    out=String.fromCharCode(65+(value%26))+out;
    value=Math.floor(value/26)-1;
  }while(value>=0);
  return out;
};

const optionNames=(set:SyncedOptionSet,ids:readonly string[])=>{
  const selected=new Set(ids);
  return set.options.filter(option=>selected.has(option.id)).map(option=>option.name);
};

export function selectionsForLine(line:FastLaneCartLine,product:FastLaneProduct):Record<string,string[]>{
  const selected:Record<string,string[]>={};
  for(const set of product.optionSets){
    const exact=line.optionSelections?.[set.id];
    if(exact?.length){
      selected[set.id]=exact.filter(id=>set.options.some(option=>option.id===id));
      continue;
    }
    const prefix=set.name+'：';
    const segment=String(line.detail??'').split(' · ').find(part=>part.startsWith(prefix));
    if(!segment)continue;
    const names=segment.slice(prefix.length).split('、').map(value=>value.trim()).filter(Boolean);
    selected[set.id]=set.options.filter(option=>names.includes(option.name)).map(option=>option.id);
  }
  return selected;
}

export function freeNoteForLine(line:FastLaneCartLine,product:FastLaneProduct):string{
  if(line.freeNote!==undefined)return line.freeNote;
  const prefixes=product.optionSets.map(set=>set.name+'：');
  return String(line.detail??'').split(' · ').filter(part=>part&&prefixes.every(prefix=>!part.startsWith(prefix))).join(' · ');
}

export function rebuildConfiguredLine(
  line:FastLaneCartLine,
  product:FastLaneProduct,
  selections:Readonly<Record<string,readonly string[]>>,
  freeNote=freeNoteForLine(line,product),
):FastLaneCartLine{
  const normalized:Record<string,string[]>={};
  let deltaMinor=0;
  const detailParts:string[]=[];
  for(const set of product.optionSets){
    const allowed=new Set(set.options.map(option=>option.id));
    const ids=[...(selections[set.id]??[])].filter(id=>allowed.has(id)).slice(0,Math.max(1,set.max||1));
    if(ids.length)normalized[set.id]=ids;
    const names=optionNames(set,ids);
    if(names.length)detailParts.push(set.name+'：'+names.join('、'));
    const idSet=new Set(ids);
    deltaMinor+=set.options.filter(option=>idSet.has(option.id)).reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
  }
  if(freeNote.trim())detailParts.push(freeNote.trim());
  return {
    ...line,
    unitMinor:product.priceMinor+deltaMinor,
    detail:detailParts.join(' · ')||undefined,
    optionSelections:normalized,
    freeNote:freeNote.trim(),
  };
}

export function requiredTasks(lines:readonly FastLaneCartLine[],products:readonly FastLaneProduct[]):FastLaneRequiredTask[]{
  const byProduct=new Map(products.map(product=>[product.id,product] as const));
  const tasks:FastLaneRequiredTask[]=[];
  for(const line of lines){
    if(line.comboDraft)continue;
    const product=byProduct.get(line.productId);
    if(!product)continue;
    const selected=selectionsForLine(line,product);
    for(const set of product.optionSets){
      const requiredMin=Math.max(set.required?1:0,set.min);
      if(requiredMin<=0)continue;
      const ids=selected[set.id]??[];
      if(ids.length>=requiredMin)continue;
      tasks.push({
        id:line.id+'::'+set.id,
        lineId:line.id,
        lineName:line.name,
        groupId:set.id,
        groupName:set.name,
        selection:set.selection,
        min:requiredMin,
        max:Math.max(requiredMin,set.max||requiredMin),
        missingCount:requiredMin-ids.length,
        selectedOptionIds:ids,
        options:set.options.map(option=>({id:option.id,name:option.name,priceAdjustmentMinor:option.priceAdjustmentMinor})),
      });
    }
  }
  return tasks;
}

export function applyRequiredSelection(
  lines:readonly FastLaneCartLine[],
  products:readonly FastLaneProduct[],
  lineId:string,
  groupId:string,
  optionIds:readonly string[],
):FastLaneCartLine[]{
  const byProduct=new Map(products.map(product=>[product.id,product] as const));
  return lines.map(line=>{
    if(line.id!==lineId)return line;
    const product=byProduct.get(line.productId);
    if(!product)throw new Error('FAST_LANE_PRODUCT_NOT_FOUND');
    const set=product.optionSets.find(row=>row.id===groupId);
    if(!set)throw new Error('FAST_LANE_REQUIRED_GROUP_NOT_FOUND');
    const allowed=new Set(set.options.map(option=>option.id));
    const unique=[...new Set(optionIds)].filter(id=>allowed.has(id));
    const min=Math.max(set.required?1:0,set.min);
    const max=Math.max(min,set.max||min||1);
    if(unique.length<min||unique.length>max)throw new Error('FAST_LANE_REQUIRED_SELECTION_INVALID');
    const current=selectionsForLine(line,product);
    current[groupId]=set.selection==='SINGLE'?unique.slice(0,1):unique.slice(0,max);
    return rebuildConfiguredLine(line,product,current);
  });
}

export function comboSlots(
  combo:SyncedCombo,
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
):FastLaneComboSlot[]{
  const poolById=new Map(pools.map(pool=>[pool.id,pool] as const));
  const productById=new Map(products.map(product=>[product.id,product] as const));
  return [combo.mainPoolId,...combo.addonPoolIds].filter((id):id is string=>Boolean(id)).flatMap(poolId=>{
    const pool=poolById.get(poolId);
    if(!pool)return [];
    const role:FastLaneComboRole=pool.kind==='MAIN_COURSE'?'MAIN_COURSE':pool.addonKind==='DRINK'?'DRINK':'SNACK';
    return pool.groups.map(group=>({
      poolId:pool.id,
      groupId:group.id,
      groupName:group.name,
      role,
      required:group.required||group.min>0,
      min:Math.max(group.required?1:0,group.min),
      max:Math.max(1,group.max),
      choices:group.subPools.flatMap(subPool=>subPool.choices.map(choice=>({
        id:choice.id,
        type:choice.type,
        productId:choice.productId,
        label:choice.type==='PRODUCT'
          ?productById.get(choice.productId??'')?.name??choice.label??choice.productId??'未命名商品'
          :choice.label||choice.id,
        subPoolId:subPool.id,
        subPoolName:subPool.name,
        priceAdjustmentMinor:subPool.priceAdjustmentMinor+choice.priceAdjustmentMinor,
      }))),
    }));
  });
}

function matchingLine(
  lines:readonly FastLaneCartLine[],
  units:Map<string,number>,
  choices:readonly FastLaneComboChoice[],
  products:readonly FastLaneProduct[],
):{line:FastLaneCartLine;choice:FastLaneComboChoice}|null{
  for(const choice of choices){
    if(choice.type!=='PRODUCT'||!choice.productId)continue;
    const line=lines.find(row=>
      !row.comboDraft&&row.productId===choice.productId&&(units.get(row.id)??0)>0&&requiredTasks([row],products).length===0
    );
    if(line)return {line,choice};
  }
  return null;
}

export function buildAutoPairingPlans(
  lines:readonly FastLaneCartLine[],
  combo:SyncedCombo|undefined,
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
  startIndex=0,
):FastLanePairPlan[]{
  if(!combo||!combo.active)return [];
  const slots=comboSlots(combo,pools,products);
  if(!slots.length)return [];
  const units=new Map(lines.filter(line=>!line.comboDraft).map(line=>[line.id,Math.max(0,line.qty)] as const));
  const plans:FastLanePairPlan[]=[];
  for(let attempt=0;attempt<26;attempt++){
    const selections:FastLanePairSelection[]=[];
    const touched:string[]=[];
    let blocked=false;
    let consumedCore=false;
    for(const slot of slots){
      const match=matchingLine(lines,units,slot.choices,products);
      if(match){
        selections.push({groupId:slot.groupId,choiceId:match.choice.id,sourceLineId:match.line.id});
        units.set(match.line.id,(units.get(match.line.id)??0)-1);
        touched.push(match.line.id);
        if(slot.role!=='DRINK')consumedCore=true;
        continue;
      }
      const nonProduct=slot.choices.filter(choice=>choice.type!=='PRODUCT');
      if(slot.role==='DRINK'&&slot.required){
        selections.push({groupId:slot.groupId,deferred:true});
        continue;
      }
      if(slot.required&&nonProduct.length===1){
        selections.push({groupId:slot.groupId,choiceId:nonProduct[0].id});
        continue;
      }
      if(slot.required){blocked=true;break;}
    }
    if(blocked||!consumedCore){
      for(const id of touched)units.set(id,(units.get(id)??0)+1);
      break;
    }
    plans.push({comboId:combo.id,comboName:combo.name,pairingLabel:letter(startIndex+plans.length),source:'AUTO',selections});
  }
  return plans;
}

export function countMainCourseUnits(
  lines:readonly FastLaneCartLine[],
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
):number{
  const productIds=new Set<string>();
  for(const combo of combos.filter(row=>row.active)){
    for(const slot of comboSlots(combo,pools,products)){
      if(slot.role!=='MAIN_COURSE')continue;
      slot.choices.forEach(choice=>{if(choice.type==='PRODUCT'&&choice.productId)productIds.add(choice.productId);});
    }
  }
  return lines.filter(line=>!line.comboDraft&&productIds.has(line.productId)&&requiredTasks([line],products).length===0).reduce((sum,line)=>sum+line.qty,0);
}

function consumeOne(lines:FastLaneCartLine[],lineId:string):{lines:FastLaneCartLine[];taken:FastLaneCartLine}{
  const found=lines.find(line=>line.id===lineId);
  if(!found||found.comboDraft||found.qty<=0)throw new Error('FAST_LANE_PAIR_SOURCE_NOT_AVAILABLE');
  const taken={...found,qty:1};
  const next=found.qty===1
    ?lines.filter(line=>line.id!==lineId)
    :lines.map(line=>line.id===lineId?{...line,qty:line.qty-1}:line);
  return {lines:next,taken};
}

function snapshot(line:FastLaneCartLine):FastLaneComponentSnapshot{
  return {
    productId:line.productId,
    name:line.name,
    unitMinor:line.unitMinor,
    serviceMode:line.serviceMode,
    detail:line.detail,
    optionSelections:line.optionSelections,
    freeNote:line.freeNote,
  };
}

function configurationAdjustmentMinor(line:FastLaneCartLine,products:readonly FastLaneProduct[]):number{
  const product=products.find(row=>row.id===line.productId);
  return product?line.unitMinor-product.priceMinor:0;
}

export function defaultSelectionsForProduct(product:FastLaneProduct):Record<string,string[]>{
  return Object.fromEntries(product.optionSets.map(set=>[
    set.id,
    set.options.filter(option=>option.defaultSelected).map(option=>option.id),
  ]));
}

function comboDetail(draft:FastLaneComboDraft){
  const selected=draft.resolvedChoices.map(choice=>choice.groupName+'：'+choice.choiceLabel);
  const pending=draft.pendingGroups.map(group=>group.groupName+'：稍後補');
  return [...selected,...pending].join(' · ');
}

export function applyPairingPlan(
  input:readonly FastLaneCartLine[],
  plan:FastLanePairPlan,
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
  newLineId:()=>string,
):FastLaneCartLine[]{
  const combo=combos.find(row=>row.id===plan.comboId&&row.active);
  if(!combo)throw new Error('FAST_LANE_COMBO_NOT_FOUND');
  const slots=comboSlots(combo,pools,products);
  const selectionByGroup=new Map(plan.selections.map(selection=>[selection.groupId,selection] as const));
  let lines=[...input];
  const components:FastLaneComboComponent[]=[];
  const resolvedChoices:FastLaneComboResolvedChoice[]=[];
  const pendingGroups:FastLaneComboPendingGroup[]=[];
  let totalMinor=combo.basePriceMinor;
  let serviceMode:ServiceMode='takeaway';
  let serviceModeSet=false;

  for(const slot of slots){
    const selection=selectionByGroup.get(slot.groupId);
    if(selection?.deferred){
      if(slot.role!=='DRINK')throw new Error('FAST_LANE_ONLY_DRINK_CAN_DEFER');
      pendingGroups.push({groupId:slot.groupId,groupName:slot.groupName,role:slot.role,required:slot.required});
      continue;
    }
    if(!selection?.choiceId){
      if(slot.required)throw new Error('FAST_LANE_REQUIRED_COMBO_SLOT_MISSING');
      continue;
    }
    const choice=slot.choices.find(row=>row.id===selection.choiceId);
    if(!choice)throw new Error('FAST_LANE_COMBO_CHOICE_NOT_FOUND');
    if(choice.type==='PRODUCT'){
      if(!selection.sourceLineId)throw new Error('FAST_LANE_PAIR_SOURCE_REQUIRED');
      const source=lines.find(line=>line.id===selection.sourceLineId);
      if(!source||source.productId!==choice.productId)throw new Error('FAST_LANE_PAIR_SOURCE_MISMATCH');
      if(requiredTasks([source],products).length)throw new Error('FAST_LANE_PAIR_SOURCE_REQUIRED_UNRESOLVED');
      const consumed=consumeOne(lines,selection.sourceLineId);
      lines=consumed.lines;
      if(!serviceModeSet){serviceMode=consumed.taken.serviceMode;serviceModeSet=true;}
      components.push({
        groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
        choiceId:choice.id,choiceLabel:choice.label,sourceLineId:selection.sourceLineId,snapshot:snapshot(consumed.taken),
      });
      totalMinor+=configurationAdjustmentMinor(consumed.taken,products);
    }
    totalMinor+=choice.priceAdjustmentMinor;
    resolvedChoices.push({
      groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
      choiceId:choice.id,choiceLabel:choice.label,priceAdjustmentMinor:choice.priceAdjustmentMinor,
    });
  }

  const draft:FastLaneComboDraft={
    comboId:combo.id,comboName:combo.name,pairingLabel:plan.pairingLabel,source:plan.source,
    components,resolvedChoices,pendingGroups,
  };
  return [...lines,{
    id:newLineId(),productId:combo.id,name:combo.name,qty:1,unitMinor:totalMinor,serviceMode,
    detail:comboDetail(draft),comboDraft:draft,
  }];
}

export function fillPendingComboGroup(
  input:readonly FastLaneCartLine[],
  comboLineId:string,
  groupId:string,
  choiceId:string,
  sourceLineId:string|undefined,
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
):FastLaneCartLine[]{
  const comboLine=input.find(line=>line.id===comboLineId);
  const draft=comboLine?.comboDraft;
  if(!comboLine||!draft)throw new Error('FAST_LANE_COMBO_LINE_NOT_FOUND');
  const combo=combos.find(row=>row.id===draft.comboId&&row.active);
  if(!combo)throw new Error('FAST_LANE_COMBO_NOT_FOUND');
  const slot=comboSlots(combo,pools,products).find(row=>row.groupId===groupId);
  if(!slot)throw new Error('FAST_LANE_COMBO_SLOT_NOT_FOUND');
  if(!draft.pendingGroups.some(group=>group.groupId===groupId))throw new Error('FAST_LANE_COMBO_SLOT_NOT_PENDING');
  const choice=slot.choices.find(row=>row.id===choiceId);
  if(!choice)throw new Error('FAST_LANE_COMBO_CHOICE_NOT_FOUND');

  let lines=[...input];
  let component:FastLaneComboComponent|undefined;
  if(choice.type==='PRODUCT'){
    if(!sourceLineId)throw new Error('FAST_LANE_PAIR_SOURCE_REQUIRED');
    const source=lines.find(line=>line.id===sourceLineId);
    if(!source||source.productId!==choice.productId)throw new Error('FAST_LANE_PAIR_SOURCE_MISMATCH');
    if(requiredTasks([source],products).length)throw new Error('FAST_LANE_PAIR_SOURCE_REQUIRED_UNRESOLVED');
    const consumed=consumeOne(lines,sourceLineId);
    lines=consumed.lines;
    component={
      groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
      choiceId:choice.id,choiceLabel:choice.label,sourceLineId,snapshot:snapshot(consumed.taken),
    };
  }
  const configAdjustment=component?configurationAdjustmentMinor({
    id:component.sourceLineId,
    productId:component.snapshot.productId,
    name:component.snapshot.name,
    qty:1,
    unitMinor:component.snapshot.unitMinor,
    serviceMode:component.snapshot.serviceMode,
    detail:component.snapshot.detail,
    optionSelections:component.snapshot.optionSelections,
    freeNote:component.snapshot.freeNote,
  },products):0;

  return lines.map(line=>{
    if(line.id!==comboLineId||!line.comboDraft)return line;
    const nextDraft:FastLaneComboDraft={
      ...line.comboDraft,
      components:component?[...line.comboDraft.components,component]:line.comboDraft.components,
      resolvedChoices:[...line.comboDraft.resolvedChoices,{
        groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
        choiceId:choice.id,choiceLabel:choice.label,priceAdjustmentMinor:choice.priceAdjustmentMinor,
      }],
      pendingGroups:line.comboDraft.pendingGroups.filter(group=>group.groupId!==groupId),
    };
    return {...line,unitMinor:line.unitMinor+choice.priceAdjustmentMinor+configAdjustment,detail:comboDetail(nextDraft),comboDraft:nextDraft};
  });
}

export function fillPendingComboGroupFromConfiguredProduct(
  input:readonly FastLaneCartLine[],
  comboLineId:string,
  groupId:string,
  choiceId:string,
  configuredLine:FastLaneCartLine,
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  products:readonly FastLaneProduct[],
):FastLaneCartLine[]{
  const comboLine=input.find(line=>line.id===comboLineId);
  const draft=comboLine?.comboDraft;
  if(!comboLine||!draft)throw new Error('FAST_LANE_COMBO_LINE_NOT_FOUND');
  const combo=combos.find(row=>row.id===draft.comboId&&row.active);
  if(!combo)throw new Error('FAST_LANE_COMBO_NOT_FOUND');
  const slot=comboSlots(combo,pools,products).find(row=>row.groupId===groupId);
  if(!slot)throw new Error('FAST_LANE_COMBO_SLOT_NOT_FOUND');
  if(!draft.pendingGroups.some(group=>group.groupId===groupId))throw new Error('FAST_LANE_COMBO_SLOT_NOT_PENDING');
  const choice=slot.choices.find(row=>row.id===choiceId);
  if(!choice||choice.type!=='PRODUCT'||choice.productId!==configuredLine.productId)throw new Error('FAST_LANE_COMBO_CHOICE_NOT_FOUND');
  if(requiredTasks([configuredLine],products).length)throw new Error('FAST_LANE_PAIR_SOURCE_REQUIRED_UNRESOLVED');
  const component:FastLaneComboComponent={
    groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
    choiceId:choice.id,choiceLabel:choice.label,sourceLineId:configuredLine.id,snapshot:snapshot({...configuredLine,qty:1}),
  };
  const configAdjustment=configurationAdjustmentMinor(configuredLine,products);
  return input.map(line=>{
    if(line.id!==comboLineId||!line.comboDraft)return line;
    const nextDraft:FastLaneComboDraft={
      ...line.comboDraft,
      components:[...line.comboDraft.components,component],
      resolvedChoices:[...line.comboDraft.resolvedChoices,{
        groupId:slot.groupId,groupName:slot.groupName,role:slot.role,
        choiceId:choice.id,choiceLabel:choice.label,priceAdjustmentMinor:choice.priceAdjustmentMinor,
      }],
      pendingGroups:line.comboDraft.pendingGroups.filter(group=>group.groupId!==groupId),
    };
    return {...line,unitMinor:line.unitMinor+choice.priceAdjustmentMinor+configAdjustment,detail:comboDetail(nextDraft),comboDraft:nextDraft};
  });
}

export function dissolveComboLine(
  input:readonly FastLaneCartLine[],
  comboLineId:string,
  newLineId:()=>string,
):FastLaneCartLine[]{
  const comboLine=input.find(line=>line.id===comboLineId);
  if(!comboLine?.comboDraft)return [...input];
  const restored=comboLine.comboDraft.components.map(component=>({
    id:newLineId(),
    productId:component.snapshot.productId,
    name:component.snapshot.name,
    qty:1,
    unitMinor:component.snapshot.unitMinor,
    serviceMode:component.snapshot.serviceMode,
    detail:component.snapshot.detail,
    optionSelections:component.snapshot.optionSelections,
    freeNote:component.snapshot.freeNote,
  } satisfies FastLaneCartLine));
  const index=input.findIndex(line=>line.id===comboLineId);
  return [...input.slice(0,index),...restored,...input.slice(index+1)];
}

export function comboBlockingCount(lines:readonly FastLaneCartLine[]):number{
  return lines.reduce((sum,line)=>sum+(line.comboDraft?.pendingGroups.filter(group=>group.required).length??0),0);
}

export function comboDraftCount(lines:readonly FastLaneCartLine[]):number{
  return lines.filter(line=>Boolean(line.comboDraft)).length;
}

export function nextPairingIndex(lines:readonly FastLaneCartLine[]):number{
  return comboDraftCount(lines);
}

export function pairingLabel(index:number){return letter(index);}


export function serializeFastLaneComposition(
  line:FastLaneCartLine,
  mode:'HOLD'|'ORDER'='HOLD',
):MfkOrderLineCompositionV1{
  if(mode==='ORDER'&&line.comboDraft?.pendingGroups.some(group=>group.required)){
    throw new Error('FAST_LANE_FORMAL_ORDER_PENDING_REQUIRED');
  }
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:line.comboDraft?'COMBO':'PRODUCT',
    cartLineId:line.id,
    ...(line.optionSelections?{optionSelections:line.optionSelections}:{}),
    ...(line.freeNote!==undefined?{freeNote:line.freeNote}:{}),
    ...(line.comboDraft?{combo:{
      comboId:line.comboDraft.comboId,
      comboName:line.comboDraft.comboName,
      pairingLabel:line.comboDraft.pairingLabel,
      source:line.comboDraft.source,
      components:line.comboDraft.components.map(component=>({
        groupId:component.groupId,
        groupName:component.groupName,
        role:component.role,
        choiceId:component.choiceId,
        choiceLabel:component.choiceLabel,
        sourceLineId:component.sourceLineId,
        snapshot:{...component.snapshot},
      })),
      resolvedChoices:line.comboDraft.resolvedChoices.map(choice=>({...choice})),
      pendingGroups:line.comboDraft.pendingGroups.map(group=>({...group})),
    }}:{}),
  });
}

export function restoreFastLaneLineComposition(
  line:FastLaneCartLine,
  raw:unknown,
):FastLaneCartLine{
  const composition=normalizeMfkOrderLineCompositionV1(raw);
  if(!composition)return line;
  return {
    ...line,
    id:composition.cartLineId,
    ...(composition.optionSelections?{optionSelections:composition.optionSelections}:{}),
    ...(composition.freeNote!==undefined?{freeNote:composition.freeNote}:{}),
    ...(composition.combo?{comboDraft:{
      comboId:composition.combo.comboId,
      comboName:composition.combo.comboName,
      pairingLabel:composition.combo.pairingLabel,
      source:composition.combo.source,
      components:composition.combo.components.map(component=>({
        groupId:component.groupId,
        groupName:component.groupName,
        role:component.role,
        choiceId:component.choiceId,
        choiceLabel:component.choiceLabel,
        sourceLineId:component.sourceLineId,
        snapshot:{...component.snapshot},
      })),
      resolvedChoices:composition.combo.resolvedChoices.map(choice=>({...choice})),
      pendingGroups:composition.combo.pendingGroups.map(group=>({...group})),
    }}:{}),
  };
}
