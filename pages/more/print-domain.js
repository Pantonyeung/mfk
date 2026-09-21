import {orderDisplayNumber} from '../../shared/order-identity.js';

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const number=value=>Number.isFinite(Number(value))?Number(value):0;

const demoTemplates=()=>[
  {id:'receipt-demo-v1',name:'顧客小票｜示範一',documentType:'receipt',paperWidth:80,source:'admin-demo',sourceVersion:1,editable:false,status:'published'},
  {id:'production-demo-v1',name:'製作單｜合併統計示範',documentType:'production',paperWidth:80,source:'admin-demo',sourceVersion:1,editable:false,status:'published'},
  {id:'packing-demo-v1',name:'打包單｜合併統計示範',documentType:'packing',paperWidth:80,source:'admin-demo',sourceVersion:1,editable:false,status:'published'},
  {id:'label-demo-v1',name:'產品標籤｜示範一',documentType:'label',paperWidth:50,source:'admin-demo',sourceVersion:1,editable:false,status:'published'}
];

export function defaultPrinterState(now=Date.now()){
  return {
    schemaVersion:1,updatedAt:number(now),bridge:{contract:'morefun.print.v1',status:'not_connected',lastSeenAt:0},
    printers:[
      {id:'receipt-1',name:'商米 T2s 內置小票機',model:'SUNMI T2S',transport:'sunmi-native',host:'',port:0,paperWidth:80,purposes:['receipt'],copies:1,enabled:true,role:'primary',timeoutMs:5000,templateAssignments:{receipt:'receipt-demo-v1'},lastDiagnostic:null},
      {id:'kitchen-1',name:'後廚機一',model:'XP-N160II',transport:'network',host:'',port:9100,paperWidth:80,purposes:['production'],copies:1,enabled:true,role:'primary',timeoutMs:5000,templateAssignments:{production:'production-demo-v1'},lastDiagnostic:null},
      {id:'packing-1',name:'打包機',model:'XP-N160II',transport:'network',host:'',port:9100,paperWidth:80,purposes:['packing'],copies:1,enabled:true,role:'primary',timeoutMs:5000,templateAssignments:{packing:'packing-demo-v1'},lastDiagnostic:null},
      {id:'label-riceball',name:'飯團標籤機',model:'T271U',transport:'network',host:'',port:9100,paperWidth:50,purposes:['label'],copies:1,enabled:true,role:'primary',timeoutMs:5000,templateAssignments:{label:'label-demo-v1'},lastDiagnostic:null},
      {id:'label-pack',name:'包裝後備標籤機',model:'T271U',transport:'network',host:'',port:9100,paperWidth:50,purposes:['label-backup'],copies:1,enabled:true,role:'backup',timeoutMs:5000,templateAssignments:{label:'label-demo-v1'},lastDiagnostic:null}
    ],
    templates:demoTemplates(),routes:{receipt:'receipt-1',production:'kitchen-1',packing:'packing-1',label:'label-riceball'},jobs:[],diagnostics:[],adminSync:{status:'demo-local',lastSyncedAt:number(now),sourceVersion:1}
  };
}

function validIPv4(value){
  const parts=String(value||'').trim().split('.');
  return parts.length===4&&parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255);
}

export function validatePrinter(printer){
  const errors=[];
  if(!String(printer?.name||'').trim())errors.push('缺少打印機名稱');
  if(!['network','sunmi-native'].includes(printer?.transport))errors.push('連接方式不支援');
  if(printer?.transport==='network'){
    if(!validIPv4(printer.host))errors.push('網絡地址格式不正確');
    if(!Number.isInteger(Number(printer.port))||Number(printer.port)<1||Number(printer.port)>65535)errors.push('連接埠必須介乎 1 至 65535');
  }
  if(![50,58,80].includes(Number(printer?.paperWidth)))errors.push('紙寬必須是 50、58 或 80 毫米');
  if(!Array.isArray(printer?.purposes)||!printer.purposes.length)errors.push('最少選擇一個用途');
  const printable=(printer?.purposes||[]).filter(value=>['receipt','production','packing','label'].includes(value));
  printable.forEach(type=>{if(!printer?.templateAssignments?.[type])errors.push(`${type} 未選擇打印格式`);});
  return {ok:errors.length===0,errors};
}

export function diagnosePrinterConfiguration(printer,{bridgeConnected=false,now=Date.now()}={}){
  const validation=validatePrinter(printer);
  return {
    printerId:printer?.id||'',checkedAt:number(now),configuration:validation.ok?'valid':'invalid',
    errors:[...validation.errors],rawTcpAvailable:false,
    rawTcpReason:'瀏覽器不可直接開啟網絡打印機 TCP 連線',
    bridgeConnected:Boolean(bridgeConnected),
    status:!validation.ok?'configuration_error':bridgeConnected?'ready_for_test_print':'waiting_bridge',
    nextStep:!validation.ok?'先修正設備設定':bridgeConnected?'可以建立實體測試打印':'封裝 APK 後由安卓橋接測試實體連線'
  };
}

function itemUnit(item){
  const category=String(item?.category||''),name=String(item?.name||'');
  if(category.includes('飲品')||/茶|奶茶|咖啡|可樂|水$|梳打/.test(name))return '杯';
  if(category.includes('飯團')||/飯團/.test(name))return '個';
  return '份';
}

export function aggregateProductionSummary(items=[]){
  const map=new Map();
  const totals={drinks:0,riceMeals:0,riceballs:0,snacks:0};
  let totalUnits=0;
  (Array.isArray(items)?items:[]).forEach(item=>{
    const name=String(item.name||item.productName||'未命名商品');
    const quantity=Math.max(0,number(item.qty||item.quantity));
    const unit=itemUnit(item),category=String(item.category||'未分類');
    const key=[name,JSON.stringify(item.options||{})].join('|');
    const row=map.get(key)||{name,category,configuration:item.options||{},quantity:0,unit};
    row.quantity+=quantity;map.set(key,row);totalUnits+=quantity;
    if(unit==='杯')totals.drinks+=quantity;
    if(category.includes('便當')||category.includes('飯餐')||category.includes('薯角餐')||/便當|飯餐/.test(name))totals.riceMeals+=quantity;
    if(category.includes('飯團')||/飯團/.test(name))totals.riceballs+=quantity;
    if(category.includes('小食'))totals.snacks+=quantity;
  });
  return {totalUnits,totals,items:[...map.values()].sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name,'zh-HK'))};
}

function optionText(options){
  if(!options)return '標準';
  if(typeof options==='string')return options||'標準';
  const text=Object.entries(options).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).filter(Boolean).map(entry=>`${key}：${entry}`)).join('／');
  return text||'標準';
}

function header(order,title){return [`磨飯｜${title}`,`訂單：${orderDisplayNumber(order)==='—'?'測試工作':orderDisplayNumber(order)}`,`來源：${order.source||'SMT'}`,`時間：${new Date(number(order.acceptedAt||order.createdAt||Date.now())).toLocaleString('zh-HK')}`];}
function channelLines(order){
  const data=order?.channelData||{};
  return [data.platformOrderId&&`渠道單號：${data.platformOrderId}`,data.phone&&`電話：${data.phone}`,data.contact&&`客人：${data.contact}`,data.pickupTime&&`取餐：${data.pickupTime}`,data.note&&`備註：${data.note}`].filter(Boolean);
}
function summaryLines(summary){return ['合併統計',...summary.items.map(row=>`${row.name}：${row.quantity}${row.unit}`),`飲品總杯數：${summary.totals.drinks}`,`飯餐總份數：${summary.totals.riceMeals}`,`飯團總個數：${summary.totals.riceballs}`,`全部產品：${summary.totalUnits}件`];}
function detailLines(items){return ['逐項明細',...(items||[]).map((item,index)=>`${index+1}. ${item.name} ×${item.qty||item.quantity||0}｜${optionText(item.options)}`)];}

export function shouldPrintProductLabel(item,order={}){
  const category=String(item?.category||''),name=String(item?.name||''),fulfillment=String(item?.fulfillment||item?.serviceMode||order.fulfillment||order.serviceMode||'');
  if(category.includes('飯團')||/飯團|紫米餐/.test(name)||item?.labelAlways===true)return true;
  if(item?.labelRequired===true)return true;
  return fulfillment==='外賣'&&item?.labelRequired!==false;
}

function labelDocuments(order){
  const result=[];
  for(const item of order?.items||order?.cart||[]){
    if(!shouldPrintProductLabel(item,order))continue;
    const total=Math.max(1,number(item.qty||item.quantity)||1);
    for(let pieceIndex=1;pieceIndex<=total;pieceIndex++)result.push({item,pieceIndex,pieceTotal:total});
  }
  return result;
}

function receiptLines(order){
  const subtotal=number(order.subtotal??order.amount??order.total),discount=number(order.discountAmount),amount=number(order.amount??order.total),paid=number(order.receivedAmount??order.paidAmount??amount),change=number(order.changeAmount);
  return [`原價：$${subtotal.toFixed(0)}`,`優惠：-$${discount.toFixed(0)}`,`應付：$${amount.toFixed(0)}`,`付款：${order.paymentMethod||'待核實'}`,`實收：$${paid.toFixed(0)}`,`找續：$${change.toFixed(0)}`];
}

function labelLines(order,item,pieceIndex,pieceTotal){
  const name=item?.labelName||[item?.code,item?.name].filter(Boolean).join(' ')||'產品標籤';
  const fulfillment=item?.fulfillment||item?.serviceMode||order.fulfillment||order.serviceMode||'堂食';
  const packaging=number(item?.packagingFee);
  return ['磨飯',`訂單：${orderDisplayNumber(order)==='—'?'測試工作':orderDisplayNumber(order)}　${pieceIndex}/${pieceTotal}`,name,fulfillment,optionText(item?.options),item?.note&&`備註：${item.note}`,packaging?`注：外賣盒 $${packaging.toFixed(0)}／盒`:''].filter(Boolean);
}

export function renderPrintDocument(template,order){
  if(!template||!['receipt','production','packing','label'].includes(template.documentType))throw new Error('打印格式不支援');
  const items=order?.items||order?.cart||[],summary=aggregateProductionSummary(items);
  let lines=[];
  if(template.documentType==='receipt')lines=[...header(order,'顧客小票'),...channelLines(order),...detailLines(items),...receiptLines(order)];
  if(template.documentType==='production')lines=[...header(order,'製作單'),...channelLines(order),...summaryLines(summary),...detailLines(items),'請按訂單配置製作'];
  if(template.documentType==='packing')lines=[...header(order,'打包單'),...channelLines(order),...summaryLines(summary),...detailLines(items),`總袋數：____　餐具：____`];
  if(template.documentType==='label'){
    const selected=order?.labelItem?{item:order.labelItem,pieceIndex:number(order.labelPieceIndex)||1,pieceTotal:number(order.labelPieceTotal)||1}:labelDocuments(order)[0];
    lines=selected?labelLines(order,selected.item,selected.pieceIndex,selected.pieceTotal):['磨飯',`訂單：${orderDisplayNumber(order)==='—'?'測試工作':orderDisplayNumber(order)}`,'沒有需要打印標籤的產品'];
  }
  return {templateId:template.id,templateVersion:template.sourceVersion,documentType:template.documentType,paperWidth:template.paperWidth,title:template.name,summary,text:lines.join('\n'),lines};
}

function selectedPrinter(state,type){
  const routeId=state?.routes?.[type];
  return (state?.printers||[]).find(row=>row.id===routeId&&row.enabled)||(state?.printers||[]).find(row=>row.enabled&&row.purposes?.includes(type));
}
function selectedTemplate(state,printer,type){
  const id=printer?.templateAssignments?.[type];
  return (state?.templates||[]).find(row=>row.id===id&&row.documentType===type&&row.status==='published');
}
function jobId(order,type,now,index=0){return `PRINT-${order.id||'TEST'}-${type}-${number(now)}-${index+1}`;}

export function createPrintJobs(order,state,{now=Date.now(),documents=['receipt','production','packing','label'],isReprint=false}={}){
  const jobs=[];
  let sequence=0;
  documents.forEach(type=>{
    const variants=type==='label'?labelDocuments(order):[null];
    variants.forEach(variant=>{
    const printer=selectedPrinter(state,type),template=selectedTemplate(state,printer,type);
    const validation=printer?validatePrinter(printer):{ok:false,errors:['未有可用打印機']};
    const errors=[...validation.errors];
    if(!template)errors.push('未有已發佈打印格式');
    const printOrder=variant?{...order,labelItem:variant.item,labelPieceIndex:variant.pieceIndex,labelPieceTotal:variant.pieceTotal}:order;
    const document=template?renderPrintDocument(template,printOrder):null;
    const copies=type==='label'?1:Math.max(1,number(printer?.copies)||1);
    const createdAt=number(now)+sequence;
    jobs.push({
      id:jobId(order,type,now,sequence),orderId:order?.id||'',documentType:type,documentName:template?.name||type,
      printerId:printer?.id||'',templateId:template?.id||'',templateVersion:template?.sourceVersion||0,copies,
      status:errors.length?'blocked':'queued',bridgeStatus:errors.length?'not_ready':'waiting_bridge',attempts:0,
      createdAt,updatedAt:createdAt,isReprint:Boolean(isReprint),reprintMark:isReprint?'補印｜不要重複製作':'',
      errors:errors.map(message=>({at:createdAt,message})),history:[{type:'print_job.created',at:createdAt,printerId:printer?.id||'',status:errors.length?'blocked':'queued'}],document
    });
    sequence+=1;
    });
  });
  return {...clone(state),jobs:[...(state?.jobs||[]),...jobs],updatedAt:number(now)};
}

export function retryPrintJob(job,{now=Date.now()}={}){
  return {...clone(job),status:'queued',bridgeStatus:'waiting_bridge',attempts:number(job?.attempts)+1,updatedAt:number(now),history:[...(job?.history||[]),{type:'print_job.retried',at:number(now),attempt:number(job?.attempts)+1}]};
}

export function reroutePrintJob(job,printer,{now=Date.now()}={}){
  const validation=validatePrinter(printer);
  if(!validation.ok)throw new Error(validation.errors.join('；'));
  const fromPrinterId=job?.printerId||'';
  return {...clone(job),printerId:printer.id,status:'queued',bridgeStatus:'waiting_bridge',updatedAt:number(now),history:[...(job?.history||[]),{type:'print_job.rerouted',at:number(now),fromPrinterId,toPrinterId:printer.id}]};
}

export function buildAndroidPrintPayload(job,printer,document){
  const validation=validatePrinter(printer);
  if(!validation.ok)throw new Error(validation.errors.join('；'));
  return {
    contract:'morefun.print.v1',idempotencyKey:job.id,jobId:job.id,documentType:job.documentType,copies:Math.max(1,number(job.copies)||1),
    target:printer.transport==='network'?{transport:'tcp',host:printer.host,port:Number(printer.port)}:{transport:'sunmi-native',device:'builtin'},
    content:{encoding:'utf-8',paperWidth:Number(document.paperWidth||printer.paperWidth),text:document.text,templateId:document.templateId,templateVersion:document.templateVersion},
    completion:{required:true,acceptedStatuses:['printed','failed'],doNotTreatQueuedAsPrinted:true}
  };
}

function documentTypeOf(job){
  const text=String(job.documentType||job.type||job.document||'');
  if(/標籤|label/i.test(text))return 'label';
  if(/打包|packing/i.test(text))return 'packing';
  if(/小票|receipt/i.test(text))return 'receipt';
  return 'production';
}

export function importExternalPrintJobs(state,{orders=[],dine=null}={}, {now=Date.now()}={}){
  const next=clone(state||defaultPrinterState(now)),seen=new Set((next.jobs||[]).map(job=>job.id));
  const append=(job,sourceRef)=>{
    if(!job?.id||seen.has(job.id))return;
    seen.add(job.id);
    next.jobs.push({...clone(job),documentType:documentTypeOf(job),sourceRef,importedAt:number(now),status:job.status||'queued',bridgeStatus:job.bridgeStatus||'waiting_bridge'});
  };
  (orders||[]).forEach(order=>(order.printJobs||[]).forEach(job=>append(job,{kind:'order',orderId:order.id})));
  (dine?.tables||[]).forEach(table=>(table.session?.printJobs||[]).forEach(job=>append(job,{kind:'dine',tableId:table.id,sessionId:table.session?.id||''})));
  next.updatedAt=number(now);
  return next;
}
