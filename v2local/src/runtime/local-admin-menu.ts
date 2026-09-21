export const LOCAL_ADMIN_MENU_STORAGE_KEY='mfk.local-admin.menu.v1';

export interface LocalAdminMenuCategory{
  readonly id:string;
  readonly name:string;
  readonly position:number;
}
export interface LocalAdminMenuProduct{
  readonly id:string;
  readonly name:string;
  readonly categoryId:string;
  readonly position:number;
  readonly active:boolean;
}
export interface LocalAdminMenuSnapshot{
  readonly schemaVersion:1;
  readonly revision:number;
  readonly updatedAt:string;
  readonly categories:readonly LocalAdminMenuCategory[];
  readonly products:readonly LocalAdminMenuProduct[];
}

const DEFAULT_CATEGORIES:readonly LocalAdminMenuCategory[]=[
  {id:'cat-riceball',name:'飯團',position:10},
  {id:'cat-combo',name:'套餐',position:20},
  {id:'cat-bento',name:'便當',position:30},
  {id:'cat-snack',name:'小食',position:40},
  {id:'cat-drink',name:'飲品',position:50},
  {id:'cat-vegetarian',name:'素食',position:60},
  {id:'cat-soup',name:'湯品',position:70},
  {id:'cat-addon',name:'配料',position:80},
  {id:'cat-more',name:'更多',position:90},
];
const DEFAULT_PRODUCTS:readonly LocalAdminMenuProduct[]=[
  {id:'riceball',name:'原味飯團',categoryId:'cat-riceball',position:10,active:true},
  {id:'tuna',name:'紫菜吞拿魚飯團',categoryId:'cat-riceball',position:20,active:true},
  {id:'pork',name:'泡菜豬肉飯團',categoryId:'cat-riceball',position:30,active:true},
  {id:'bento',name:'肉燥便當',categoryId:'cat-bento',position:10,active:true},
  {id:'curry',name:'咖喱便當',categoryId:'cat-bento',position:20,active:true},
  {id:'wedges',name:'香脆薯角',categoryId:'cat-snack',position:10,active:true},
  {id:'milkTea',name:'台式奶茶',categoryId:'cat-drink',position:10,active:true},
  {id:'lemonTea',name:'手打檸檬茶',categoryId:'cat-drink',position:20,active:true},
];

const listeners=new Set<()=>void>();

function now(){return new Date().toISOString()}
function cloneSnapshot(snapshot:LocalAdminMenuSnapshot):LocalAdminMenuSnapshot{
  return Object.freeze({
    ...snapshot,
    categories:Object.freeze(snapshot.categories.map(row=>Object.freeze({...row}))),
    products:Object.freeze(snapshot.products.map(row=>Object.freeze({...row}))),
  });
}
function seed(revision=1):LocalAdminMenuSnapshot{
  return cloneSnapshot({
    schemaVersion:1,
    revision,
    updatedAt:now(),
    categories:DEFAULT_CATEGORIES,
    products:DEFAULT_PRODUCTS,
  });
}
function text(value:unknown,code:string,max=80):string{
  if(typeof value!=='string')throw new Error(code);
  const normalized=value.trim();
  if(!normalized||normalized.length>max)throw new Error(code);
  return normalized;
}
function id(value:unknown,code:string):string{
  const normalized=text(value,code,64);
  if(!/^[A-Za-z0-9._-]+$/.test(normalized))throw new Error(code);
  return normalized;
}
function position(value:unknown,code:string):number{
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0||number>9999)throw new Error(code);
  return number;
}

export function validateLocalAdminMenu(input:unknown):LocalAdminMenuSnapshot{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schemaVersion!==1)throw new Error('ADMIN_MENU_SCHEMA_UNSUPPORTED');
  const revision=Number(row.revision);
  if(!Number.isSafeInteger(revision)||revision<1)throw new Error('ADMIN_MENU_REVISION_INVALID');
  if(typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt)))throw new Error('ADMIN_MENU_UPDATED_AT_INVALID');
  if(!Array.isArray(row.categories)||row.categories.length===0)throw new Error('ADMIN_MENU_CATEGORIES_REQUIRED');
  if(!Array.isArray(row.products)||row.products.length===0)throw new Error('ADMIN_MENU_PRODUCTS_REQUIRED');

  const categoryIds=new Set<string>();
  const categories=row.categories.map((value,index)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ADMIN_MENU_CATEGORY_INVALID_'+index);
    const item=value as Record<string,unknown>;
    const category=Object.freeze({
      id:id(item.id,'ADMIN_MENU_CATEGORY_ID_INVALID_'+index),
      name:text(item.name,'ADMIN_MENU_CATEGORY_NAME_INVALID_'+index),
      position:position(item.position,'ADMIN_MENU_CATEGORY_POSITION_INVALID_'+index),
    });
    if(categoryIds.has(category.id))throw new Error('ADMIN_MENU_CATEGORY_DUPLICATE_'+category.id);
    categoryIds.add(category.id);
    return category;
  });

  const productIds=new Set<string>();
  const products=row.products.map((value,index)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ADMIN_MENU_PRODUCT_INVALID_'+index);
    const item=value as Record<string,unknown>;
    const productId=id(item.id,'ADMIN_MENU_PRODUCT_ID_INVALID_'+index);
    const categoryId=id(item.categoryId,'ADMIN_MENU_PRODUCT_CATEGORY_INVALID_'+index);
    if(!categoryIds.has(categoryId))throw new Error('ADMIN_MENU_PRODUCT_CATEGORY_UNKNOWN_'+categoryId);
    if(typeof item.active!=='boolean')throw new Error('ADMIN_MENU_PRODUCT_ACTIVE_INVALID_'+index);
    const product=Object.freeze({
      id:productId,
      name:text(item.name,'ADMIN_MENU_PRODUCT_NAME_INVALID_'+index),
      categoryId,
      position:position(item.position,'ADMIN_MENU_PRODUCT_POSITION_INVALID_'+index),
      active:item.active,
    });
    if(productIds.has(product.id))throw new Error('ADMIN_MENU_PRODUCT_DUPLICATE_'+product.id);
    productIds.add(product.id);
    return product;
  });

  return cloneSnapshot({
    schemaVersion:1,
    revision,
    updatedAt:row.updatedAt,
    categories,
    products,
  });
}

function persist(snapshot:LocalAdminMenuSnapshot){
  localStorage.setItem(LOCAL_ADMIN_MENU_STORAGE_KEY,JSON.stringify(snapshot));
}
function emit(){for(const listener of listeners)listener()}

export function readLocalAdminMenu():LocalAdminMenuSnapshot{
  try{
    const raw=localStorage.getItem(LOCAL_ADMIN_MENU_STORAGE_KEY);
    if(raw)return validateLocalAdminMenu(JSON.parse(raw));
  }catch{}
  const initial=seed();
  try{persist(initial)}catch{}
  return initial;
}

export function saveLocalAdminMenu(
  draft:Pick<LocalAdminMenuSnapshot,'categories'|'products'>,
  expectedRevision:number,
):LocalAdminMenuSnapshot{
  const current=readLocalAdminMenu();
  if(current.revision!==expectedRevision)throw new Error('ADMIN_MENU_REVISION_CONFLICT');
  const next=validateLocalAdminMenu({
    schemaVersion:1,
    revision:current.revision+1,
    updatedAt:now(),
    categories:draft.categories,
    products:draft.products,
  });
  persist(next);
  emit();
  return next;
}

export function resetLocalAdminMenu(expectedRevision:number):LocalAdminMenuSnapshot{
  const current=readLocalAdminMenu();
  if(current.revision!==expectedRevision)throw new Error('ADMIN_MENU_REVISION_CONFLICT');
  const next=seed(current.revision+1);
  persist(next);
  emit();
  return next;
}

export function subscribeLocalAdminMenu(listener:()=>void){
  listeners.add(listener);
  return()=>listeners.delete(listener);
}
