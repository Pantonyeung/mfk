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