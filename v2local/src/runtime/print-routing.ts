import type {RasterLabelSpec} from './label-bitmap.ts';

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
  readonly items:readonly {readonly id:string;readonly name:string;readonly qty:number;readonly unitMinor:number;readonly serviceMode?:'takeaway'|'dine-in'}[];
}

export interface PlannedPrintJob{
  readonly id:string;
  readonly role:PrintRole;
  readonly binding:PrintBinding;
  readonly payload:string;
  readonly renderMode?:'text'|'tsc-bitmap';
  readonly labelSpec?:RasterLabelSpec;
  readonly cutAfter?:boolean;
  readonly kickDrawer?:boolean;
  readonly beepAfter?:boolean;
}

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
  receipt:true,production:true,packing:true,label:false,dineIn:true,takeaway:true,labelPrinterIds:Object.freeze([]),
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

function receipt(order:PrintableOrder){
  return '\x1b\x40'
    +'磨飯 MFK\n'
    +order.display+'\n'
    +'------------------------------\n'
    +order.items.map(item=>clean(item.name)+' x'+item.qty+'  '+money(item.unitMinor*item.qty)).join('\n')
    +'\n------------------------------\n'
    +'TOTAL '+money(order.totalMinor)+'\n'
    +clean(order.paymentLabel)+'\n'
    +new Date(order.createdAt).toLocaleString('zh-HK')
    +'\n\n\n';
}

function production(order:PrintableOrder){
  return '\x1b\x40'
    +'製作單  '+order.display+'\n'
    +'==============================\n'
    +order.items.map(item=>item.qty+' x '+clean(item.name)).join('\n')
    +'\n==============================\n'
    +clean(order.sourceLabel)
    +'\n\n\n';
}

function packing(order:PrintableOrder){
  return '\x1b\x40'
    +'打包單  '+order.display+'\n'
    +'==============================\n'
    +order.items.map(item=>item.qty+' x '+clean(item.name)).join('\n')
    +'\n==============================\n'
    +'共 '+order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0)+' 件'
    +'\n\n\n';
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
function labelAllowed(item:PrintableOrder['items'][number],binding:PrintBinding,config?:PrintRuntimeConfig){
  if(!config||Object.keys(config.productRules).length===0)return productMatchesBinding(String(item.id),binding);
  const rule=printRule(String(item.id),config);
  if(!rule.label||!serviceAllowed(item,rule))return false;
  const logicalId=derivedLogicalPrinterId(binding);
  if(rule.labelPrinterIds.length===0)return productMatchesBinding(String(item.id),binding);
  return Boolean(logicalId&&rule.labelPrinterIds.includes(logicalId));
}
function withItems(order:PrintableOrder,items:PrintableOrder['items']):PrintableOrder{
  return {...order,items};
}

function buildGlobalProductLabelUnits(order:PrintableOrder,bindings:readonly PrintBinding[],config?:PrintRuntimeConfig){
  const labelBindings=bindings.filter(binding=>binding.role==='產品標籤');
  const legacyRules=!config||Object.keys(config.productRules).length===0;
  const allProducts=legacyRules&&labelBindings.some(binding=>binding.productIds===undefined);
  const configured=new Set(labelBindings.flatMap(binding=>binding.productIds??[]).map(String));
  const units:{item:PrintableOrder['items'][number];unit:number;pieceIndex:number}[]=[];
  let pieceIndex=0;
  for(const item of order.items){
    if(legacyRules&&!allProducts&&!configured.has(String(item.id)))continue;
    if(!legacyRules&&!labelBindings.some(binding=>labelAllowed(item,binding,config)))continue;
    const qty=Math.max(0,Math.floor(Number(item.qty)||0));
    for(let unit=1;unit<=qty;unit++){
      pieceIndex+=1;
      units.push({item,unit,pieceIndex});
    }
  }
  return units;
}

export function buildOrderPrintPlan(order:PrintableOrder,bindings:readonly PrintBinding[],config?:PrintRuntimeConfig):readonly PlannedPrintJob[]{
  const active=bindings.filter(binding=>String(binding.host||'').trim()&&Number(binding.port)>0&&logicalBindingEnabled(binding,config));
  const productLabelUnits=buildGlobalProductLabelUnits(order,active,config);
  const globalProductLabelTotal=productLabelUnits.length;
  const jobs:PlannedPrintJob[]=[];
  for(const binding of active){
    if(binding.role==='顧客小票'){
      const items=roleItems(order,'receipt',config);
      if(items.length<1)continue;
      jobs.push({id:order.id+':receipt',role:binding.role,binding,payload:receipt(withItems(order,items)),cutAfter:true,kickDrawer:/\bCASH\b/i.test(order.paymentLabel),beepAfter:true});
      continue;
    }
    if(binding.role==='製作單'){
      const items=roleItems(order,'production',config);
      if(items.length<1)continue;
      jobs.push({id:order.id+':production',role:binding.role,binding,payload:production(withItems(order,items)),cutAfter:true,beepAfter:true});
      continue;
    }
    if(binding.role==='打包單'){
      const items=roleItems(order,'packing',config);
      if(items.length<1)continue;
      jobs.push({id:order.id+':packing',role:binding.role,binding,payload:packing(withItems(order,items)),cutAfter:true,beepAfter:true});
      continue;
    }
    if(binding.role==='袋標籤'){
      const total=order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
      const labelSpec:RasterLabelSpec={
        orderCode:clean(order.display),
        primaryText:'袋標籤',
        secondaryText:'共 '+total+' 件',
        pieceLabel:'1/1',
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
      const routeUnits=productLabelUnits.filter(unit=>labelAllowed(unit.item,binding,config));
      if(routeUnits.length<1)continue;
      for(const unit of routeUnits){
        const labelSpec:RasterLabelSpec={
          orderCode:clean(order.display),
          primaryText:clean(unit.item.name),
          pieceLabel:unit.pieceIndex+'/'+globalProductLabelTotal,
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
