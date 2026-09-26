import type {MfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {readSmtAdminConfigLkg} from './admin-config-sync.ts';

export type SyncedServiceMode='takeaway'|'dine-in';

export interface SyncedOptionChoice{
  readonly id:string;
  readonly name:string;
  readonly priceAdjustmentMinor:number;
  readonly defaultSelected:boolean;
  readonly active:boolean;
}
export interface SyncedOptionSet{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly forceShow:boolean;
  readonly selection:'SINGLE'|'MULTI';
  readonly min:number;
  readonly max:number;
  readonly options:readonly SyncedOptionChoice[];
}
export interface SyncedOrderingProduct{
  readonly id:string;
  readonly categoryId:string;
  readonly category:string;
  readonly name:string;
  readonly description?:string;
  readonly priceMinor:number;
  readonly priceReady:boolean;
  readonly sellable:boolean;
  readonly imageUrl?:string;
  readonly optionSets:readonly SyncedOptionSet[];
}
export interface SyncedOrderingCategory{
  readonly id:string;
  readonly label:string;
  readonly position:number;
}
export interface SyncedComboChoice{
  readonly id:string;
  readonly type:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
  readonly label:string;
  readonly priceAdjustmentMinor:number;
  readonly active:boolean;
}
export interface SyncedComboSubPool{
  readonly id:string;
  readonly name:string;
  readonly priceAdjustmentMinor:number;
  readonly active:boolean;
  readonly choices:readonly SyncedComboChoice[];
}
export interface SyncedComboPoolGroup{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly min:number;
  readonly max:number;
  readonly subPools:readonly SyncedComboSubPool[];
}
export interface SyncedComboPool{
  readonly id:string;
  readonly name:string;
  readonly kind:'MAIN_COURSE'|'ADDON';
  readonly addonKind?:'SNACK'|'DRINK';
  readonly groups:readonly SyncedComboPoolGroup[];
}
export interface SyncedCombo{
  readonly id:string;
  readonly name:string;
  readonly basePriceMinor:number;
  readonly active:boolean;
  readonly mainPoolId?:string;
  readonly addonPoolIds:readonly string[];
}

export interface SyncedRiceballDrinkPromotion{
  readonly active:boolean;
  readonly eligibleMainPoolIds:readonly string[];
  readonly drinks:readonly {readonly productId:string;readonly label:string;readonly promoPriceMinor:number}[];
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function array(value:unknown):readonly unknown[]{return Array.isArray(value)?value:[];}
function string(value:unknown,fallback=''){return typeof value==='string'?value:fallback;}
function bool(value:unknown,fallback=false){return typeof value==='boolean'?value:fallback;}
function integer(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isSafeInteger(n)?n:fallback;
}
function moneyMinor(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}
function snapshotOf(envelope?:MfkAdminConfigEnvelope|null){
  return record((envelope??readSmtAdminConfigLkg())?.snapshot);
}

export function projectSyncedOrderingCatalog(
  serviceMode:SyncedServiceMode,
  envelope?:MfkAdminConfigEnvelope|null,
):{readonly categories:readonly SyncedOrderingCategory[];readonly products:readonly SyncedOrderingProduct[]}{
  const snapshot=snapshotOf(envelope);
  const catalog=record(snapshot.catalog);
  const categoriesRaw=array(catalog.categories);
  const productsRaw=array(catalog.products);
  const optionCenter=record(snapshot.optionCenter);
  const optionSetsRaw=array(optionCenter.sets);
  const productLinksRaw=array(optionCenter.productLinks);
  const availability=record(snapshot.availability);
  const productMedia=record(snapshot.productMedia);

  const categories=categoriesRaw
    .map((raw,index)=>{
      const row=record(raw);
      return {
        id:string(row.id),
        label:string(row.name),
        position:integer(row.position,(index+1)*10),
        active:bool(row.active,true),
      };
    })
    .filter(row=>row.id&&row.label&&row.active)
    .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const categoryById=new Map(categories.map(row=>[row.id,row] as const));

  const setsById=new Map(optionSetsRaw.map(raw=>{
    const row=record(raw);
    return [string(row.id),row] as const;
  }).filter(([id])=>Boolean(id)));
  const linksByProduct=new Map<string,Record<string,unknown>[]>();
  for(const raw of productLinksRaw){
    const link=record(raw);
    const productId=string(link.productId);
    if(!productId)continue;
    const rows=linksByProduct.get(productId)??[];
    rows.push(link);
    linksByProduct.set(productId,rows);
  }

  const products=productsRaw
    .map((raw,index)=>{
      const row=record(raw);
      const id=string(row.id);
      const categoryId=string(row.categoryId);
      const category=categoryById.get(categoryId);
      const priceText=string(row.basePrice);
      const baseReady=priceText.trim()!==''&&Number.isFinite(Number(priceText));
      const surcharge=serviceMode==='takeaway'&&bool(row.takeawaySurchargeEnabled,false)?100:0;
      const adjustment=serviceMode==='takeaway'?moneyMinor(row.takeawayAdjustment):0;
      const availabilityRow=record(availability[id]);
      const mediaRow=record(productMedia[id]);
      const imageUrl=string(mediaRow.publicUrl)||string(mediaRow.canonicalImageRef)||string(row.imageRef);
      const optionSets=(linksByProduct.get(id)??[]).map(link=>{
        const set=setsById.get(string(link.setId));
        if(!set||set.active===false)return null;
        const defaults=new Set(array(link.defaultOptionIds).map(value=>string(value)).filter(Boolean));
        const options=array(set.options)
          .map(optionRaw=>{
            const option=record(optionRaw);
            const optionId=string(option.id);
            return {
              id:optionId,
              name:string(option.name,optionId),
              priceAdjustmentMinor:moneyMinor(option.priceAdjustment),
              defaultSelected:defaults.has(optionId),
              active:bool(option.active,true),
              position:integer(option.position,0),
            };
          })
          .filter(option=>option.id&&option.active)
          .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
          .map(({position:_,...option})=>Object.freeze(option));
        return Object.freeze({
          id:string(set.id),
          name:string(set.name,string(set.id)),
          required:bool(set.required,false),
          forceShow:bool(set.forceShow,false),
          selection:set.selection==='MULTI'?'MULTI' as const:'SINGLE' as const,
          min:integer(set.min,0),
          max:integer(set.max,1),
          options:Object.freeze(options),
        });
      }).filter((set):set is SyncedOptionSet=>Boolean(set));

      return {
        id,
        categoryId,
        category:category?.label??'其他',
        name:string(row.name,id),
        description:string(row.description)||undefined,
        active:bool(row.active,true),
        position:integer(row.legacySourcePosition,index),
        priceMinor:moneyMinor(priceText)+surcharge+adjustment,
        priceReady:baseReady,
        sellable:availabilityRow.sellable===undefined?true:bool(availabilityRow.sellable,true),
        imageUrl:imageUrl||undefined,
        optionSets:Object.freeze(optionSets),
      };
    })
    .filter(row=>row.id&&row.active&&categoryById.has(row.categoryId))
    .sort((a,b)=>{
      const ac=categoryById.get(a.categoryId)?.position??9999;
      const bc=categoryById.get(b.categoryId)?.position??9999;
      return ac-bc||a.position-b.position||a.id.localeCompare(b.id);
    })
    .map(({active:_,position:__,...row})=>Object.freeze(row));

  return Object.freeze({
    categories:Object.freeze(categories.map(({active:_,...row})=>Object.freeze(row))),
    products:Object.freeze(products),
  });
}

export function projectSyncedRiceballDrinkPromotion(
  envelope?:MfkAdminConfigEnvelope|null,
):SyncedRiceballDrinkPromotion|null{
  const snapshot=snapshotOf(envelope);
  const pricingPromotions=record(snapshot.pricingPromotions);
  const row=record(pricingPromotions.riceballDrink);
  if(row.schema!=='MFK_RICEBALL_DRINK_PROMOTION_V1'||!bool(row.active,false))return null;
  const eligibleMainPoolIds=array(row.eligibleMainPoolIds).map(value=>string(value)).filter(Boolean);
  const drinks=array(row.drinks).map(raw=>{
    const drink=record(raw);
    const productId=string(drink.productId);
    const priceText=string(drink.promoPrice);
    const ready=priceText.trim()!==''&&Number.isFinite(Number(priceText));
    return {
      productId,
      label:string(drink.label,productId),
      promoPriceMinor:ready?moneyMinor(priceText):-1,
    };
  }).filter(drink=>drink.productId&&drink.promoPriceMinor>=0);
  if(!eligibleMainPoolIds.length||!drinks.length)return null;
  return Object.freeze({
    active:true,
    eligibleMainPoolIds:Object.freeze(eligibleMainPoolIds),
    drinks:Object.freeze(drinks.map(drink=>Object.freeze(drink))),
  });
}

export function projectSyncedCombos(envelope?:MfkAdminConfigEnvelope|null):{
  readonly combos:readonly SyncedCombo[];
  readonly pools:readonly SyncedComboPool[];
}{
  const snapshot=snapshotOf(envelope);
  const catalog=record(snapshot.catalog);
  const combos=array(catalog.combos).map(raw=>{
    const row=record(raw);
    return Object.freeze({
      id:string(row.id),
      name:string(row.name,string(row.id)),
      basePriceMinor:moneyMinor(row.basePrice),
      active:bool(row.active,true),
      mainPoolId:string(row.mainPoolId)||undefined,
      addonPoolIds:Object.freeze(array(row.addonPoolIds).map(value=>string(value)).filter(Boolean)),
    });
  }).filter(row=>row.id&&row.active);

  const pools=array(catalog.comboPools).map(raw=>{
    const pool=record(raw);
    const groups=array(pool.groups).map(groupRaw=>{
      const group=record(groupRaw);
      const choices=array(group.choices).map(choiceRaw=>{
        const choice=record(choiceRaw);
        return {
          id:string(choice.id),
          type:choice.choiceType==='LABEL'?'LABEL' as const:choice.choiceType==='NONE'?'NONE' as const:'PRODUCT' as const,
          productId:string(choice.productId)||undefined,
          label:string(choice.label),
          bandId:string(choice.bandId),
          priceAdjustmentMinor:moneyMinor(choice.priceAdjustment),
          active:bool(choice.active,true),
          position:integer(choice.position,0),
        };
      }).filter(choice=>choice.id&&choice.active);
      const bands=array(group.bands).map(bandRaw=>{
        const band=record(bandRaw);
        const id=string(band.id);
        return Object.freeze({
          id,
          name:string(band.name,id),
          priceAdjustmentMinor:moneyMinor(band.priceAdjustment),
          active:bool(band.active,true),
          position:integer(band.position,0),
          choices:Object.freeze(choices
            .filter(choice=>choice.bandId===id)
            .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
            .map(({bandId:_,position:__,...choice})=>Object.freeze(choice))),
        });
      }).filter(band=>band.id&&band.active)
        .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
        .map(({position:_,...band})=>Object.freeze(band));
      return Object.freeze({
        id:string(group.id),
        name:string(group.name,string(group.id)),
        required:bool(group.required,true),
        min:integer(group.min,1),
        max:integer(group.max,1),
        position:integer(group.position,0),
        subPools:Object.freeze(bands),
      });
    }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
      .map(({position:_,...group})=>Object.freeze(group));
    const kind=pool.kind==='ADDON'?'ADDON' as const:'MAIN_COURSE' as const;
    return Object.freeze({
      id:string(pool.id),
      name:string(pool.name,string(pool.id)),
      kind,
      addonKind:kind==='ADDON'?(pool.addonKind==='DRINK'?'DRINK' as const:'SNACK' as const):undefined,
      groups:Object.freeze(groups),
    });
  }).filter(pool=>pool.id);

  return Object.freeze({combos:Object.freeze(combos),pools:Object.freeze(pools)});
}
