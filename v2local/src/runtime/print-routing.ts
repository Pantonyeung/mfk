import type {RasterLabelSpec} from './label-bitmap.ts';
import {productLabelContent,productionBlockLines,verticalSelectionLines} from './print-content.ts';

export type PrintRole='顧客小票'|'製作單'|'打包單'|'產品標籤'|'袋標籤';

export interface PrintBinding{
  readonly id:string;
  readonly routeKey:string;
  readonly name:string;
  readonly model:string;
  readonly role:PrintRole;
  readonly host:string;
  readonly port:number;
  readonly capability:'receipt-80mm/kitchen'|'label-58mm';
  readonly encoding:'gb18030'|'big5'|'utf-8';
  readonly logicalPrinterId?:string;
  readonly productIds?:readonly string[];
}

export interface PrintableOrder{
  readonly id:string;
  readonly display:string;
  readonly createdAt:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly sourceLabel:string;
  readonly providerPickupCode?:string;
  readonly diningTableLabel?:string;
  readonly orderRemark?:string;
  readonly utensilPreference?:'需要'|'不需要';
  readonly items:readonly {
    readonly id:string;
    readonly name:string;
    readonly qty:number;
    readonly unitMinor:number;
    readonly serviceMode?:'takeaway'|'dine-in';
    readonly productCode?:string;
    readonly detail?:string;
  }[];
}

export interface PlannedPrintJob{
  readonly id:string;
  readonly role:PrintRole;
  readonly binding:PrintBinding;
  readonly payload:string;
  readonly renderMode?:'text'|'tsc-bitmap'|'escpos-raster';
  readonly labelSpec?:RasterLabelSpec;
  readonly ticketKind?:'receipt'|'production'|'packing'|'dining-table';
  readonly ticketOrder?:PrintableOrder;
  readonly cutAfter?:boolean;
  readonly kickDrawer?:boolean;
  readonly beepAfter?:boolean;
}

export type PrintPlanMode='standard'|'dining-initial';

export interface TscBitmapJobBatch{
  readonly binding:PrintBinding;
  readonly jobs:readonly PlannedPrintJob[];
}

export interface PrintRuntimeRule{
  readonly receipt:boolean;
  readonly production:boolean;
  readonly packing:boolean;
  readonly label:boolean;
  readonly dineIn:boolean;
  readonly takeaway:boolean;
  readonly labelPrinterIds:readonly string[];
}
export interface PrintRuntimeConfig{
  readonly logicalPrinters:readonly {readonly id:string;readonly type:'RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';readonly active:boolean}[];
  readonly productRules:Readonly<Record<string,PrintRuntimeRule>>;
}
const DEFAULT_RULE:PrintRuntimeRule=Object.freeze({
  receipt:true,production:true,packing:true,label:true,dineIn:true,takeaway:true,labelPrinterIds:Object.freeze([]),
});

export function groupTscBitmapJobsByPhysicalPrinter(plan:readonly PlannedPrintJob[]):readonly TscBitmapJobBatch[]{
  const groups=new Map<string,{binding:PrintBinding;jobs:PlannedPrintJob[]}>();
  for(const job of plan){
    if(job.renderMode!=='tsc-bitmap'||!job.labelSpec)continue;
    const host=String(job.binding.host||'').trim().toLowerCase();
    const port=Number(job.binding.port)||9100;
    const key=host+':'+port;
    const existing=groups.get(key);
    if(existing)existing.jobs.push(job);
    else groups.set(key,{binding:job.binding,jobs:[job]});
  }
  return Object.freeze([...groups.values()].map(group=>Object.freeze({
    binding:group.binding,
    jobs:Object.freeze([...group.jobs]),
  })));
}

const money=(minor:number)=>'$'+(Math.max(0,Number(minor)||0)/100).toFixed(2);
const clean=(value:string)=>String(value??'').replace(/[\r\n]+/g,' ').trim();

const ESC='\x1b';
const GS='\x1d';
const INIT=ESC+'@';
const LEFT=ESC+'a'+String.fromCharCode(0);
const CENTER=ESC+'a'+String.fromCharCode(1);
const BOLD_ON=ESC+'E'+String.fromCharCode(1);
const BOLD_OFF=ESC+'E'+String.fromCharCode(0);
const REVERSE_ON=GS+'B'+String.fromCharCode(1);
const REVERSE_OFF=GS+'B'+String.fromCharCode(0);
const NORMAL=GS+'!'+String.fromCharCode(0);
const DOUBLE=GS+'!'+String.fromCharCode(0x11);
const TRIPLE=GS+'!'+String.fromCharCode(0x22);
const RULE='------------------------------------------\n';

function hktDateTime(iso:string){
  const date=new Date(iso);
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Hong_Kong',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,
  }).formatToParts(date);
  const pick=(type:string)=>parts.find(part=>part.type===type)?.value??'';
  return pick('year')+'-'+pick('month')+'-'+pick('day')+' '+pick('hour')+':'+pick('minute')+':'+pick('second');
}

function orderService(order:PrintableOrder){
  const modes=new Set(order.items.map(item=>item.serviceMode).filter(Boolean));
  if(modes.size===1)return modes.has('dine-in')?'堂食':'外賣';
  if(modes.size>1)return '堂食／外賣';
  return '外賣';
}

function itemBaseName(item:PrintableOrder['items'][number]){
  const parts=clean(item.name).split('｜');
  return parts.shift()||clean(item.name);
}
function itemIdentity(item:PrintableOrder['items'][number]){
  const code=clean(item.productCode??'');
  return (code?code+'. ':'')+itemBaseName(item);
}
function itemDetail(item:PrintableOrder['items'][number]){
  const explicit=clean(item.detail??'');
  if(explicit&&explicit!==clean(item.name))return explicit;
  const parts=clean(item.name).split('｜');
  parts.shift();
  return parts.join(' · ');
}
function totalUnits(order:PrintableOrder){
  return order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
}
function footer(){
  return CENTER+NORMAL+'*** 謝謝！***\n'
    +'— 手作・真食・更有味 —\n'
    +'More Fun Kitchen\n'+LEFT;
}
function brand(){
  return CENTER+BOLD_ON+DOUBLE+'More Fun  磨飯\n'+NORMAL+BOLD_OFF
    +'手作・真食・更有味\n'+LEFT;
}
function reverseBlock(label:string,value:string,size=DOUBLE){
  return CENTER+REVERSE_ON+BOLD_ON+size+' '+clean(label)+' '+clean(value)+' \n'
    +NORMAL+BOLD_OFF+REVERSE_OFF+LEFT;
}

export function renderCustomerReceiptTicket(order:PrintableOrder){
  const rows=order.items.map(item=>{
    const details=verticalSelectionLines(itemDetail(item)).map(line=>'  '+line+'\n').join('');
    return BOLD_ON+itemIdentity(item)+BOLD_OFF+'\n'
      +details
      +'  '+item.qty+'份   '+money(item.unitMinor*item.qty)+'\n';
  }).join('');
  return INIT
    +brand()
    +RULE
    +CENTER+BOLD_ON+DOUBLE+'客戶收據\n'+NORMAL+BOLD_OFF+LEFT
    +RULE
    +'訂單編號 '+clean(order.display)+'\n'
    +'下單時間 '+hktDateTime(order.createdAt)+'\n'
    +'來源 '+clean(order.sourceLabel)+' / '+orderService(order)+'\n'
    +RULE
    +rows
    +RULE
    +BOLD_ON+'總數量 '+totalUnits(order)+'份\n'+BOLD_OFF
    +'付款方式 '+clean(order.paymentLabel)+'\n'
    +BOLD_ON+DOUBLE+'合計 '+money(order.totalMinor)+'\n'+NORMAL+BOLD_OFF
    +RULE
    +CENTER+'請核對餐點 / 謝謝光臨\n'
    +'*** 謝謝！***\n'
    +'More Fun Kitchen\n'+LEFT
    +'\n\n';
}

export function renderDiningTableTicket(order:PrintableOrder){
  const rows=order.items.map(item=>{
    const details=verticalSelectionLines(itemDetail(item)).map(line=>'  '+line+'\n').join('');
    return BOLD_ON+itemIdentity(item)+BOLD_OFF+'\n'
      +details
      +'  '+item.qty+'份\n';
  }).join('');
  return INIT
    +brand()
    +RULE
    +CENTER+BOLD_ON+DOUBLE+'堂食枱單\n'+NORMAL+BOLD_OFF+LEFT
    +RULE
    +'枱號 '+clean(order.diningTableLabel??'未指定')+'\n'
    +'訂單編號 '+clean(order.display)+'\n'
    +'下單時間 '+hktDateTime(order.createdAt)+'\n'
    +RULE
    +rows
    +RULE
    +BOLD_ON+'總數量 '+totalUnits(order)+'份\n'+BOLD_OFF
    +'訂單總額 '+money(order.totalMinor)+'\n'
    +BOLD_ON+'付款狀態 未結清\n'+BOLD_OFF
    +CENTER+'*** 此枱單不是付款收據 ***\n'+LEFT
    +RULE
    +'\n\n';
}

export function renderProductionTicket(order:PrintableOrder){
  const blocks=order.items.map(item=>{
    const details=productionBlockLines(itemDetail(item)).map(line=>line+'\n').join('');
    return BOLD_ON+DOUBLE+itemIdentity(item)+'\n'+NORMAL+BOLD_OFF
      +details
      +'數量 '+item.qty+'份\n'
      +RULE;
  }).join('');
  return INIT
    +CENTER+BOLD_ON+TRIPLE+orderService(order)+'\n'+NORMAL+BOLD_OFF+LEFT
    +RULE
    +'單號 '+clean(order.display)+'\n'
    +'時間 '+hktDateTime(order.createdAt)+'\n'
    +RULE
    +blocks
    +(clean(order.orderRemark??'')?'備註 '+clean(order.orderRemark??'')+'\n':'')
    +RULE
    +'\n\n';
}

export function renderPackingTicket(order:PrintableOrder){
  const rows=order.items.map(item=>{
    const details=verticalSelectionLines(itemDetail(item)).map(line=>line+'\n').join('');
    return BOLD_ON+itemIdentity(item)+BOLD_OFF+'\n'
      +details
      +'數量 '+item.qty+'份\n';
  }).join('');
  return INIT
    +brand()
    +RULE
    +CENTER+BOLD_ON+DOUBLE+(orderService(order)==='堂食'?'堂食打包單':'外賣打包單')+'\n'
    +NORMAL+(orderService(order)==='堂食'?'DINE IN':'TAKE AWAY')+'\n'+BOLD_OFF+LEFT
    +RULE
    +'訂單編號 '+clean(order.display)+'\n'
    +'下單時間 '+hktDateTime(order.createdAt)+'\n'
    +RULE
    +rows
    +RULE
    +BOLD_ON+DOUBLE+'總數量 '+totalUnits(order)+'件\n'+NORMAL+BOLD_OFF
    +'[ ] 餐具   [ ] 飲品   [ ] 醬汁\n'
    +RULE
    +'付款方式 '+clean(order.paymentLabel)+'\n'
    +'金額 '+money(order.totalMinor)+'\n'
    +RULE
    +CENTER+'請確認餐點後交予顧客 謝謝！\n'
    +'More Fun Kitchen\n'+LEFT
    +'\n\n';
}

function productMatchesBinding(productId:string,binding:PrintBinding){
  if(binding.productIds===undefined)return true;
  return binding.productIds.map(String).includes(String(productId));
}

function derivedLogicalPrinterId(binding:PrintBinding){
  if(binding.logicalPrinterId?.trim())return binding.logicalPrinterId.trim();
  if(binding.routeKey==='logical.receipt')return 'logical-receipt';
  if(binding.routeKey==='logical.production')return 'logical-production';
  if(binding.routeKey==='logical.packing')return 'logical-packing';
  if(binding.routeKey==='logical.product-label.riceball')return 'logical-riceball-label';
  if(binding.routeKey==='logical.product-label.takeaway')return 'logical-takeaway-label';
  return '';
}
function logicalBindingEnabled(binding:PrintBinding,config?:PrintRuntimeConfig){
  if(!config||config.logicalPrinters.length===0)return true;
  const logicalId=derivedLogicalPrinterId(binding);
  if(!logicalId)return binding.role==='袋標籤';
  return Boolean(config.logicalPrinters.find(row=>row.id===logicalId&&row.active));
}
function printRule(productId:string,config?:PrintRuntimeConfig){
  return config?.productRules[productId]??DEFAULT_RULE;
}
function serviceAllowed(item:PrintableOrder['items'][number],rule:PrintRuntimeRule){
  if(item.serviceMode==='dine-in')return rule.dineIn;
  if(item.serviceMode==='takeaway')return rule.takeaway;
  return true;
}
function roleItems(order:PrintableOrder,key:'receipt'|'production'|'packing',config?:PrintRuntimeConfig){
  if(!config||Object.keys(config.productRules).length===0)return order.items;
  return order.items.filter(item=>{
    const rule=printRule(String(item.id),config);
    return rule[key]&&serviceAllowed(item,rule);
  });
}
function preferredDefaultLabelBinding(bindings:readonly PrintBinding[]){
  return bindings.find(binding=>derivedLogicalPrinterId(binding)==='logical-takeaway-label')
    ??bindings.find(binding=>binding.routeKey==='logical.product-label.takeaway');
}
function labelAllowed(item:PrintableOrder['items'][number],binding:PrintBinding,config?:PrintRuntimeConfig,allLabelBindings:readonly PrintBinding[]=[]){
  const productId=String(item.id);
  const explicit=config?.productRules[productId];
  const rule=explicit??DEFAULT_RULE;
  if(!rule.label||!serviceAllowed(item,rule))return false;
  const logicalId=derivedLogicalPrinterId(binding);
  if(rule.labelPrinterIds.length>0)return Boolean(logicalId&&rule.labelPrinterIds.includes(logicalId));
  if(productMatchesBinding(productId,binding))return true;
  const preferred=preferredDefaultLabelBinding(allLabelBindings);
  return Boolean(preferred&&preferred.id===binding.id);
}
function withItems(order:PrintableOrder,items:PrintableOrder['items']):PrintableOrder{
  return {...order,items};
}

function buildGlobalProductLabelUnits(order:PrintableOrder,bindings:readonly PrintBinding[],config?:PrintRuntimeConfig){
  const labelBindings=bindings.filter(binding=>binding.role==='產品標籤');
  const units:{item:PrintableOrder['items'][number];unit:number;pieceIndex:number}[]=[];
  let pieceIndex=0;
  for(const item of order.items){
    if(!labelBindings.some(binding=>labelAllowed(item,binding,config,labelBindings)))continue;
    const qty=Math.max(0,Math.floor(Number(item.qty)||0));
    for(let unit=1;unit<=qty;unit++){
      pieceIndex+=1;
      units.push({item,unit,pieceIndex});
    }
  }
  return units;
}

export function buildOrderPrintPlan(order:PrintableOrder,bindings:readonly PrintBinding[],config?:PrintRuntimeConfig,mode:PrintPlanMode='standard'):readonly PlannedPrintJob[]{
  const active=bindings.filter(binding=>String(binding.host||'').trim()&&Number(binding.port)>0&&logicalBindingEnabled(binding,config));
  const productLabelUnits=buildGlobalProductLabelUnits(order,active,config);
  const globalProductLabelTotal=productLabelUnits.length;
  const jobs:PlannedPrintJob[]=[];
  for(const binding of active){
    if(binding.role==='顧客小票'){
      const items=roleItems(order,'receipt',config);
      if(items.length<1)continue;
      const routed=withItems(order,items);
      if(mode==='dining-initial'){
        jobs.push({
          id:order.id+':dining-table',
          role:binding.role,
          binding,
          payload:renderDiningTableTicket(routed),
          renderMode:'escpos-raster',
          ticketKind:'dining-table',
          ticketOrder:routed,
          cutAfter:true,
          kickDrawer:false,
          beepAfter:true,
        });
      }else{
        jobs.push({id:order.id+':receipt',role:binding.role,binding,payload:renderCustomerReceiptTicket(routed),renderMode:'escpos-raster',ticketKind:'receipt',ticketOrder:routed,cutAfter:true,kickDrawer:/\bCASH\b/i.test(order.paymentLabel),beepAfter:true});
      }
      continue;
    }
    if(binding.role==='製作單'){
      const items=roleItems(order,'production',config);
      if(items.length<1)continue;
      jobs.push({id:order.id+':production',role:binding.role,binding,payload:renderProductionTicket(withItems(order,items)),renderMode:'escpos-raster',ticketKind:'production',ticketOrder:withItems(order,items),cutAfter:true,beepAfter:true});
      continue;
    }
    if(binding.role==='打包單'){
      const items=roleItems(order,'packing',config);
      if(items.length<1)continue;
      jobs.push({id:order.id+':packing',role:binding.role,binding,payload:renderPackingTicket(withItems(order,items)),renderMode:'escpos-raster',ticketKind:'packing',ticketOrder:withItems(order,items),cutAfter:true,beepAfter:true});
      continue;
    }
    if(binding.role==='袋標籤'){
      const total=order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
      const labelSpec:RasterLabelSpec={
        kind:'bag',
        orderCode:clean(order.display),
        primaryText:'共 '+total+' 件',
        secondaryText:'共 '+total+' 件',
        pickupCode:clean(order.providerPickupCode??order.display),
      };
      jobs.push({
        id:order.id+':'+binding.id+':bag-label',
        role:binding.role,
        binding,
        payload:'LABEL '+labelSpec.orderCode+' '+labelSpec.primaryText,
        renderMode:'tsc-bitmap',
        labelSpec,
      });
      continue;
    }
    if(binding.role==='產品標籤'){
      const allLabelBindings=active.filter(row=>row.role==='產品標籤');
      const routeUnits=productLabelUnits.filter(unit=>labelAllowed(unit.item,binding,config,allLabelBindings));
      if(routeUnits.length<1)continue;
      for(const unit of routeUnits){
        const labelContent=productLabelContent({
          productName:itemBaseName(unit.item),
          detail:itemDetail(unit.item),
        });
        const labelSpec:RasterLabelSpec={
          kind:'product',
          orderCode:clean(order.display),
          primaryText:labelContent.title,
          pieceLabel:unit.pieceIndex+'/'+globalProductLabelTotal,
          ...(labelContent.bodyLines.length?{secondaryLines:labelContent.bodyLines}:{}),
        };
        jobs.push({
          id:order.id+':'+binding.id+':product-label:'+unit.item.id+':'+unit.unit,
          role:binding.role,
          binding,
          payload:'LABEL '+labelSpec.orderCode+' '+labelSpec.primaryText+' '+labelSpec.pieceLabel,
          renderMode:'tsc-bitmap',
          labelSpec,
        });
      }
    }
  }
  return Object.freeze(jobs.map(job=>Object.freeze(job)));
}
