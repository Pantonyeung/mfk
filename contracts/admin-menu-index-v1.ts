export const MFK_ADMIN_MENU_INDEX_SCHEMA='MFK_ADMIN_MENU_INDEX_V1' as const;

export interface MfkAdminMenuIndexCategory{
  readonly id:string;
  readonly label:string;
  readonly position:number;
}
export interface MfkAdminMenuIndexProduct{
  readonly id:string;
  readonly label:string;
  readonly categoryId:string;
  readonly position:number;
  readonly enabled:true;
}
export interface MfkAdminMenuIndexRevision{
  readonly schema:typeof MFK_ADMIN_MENU_INDEX_SCHEMA;
  readonly revision:number;
  readonly baseRevision:number;
  readonly publishedAt:string;
  readonly categories:readonly MfkAdminMenuIndexCategory[];
  readonly products:readonly MfkAdminMenuIndexProduct[];
  readonly fingerprint:string;
}

function text(value:unknown,code:string,max=100){
  if(typeof value!=='string')throw new Error(code);
  const v=value.trim();
  if(!v||v.length>max)throw new Error(code);
  return v;
}
function id(value:unknown,code:string){
  const v=text(value,code,64);
  if(!/^[A-Za-z0-9._-]+$/.test(v))throw new Error(code);
  return v;
}
function position(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0||n>9999)throw new Error(code);
  return n;
}
function revision(value:unknown,code:string,allowZero=false){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<(allowZero?0:1))throw new Error(code);
  return n;
}
function canonicalPayload(value:Omit<MfkAdminMenuIndexRevision,'fingerprint'>){
  return JSON.stringify({
    schema:value.schema,
    revision:value.revision,
    baseRevision:value.baseRevision,
    publishedAt:value.publishedAt,
    categories:value.categories.map(row=>({id:row.id,label:row.label,position:row.position})),
    products:value.products.map(row=>({id:row.id,label:row.label,categoryId:row.categoryId,position:row.position,enabled:true})),
  });
}
function fnv1a(value:string){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}
export function fingerprintMfkAdminMenuIndexRevision(value:Omit<MfkAdminMenuIndexRevision,'fingerprint'>){
  return 'fnv1a32:'+fnv1a(canonicalPayload(value));
}

export function validateMfkAdminMenuIndexRevision(input:unknown):MfkAdminMenuIndexRevision{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_INDEX_REVISION_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!==MFK_ADMIN_MENU_INDEX_SCHEMA)throw new Error('ADMIN_MENU_INDEX_SCHEMA_UNSUPPORTED');
  const r=revision(row.revision,'ADMIN_MENU_INDEX_REVISION_INVALID');
  const base=revision(row.baseRevision,'ADMIN_MENU_INDEX_BASE_REVISION_INVALID',true);
  if(r!==base+1)throw new Error('ADMIN_MENU_INDEX_REVISION_SEQUENCE_INVALID');
  if(typeof row.publishedAt!=='string'||!Number.isFinite(Date.parse(row.publishedAt)))throw new Error('ADMIN_MENU_INDEX_PUBLISHED_AT_INVALID');
  if(!Array.isArray(row.categories)||row.categories.length===0)throw new Error('ADMIN_MENU_INDEX_CATEGORIES_REQUIRED');
  if(!Array.isArray(row.products)||row.products.length===0)throw new Error('ADMIN_MENU_INDEX_PRODUCTS_REQUIRED');

  const categoryIds=new Set<string>();
  const categories=row.categories.map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ADMIN_MENU_INDEX_CATEGORY_INVALID_'+index);
    const item=raw as Record<string,unknown>;
    const out=Object.freeze({
      id:id(item.id,'ADMIN_MENU_INDEX_CATEGORY_ID_INVALID_'+index),
      label:text(item.label,'ADMIN_MENU_INDEX_CATEGORY_LABEL_INVALID_'+index),
      position:position(item.position,'ADMIN_MENU_INDEX_CATEGORY_POSITION_INVALID_'+index),
    });
    if(categoryIds.has(out.id))throw new Error('ADMIN_MENU_INDEX_CATEGORY_DUPLICATE_'+out.id);
    categoryIds.add(out.id);
    return out;
  });

  const productIds=new Set<string>();
  const products=row.products.map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ADMIN_MENU_INDEX_PRODUCT_INVALID_'+index);
    const item=raw as Record<string,unknown>;
    const categoryId=id(item.categoryId,'ADMIN_MENU_INDEX_PRODUCT_CATEGORY_INVALID_'+index);
    if(!categoryIds.has(categoryId))throw new Error('ADMIN_MENU_INDEX_PRODUCT_CATEGORY_UNKNOWN_'+categoryId);
    if(item.enabled!==true)throw new Error('ADMIN_MENU_INDEX_PRODUCT_ENABLED_INVALID_'+index);
    const out=Object.freeze({
      id:id(item.id,'ADMIN_MENU_INDEX_PRODUCT_ID_INVALID_'+index),
      label:text(item.label,'ADMIN_MENU_INDEX_PRODUCT_LABEL_INVALID_'+index),
      categoryId,
      position:position(item.position,'ADMIN_MENU_INDEX_PRODUCT_POSITION_INVALID_'+index),
      enabled:true as const,
    });
    if(productIds.has(out.id))throw new Error('ADMIN_MENU_INDEX_PRODUCT_DUPLICATE_'+out.id);
    productIds.add(out.id);
    return out;
  });

  const baseValue=Object.freeze({
    schema:MFK_ADMIN_MENU_INDEX_SCHEMA,
    revision:r,
    baseRevision:base,
    publishedAt:row.publishedAt,
    categories:Object.freeze(categories),
    products:Object.freeze(products),
  });
  const expected=fingerprintMfkAdminMenuIndexRevision(baseValue);
  if(row.fingerprint!==expected)throw new Error('ADMIN_MENU_INDEX_FINGERPRINT_MISMATCH');
  return Object.freeze({...baseValue,fingerprint:expected});
}

export function createMfkAdminMenuIndexRevision(input:{
  readonly baseRevision:number;
  readonly publishedAt:string;
  readonly categories:readonly MfkAdminMenuIndexCategory[];
  readonly products:readonly MfkAdminMenuIndexProduct[];
}):MfkAdminMenuIndexRevision{
  const baseRevision=revision(input.baseRevision,'ADMIN_MENU_INDEX_BASE_REVISION_INVALID',true);
  const value={
    schema:MFK_ADMIN_MENU_INDEX_SCHEMA,
    revision:baseRevision+1,
    baseRevision,
    publishedAt:input.publishedAt,
    categories:input.categories,
    products:input.products,
  } as const;
  return validateMfkAdminMenuIndexRevision({...value,fingerprint:fingerprintMfkAdminMenuIndexRevision(value)});
}
