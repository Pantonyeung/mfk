export type FormalPrinterType='RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';

export interface FormalLogicalPrinter{
  id:string;
  name:string;
  type:FormalPrinterType;
  model:string;
  widthMm:number;
  active:boolean;
  capabilities:string[];
}
export interface FormalPrintTemplateSet{
  receipt:string;
  production:string;
  packing:string;
  label:string;
  showComboRelationship:boolean;
  separateFoodDrinkCount:boolean;
}

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}

export function readFormalLogicalPrinters(snapshot:Record<string,unknown>):FormalLogicalPrinter[]{
  return list(snapshot.logicalPrinters).map(value=>{
    const item=row(value);
    const type:FormalPrinterType=['RECEIPT','PRODUCTION','PACKING','LABEL'].includes(String(item.type))?item.type as FormalPrinterType:'RECEIPT';
    return{
      id:text(item.id),
      name:text(item.name),
      type,
      model:text(item.model),
      widthMm:Number.isFinite(Number(item.widthMm))?Number(item.widthMm):80,
      active:item.active!==false,
      capabilities:list(item.capabilities).map(String).filter(Boolean),
    };
  }).filter(item=>item.id);
}

export function addFormalLogicalPrinter(snapshot:Record<string,unknown>,id:string){
  const printers=list(snapshot.logicalPrinters);
  const next={id,name:'新打印用途',type:'RECEIPT',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['RECEIPT']};
  return{...snapshot,logicalPrinters:[...printers,next]};
}

export function patchFormalLogicalPrinter(snapshot:Record<string,unknown>,printerId:string,patch:Partial<Omit<FormalLogicalPrinter,'id'>>){
  let found=false;
  const printers=list(snapshot.logicalPrinters).map(value=>{
    const item=row(value);
    if(text(item.id)!==printerId)return value;
    found=true;
    const next={...item,...patch};
    if(patch.type)next.capabilities=[patch.type];
    return next;
  });
  if(!found)throw new Error('FORMAL_PRINTER_NOT_FOUND');
  return{...snapshot,logicalPrinters:printers};
}

export function removeFormalLogicalPrinter(snapshot:Record<string,unknown>,printerId:string){
  const printRules=row(snapshot.printRules);
  for(const value of Object.values(printRules)){
    const rule=row(value);
    if(list(rule.labelPrinterIds).map(String).includes(printerId))throw new Error('FORMAL_PRINTER_IN_USE');
  }
  return{...snapshot,logicalPrinters:list(snapshot.logicalPrinters).filter(value=>text(row(value).id)!==printerId)};
}

export function readFormalPrintTemplates(snapshot:Record<string,unknown>):FormalPrintTemplateSet{
  const templates=row(snapshot.printTemplates);
  return{
    receipt:text(templates.receipt),
    production:text(templates.production),
    packing:text(templates.packing),
    label:text(templates.label),
    showComboRelationship:templates.showComboRelationship!==false,
    separateFoodDrinkCount:templates.separateFoodDrinkCount!==false,
  };
}

export function patchFormalPrintTemplates(snapshot:Record<string,unknown>,patch:Partial<FormalPrintTemplateSet>){
  const templates=row(snapshot.printTemplates);
  return{...snapshot,printTemplates:{...templates,...patch}};
}

export const FORMAL_PRINT_ROUTING_GAP=Object.freeze({
  currentCanonicalShape:'printRules[productId] = receipt/production/packing/label + labelPrinterIds',
  requiredV3Shape:'per-output Logical Printer IDs + per-output Template IDs',
  status:'SCHEMA_SEAM_REQUIRED',
  physicalBindingAuthority:'SMT_ONSITE',
});
