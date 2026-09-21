export const LOCAL_ADMIN_MENU_ACTIVE_KEY='mfk.local-admin.menu.active.v2';
export const LOCAL_ADMIN_MENU_DRAFT_KEY='mfk.local-admin.menu.draft.v2';
export const LOCAL_ADMIN_MENU_HISTORY_KEY='mfk.local-admin.menu.history.v2';
const LEGACY_KEY='mfk.local-admin.menu.v1';

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
  readonly schemaVersion:2;
  readonly revision:number;
  readonly publishedAt:string;
  readonly categories:readonly LocalAdminMenuCategory[];
  readonly products:readonly LocalAdminMenuProduct[];
}
export interface LocalAdminMenuDraft{
  readonly schemaVersion:2;
  readonly draftRevision:number;
  readonly basePublishedRevision:number;
  readonly updatedAt:string;
  readonly categories:readonly LocalAdminMenuCategory[];
  readonly products:readonly LocalAdminMenuProduct[];
}
export interface LocalAdminMenuValidation{
  readonly ok:boolean;
  readonly errors:readonly string[];
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

const activeListeners=new Set<()=>void>();
const draftListeners=new Set<()=>void>();

function now(){return new Date().toISOString()}
function freezeCategories(rows:readonly LocalAdminMenuCategory[]){
  return Object.freeze(rows.map(row=>Object.freeze({...row})));
}
function freezeProducts(rows:readonly LocalAdminMenuProduct[]){
  return Object.freeze(rows.map(row=>Object.freeze({...row})));
}
function cloneActive(snapshot:LocalAdminMenuSnapshot):LocalAdminMenuSnapshot{
  return Object.freeze({...snapshot,categories:freezeCategories(snapshot.categories),products:freezeProducts(snapshot.products)});
}
function cloneDraft(snapshot:LocalAdminMenuDraft):LocalAdminMenuDraft{
  return Object.freeze({...snapshot,categories:freezeCategories(snapshot.categories),products:freezeProducts(snapshot.products)});
}
function seedActive(revision=1):LocalAdminMenuSnapshot{
  return cloneActive({
    schemaVersion:2,
    revision,
    publishedAt:now(),
    categories:DEFAULT_CATEGORIES,
    products:DEFAULT_PRODUCTS,
  });
}
function draftFromActive(active:LocalAdminMenuSnapshot,draftRevision=1):LocalAdminMenuDraft{
  return cloneDraft({
    schemaVersion:2,
    draftRevision,
    basePublishedRevision:active.revision,
    updatedAt:now(),
    categories:active.categories,
    products:active.products,
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

function validateCollections(categoriesRaw:unknown,productsRaw:unknown){
  if(!Array.isArray(categoriesRaw)||categoriesRaw.length===0)throw new Error('ADMIN_MENU_CATEGORIES_REQUIRED');
  if(!Array.isArray(productsRaw)||productsRaw.length===0)throw new Error('ADMIN_MENU_PRODUCTS_REQUIRED');

  const categoryIds=new Set<string>();
  const categoryNames=new Set<string>();
  const categories=categoriesRaw.map((value,index)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ADMIN_MENU_CATEGORY_INVALID_'+index);
    const item=value as Record<string,unknown>;
    const category=Object.freeze({
      id:id(item.id,'ADMIN_MENU_CATEGORY_ID_INVALID_'+index),
      name:text(item.name,'ADMIN_MENU_CATEGORY_NAME_INVALID_'+index),
      position:position(item.position,'ADMIN_MENU_CATEGORY_POSITION_INVALID_'+index),
    });
    if(categoryIds.has(category.id))throw new Error('ADMIN_MENU_CATEGORY_DUPLICATE_'+category.id);
    if(categoryNames.has(category.name))throw new Error('ADMIN_MENU_CATEGORY_NAME_DUPLICATE_'+category.name);
    categoryIds.add(category.id);
    categoryNames.add(category.name);
    return category;
  });

  const productIds=new Set<string>();
  const products=productsRaw.map((value,index)=>{
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

  if(products.filter(row=>row.active).length===0)throw new Error('ADMIN_MENU_ACTIVE_PRODUCT_REQUIRED');
  return {categories,products};
}

export function validateLocalAdminMenuSnapshot(input:unknown):LocalAdminMenuSnapshot{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schemaVersion!==2)throw new Error('ADMIN_MENU_SCHEMA_UNSUPPORTED');
  const revision=Number(row.revision);
  if(!Number.isSafeInteger(revision)||revision<1)throw new Error('ADMIN_MENU_REVISION_INVALID');
  if(typeof row.publishedAt!=='string'||!Number.isFinite(Date.parse(row.publishedAt)))throw new Error('ADMIN_MENU_PUBLISHED_AT_INVALID');
  const {categories,products}=validateCollections(row.categories,row.products);
  return cloneActive({schemaVersion:2,revision,publishedAt:row.publishedAt,categories,products});
}

export function validateLocalAdminMenuDraft(input:unknown):LocalAdminMenuDraft{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_DRAFT_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schemaVersion!==2)throw new Error('ADMIN_MENU_DRAFT_SCHEMA_UNSUPPORTED');
  const draftRevision=Number(row.draftRevision);
  const basePublishedRevision=Number(row.basePublishedRevision);
  if(!Number.isSafeInteger(draftRevision)||draftRevision<1)throw new Error('ADMIN_MENU_DRAFT_REVISION_INVALID');
  if(!Number.isSafeInteger(basePublishedRevision)||basePublishedRevision<1)throw new Error('ADMIN_MENU_DRAFT_BASE_REVISION_INVALID');
  if(typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt)))throw new Error('ADMIN_MENU_DRAFT_UPDATED_AT_INVALID');
  const {categories,products}=validateCollections(row.categories,row.products);
  return cloneDraft({schemaVersion:2,draftRevision,basePublishedRevision,updatedAt:row.updatedAt,categories,products});
}

export function inspectLocalAdminMenuDraft(input:Pick<LocalAdminMenuDraft,'categories'|'products'>):LocalAdminMenuValidation{
  try{
    validateCollections(input.categories,input.products);
    return Object.freeze({ok:true,errors:Object.freeze([])});
  }catch(error){
    return Object.freeze({
      ok:false,
      errors:Object.freeze([error instanceof Error?error.message:'ADMIN_MENU_INVALID']),
    });
  }
}

function persistActive(snapshot:LocalAdminMenuSnapshot){localStorage.setItem(LOCAL_ADMIN_MENU_ACTIVE_KEY,JSON.stringify(snapshot))}
function persistDraft(snapshot:LocalAdminMenuDraft){localStorage.setItem(LOCAL_ADMIN_MENU_DRAFT_KEY,JSON.stringify(snapshot))}
function readHistory():LocalAdminMenuSnapshot[]{
  try{
    const raw=JSON.parse(localStorage.getItem(LOCAL_ADMIN_MENU_HISTORY_KEY)||'[]');
    if(!Array.isArray(raw))return[];
    return raw.map(validateLocalAdminMenuSnapshot);
  }catch{return[]}
}
function appendHistory(snapshot:LocalAdminMenuSnapshot){
  const history=[snapshot,...readHistory().filter(row=>row.revision!==snapshot.revision)].slice(0,20);
  localStorage.setItem(LOCAL_ADMIN_MENU_HISTORY_KEY,JSON.stringify(history));
}
function emitActive(){for(const listener of activeListeners)listener()}
function emitDraft(){for(const listener of draftListeners)listener()}

function migrateLegacy():LocalAdminMenuSnapshot|null{
  try{
    const raw=localStorage.getItem(LEGACY_KEY);
    if(!raw)return null;
    const legacy=JSON.parse(raw) as Record<string,unknown>;
    if(!Array.isArray(legacy.categories)||!Array.isArray(legacy.products))return null;
    const {categories,products}=validateCollections(legacy.categories,legacy.products);
    const revision=Number.isSafeInteger(legacy.revision)&&Number(legacy.revision)>=1?Number(legacy.revision):1;
    return cloneActive({
      schemaVersion:2,
      revision,
      publishedAt:typeof legacy.updatedAt==='string'&&Number.isFinite(Date.parse(legacy.updatedAt))?legacy.updatedAt:now(),
      categories,
      products,
    });
  }catch{return null}
}

export function readLocalAdminMenu():LocalAdminMenuSnapshot{
  try{
    const raw=localStorage.getItem(LOCAL_ADMIN_MENU_ACTIVE_KEY);
    if(raw)return validateLocalAdminMenuSnapshot(JSON.parse(raw));
  }catch{}
  const initial=migrateLegacy()??seedActive();
  try{
    persistActive(initial);
    appendHistory(initial);
  }catch{}
  return initial;
}

export function readLocalAdminMenuDraft():LocalAdminMenuDraft{
  const active=readLocalAdminMenu();
  try{
    const raw=localStorage.getItem(LOCAL_ADMIN_MENU_DRAFT_KEY);
    if(raw){
      const draft=validateLocalAdminMenuDraft(JSON.parse(raw));
      if(draft.basePublishedRevision===active.revision)return draft;
    }
  }catch{}
  const draft=draftFromActive(active);
  try{persistDraft(draft)}catch{}
  return draft;
}

export function saveLocalAdminMenuDraft(
  input:Pick<LocalAdminMenuDraft,'categories'|'products'>,
  expectedDraftRevision:number,
):LocalAdminMenuDraft{
  const current=readLocalAdminMenuDraft();
  if(current.draftRevision!==expectedDraftRevision)throw new Error('ADMIN_MENU_DRAFT_REVISION_CONFLICT');
  const next=validateLocalAdminMenuDraft({
    schemaVersion:2,
    draftRevision:current.draftRevision+1,
    basePublishedRevision:current.basePublishedRevision,
    updatedAt:now(),
    categories:input.categories,
    products:input.products,
  });
  persistDraft(next);
  emitDraft();
  return next;
}

export function publishLocalAdminMenu(
  expectedDraftRevision:number,
  expectedPublishedRevision:number,
):LocalAdminMenuSnapshot{
  const active=readLocalAdminMenu();
  const draft=readLocalAdminMenuDraft();
  if(active.revision!==expectedPublishedRevision)throw new Error('ADMIN_MENU_PUBLISHED_REVISION_CONFLICT');
  if(draft.draftRevision!==expectedDraftRevision)throw new Error('ADMIN_MENU_DRAFT_REVISION_CONFLICT');
  if(draft.basePublishedRevision!==active.revision)throw new Error('ADMIN_MENU_DRAFT_BASE_STALE');

  const next=validateLocalAdminMenuSnapshot({
    schemaVersion:2,
    revision:active.revision+1,
    publishedAt:now(),
    categories:draft.categories,
    products:draft.products,
  });
  persistActive(next);
  appendHistory(next);
  const rebased=draftFromActive(next,draft.draftRevision+1);
  persistDraft(rebased);
  emitActive();
  emitDraft();
  return next;
}

export function discardLocalAdminMenuDraft(expectedDraftRevision:number):LocalAdminMenuDraft{
  const current=readLocalAdminMenuDraft();
  if(current.draftRevision!==expectedDraftRevision)throw new Error('ADMIN_MENU_DRAFT_REVISION_CONFLICT');
  const next=draftFromActive(readLocalAdminMenu(),current.draftRevision+1);
  persistDraft(next);
  emitDraft();
  return next;
}

export function resetLocalAdminMenuToSeed(
  expectedDraftRevision:number,
):LocalAdminMenuDraft{
  const current=readLocalAdminMenuDraft();
  if(current.draftRevision!==expectedDraftRevision)throw new Error('ADMIN_MENU_DRAFT_REVISION_CONFLICT');
  const active=readLocalAdminMenu();
  const next=validateLocalAdminMenuDraft({
    schemaVersion:2,
    draftRevision:current.draftRevision+1,
    basePublishedRevision:active.revision,
    updatedAt:now(),
    categories:DEFAULT_CATEGORIES,
    products:DEFAULT_PRODUCTS,
  });
  persistDraft(next);
  emitDraft();
  return next;
}

export function subscribeLocalAdminMenu(listener:()=>void){
  activeListeners.add(listener);
  return()=>{activeListeners.delete(listener);};
}
export function subscribeLocalAdminMenuDraft(listener:()=>void){
  draftListeners.add(listener);
  return()=>{draftListeners.delete(listener);};
}
