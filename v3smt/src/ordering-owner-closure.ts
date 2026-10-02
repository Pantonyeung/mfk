import type {
  MfpOrderingCatalog,
  MfpOrderingDraft,
  MfpOrderingDraftLine,
} from './ordering-domain.ts';

export interface MfpDisplaySettings{
  readonly categoryRows:number;
  readonly productColumns:number;
  readonly showImages:boolean;
  readonly fontScale:number;
  readonly densityScale:number;
}

export const MFP_DISPLAY_SETTINGS_KEY='mfp.a4.display-settings.v1';
export const DEFAULT_MFP_DISPLAY_SETTINGS:MfpDisplaySettings=Object.freeze({
  categoryRows:4,productColumns:3,showImages:true,fontScale:1,densityScale:1,
});

interface DisplaySettingsStorage{
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
}

function validDisplaySettings(value:unknown):value is MfpDisplaySettings{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return Number.isSafeInteger(row.categoryRows)&&Number(row.categoryRows)>=1&&Number(row.categoryRows)<=4
    &&Number.isSafeInteger(row.productColumns)&&Number(row.productColumns)>=2&&Number(row.productColumns)<=6
    &&typeof row.showImages==='boolean'
    &&typeof row.fontScale==='number'&&Number.isFinite(row.fontScale)&&row.fontScale>=.8&&row.fontScale<=1.4
    &&typeof row.densityScale==='number'&&Number.isFinite(row.densityScale)&&row.densityScale>=.75&&row.densityScale<=1.25;
}

export function loadMfpDisplaySettings(storage:DisplaySettingsStorage):MfpDisplaySettings{
  try{
    const raw=storage.getItem(MFP_DISPLAY_SETTINGS_KEY);
    if(!raw)return DEFAULT_MFP_DISPLAY_SETTINGS;
    const parsed:unknown=JSON.parse(raw);
    return validDisplaySettings(parsed)?Object.freeze({...parsed}):DEFAULT_MFP_DISPLAY_SETTINGS;
  }catch{return DEFAULT_MFP_DISPLAY_SETTINGS;}
}

export function saveMfpDisplaySettings(storage:DisplaySettingsStorage,settings:MfpDisplaySettings){
  if(!validDisplaySettings(settings))throw new Error('MFP_DISPLAY_SETTINGS_INVALID');
  storage.setItem(MFP_DISPLAY_SETTINGS_KEY,JSON.stringify(settings));
}

export function mfpDisplaySettingsStyle(settings:MfpDisplaySettings):Record<string,string>{
  if(!validDisplaySettings(settings))throw new Error('MFP_DISPLAY_SETTINGS_INVALID');
  return {
    '--mfp-category-rows':String(settings.categoryRows),
    '--mfp-product-columns':String(settings.productColumns),
    '--mfp-font-scale':String(settings.fontScale),
    '--mfp-density-scale':String(settings.densityScale),
  };
}

export type MfpCartViewMode='ORIGINAL'|'SORT'|'COMBINE';
export interface MfpCartPresentationLine{
  readonly line:MfpOrderingDraftLine;
  readonly cartLineIds:readonly string[];
  readonly quantity:number;
  readonly combined:boolean;
}

function exactConfiguration(line:MfpOrderingDraftLine){
  return JSON.stringify({
    kind:line.kind,productId:line.productId,comboId:line.comboId,note:line.note,
    serviceMode:line.serviceMode,optionSelections:line.optionSelections,comboSelections:line.comboSelections,
    materialPriceFacts:line.materialPriceFacts,previewUnitMinor:line.previewUnitMinor,state:line.state,
    issues:line.issues,projectionHash:line.sourceProjection.projectionHash,
  });
}

function categoryPosition(catalog:MfpOrderingCatalog,line:MfpOrderingDraftLine){
  if(line.kind==='COMBO')return Number.MAX_SAFE_INTEGER;
  const product=catalog.products.find(row=>row.productId===line.productId);
  const category=catalog.categories.find(row=>row.id===product?.categoryId);
  return category?.position??Number.MAX_SAFE_INTEGER;
}

export function presentMfpCart(draft:MfpOrderingDraft,catalog:MfpOrderingCatalog,mode:MfpCartViewMode):readonly MfpCartPresentationLine[]{
  const indexed=draft.lines.map((line,index)=>({line,index}));
  const ordered=mode==='SORT'
    ?[...indexed].sort((a,b)=>categoryPosition(catalog,a.line)-categoryPosition(catalog,b.line)||a.index-b.index)
    :indexed;
  if(mode!=='COMBINE')return Object.freeze(ordered.map(({line})=>Object.freeze({
    line,cartLineIds:Object.freeze([line.cartLineId]),quantity:line.quantity,combined:false,
  })));
  const groups=new Map<string,MfpOrderingDraftLine[]>();
  for(const {line} of ordered){
    const signature=exactConfiguration(line);
    groups.set(signature,[...(groups.get(signature)??[]),line]);
  }
  return Object.freeze([...groups.values()].map(lines=>Object.freeze({
    line:lines[0]!,cartLineIds:Object.freeze(lines.map(line=>line.cartLineId)),
    quantity:lines.reduce((sum,line)=>sum+line.quantity,0),
    combined:lines.length>1||lines[0]!.quantity>1,
  })));
}

export function sequencePreviewForMfpLine(draft:MfpOrderingDraft,cartLineId:string){
  const index=draft.lines.findIndex(line=>line.cartLineId===cartLineId);
  if(index<0)throw new Error('MFP_ORDERING_CART_LINE_NOT_FOUND');
  return String(index+1).padStart(3,'0');
}

export type MfpDraftDestination='HOLD'|'DINING';
export function defaultMfpDraftDestination(draft:MfpOrderingDraft):MfpDraftDestination{
  return draft.lines.some(line=>line.serviceMode==='dine-in')?'DINING':'HOLD';
}

export function resolveMfpDraftDestination(draft:MfpOrderingDraft,override:MfpDraftDestination|null){
  return override??defaultMfpDraftDestination(draft);
}

export function mfpHoldEntryLabel(draft:MfpOrderingDraft){return draft.lines.length?'Hold / Dining':'Retrieve';}

export interface MfpRequiredTask{
  readonly cartLineId:string;
  readonly productId:string;
  readonly optionSetId:string;
  readonly label:string;
  readonly min:number;
  readonly max:number;
}

export function requiredTasksForMfpDraft(catalog:MfpOrderingCatalog,draft:MfpOrderingDraft):readonly MfpRequiredTask[]{
  const tasks:MfpRequiredTask[]=[];
  for(const line of draft.lines){
    if(line.kind!=='PRODUCT'||!line.productId)continue;
    const product=catalog.products.find(row=>row.productId===line.productId);
    if(!product)continue;
    const selected=new Map(line.optionSelections.map(row=>[row.optionSetId,row.optionIds] as const));
    for(const set of product.optionSets){
      const min=Math.max(set.required?1:0,set.min);
      const count=selected.get(set.id)?.length??0;
      if(count>=min&&count<=set.max)continue;
      tasks.push(Object.freeze({cartLineId:line.cartLineId,productId:product.productId,optionSetId:set.id,label:set.name,min,max:set.max}));
    }
  }
  return Object.freeze(tasks);
}

export interface MfpFastPairUnit{
  readonly id:string;
  readonly cartLineId:string;
  readonly unitIndex:number;
  readonly productId:string;
  readonly serviceMode:MfpOrderingDraftLine['serviceMode'];
}

export interface MfpFastPairSlot{
  readonly id:string;
  readonly label:string;
  readonly comboId:string;
  readonly mainUnitId:string;
  readonly compatibleSnackUnitIds:readonly string[];
  readonly defaultSnackUnitId?:string;
}

export interface MfpFastPairDraft{
  readonly slots:readonly MfpFastPairSlot[];
  readonly mainUnits:readonly MfpFastPairUnit[];
  readonly snackUnits:readonly MfpFastPairUnit[];
  readonly residualMainUnitIds:readonly string[];
  readonly residualSnackUnitIds:readonly string[];
}

function letter(index:number){
  let value=Math.max(0,index),out='';
  do{out=String.fromCharCode(65+value%26)+out;value=Math.floor(value/26)-1;}while(value>=0);
  return out;
}

function productChoiceIds(catalog:MfpOrderingCatalog,poolIds:readonly string[]){
  const ids=new Set<string>();
  for(const poolId of poolIds){
    const pool=catalog.comboPools.find(row=>row.id===poolId);
    for(const group of pool?.groups??[])for(const subPool of group.subPools)for(const choice of subPool.choices){
      if(choice.sellable&&choice.type==='PRODUCT'&&choice.productId)ids.add(choice.productId);
    }
  }
  return ids;
}

function expandProductLine(line:MfpOrderingDraftLine):MfpFastPairUnit[]{
  if(line.kind!=='PRODUCT'||!line.productId||line.state!=='READY')return [];
  return Array.from({length:line.quantity},(_,index)=>Object.freeze({
    id:`${line.cartLineId}::${index+1}`,cartLineId:line.cartLineId,unitIndex:index+1,
    productId:line.productId!,serviceMode:line.serviceMode,
  }));
}

export function buildMfpFastPairDraft(catalog:MfpOrderingCatalog,draft:MfpOrderingDraft):MfpFastPairDraft{
  const combos=catalog.combos.filter(combo=>combo.sellable&&combo.priceReady&&combo.mainPoolId);
  const comboMains=new Map(combos.map(combo=>[combo.id,productChoiceIds(catalog,[combo.mainPoolId!])] as const));
  const comboSnacks=new Map(combos.map(combo=>[
    combo.id,
    productChoiceIds(catalog,combo.addonPoolIds.filter(poolId=>{
      const pool=catalog.comboPools.find(row=>row.id===poolId);
      return pool?.kind==='ADDON'&&pool.addonKind==='SNACK';
    })),
  ] as const));
  const units=draft.lines.flatMap(expandProductLine);
  const mainUnits:ReadonlyArray<Readonly<{unit:MfpFastPairUnit;comboId:string}>>=units.flatMap(unit=>{
    const matches=combos.filter(combo=>comboMains.get(combo.id)?.has(unit.productId));
    return matches.length===1?[Object.freeze({unit,comboId:matches[0]!.id})]:[];
  });
  const allSnackIds=new Set([...comboSnacks.values()].flatMap(ids=>[...ids]));
  const snackUnits=units.filter(unit=>allSnackIds.has(unit.productId)&&!mainUnits.some(row=>row.unit.id===unit.id));
  const used=new Set<string>();
  const slots=mainUnits.map(({unit,comboId},index)=>{
    const compatible=snackUnits.filter(snack=>snack.serviceMode===unit.serviceMode&&comboSnacks.get(comboId)?.has(snack.productId));
    const defaultSnack=compatible.find(snack=>!used.has(snack.id));
    if(defaultSnack)used.add(defaultSnack.id);
    return Object.freeze({
      id:unit.id,label:letter(index),comboId,mainUnitId:unit.id,
      compatibleSnackUnitIds:Object.freeze(compatible.map(snack=>snack.id)),
      ...(defaultSnack?{defaultSnackUnitId:defaultSnack.id}:{}),
    });
  });
  return Object.freeze({
    slots:Object.freeze(slots),mainUnits:Object.freeze(mainUnits.map(row=>row.unit)),snackUnits:Object.freeze(snackUnits),
    residualMainUnitIds:Object.freeze(slots.filter(slot=>!slot.defaultSnackUnitId).map(slot=>slot.mainUnitId)),
    residualSnackUnitIds:Object.freeze(snackUnits.filter(unit=>!used.has(unit.id)).map(unit=>unit.id)),
  });
}

export function assignMfpFastPair(draft:MfpFastPairDraft):Readonly<Record<string,string|undefined>>{
  return Object.freeze(Object.fromEntries(draft.slots.flatMap(slot=>slot.defaultSnackUnitId?[[slot.id,slot.defaultSnackUnitId]]:[])) as Readonly<Record<string,string>>);
}

export function swapMfpFastPair(
  draft:MfpFastPairDraft,
  assignments:Readonly<Record<string,string|undefined>>,
  targetSlotId:string,
  snackUnitId:string,
):Readonly<Record<string,string|undefined>>{
  const target=draft.slots.find(slot=>slot.id===targetSlotId);
  if(!target?.compatibleSnackUnitIds.includes(snackUnitId))return assignments;
  const owner=draft.slots.find(slot=>assignments[slot.id]===snackUnitId);
  const current=assignments[targetSlotId];
  if(owner?.id===targetSlotId)return assignments;
  if(owner&&current&&owner.compatibleSnackUnitIds.includes(current))return Object.freeze({...assignments,[targetSlotId]:snackUnitId,[owner.id]:current});
  if(owner&&!current){
    const next={...assignments,[targetSlotId]:snackUnitId};
    delete next[owner.id];
    return Object.freeze(next);
  }
  return Object.freeze({...assignments,[targetSlotId]:snackUnitId});
}

export type MfpGuidanceTarget='REQUIRED'|'QUICK_DRINK'|'COMBO_BLOCKER'|'FAST_PAIR'|'CHECKOUT'|'PRODUCT';
export function mfpGuidanceTarget(catalog:MfpOrderingCatalog,draft:MfpOrderingDraft):MfpGuidanceTarget{
  if(requiredTasksForMfpDraft(catalog,draft).length)return 'REQUIRED';
  const incompleteCombos=draft.lines.filter(line=>line.kind==='COMBO'&&line.state!=='READY');
  const missingDrink=incompleteCombos.some(line=>{
    const combo=catalog.combos.find(row=>row.id===line.comboId);
    const selected=new Map<string,number>();
    for(const row of line.comboSelections)selected.set(row.groupId,(selected.get(row.groupId)??0)+1);
    return combo?.addonPoolIds.some(poolId=>{
      const pool=catalog.comboPools.find(row=>row.id===poolId);
      return pool?.kind==='ADDON'&&pool.addonKind==='DRINK'&&pool.groups.some(group=>(selected.get(group.id)??0)<Math.max(group.required?1:0,group.min));
    });
  });
  if(missingDrink)return 'QUICK_DRINK';
  if(incompleteCombos.length)return 'COMBO_BLOCKER';
  if(buildMfpFastPairDraft(catalog,draft).slots.some(slot=>slot.defaultSnackUnitId))return 'FAST_PAIR';
  return draft.lines.length?'CHECKOUT':'PRODUCT';
}
