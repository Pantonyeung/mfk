export const ADMIN_MENU_READBACK_URL='https://morefun-v2-admin.pantonyeung.workers.dev/api/smt/menu-readback';
const CACHE_KEY='mfk.admin-menu.readback.v2';

export interface AdminMenuCategoryProjection{
  readonly categoryId:string;
  readonly name:string;
  readonly position:number;
  readonly revision:number;
  readonly parentCategoryId?:string;
}
export interface AdminMenuProductProjection{
  readonly productId:string;
  readonly name:string;
  readonly shortName?:string;
  readonly imageRef?:string;
  readonly revision:number;
  readonly categoryMemberships:readonly {readonly categoryId:string;readonly position:number}[];
}
export interface AdminMenuReadback{
  readonly storeId:string;
  readonly catalogRevision:string;
  readonly categories:readonly AdminMenuCategoryProjection[];
  readonly products:readonly AdminMenuProductProjection[];
  readonly fetchedAt:string;
}

function record(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function nonEmpty(value:unknown,code:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(code);
  return value.trim();
}
function safeInt(value:unknown,code:string,min=0):number{
  if(!Number.isSafeInteger(value)||Number(value)<min)throw new Error(code);
  return Number(value);
}
function optionalText(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim():undefined;
}

export function normalizeAdminMenuEnvelope(body:unknown):AdminMenuReadback{
  const envelope=record(body,'ADMIN_MENU_ENVELOPE_INVALID');
  if(envelope.ok!==true)throw new Error('ADMIN_MENU_ENVELOPE_INVALID');
  const value=record(envelope.value,'ADMIN_MENU_VALUE_INVALID');
  const storeId=nonEmpty(value.storeId,'ADMIN_MENU_STORE_ID_REQUIRED');
  const catalogRevision=nonEmpty(value.catalogRevision,'ADMIN_MENU_REVISION_REQUIRED');
  if(!Array.isArray(value.categories)||!Array.isArray(value.products))throw new Error('ADMIN_MENU_COLLECTIONS_REQUIRED');

  const categories=value.categories.map((raw,index)=>{
    const row=record(raw,'ADMIN_MENU_CATEGORY_INVALID_'+index);
    const categoryId=nonEmpty(row.categoryId,'ADMIN_MENU_CATEGORY_ID_REQUIRED_'+index);
    const name=nonEmpty(row.name,'ADMIN_MENU_CATEGORY_NAME_REQUIRED_'+index);
    const position=safeInt(row.position,'ADMIN_MENU_CATEGORY_POSITION_INVALID_'+index);
    const revision=safeInt(row.revision,'ADMIN_MENU_CATEGORY_REVISION_INVALID_'+index,1);
    const parentCategoryId=optionalText(row.parentCategoryId);
    return Object.freeze({categoryId,name,position,revision,...(parentCategoryId?{parentCategoryId}:{})});
  });
  const categoryIds=new Set(categories.map(category=>category.categoryId));
  if(categoryIds.size!==categories.length)throw new Error('ADMIN_MENU_CATEGORY_DUPLICATE');

  const products=value.products.map((raw,index)=>{
    const row=record(raw,'ADMIN_MENU_PRODUCT_INVALID_'+index);
    const productId=nonEmpty(row.productId,'ADMIN_MENU_PRODUCT_ID_REQUIRED_'+index);
    const name=nonEmpty(row.name,'ADMIN_MENU_PRODUCT_NAME_REQUIRED_'+index);
    const revision=safeInt(row.revision,'ADMIN_MENU_PRODUCT_REVISION_INVALID_'+index,1);
    if(!Array.isArray(row.categoryMemberships)||row.categoryMemberships.length===0)throw new Error('ADMIN_MENU_PRODUCT_CATEGORY_REQUIRED_'+index);
    const categoryMemberships=row.categoryMemberships.map((membership,membershipIndex)=>{
      const item=record(membership,'ADMIN_MENU_PRODUCT_CATEGORY_INVALID_'+index+'_'+membershipIndex);
      const categoryId=nonEmpty(item.categoryId,'ADMIN_MENU_PRODUCT_CATEGORY_ID_REQUIRED_'+index+'_'+membershipIndex);
      if(!categoryIds.has(categoryId))throw new Error('ADMIN_MENU_PRODUCT_CATEGORY_UNKNOWN_'+categoryId);
      return Object.freeze({
        categoryId,
        position:safeInt(item.position,'ADMIN_MENU_PRODUCT_CATEGORY_POSITION_INVALID_'+index+'_'+membershipIndex),
      });
    });
    const shortName=optionalText(row.shortName);
    const imageRef=optionalText(row.imageRef);
    return Object.freeze({
      productId,name,revision,
      ...(shortName?{shortName}:{}),
      ...(imageRef?{imageRef}:{}),
      categoryMemberships:Object.freeze(categoryMemberships),
    });
  });
  const productIds=new Set(products.map(product=>product.productId));
  if(productIds.size!==products.length)throw new Error('ADMIN_MENU_PRODUCT_DUPLICATE');
  if(products.length===0)throw new Error('ADMIN_MENU_PRODUCTS_EMPTY');

  return Object.freeze({
    storeId,
    catalogRevision,
    categories:Object.freeze(categories),
    products:Object.freeze(products),
    fetchedAt:new Date().toISOString(),
  });
}

export function readCachedAdminMenu():AdminMenuReadback|null{
  try{
    const raw=localStorage.getItem(CACHE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as AdminMenuReadback;
    if(!parsed||!parsed.storeId||!parsed.catalogRevision||!Array.isArray(parsed.categories)||!Array.isArray(parsed.products)||!parsed.products.length)return null;
    return parsed;
  }catch{return null}
}

export async function readAdminPublishedMenu(fetchImpl:typeof fetch=fetch,url:string=ADMIN_MENU_READBACK_URL):Promise<AdminMenuReadback>{
  const controller=new AbortController();
  const timer=globalThis.setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetchImpl(url,{
      method:'GET',
      headers:{accept:'application/json'},
      cache:'no-store',
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('ADMIN_MENU_HTTP_'+response.status);
    const normalized=normalizeAdminMenuEnvelope(await response.json());
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(normalized));}catch{}
    return normalized;
  }catch(error){
    if((error as Error)?.name==='AbortError')throw new Error('ADMIN_MENU_TIMEOUT');
    throw error;
  }finally{
    globalThis.clearTimeout(timer);
  }
}
