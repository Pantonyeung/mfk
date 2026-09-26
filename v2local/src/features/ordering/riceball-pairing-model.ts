import type {SyncedCombo,SyncedComboPool,SyncedOptionSet} from '../../runtime/admin-config-projection.ts';
import type {ServiceMode} from './ordering-workspace-model.ts';

export interface PairingProduct{
  readonly id:string;
  readonly name:string;
  readonly priceMinor:number;
  readonly optionSets?:readonly SyncedOptionSet[];
}

export interface PairingCartLine{
  readonly id:string;
  readonly productId:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly serviceMode:ServiceMode;
  readonly detail?:string;
}

export interface PairingUnit{
  readonly id:string;
  readonly lineId:string;
  readonly unitIndex:number;
  readonly productId:string;
  readonly name:string;
  readonly serviceMode:ServiceMode;
  readonly detail?:string;
}

export interface PairingSnackUnit extends PairingUnit{}

export interface PairingSlot{
  readonly id:string;
  readonly label:string;
  readonly main:PairingUnit;
  readonly comboId:string;
  readonly comboName:string;
  readonly comboBaseMinor:number;
  readonly compatibleSnackUnitIds:readonly string[];
  readonly defaultSnackUnitId?:string;
}

export interface PairingDraft{
  readonly slots:readonly PairingSlot[];
  readonly snacks:readonly PairingSnackUnit[];
  readonly pairableCount:number;
  readonly leftoverSnackUnitIds:readonly string[];
}

export interface PairingAppliedGroup{
  readonly label:string;
  readonly comboId:string;
  readonly comboName:string;
  readonly mainProductId:string;
  readonly snackProductId:string;
  readonly mainPriceMinor:number;
  readonly snackPriceMinor:number;
  readonly totalMinor:number;
}

export const PAIRING_GROUP_PREFIX='套餐配對：' as const;
export const PAIRING_COMBO_PREFIX='套餐：' as const;
export const PAIRING_ROLE_PREFIX='角色：' as const;

const letter=(index:number)=>{
  let value=Math.max(0,index);
  let out='';
  do{
    out=String.fromCharCode(65+(value%26))+out;
    value=Math.floor(value/26)-1;
  }while(value>=0);
  return out;
};

function cleanParts(detail?:string){
  return String(detail??'').split(' · ').map(part=>part.trim()).filter(Boolean);
}

export function pairingGroupFromDetail(detail?:string){
  const part=cleanParts(detail).find(value=>value.startsWith(PAIRING_GROUP_PREFIX));
  return part?part.slice(PAIRING_GROUP_PREFIX.length).replace(/組$/,''):undefined;
}

export function pairingRoleFromDetail(detail?:string):'MAIN'|'SNACK'|undefined{
  const part=cleanParts(detail).find(value=>value.startsWith(PAIRING_ROLE_PREFIX));
  const role=part?.slice(PAIRING_ROLE_PREFIX.length);
  return role==='飯團'?'MAIN':role==='小食'?'SNACK':undefined;
}

export function isPairedComboLine(line:Pick<PairingCartLine,'detail'>){
  return Boolean(pairingGroupFromDetail(line.detail)&&pairingRoleFromDetail(line.detail));
}

export function stripPairingDetail(detail?:string){
  return cleanParts(detail)
    .filter(part=>!part.startsWith(PAIRING_GROUP_PREFIX)&&!part.startsWith(PAIRING_COMBO_PREFIX)&&!part.startsWith(PAIRING_ROLE_PREFIX))
    .join(' · ');
}

function selectedOptionAdjustment(line:PairingCartLine,product:PairingProduct){
  const parts=cleanParts(stripPairingDetail(line.detail));
  let delta=0;
  for(const set of product.optionSets??[]){
    const prefix=set.name+'：';
    const segment=parts.find(part=>part.startsWith(prefix));
    if(!segment)continue;
    const names=segment.slice(prefix.length).split('、').map(value=>value.trim()).filter(Boolean);
    const selected=new Set(names);
    delta+=set.options.filter(option=>selected.has(option.name)).reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
  }
  return delta;
}

export function standalonePriceForLine(line:PairingCartLine,products:readonly PairingProduct[]){
  const product=products.find(row=>row.id===line.productId);
  return product?product.priceMinor+selectedOptionAdjustment(line,product):line.unitMinor;
}

function expandLine(line:PairingCartLine):PairingUnit[]{
  return Array.from({length:Math.max(0,Math.floor(line.qty))},(_,index)=>({
    id:line.id+'::'+String(index+1),
    lineId:line.id,
    unitIndex:index+1,
    productId:line.productId,
    name:line.name,
    serviceMode:line.serviceMode,
    detail:line.detail,
  }));
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
    return pool.groups.some(group=>group.subPools.some(subPool=>subPool.choices.some(choice=>choice.type==='PRODUCT'&&choice.productId===productId)));
  });
}

function snackAdjustmentForCombo(
  combo:SyncedCombo,
  snackProductId:string,
  pools:readonly SyncedComboPool[],
):number|undefined{
  const poolById=new Map(pools.map(pool=>[pool.id,pool] as const));
  for(const poolId of combo.addonPoolIds){
    const pool=poolById.get(poolId);
    if(!pool||pool.kind!=='ADDON'||pool.addonKind!=='SNACK')continue;
    for(const group of pool.groups){
      for(const subPool of group.subPools){
        const choice=subPool.choices.find(row=>row.type==='PRODUCT'&&row.productId===snackProductId);
        if(choice)return subPool.priceAdjustmentMinor+choice.priceAdjustmentMinor;
      }
    }
  }
  return undefined;
}

function allSnackProductIds(combos:readonly SyncedCombo[],pools:readonly SyncedComboPool[]){
  const poolById=new Map(pools.map(pool=>[pool.id,pool] as const));
  const ids=new Set<string>();
  for(const combo of combos.filter(row=>row.active)){
    for(const poolId of combo.addonPoolIds){
      const pool=poolById.get(poolId);
      if(!pool||pool.kind!=='ADDON'||pool.addonKind!=='SNACK')continue;
      for(const group of pool.groups){
        for(const subPool of group.subPools){
          for(const choice of subPool.choices){
            if(choice.type==='PRODUCT'&&choice.productId)ids.add(choice.productId);
          }
        }
      }
    }
  }
  return ids;
}

export function buildRiceballPairingDraft(
  lines:readonly PairingCartLine[],
  products:readonly PairingProduct[],
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  blockedLineIds:ReadonlySet<string>=new Set(),
):PairingDraft{
  const unpaired=lines.filter(line=>line.qty>0&&!isPairedComboLine(line)&&!blockedLineIds.has(line.id));
  const snackIds=allSnackProductIds(combos,pools);

  const mainUnits:{unit:PairingUnit;combo:SyncedCombo}[]=[];
  const snackUnits:PairingSnackUnit[]=[];

  for(const line of unpaired){
    const matches=mainComboMatches(line.productId,combos,pools);
    if(matches.length===1){
      for(const unit of expandLine(line))mainUnits.push({unit,combo:matches[0]!});
      continue;
    }
    if(snackIds.has(line.productId))snackUnits.push(...expandLine(line));
  }

  const usedSnacks=new Set<string>();
  const slots:PairingSlot[]=mainUnits.map(({unit,combo},index)=>{
    const compatible=snackUnits.filter(snack=>
      snack.serviceMode===unit.serviceMode&&snackAdjustmentForCombo(combo,snack.productId,pools)!==undefined
    );
    const defaultSnack=compatible.find(snack=>!usedSnacks.has(snack.id));
    if(defaultSnack)usedSnacks.add(defaultSnack.id);
    return Object.freeze({
      id:unit.id,
      label:letter(index),
      main:unit,
      comboId:combo.id,
      comboName:combo.name,
      comboBaseMinor:combo.basePriceMinor,
      compatibleSnackUnitIds:Object.freeze(compatible.map(snack=>snack.id)),
      ...(defaultSnack?{defaultSnackUnitId:defaultSnack.id}:{}),
    });
  });

  return Object.freeze({
    slots:Object.freeze(slots),
    snacks:Object.freeze(snackUnits),
    pairableCount:slots.filter(slot=>Boolean(slot.defaultSnackUnitId)).length,
    leftoverSnackUnitIds:Object.freeze(snackUnits.filter(snack=>!usedSnacks.has(snack.id)).map(snack=>snack.id)),
  });
}

export function pairingAssignmentsFromDraft(draft:PairingDraft){
  return Object.freeze(Object.fromEntries(
    draft.slots.flatMap(slot=>slot.defaultSnackUnitId?[[slot.id,slot.defaultSnackUnitId]]:[]),
  ) as Readonly<Record<string,string>>);
}

export function swapPairingSnack(
  draft:PairingDraft,
  assignments:Readonly<Record<string,string|undefined>>,
  targetSlotId:string,
  snackUnitId:string,
):Readonly<Record<string,string|undefined>>{
  const target=draft.slots.find(slot=>slot.id===targetSlotId);
  if(!target||!target.compatibleSnackUnitIds.includes(snackUnitId))return assignments;

  const owner=draft.slots.find(slot=>assignments[slot.id]===snackUnitId);
  const current=assignments[targetSlotId];
  if(owner?.id===targetSlotId)return assignments;

  if(owner&&current){
    if(!owner.compatibleSnackUnitIds.includes(current))return assignments;
    return Object.freeze({...assignments,[targetSlotId]:snackUnitId,[owner.id]:current});
  }
  if(owner&&!current){
    const next={...assignments,[targetSlotId]:snackUnitId};
    delete next[owner.id];
    return Object.freeze(next);
  }
  if(!owner){
    const next={...assignments,[targetSlotId]:snackUnitId};
    return Object.freeze(next);
  }
  return assignments;
}

function withPairingDetail(
  original:string|undefined,
  label:string,
  comboName:string,
  role:'飯團'|'小食',
){
  return [
    PAIRING_GROUP_PREFIX+label+'組',
    PAIRING_COMBO_PREFIX+comboName,
    PAIRING_ROLE_PREFIX+role,
    stripPairingDetail(original),
  ].filter(Boolean).join(' · ');
}

export function applyRiceballPairings<T extends PairingCartLine>(
  input:readonly T[],
  products:readonly PairingProduct[],
  combos:readonly SyncedCombo[],
  pools:readonly SyncedComboPool[],
  draft:PairingDraft,
  assignments:Readonly<Record<string,string|undefined>>,
  newLineId:()=>string,
):{readonly lines:T[];readonly groups:readonly PairingAppliedGroup[]}{
  const productById=new Map(products.map(product=>[product.id,product] as const));
  const comboById=new Map(combos.map(combo=>[combo.id,combo] as const));
  const lineById=new Map(input.map(line=>[line.id,line] as const));
  const snackById=new Map(draft.snacks.map(snack=>[snack.id,snack] as const));
  const consumed=new Map<string,number>();
  const usedSnackUnits=new Set<string>();
  const created:T[]=[];
  const groups:PairingAppliedGroup[]=[];

  for(const slot of draft.slots){
    const snackUnitId=assignments[slot.id];
    if(!snackUnitId)continue;
    if(usedSnackUnits.has(snackUnitId))throw new Error('PAIRING_SNACK_UNIT_DUPLICATE');
    const snack=snackById.get(snackUnitId);
    if(!snack||!slot.compatibleSnackUnitIds.includes(snackUnitId))throw new Error('PAIRING_SNACK_INCOMPATIBLE');
    const mainLine=lineById.get(slot.main.lineId);
    const snackLine=lineById.get(snack.lineId);
    const combo=comboById.get(slot.comboId);
    if(!mainLine||!snackLine||!combo)throw new Error('PAIRING_SOURCE_MISSING');
    if(mainLine.serviceMode!==snackLine.serviceMode)throw new Error('PAIRING_SERVICE_MODE_MISMATCH');

    const mainProduct=productById.get(mainLine.productId);
    const snackProduct=productById.get(snackLine.productId);
    if(!mainProduct||!snackProduct)throw new Error('PAIRING_PRODUCT_MISSING');

    const snackAdjustment=snackAdjustmentForCombo(combo,snackLine.productId,pools);
    if(snackAdjustment===undefined)throw new Error('PAIRING_SNACK_PRICE_MISSING');

    const mainConfigAdjustment=selectedOptionAdjustment(mainLine,mainProduct);
    const snackConfigAdjustment=selectedOptionAdjustment(snackLine,snackProduct);
    const mainPriceMinor=combo.basePriceMinor+mainConfigAdjustment;
    const snackPriceMinor=snackAdjustment+snackConfigAdjustment;
    const totalMinor=mainPriceMinor+snackPriceMinor;
    if(!Number.isSafeInteger(totalMinor)||totalMinor<0)throw new Error('PAIRING_PRICE_INVALID');

    consumed.set(mainLine.id,(consumed.get(mainLine.id)??0)+1);
    consumed.set(snackLine.id,(consumed.get(snackLine.id)??0)+1);
    usedSnackUnits.add(snackUnitId);

    created.push({
      ...mainLine,
      id:newLineId(),
      qty:1,
      unitMinor:mainPriceMinor,
      detail:withPairingDetail(mainLine.detail,slot.label,combo.name,'飯團'),
    } as T);
    created.push({
      ...snackLine,
      id:newLineId(),
      qty:1,
      unitMinor:snackPriceMinor,
      detail:withPairingDetail(snackLine.detail,slot.label,combo.name,'小食'),
    } as T);
    groups.push(Object.freeze({
      label:slot.label,
      comboId:combo.id,
      comboName:combo.name,
      mainProductId:mainLine.productId,
      snackProductId:snackLine.productId,
      mainPriceMinor,
      snackPriceMinor,
      totalMinor,
    }));
  }

  const remaining=input.flatMap(line=>{
    const count=consumed.get(line.id)??0;
    if(count<=0)return [line];
    const qty=line.qty-count;
    if(qty<0)throw new Error('PAIRING_SOURCE_OVERCONSUMED');
    return qty>0?[{...line,qty} as T]:[];
  });

  return Object.freeze({
    lines:[...remaining,...created],
    groups:Object.freeze(groups),
  });
}

export function restorePairingGroup<T extends PairingCartLine>(
  input:readonly T[],
  products:readonly PairingProduct[],
  label:string,
):T[]{
  const group=input.filter(line=>pairingGroupFromDetail(line.detail)===label);
  if(group.length===0)return [...input];
  const restoredIds=new Set(group.map(line=>line.id));
  return input.map(line=>{
    if(!restoredIds.has(line.id))return line;
    const product=products.find(row=>row.id===line.productId);
    if(!product)throw new Error('PAIRING_PRODUCT_MISSING');
    const detail=stripPairingDetail(line.detail);
    const restored={...line,unitMinor:product.priceMinor+selectedOptionAdjustment({...line,detail},product),detail:detail||undefined};
    return restored as T;
  });
}

export function existingPairingGroups(lines:readonly PairingCartLine[]){
  const labels:string[]=[];
  for(const line of lines){
    const label=pairingGroupFromDetail(line.detail);
    if(label&&!labels.includes(label))labels.push(label);
  }
  return labels;
}
