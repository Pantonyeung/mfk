import {readAdminSnapshotSection} from './admin-config-sync.ts';

export interface SmtDiningTableConfig{
  readonly id:string;
  readonly name:string;
  readonly active:boolean;
  readonly sortOrder:number;
}

export interface SmtStoreSettings{
  readonly storeName:string;
  readonly storeCode:string;
  readonly currency:string;
  readonly timezone:string;
  readonly lateArrivalMinutes:number;
  readonly fulfillmentMinutes:number;
  readonly archiveHours:number;
  readonly reminderAfterMinutes:number;
  readonly reminderIntervalMinutes:number;
  readonly repeatReminder:boolean;
  readonly timeoutPriority:'NORMAL'|'HIGH'|'URGENT';
  readonly dineInEnabled:boolean;
  readonly takeawayEnabled:boolean;
  readonly diningTables:readonly SmtDiningTableConfig[];
  readonly paymentRefs:readonly string[];
  readonly printRefs:readonly string[];
  readonly channelRefs:readonly string[];
}

export interface SmtCapacityConfig{
  readonly dailyLimit?:number;
  readonly warningAt:number;
  readonly hardStopConfigured:boolean;
  readonly note:string;
}

export interface SmtFrontlinePresentation{
  readonly headline:string;
  readonly eyebrow:string;
  readonly body:string;
  readonly ctaLabel:string;
  readonly showPromos:boolean;
  readonly showCategories:boolean;
  readonly showImages:boolean;
  readonly showDescriptions:boolean;
  readonly tabletColumns:number;
  readonly mobileColumns:number;
  readonly quickProductIds:readonly string[];
}

export interface SmtQuickReason{
  readonly id:string;
  readonly scope:'TENDER_CORRECTION'|'REPRINT'|'CANCEL'|'REFUND';
  readonly label:string;
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function text(value:unknown,fallback=''){return typeof value==='string'?value.trim():fallback;}
function number(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function bool(value:unknown,fallback=false){return typeof value==='boolean'?value:fallback;}
function strings(value:unknown){
  return Array.isArray(value)?value.map(item=>String(item).trim()).filter(Boolean):[];
}

export function readSmtStoreSettings():SmtStoreSettings{
  const row=record(readAdminSnapshotSection('storeSettings'));
  const priority=String(row.timeoutPriority);
  return Object.freeze({
    storeName:text(row.storeName,'磨飯'),
    storeCode:text(row.storeCode,'MF01'),
    currency:text(row.currency,'HKD'),
    timezone:text(row.timezone,'Asia/Hong_Kong'),
    lateArrivalMinutes:Math.max(0,number(row.lateArrivalMinutes,15)),
    fulfillmentMinutes:Math.max(0,number(row.fulfillmentMinutes,20)),
    archiveHours:Math.max(1,number(row.archiveHours,24)),
    reminderAfterMinutes:Math.max(0,number(row.reminderAfterMinutes,5)),
    reminderIntervalMinutes:Math.max(1,number(row.reminderIntervalMinutes,5)),
    repeatReminder:bool(row.repeatReminder,true),
    timeoutPriority:priority==='URGENT'?'URGENT':priority==='NORMAL'?'NORMAL':'HIGH',
    dineInEnabled:row.dineInEnabled===undefined?true:bool(row.dineInEnabled,true),
    takeawayEnabled:row.takeawayEnabled===undefined?true:bool(row.takeawayEnabled,true),
    diningTables:Object.freeze((Array.isArray(row.diningTables)?row.diningTables:[]).flatMap((raw,index)=>{
      const item=record(raw);
      const id=text(item.id);
      const name=text(item.name);
      if(!id||!name||item.active===false)return [];
      return [Object.freeze({
        id,
        name,
        active:true,
        sortOrder:Math.max(1,Math.floor(number(item.sortOrder,index+1))),
      })];
    }).sort((a,b)=>a.sortOrder-b.sortOrder)),
    paymentRefs:Object.freeze(strings(row.paymentRefs)),
    printRefs:Object.freeze(strings(row.printRefs)),
    channelRefs:Object.freeze(strings(row.channelRefs)),
  });
}

export function readSmtCapacityConfig():SmtCapacityConfig{
  const row=record(readAdminSnapshotSection('capacity'));
  const limitText=text(row.dailyLimit);
  const parsed=Number(limitText);
  const dailyLimit=Number.isFinite(parsed)&&parsed>0?Math.floor(parsed):undefined;
  return Object.freeze({
    ...(dailyLimit?{dailyLimit}:{}),
    warningAt:Math.min(100,Math.max(1,Math.floor(number(row.warningAt,80)))),
    hardStopConfigured:bool(row.hardStop,false),
    note:text(row.note),
  });
}

export function readSmtFrontlinePresentation():SmtFrontlinePresentation{
  const presentation=record(readAdminSnapshotSection('presentation'));
  const row=record(presentation.frontline??presentation.FRONTLINE);
  return Object.freeze({
    headline:text(row.headline),
    eyebrow:text(row.eyebrow),
    body:text(row.body),
    ctaLabel:text(row.ctaLabel),
    showPromos:row.showPromos===undefined?true:bool(row.showPromos,true),
    showCategories:row.showCategories===undefined?true:bool(row.showCategories,true),
    showImages:row.showImages===undefined?true:bool(row.showImages,true),
    showDescriptions:row.showDescriptions===undefined?true:bool(row.showDescriptions,true),
    tabletColumns:Math.min(6,Math.max(2,Math.floor(number(row.tabletColumns,4)))),
    mobileColumns:Math.min(3,Math.max(1,Math.floor(number(row.mobileColumns,2)))),
    quickProductIds:Object.freeze(strings(row.quickProductIds)),
  });
}

export function readSmtQuickReasons(scope:SmtQuickReason['scope']):readonly SmtQuickReason[]{
  const rows=readAdminSnapshotSection<unknown[]>('quickReasons');
  if(!Array.isArray(rows))return Object.freeze([]);
  return Object.freeze(rows.flatMap(raw=>{
    const row=record(raw);
    const id=text(row.id);
    const label=text(row.label);
    if(!id||!label||row.active===false||String(row.scope)!==scope)return [];
    return [Object.freeze({id,scope,label}) as SmtQuickReason];
  }));
}

export function capacityNoticeForCount(currentCount:number){
  const config=readSmtCapacityConfig();
  if(!config.dailyLimit)return null;
  const ratio=config.dailyLimit>0?currentCount/config.dailyLimit:0;
  const warning=ratio*100>=config.warningAt;
  if(!warning)return null;
  return Object.freeze({
    currentCount,
    dailyLimit:config.dailyLimit,
    warningAt:config.warningAt,
    hardStopConfigured:config.hardStopConfigured,
    note:config.note,
  });
}


export interface SmtLogicalPrinterConfig{
  readonly id:string;
  readonly name:string;
  readonly type:'RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';
  readonly active:boolean;
}
export interface SmtProductPrintRule{
  readonly receipt:boolean;
  readonly production:boolean;
  readonly packing:boolean;
  readonly label:boolean;
  readonly dineIn:boolean;
  readonly takeaway:boolean;
  readonly labelPrinterIds:readonly string[];
}
export interface SmtPrintConfig{
  readonly logicalPrinters:readonly SmtLogicalPrinterConfig[];
  readonly productRules:Readonly<Record<string,SmtProductPrintRule>>;
  readonly templateSpec:Readonly<Record<string,unknown>>;
}

const DEFAULT_PRINT_RULE:SmtProductPrintRule=Object.freeze({
  receipt:true,production:true,packing:true,label:false,dineIn:true,takeaway:true,labelPrinterIds:Object.freeze([]),
});

export function readSmtPrintConfig():SmtPrintConfig{
  const rawPrinters=readAdminSnapshotSection<unknown[]>('logicalPrinters');
  const logicalPrinters=Array.isArray(rawPrinters)?rawPrinters.flatMap(raw=>{
    const row=record(raw);
    const type=String(row.type);
    const id=text(row.id);
    if(!id||!['RECEIPT','PRODUCTION','PACKING','LABEL'].includes(type))return [];
    return [Object.freeze({
      id,
      name:text(row.name,id),
      type:type as SmtLogicalPrinterConfig['type'],
      active:row.active!==false,
    })];
  }):[];

  const rawRules=record(readAdminSnapshotSection('printRules'));
  const productRules:Record<string,SmtProductPrintRule>={};
  for(const [productId,raw] of Object.entries(rawRules)){
    const row=record(raw);
    productRules[productId]=Object.freeze({
      receipt:row.receipt===undefined?DEFAULT_PRINT_RULE.receipt:bool(row.receipt,true),
      production:row.production===undefined?DEFAULT_PRINT_RULE.production:bool(row.production,true),
      packing:row.packing===undefined?DEFAULT_PRINT_RULE.packing:bool(row.packing,true),
      label:row.label===undefined?DEFAULT_PRINT_RULE.label:bool(row.label,false),
      dineIn:row.dineIn===undefined?DEFAULT_PRINT_RULE.dineIn:bool(row.dineIn,true),
      takeaway:row.takeaway===undefined?DEFAULT_PRINT_RULE.takeaway:bool(row.takeaway,true),
      labelPrinterIds:Object.freeze(strings(row.labelPrinterIds)),
    });
  }
  return Object.freeze({
    logicalPrinters:Object.freeze(logicalPrinters),
    productRules:Object.freeze(productRules),
    templateSpec:Object.freeze(record(readAdminSnapshotSection('printTemplates'))),
  });
}

export function printRuleForProduct(productId:string,config=readSmtPrintConfig()){
  return config.productRules[productId]??DEFAULT_PRINT_RULE;
}
