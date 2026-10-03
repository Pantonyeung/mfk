import {isFormalOptionPrice} from './formal-option-center.ts';

export interface FormalCatalogCategory{
  id:string;
  name:string;
  position:number;
  active:boolean;
}

export interface FormalCatalogProduct{
  id:string;
  name:string;
  productCode:string;
  categoryId:string;
  active:boolean;
  basePrice:string;
  description:string;
}

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}

export function readFormalCatalog(snapshot:Record<string,unknown>){
  const catalog=row(snapshot.catalog);
  const categories:FormalCatalogCategory[]=list(catalog.categories).map((value,index)=>{
    const item=row(value);
    return {
      id:text(item.id),
      name:text(item.name),
      position:Number.isFinite(Number(item.position))?Number(item.position):(index+1)*10,
      active:item.active!==false,
    };
  }).filter(item=>item.id);
  const products:FormalCatalogProduct[]=list(catalog.products).map(value=>{
    const item=row(value);
    return {
      id:text(item.id),
      name:text(item.name),
      productCode:text(item.productCode)||text(item.legacyBarcode)||text(item.id),
      categoryId:text(item.categoryId),
      active:item.active!==false,
      basePrice:text(item.basePrice),
      description:text(item.description),
    };
  }).filter(item=>item.id);
  return {catalog,categories,products};
}

export function patchFormalCatalogProduct(
  snapshot:Record<string,unknown>,
  productId:string,
  patch:Partial<Pick<FormalCatalogProduct,'name'|'categoryId'|'active'|'basePrice'|'description'>>,
){
  const catalog=row(snapshot.catalog);
  const products=list(catalog.products);
  let found=false;
  const nextProducts=products.map(value=>{
    const item=row(value);
    if(text(item.id)!==productId)return value;
    found=true;
    return {...item,...patch};
  });
  if(!found)throw new Error('FORMAL_PRODUCT_NOT_FOUND');
  return {...snapshot,catalog:{...catalog,products:nextProducts}};
}

export function patchFormalCategory(
  snapshot:Record<string,unknown>,
  categoryId:string,
  patch:Partial<Pick<FormalCatalogCategory,'name'|'position'|'active'>>,
){
  const catalog=row(snapshot.catalog);
  const categories=list(catalog.categories);
  let found=false;
  const nextCategories=categories.map(value=>{
    const item=row(value);
    if(text(item.id)!==categoryId)return value;
    found=true;
    return {...item,...patch};
  });
  if(!found)throw new Error('FORMAL_CATEGORY_NOT_FOUND');
  return {...snapshot,catalog:{...catalog,categories:nextCategories}};
}

export interface FormalModifierOption{
  id:string;
  name:string;
  code:string;
  priceAdjustment:string;
  active:boolean;
}
export interface FormalModifierGroup{
  id:string;
  name:string;
  options:FormalModifierOption[];
}
export interface FormalCombo{
  id:string;
  name:string;
  basePrice:string;
  active:boolean;
}

export function readFormalCatalogPricing(snapshot:Record<string,unknown>){
  const catalog=row(snapshot.catalog);
  // Existing optionCenter is canonical; never show a disagreeing legacy mirror as price truth.
  const optionGroups=Object.hasOwn(snapshot,'optionCenter')?row(snapshot.optionCenter).sets:catalog.modifierGroups;
  const modifierGroups:FormalModifierGroup[]=list(optionGroups).map(value=>{
    const group=row(value);
    return{
      id:text(group.id),
      name:text(group.name),
      options:list(group.options).map(optionValue=>{
        const option=row(optionValue);
        return{
          id:text(option.id),
          name:text(option.name),
          code:text(option.code)||text(option.id),
          priceAdjustment:text(option.priceAdjustment),
          active:option.active!==false,
        };
      }).filter(option=>option.id),
    };
  }).filter(group=>group.id);
  const combos:FormalCombo[]=list(catalog.combos).map(value=>{
    const combo=row(value);
    return{
      id:text(combo.id),
      name:text(combo.name),
      basePrice:text(combo.basePrice),
      active:combo.active!==false,
    };
  }).filter(combo=>combo.id);
  return{modifierGroups,combos};
}

export function createFormalCategory(snapshot:Record<string,unknown>,input:{id:string;name:string}){
  const catalog=row(snapshot.catalog);
  const categories=list(catalog.categories);
  const maxPosition=categories.reduce((max,value)=>Math.max(max,Number(row(value).position)||0),0);
  const next={id:input.id,name:input.name,position:maxPosition+10,active:true};
  return{...snapshot,catalog:{...catalog,categories:[...categories,next]}};
}

export function removeFormalCategory(snapshot:Record<string,unknown>,categoryId:string){
  const catalog=row(snapshot.catalog);
  const products=list(catalog.products);
  if(products.some(value=>text(row(value).categoryId)===categoryId))throw new Error('FORMAL_CATEGORY_IN_USE');
  return{...snapshot,catalog:{...catalog,categories:list(catalog.categories).filter(value=>text(row(value).id)!==categoryId)}};
}

export function moveFormalCategory(snapshot:Record<string,unknown>,categoryId:string,direction:-1|1){
  const catalog=row(snapshot.catalog);
  const categories=[...list(catalog.categories)].sort((a,b)=>(Number(row(a).position)||0)-(Number(row(b).position)||0));
  const index=categories.findIndex(value=>text(row(value).id)===categoryId);
  const target=index+direction;
  if(index<0||target<0||target>=categories.length)return snapshot;
  [categories[index],categories[target]]=[categories[target],categories[index]];
  const normalized=categories.map((value,idx)=>({...row(value),position:(idx+1)*10}));
  return{...snapshot,catalog:{...catalog,categories:normalized}};
}

export function moveFormalProduct(snapshot:Record<string,unknown>,productId:string,direction:-1|1){
  const catalog=row(snapshot.catalog);
  const products=[...list(catalog.products)];
  const index=products.findIndex(value=>text(row(value).id)===productId);
  const target=index+direction;
  if(index<0||target<0||target>=products.length)return snapshot;
  [products[index],products[target]]=[products[target],products[index]];
  const normalized=products.map((value,idx)=>({...row(value),legacySourcePosition:idx}));
  return{...snapshot,catalog:{...catalog,products:normalized}};
}

function modifierRecord(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('FORMAL_MODIFIER_SOURCE_INVALID');
  return value as Record<string,unknown>;
}
function modifierRows(value:unknown):Record<string,unknown>[] {
  if(!Array.isArray(value))throw new Error('FORMAL_MODIFIER_SOURCE_INVALID');
  return value.map(modifierRecord);
}
function uniqueModifierRow(values:Record<string,unknown>[],id:string,kind:'GROUP'|'OPTION'){
  if(!id||values.some(value=>typeof value.id!=='string'||!value.id))throw new Error('FORMAL_MODIFIER_SOURCE_INVALID');
  const matches=values.filter(value=>value.id===id);
  if(!matches.length)throw new Error('FORMAL_MODIFIER_'+kind+'_NOT_FOUND');
  if(matches.length!==1)throw new Error('FORMAL_MODIFIER_'+kind+'_AMBIGUOUS');
  return matches[0];
}
function modifierPriceTarget(values:unknown,groupId:string,optionId:string){
  const groups=modifierRows(values),group=uniqueModifierRow(groups,groupId,'GROUP');
  const options=modifierRows(group.options),option=uniqueModifierRow(options,optionId,'OPTION');
  if(typeof option.priceAdjustment!=='string'||!option.priceAdjustment.trim()||!Number.isFinite(Number(option.priceAdjustment)))throw new Error('FORMAL_MODIFIER_SOURCE_PRICE_INVALID');
  return {groups,group,options,option};
}
function withModifierPrice(target:ReturnType<typeof modifierPriceTarget>,priceAdjustment:string){
  return target.groups.map(group=>group===target.group?{...group,options:target.options.map(option=>option===target.option?{...option,priceAdjustment}:option)}:group);
}

export function patchFormalModifierOptionPrice(snapshot:Record<string,unknown>,groupId:string,optionId:string,priceAdjustment:string,expectedPrice?:string){
  if(!isFormalOptionPrice(priceAdjustment))throw new Error('FORMAL_MODIFIER_PRICE_INVALID');
  const catalog=modifierRecord(snapshot.catalog);
  const legacy=modifierPriceTarget(catalog.modifierGroups,groupId,optionId);
  // Validate both existing targets before constructing the one atomic snapshot edit.
  // A truly absent optionCenter stays absent; this edit is not a migration.
  if(!Object.hasOwn(snapshot,'optionCenter')){
    if(expectedPrice!==undefined&&legacy.option.priceAdjustment!==expectedPrice)throw new Error('FORMAL_MODIFIER_PRICE_STALE');
    return {...snapshot,catalog:{...catalog,modifierGroups:withModifierPrice(legacy,priceAdjustment)}};
  }
  const center=modifierRecord(snapshot.optionCenter);
  const target=modifierPriceTarget(center.sets,groupId,optionId);
  if(expectedPrice!==undefined&&target.option.priceAdjustment!==expectedPrice)throw new Error('FORMAL_MODIFIER_PRICE_STALE');
  const links=modifierRows(center.productLinks);
  if(links.some(link=>typeof link.productId!=='string'||!link.productId||typeof link.setId!=='string'||!link.setId||!Array.isArray(link.defaultOptionIds)||link.defaultOptionIds.some(id=>typeof id!=='string'||!id)))throw new Error('FORMAL_MODIFIER_SOURCE_INVALID');
  return {
    ...snapshot,
    optionCenter:{...center,sets:withModifierPrice(target,priceAdjustment)},
    catalog:{...catalog,modifierGroups:withModifierPrice(legacy,priceAdjustment)},
  };
}

export function patchFormalComboPrice(snapshot:Record<string,unknown>,comboId:string,basePrice:string){
  const catalog=row(snapshot.catalog);
  let found=false;
  const combos=list(catalog.combos).map(value=>{
    const combo=row(value);
    if(text(combo.id)!==comboId)return value;
    found=true;
    return{...combo,basePrice};
  });
  if(!found)throw new Error('FORMAL_COMBO_NOT_FOUND');
  return{...snapshot,catalog:{...catalog,combos}};
}


export function moveFormalProductWithinCategory(snapshot:Record<string,unknown>,productId:string,direction:-1|1){
  const catalog=row(snapshot.catalog);
  const products=[...list(catalog.products)];
  const currentIndex=products.findIndex(value=>text(row(value).id)===productId);
  if(currentIndex<0)return snapshot;
  const categoryId=text(row(products[currentIndex]).categoryId);
  const peerIndexes=products.map((value,index)=>({value,index})).filter(item=>text(row(item.value).categoryId)===categoryId).map(item=>item.index);
  const peerPosition=peerIndexes.indexOf(currentIndex);
  const targetPeerPosition=peerPosition+direction;
  if(peerPosition<0||targetPeerPosition<0||targetPeerPosition>=peerIndexes.length)return snapshot;
  const targetIndex=peerIndexes[targetPeerPosition];
  [products[currentIndex],products[targetIndex]]=[products[targetIndex],products[currentIndex]];
  const normalized=products.map((value,idx)=>({...row(value),legacySourcePosition:idx}));
  return{...snapshot,catalog:{...catalog,products:normalized}};
}
