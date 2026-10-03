import {patchFormalCatalogProduct,type FormalCatalogProduct} from './formal-catalog.ts';
import {readFormalOptionCenter,writeFormalOptionCenter,type FormalProductOptionLink} from './formal-option-center.ts';
import {assertFormalOptionReadiness} from './formal-option-readiness.ts';

export type FormalProductOptionBinding=Pick<FormalProductOptionLink,'setId'|'defaultOptionIds'>;
type ProductPatch=Partial<Pick<FormalCatalogProduct,'name'|'categoryId'|'active'|'basePrice'|'description'>>;
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Raw facts displayed when opening the sheet. Other products/domains may safely change. */
export function formalProductEditBaseline(snapshot:Record<string,unknown>,productId:string){
  const catalog=row(snapshot.catalog),center=row(snapshot.optionCenter);
  return JSON.stringify({
    product:list(catalog.products).find(value=>row(value).id===productId)??null,
    sets:center.sets,
    legacyGroups:catalog.modifierGroups,
    links:list(center.productLinks).filter(value=>row(value).productId===productId),
    hasCenter:Object.hasOwn(snapshot,'optionCenter'),
  });
}

/** One existing draft mutation: basics + per-product links; no generated identity or price authority. */
export function saveFormalProductOptions(
  snapshot:Record<string,unknown>,productId:string,patch:ProductPatch,
  bindings:readonly FormalProductOptionBinding[],expectedBaseline:string,
):Record<string,unknown>{
  assertFormalOptionReadiness(snapshot,'EDIT_SOURCE');
  if(!list(row(snapshot.catalog).products).some(value=>row(value).id===productId))throw new Error('FORMAL_PRODUCT_NOT_FOUND');
  if(formalProductEditBaseline(snapshot,productId)!==expectedBaseline)throw new Error('FORMAL_PRODUCT_EDIT_STALE');
  const state=readFormalOptionCenter(snapshot);
  const previous=state.productLinks.filter(link=>link.productId===productId).map(({setId,defaultOptionIds})=>({setId,defaultOptionIds}));
  // A basic-only save must not materialize absent option sources or normalize historical facts.
  if(same(previous,bindings))return patchFormalCatalogProduct(snapshot,productId,patch);
  const ids=new Set<string>();
  for(const binding of bindings){
    if(ids.has(binding.setId))throw new Error('FORMAL_PRODUCT_OPTION_DUPLICATE');
    ids.add(binding.setId);
    const set=state.sets.find(set=>set.id===binding.setId);
    if(!set)throw new Error('FORMAL_PRODUCT_OPTION_NOT_FOUND');
    const before=previous.find(link=>link.setId===binding.setId);
    if(!before||!same(before.defaultOptionIds,binding.defaultOptionIds)){
      if(!set.active)throw new Error('FORMAL_PRODUCT_OPTION_UNAVAILABLE');
      if(set.allowQuantities)throw new Error('FORMAL_PRODUCT_OPTION_QUANTITIES_UNSUPPORTED');
    }
  }
  const wanted=new Map(bindings.map(binding=>[binding.setId,binding]));
  const retained=state.productLinks.flatMap(link=>{
    if(link.productId!==productId)return [link];
    const binding=wanted.get(link.setId);
    return binding?[{...link,defaultOptionIds:[...binding.defaultOptionIds]}]:[];
  });
  const existing=new Set(previous.map(link=>link.setId));
  const additions=bindings.filter(binding=>!existing.has(binding.setId)).map(binding=>({productId,setId:binding.setId,defaultOptionIds:[...binding.defaultOptionIds]}));
  const next=writeFormalOptionCenter(snapshot,{sets:state.sets,productLinks:[...retained,...additions]});
  return patchFormalCatalogProduct(next,productId,patch);
}
