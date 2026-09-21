export const MENU_CACHE_KEY='morefun.smt.menu.local.v1';

function safeCatalog(value,fallback){
  if(!value||typeof value!=='object')return fallback;
  const categories=Array.isArray(value.categories)&&value.categories.length?value.categories:fallback.categories;
  const products=Array.isArray(value.products)&&value.products.length?value.products:fallback.products;
  const drinks=Array.isArray(value.drinks)&&value.drinks.length?value.drinks:fallback.drinks;
  return {categories,products,drinks};
}

export async function loadMenuCatalog({storage=globalThis.localStorage,fallback}={}){
  if(!fallback)throw new Error('LOCAL_MENU_FALLBACK_REQUIRED');
  try{
    const raw=storage?.getItem?.(MENU_CACHE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      const catalog=safeCatalog(parsed,fallback);
      return {...catalog,source:'local',loadedAt:Number(parsed.loadedAt)||Date.now()};
    }
  }catch(_error){}
  const catalog={...safeCatalog(fallback,fallback),loadedAt:Date.now()};
  try{storage?.setItem?.(MENU_CACHE_KEY,JSON.stringify(catalog));}catch(_error){}
  return {...catalog,source:'local'};
}
