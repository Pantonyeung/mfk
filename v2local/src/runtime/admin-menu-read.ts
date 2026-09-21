export interface AdminMenuProductProjection{
  readonly id:string;
  readonly name:string;
  readonly category:string;
  readonly imageRef?:string;
}

export interface AdminMenuReadback{
  readonly catalogVersion:string;
  readonly products:readonly AdminMenuProductProjection[];
  readonly fetchedAt:string;
}

const ENDPOINT='https://morefun-v2-customer.pantonyeung.workers.dev/api/customer/ordering';
const CACHE_KEY='mfk.admin-menu.readback.v1';

function text(value:unknown):string{
  return typeof value==='string'?value.trim():'';
}

function normalizeProduct(value:unknown,index:number):AdminMenuProductProjection{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ADMIN_MENU_PRODUCT_INVALID_'+index);
  const row=value as Record<string,unknown>;
  const id=text(row.productId)||text(row.id)||text(row.sku)||text(row.itemId);
  const name=text(row.displayName)||text(row.name)||text(row.title);
  const category=text(row.categoryName)||text(row.category)||text(row.categoryId)||'其他';
  if(!id||!name)throw new Error('ADMIN_MENU_PRODUCT_IDENTITY_REQUIRED_'+index);
  const imageRef=text(row.imageRef);
  return Object.freeze({id,name,category,...(imageRef?{imageRef}:{})});
}

export function readCachedAdminMenu():AdminMenuReadback|null{
  try{
    const raw=localStorage.getItem(CACHE_KEY);
    if(!raw)return null;
    const value=JSON.parse(raw) as AdminMenuReadback;
    if(!value||!value.catalogVersion||!Array.isArray(value.products)||!value.products.length)return null;
    return value;
  }catch{return null}
}

export async function readAdminPublishedMenu(fetchImpl:typeof fetch=fetch):Promise<AdminMenuReadback>{
  const controller=new AbortController();
  const timer=globalThis.setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetchImpl(ENDPOINT,{
      method:'GET',
      headers:{accept:'application/json'},
      cache:'no-store',
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('ADMIN_MENU_HTTP_'+response.status);
    const body=await response.json() as Record<string,unknown>;
    const catalogVersion=text(body.catalogVersion);
    const rawProducts=Array.isArray(body.products)?body.products:[];
    if(!catalogVersion||!rawProducts.length)throw new Error('ADMIN_MENU_PROJECTION_INVALID');
    const result:Object=Object.freeze({
      catalogVersion,
      products:Object.freeze(rawProducts.map(normalizeProduct)),
      fetchedAt:new Date().toISOString(),
    });
    const normalized=result as AdminMenuReadback;
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(normalized));}catch{}
    return normalized;
  }catch(error){
    if((error as Error)?.name==='AbortError')throw new Error('ADMIN_MENU_TIMEOUT');
    throw error;
  }finally{
    globalThis.clearTimeout(timer);
  }
}
