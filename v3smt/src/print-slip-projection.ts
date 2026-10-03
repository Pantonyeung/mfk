import {clonePrintTemplateJson,printTemplateRecord,printTemplateText,type PrintTemplateJson} from '../../contracts/print-template-catalog-v1.ts';

export interface PrintSlipCategory{readonly id:string;readonly name:string;}
/** Values are canonical physical facts, not inferred from price, display name, or combo ancestry. */
export interface PrintSlipSourceLine{
  readonly lineId:string;
  readonly productId:string;
  readonly productName:string;
  readonly categoryId:string|null;
  /** Already-expanded physical quantity; a combo parent's quantity is never multiplied here. */
  readonly quantity:number;
  readonly role:'PHYSICAL_ITEM'|'COMBO_PARENT'|'NON_PHYSICAL';
  readonly parentLineId?:string;
  readonly variantIdentity:string;
  readonly configuration:Readonly<Record<string,PrintTemplateJson>>;
  readonly isDrink:boolean;
}
export interface PrintSlipCategoryGroup{
  readonly categoryId:string|null;
  readonly categoryName:string;
  readonly unknownCategory:boolean;
  readonly lines:readonly PrintSlipSourceLine[];
}
export interface PrintSlipProductSummary{
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly variants:readonly Readonly<{variantIdentity:string;quantity:number;configuration:PrintSlipSourceLine['configuration'];sourceLineIds:readonly string[]}>[];
}
export type PrintSlipSummary=
  |Readonly<{kind:'CATEGORY';categories:readonly Readonly<{categoryId:string|null;categoryName:string;quantity:number}>[];drinksQuantity:number}>
  |Readonly<{kind:'PRODUCT';products:readonly PrintSlipProductSummary[];drinksQuantity:number}>;
export interface PrintSlipProjection{
  readonly schema:'mfp.print-slip-projection.v1';
  readonly kind:'PRODUCTION'|'PACKING';
  readonly quantitySummaryEnabled:boolean;
  readonly categories:readonly PrintSlipCategory[];
  readonly sourceLines:readonly PrintSlipSourceLine[];
  readonly excludedLineIds:readonly string[];
  readonly groups:readonly PrintSlipCategoryGroup[];
  readonly summary:PrintSlipSummary|null;
}
function count(sum:number,quantity:number){const next=sum+quantity;if(!Number.isSafeInteger(next))throw new Error('PRINT_SLIP_QUANTITY_OVERFLOW');return next;}
function readLines(input:readonly PrintSlipSourceLine[]){
  if(!Array.isArray(input))throw new Error('PRINT_SLIP_LINES_REQUIRED');
  const seen=new Set<string>();
  const lines=input.map(value=>{
    const row=printTemplateRecord(value,'PRINT_SLIP_LINE_INVALID');
    const lineId=printTemplateText(row.lineId,'PRINT_SLIP_LINE_ID_REQUIRED');
    if(seen.has(lineId))throw new Error('PRINT_SLIP_LINE_ID_DUPLICATE');seen.add(lineId);
    if(typeof row.role!=='string'||!['PHYSICAL_ITEM','COMBO_PARENT','NON_PHYSICAL'].includes(row.role))throw new Error('PRINT_SLIP_PHYSICAL_ROLE_REQUIRED');
    if(row.role==='PHYSICAL_ITEM'){
      printTemplateText(row.variantIdentity,'PRINT_SLIP_VARIANT_ID_REQUIRED');
      printTemplateText(row.productId,'PRINT_SLIP_PRODUCT_ID_REQUIRED');
      printTemplateText(row.productName,'PRINT_SLIP_PRODUCT_NAME_REQUIRED');
      if(row.categoryId!==null)printTemplateText(row.categoryId,'PRINT_SLIP_CATEGORY_ID_REQUIRED');
      if(!Number.isSafeInteger(row.quantity)||Number(row.quantity)<1)throw new Error('PRINT_SLIP_PHYSICAL_QUANTITY_REQUIRED');
      if(typeof row.isDrink!=='boolean')throw new Error('PRINT_SLIP_DRINK_ROLE_REQUIRED');
      printTemplateRecord(row.configuration,'PRINT_SLIP_VARIANT_CONFIGURATION_REQUIRED');
    }
    return clonePrintTemplateJson(row) as unknown as PrintSlipSourceLine;
  });
  for(const line of lines){
    if(line.parentLineId!==undefined){
      const parent=lines.find(other=>other.lineId===line.parentLineId);
      if(!parent||parent.role!=='COMBO_PARENT'||parent.lineId===line.lineId)throw new Error('PRINT_SLIP_COMBO_PARENT_INVALID');
    }
  }
  return Object.freeze(lines);
}
function productSummaries(lines:readonly PrintSlipSourceLine[]):readonly PrintSlipProductSummary[]{
  const products=new Map<string,{productId:string;productName:string;quantity:number;categoryId:string|null;isDrink:boolean;variants:Map<string,{variantIdentity:string;quantity:number;configuration:PrintSlipSourceLine['configuration'];sourceLineIds:string[]}>}>();
  for(const line of lines){
    let product=products.get(line.productId);
    if(!product){product={productId:line.productId,productName:line.productName,quantity:0,categoryId:line.categoryId,isDrink:line.isDrink,variants:new Map()};products.set(line.productId,product);}
    if(product.categoryId!==line.categoryId||product.isDrink!==line.isDrink)throw new Error('PRINT_SLIP_PRODUCT_IDENTITY_CONFLICT');
    let variant=product.variants.get(line.variantIdentity);
    if(!variant){variant={variantIdentity:line.variantIdentity,quantity:0,configuration:line.configuration,sourceLineIds:[]};product.variants.set(line.variantIdentity,variant);}
    if(JSON.stringify(variant.configuration)!==JSON.stringify(line.configuration))throw new Error('PRINT_SLIP_VARIANT_IDENTITY_CONFLICT');
    variant.quantity=count(variant.quantity,line.quantity);variant.sourceLineIds.push(line.lineId);
    product.quantity=count(product.quantity,line.quantity);
  }
  return Object.freeze([...products.values()].map(p=>Object.freeze({productId:p.productId,productName:p.productName,quantity:p.quantity,variants:Object.freeze([...p.variants.values()].map(v=>Object.freeze({...v,sourceLineIds:Object.freeze(v.sourceLineIds)})))})));
}
/** Pure, immutable presentation snapshot. No routing, pricing, order mutation, renderer, or queue. */
export function projectPrintSlip(input:Readonly<{kind:'PRODUCTION'|'PACKING';categories:readonly PrintSlipCategory[];lines:readonly PrintSlipSourceLine[];quantitySummaryEnabled:boolean}>):PrintSlipProjection{
  if(!['PRODUCTION','PACKING'].includes(input.kind)||typeof input.quantitySummaryEnabled!=='boolean')throw new Error('PRINT_SLIP_POLICY_REQUIRED');
  if(!Array.isArray(input.categories))throw new Error('PRINT_SLIP_CATEGORIES_REQUIRED');
  const categories=Object.freeze(input.categories.map(row=>Object.freeze({id:printTemplateText(row.id,'PRINT_SLIP_CATEGORY_ID_REQUIRED'),name:printTemplateText(row.name,'PRINT_SLIP_CATEGORY_NAME_REQUIRED')})));
  if(new Set(categories.map(c=>c.id)).size!==categories.length)throw new Error('PRINT_SLIP_CATEGORY_ID_DUPLICATE');
  const sourceLines=readLines(input.lines);
  const physical=sourceLines.filter(l=>l.role==='PHYSICAL_ITEM');
  const grouped=new Map<string|null,PrintSlipSourceLine[]>();
  for(const line of physical){const group=grouped.get(line.categoryId)??[];group.push(line);grouped.set(line.categoryId,group);}
  const orderedIds:(string|null)[]=[...categories.map(c=>c.id).filter(id=>grouped.has(id)),...[...grouped.keys()].filter(id=>!categories.some(c=>c.id===id))];
  const groups=Object.freeze(orderedIds.map(categoryId=>{const category=categories.find(c=>c.id===categoryId);return Object.freeze({categoryId,categoryName:category?.name??'未分類',unknownCategory:!category,lines:Object.freeze(grouped.get(categoryId)!)});}));
  // Validate identities even when summary is off; missing physical facts never become guessed totals.
  const products=productSummaries(groups.flatMap(g=>g.lines));
  const drinksQuantity=physical.filter(l=>l.isDrink).reduce((sum,l)=>count(sum,l.quantity),0);
  const summary:PrintSlipSummary|null=!input.quantitySummaryEnabled?null:input.kind==='PRODUCTION'
    ?Object.freeze({kind:'PRODUCT',products,drinksQuantity})
    :Object.freeze({kind:'CATEGORY',categories:Object.freeze(groups.map(g=>Object.freeze({categoryId:g.categoryId,categoryName:g.categoryName,quantity:g.lines.reduce((sum,l)=>count(sum,l.quantity),0)}))),drinksQuantity});
  return Object.freeze({schema:'mfp.print-slip-projection.v1',kind:input.kind,quantitySummaryEnabled:input.quantitySummaryEnabled,categories,sourceLines,excludedLineIds:Object.freeze(sourceLines.filter(l=>l.role!=='PHYSICAL_ITEM').map(l=>l.lineId)),groups,summary});
}
