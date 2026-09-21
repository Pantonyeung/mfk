const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const round=value=>Math.round(number(value)*100)/100;

export const CASH_DENOMINATIONS=[
  {id:'note-500',kind:'note',label:'$500 紙幣',value:500},
  {id:'note-100',kind:'note',label:'$100 紙幣',value:100},
  {id:'note-50',kind:'note',label:'$50 紙幣',value:50},
  {id:'note-20',kind:'note',label:'$20 紙幣',value:20},
  {id:'note-10',kind:'note',label:'$10 紙幣',value:10},
  {id:'coin-5',kind:'coin',label:'$5 硬幣',value:5},
  {id:'coin-2',kind:'coin',label:'$2 硬幣',value:2},
  {id:'coin-1',kind:'coin',label:'$1 硬幣',value:1}
];

export function syncCashDenomination(breakdown,id,{source='quantity',value=0}={}){
  const denomination=CASH_DENOMINATIONS.find(row=>row.id===id);
  if(!denomination)throw new Error('找不到現金面額');
  const input=Math.max(0,number(value));
  let quantity;
  if(source==='amount'){
    quantity=round(input/denomination.value);
    if(Math.abs(quantity-Math.round(quantity))>.000001)throw new Error('輸入金額必須符合面額倍數');
    quantity=Math.round(quantity);
  }else{
    if(Math.abs(input-Math.round(input))>.000001)throw new Error('紙幣或硬幣數量必須是整數');
    quantity=Math.round(input);
  }
  return {...(breakdown||{}),[id]:{denomination:denomination.value,quantity,amount:round(quantity*denomination.value)}};
}

export function totalCashBreakdown(breakdown={}){
  return round(CASH_DENOMINATIONS.reduce((sum,row)=>sum+number(breakdown?.[row.id]?.amount),0));
}

export function defaultCashDistribution(cashCounted=0,openingFloat=0){
  const counted=Math.max(0,round(cashCounted));
  const retained=Math.min(counted,Math.max(0,round(openingFloat)));
  return {cashWithdrawn:round(counted-retained),cashRetained:retained};
}

export function buildOpeningCashState(dayCloses=[],adjustments=[],businessDate=''){
  const closes=Array.isArray(dayCloses)?dayCloses:[];
  const latest=[...closes]
    .filter(row=>row.businessDate!==businessDate)
    .sort((a,b)=>number(b.createdAt)-number(a.createdAt))[0];
  const previousRetained=round(latest?.cashRetained);
  const confirmed=[...(Array.isArray(adjustments)?adjustments:[])]
    .filter(row=>row.businessDate===businessDate&&row.confirmedAt)
    .sort((a,b)=>number(b.confirmedAt)-number(a.confirmedAt))[0];
  const adjustment=round(confirmed?.adjustment);
  return {
    businessDate:String(businessDate||''),previousRetained,adjustment,
    openingCash:round(Math.max(0,previousRetained+adjustment)),confirmed:Boolean(confirmed),
    ...(confirmed?{confirmedAt:number(confirmed.confirmedAt)}:{})
  };
}

function localDateId(timestamp){
  const date=new Date(timestamp);
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}

export function businessWindow(now=Date.now(),startHour=5){
  const point=new Date(number(now));
  const start=new Date(point);
  start.setHours(startHour,0,0,0);
  if(point.getTime()<start.getTime())start.setDate(start.getDate()-1);
  const end=new Date(start);
  end.setDate(end.getDate()+1);
  return {id:localDateId(start.getTime()),start:start.getTime(),end:end.getTime(),startHour};
}

function dateAtBusinessStart(dateId,startHour=5){
  const match=String(dateId||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)throw new Error('日期格式無效');
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(startHour)||0,0,0,0);
  if(localDateId(date.getTime())!==dateId)throw new Error('日期格式無效');
  return date;
}

function shiftMonthsClamped(date,months){
  const shifted=new Date(date),day=shifted.getDate();
  shifted.setDate(1);
  shifted.setMonth(shifted.getMonth()+Number(months));
  const lastDay=new Date(shifted.getFullYear(),shifted.getMonth()+1,0).getDate();
  shifted.setDate(Math.min(day,lastDay));
  return shifted;
}

export function buildReportRange(preset='today',{now=Date.now(),startHour=5,startDate='',endDate=''}={}){
  const today=businessWindow(now,startHour),todayStart=new Date(today.start),todayEnd=new Date(today.end);
  let start=new Date(todayStart),end=new Date(todayEnd),label='今日';
  if(preset==='yesterday'){
    start.setDate(start.getDate()-1);end=new Date(todayStart);label='昨日';
  }else if(preset==='7d'){
    start.setDate(start.getDate()-6);label='最近 7 日';
  }else if(preset==='30d'){
    start.setDate(start.getDate()-29);label='最近 30 日';
  }else if(preset==='3m'){
    start=shiftMonthsClamped(todayStart,-3);label='最近 3 個月';
  }else if(preset==='6m'){
    start=shiftMonthsClamped(todayStart,-6);label='最近 6 個月';
  }else if(preset==='custom'){
    start=dateAtBusinessStart(startDate,startHour);
    const inclusiveEnd=dateAtBusinessStart(endDate,startHour);
    if(inclusiveEnd.getTime()<start.getTime())throw new Error('結束日期不可早於開始日期');
    if(inclusiveEnd.getTime()>todayStart.getTime())throw new Error('結束日期不可選擇未來營業日');
    end=new Date(inclusiveEnd);end.setDate(end.getDate()+1);
    const earliest=shiftMonthsClamped(todayStart,-6);
    if(start.getTime()<earliest.getTime())throw new Error('SMT 每次最多查詢最近六個月');
    label=startDate===endDate?startDate:`${startDate} 至 ${endDate}`;
  }else if(preset!=='today')throw new Error('找不到報表日期範圍');
  const inclusiveEnd=new Date(end);inclusiveEnd.setDate(inclusiveEnd.getDate()-1);
  const resolvedStartDate=localDateId(start.getTime()),resolvedEndDate=localDateId(inclusiveEnd.getTime());
  return {
    id:preset==='today'?today.id:`${resolvedStartDate}_${resolvedEndDate}`,
    preset,label,start:start.getTime(),end:end.getTime(),startDate:resolvedStartDate,endDate:resolvedEndDate,startHour
  };
}

function orderTime(order){
  return number(order?.completedAt||order?.checkedOutAt||order?.acceptedAt||order?.createdAt||order?.updatedAt);
}

export function ordersForWindow(orders,{now=Date.now(),startHour=5}={}){
  const window=businessWindow(now,startHour);
  return (Array.isArray(orders)?orders:[]).filter(order=>{
    const time=orderTime(order);
    return time>=window.start&&time<window.end;
  });
}

export function ordersForRange(orders,range){
  if(!range||!Number.isFinite(Number(range.start))||!Number.isFinite(Number(range.end))||Number(range.end)<=Number(range.start))throw new Error('報表日期範圍無效');
  return (Array.isArray(orders)?orders:[]).filter(order=>{
    const time=orderTime(order);
    return time>=Number(range.start)&&time<Number(range.end);
  });
}

function groupRows(map){
  return [...map.values()].sort((a,b)=>b.amount-a.amount||String(a.name).localeCompare(String(b.name),'zh-HK'));
}

function paymentName(order={}){
  const text=String(order?.paymentMethod||'未分類').trim();
  const compact=text.toLowerCase().replaceAll(' ','');
  if(order?.group==='platform'||/平台已付|平台代收/.test(text))return '平台代收';
  if(/^現金(?:付款)?$/.test(text))return '現金';
  if(/alipay|支付寶/.test(compact))return '支付寶';
  if(/wechat|微信/.test(compact))return '微信支付';
  if(/fps|轉數快/.test(compact))return '轉數快';
  if(/payme/.test(compact))return 'PayMe';
  if(/拍住賞|tap&go|tapngo/.test(compact))return '拍住賞';
  if(/組合付款/.test(text))return '組合付款';
  if(/待核實|待確認/.test(text))return '待核實';
  return '其他';
}

function paymentGroup(method=''){
  const text=String(method||'未分類');
  if(text==='現金')return 'cash';
  if(text==='平台代收')return 'platform';
  return 'electronic';
}

function uniquePush(values,value){if(value&&!values.includes(value))values.push(value)}
function newBreakdown(name){return {name,orders:0,gross:0,discounts:0,amount:0,expected:0,received:0,refunds:0,difference:0,pending:0,orderIds:[]}}
function addBreakdown(map,name,order,values){
  const row=map.get(name)||newBreakdown(name);
  for(const key of ['gross','discounts','amount','expected','received','refunds'])row[key]+=number(values[key]);
  row.pending+=values.pending?1:0;
  uniquePush(row.orderIds,order.id);
  row.orders=row.orderIds.length;
  map.set(name,row);
}
function finishBreakdowns(map){
  for(const row of map.values()){
    for(const key of ['gross','discounts','amount','expected','received','refunds'])row[key]=round(row[key]);
    row.difference=round(row.expected-row.received);
    row.averageOrderValue=row.orders?round(row.amount/row.orders):0;
    row.status=row.pending?'待核實':row.name==='平台代收'&&row.difference?'待平台結算':row.difference>0?'短收':row.difference<0?'多收':'已對數';
  }
  return groupRows(map);
}
function anomalyRow(map,key,name,order,amount=0){
  const row=map.get(key)||{key,name,count:0,amount:0,orderIds:[]};
  row.count+=1;row.amount+=number(amount);uniquePush(row.orderIds,order.id);map.set(key,row);
}

function hasNumericValue(value){return value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))}
function paymentLegs(order,net,gross,discount,refund,pending){
  const detail=(Array.isArray(order?.payments)?order.payments:[]).filter(entry=>number(entry?.amount)>0);
  const total=detail.reduce((sum,entry)=>sum+number(entry.amount),0);
  const source=detail.length&&total>0?detail:[{method:order?.paymentMethod,amount:net}];
  return source.map((entry,index)=>{
    const ratio=source.length===1?1:number(entry.amount)/total;
    const name=paymentName({...order,paymentMethod:entry.method||order?.paymentMethod});
    const platform=name==='平台代收';
    const expected=platform?number(order?.estimatedPlatformSettlement??net)*ratio:net*ratio;
    let received;
    if(pending)received=0;
    else if(platform)received=number(order?.actualPlatformSettlement??order?.platformSettledAmount)*ratio;
    else if(detail.length)received=hasNumericValue(entry.receivedAmount??entry.paidAmount)?number(entry.receivedAmount??entry.paidAmount):expected;
    else if(hasNumericValue(order?.receivedAmount)){
      received=number(order.receivedAmount);
      if(name==='現金')received-=number(order?.changeAmount);
    }else if(hasNumericValue(order?.paidAmount)){
      received=number(order.paidAmount);
      if(name==='現金')received=Math.min(received,expected);
    }else received=expected;
    return {name,index,group:paymentGroup(name),values:{gross:gross*ratio,discounts:discount*ratio,amount:net*ratio,expected,received,refunds:refund*ratio,pending}};
  });
}

export function buildOperationalReport(orders,{now=Date.now(),startHour=5,range=null}={}){
  const window=range||businessWindow(now,startHour);
  const allOrders=Array.isArray(orders)?orders:[];
  const rows=range?ordersForRange(allOrders,range):ordersForWindow(allOrders,{now,startHour});
  const completed=rows.filter(order=>order.status!=='cancelled'&&order.status!=='voided');
  const summary={
    completedOrders:completed.length,
    cancelledOrders:rows.length-completed.length,
    refundOrders:0,
    itemUnits:0,
    grossSales:0,
    discounts:0,
    refunds:0,
    netSales:0,
    averageOrderValue:0,
    outstandingOrders:0,
    outstandingAmount:0,
    cashExpected:0,
    electronicExpected:0,
    unverifiedDirectTotal:0,
    unverifiedDirectOrders:0,
    platformGross:0,
    platformSettlement:0,
    pendingPayments:0,
    printExceptions:0
  };
  const channels=new Map(),payments=new Map(),products=new Map(),categories=new Map(),hours=new Map(),anomalies=new Map();
  rows.filter(order=>order.status==='cancelled'||order.status==='voided').forEach(order=>anomalyRow(anomalies,'cancelled','取消／作廢訂單',order,order.amount));
  const auditAnomalies={
    order_payment_changed:['payment_changed','更改付款／訂單資料'],checkout_data_corrected:['payment_changed','更改付款／訂單資料'],
    order_item_partially_cancelled:['partial_cancel','部分取消／退菜'],order_reprint_queued:['reprint','重印單據'],payment_issue_flagged:['payment_issue','付款問題']
  };
  const auditDrilldownOrders=[];
  allOrders.forEach(order=>(order.audit||[]).forEach(entry=>{
    const definition=auditAnomalies[entry?.type];
    const eventAt=number(entry?.at);
    if(definition&&eventAt>=number(window.start)&&eventAt<number(window.end)){
      anomalyRow(anomalies,definition[0],definition[1],order,entry?.amount??entry?.detail?.amount??0);
      if(!rows.some(row=>row.id===order.id)&&!auditDrilldownOrders.some(row=>row.id===order.id))auditDrilldownOrders.push(order);
    }
  }));
  completed.forEach(order=>{
    const gross=number(order.subtotal??order.amount);
    const discount=number(order.discountAmount);
    const refund=number(order.refundedAmount||order.refundAmount);
    const net=Math.max(0,number(order.amount)-refund);
    summary.grossSales+=gross;
    summary.discounts+=discount;
    summary.refunds+=refund;
    if(refund){summary.refundOrders+=1;anomalyRow(anomalies,'refund','退款訂單',order,refund)}
    summary.netSales+=net;
    const pending=/待|pending/i.test(String(order.paymentStatus||order.reconciliationStatus||''));
    if(pending){summary.pendingPayments+=1;summary.outstandingOrders+=1;summary.outstandingAmount+=net;anomalyRow(anomalies,'payment_pending','付款待核實',order,net)}
    if(order.printStatus==='異常'||(order.printJobs||[]).some(job=>job.status==='failed')){summary.printExceptions+=1;anomalyRow(anomalies,'print_failed','打印異常',order,net)}
    const unverifiedDirect=pending&&(/電話|WhatsApp|磨飯\s*App|自家\s*App|網頁|Web/i.test(String(order.source||''))||order.group==='owned');
    const legs=paymentLegs(order,net,gross,discount,refund,pending);
    if(unverifiedDirect){
      summary.unverifiedDirectTotal+=net;
      summary.unverifiedDirectOrders+=1;
    }else for(const leg of legs){
      if(leg.group==='cash')summary.cashExpected+=leg.values.expected;
      else if(leg.group==='platform'){
        summary.platformGross+=number(order.platformSalesGross??net)*(leg.values.amount/(net||1));
        summary.platformSettlement+=leg.values.expected;
      }else summary.electronicExpected+=leg.values.expected;
    }
    const values={gross,discounts:discount,amount:net,expected:legs.reduce((sum,leg)=>sum+leg.values.expected,0),received:legs.reduce((sum,leg)=>sum+leg.values.received,0),refunds:refund,pending};
    addBreakdown(channels,String(order.source||'未分類'),order,values);
    legs.forEach(leg=>addBreakdown(payments,leg.name,order,leg.values));
    const hour=new Date(orderTime(order)).getHours();
    const hourKey=String(hour).padStart(2,'0')+':00';
    addBreakdown(hours,hourKey,order,values);
    (order.items||order.cart||[]).forEach(item=>{
      const quantity=Math.max(0,number(item.qty||item.quantity));
      const amount=number(item.total??number(item.unitPrice)*quantity);
      const name=String(item.name||item.productName||'未命名商品');
      const category=String(item.category||'未分類');
      const product=products.get(name)||{name,category,quantity:0,amount:0,orders:0,orderIds:[]};
      product.quantity+=quantity;product.amount+=amount;uniquePush(product.orderIds,order.id);product.orders=product.orderIds.length;products.set(name,product);
      const categoryRow=categories.get(category)||{name:category,quantity:0,amount:0,orders:0,orderIds:[]};
      categoryRow.quantity+=quantity;categoryRow.amount+=amount;uniquePush(categoryRow.orderIds,order.id);categoryRow.orders=categoryRow.orderIds.length;categories.set(category,categoryRow);
      summary.itemUnits+=quantity;
    });
  });
  summary.averageOrderValue=summary.completedOrders?summary.netSales/summary.completedOrders:0;
  Object.keys(summary).forEach(key=>{if(typeof summary[key]==='number')summary[key]=round(summary[key]);});
  for(const map of [products,categories])for(const row of map.values()){row.amount=round(row.amount);row.share=summary.netSales?round(row.amount/summary.netSales*100):0}
  for(const row of anomalies.values())row.amount=round(row.amount);
  return {
    businessWindow:window,range:window,orderIds:rows.map(order=>order.id),orders:clone([...rows,...auditDrilldownOrders]),summary,
    channels:finishBreakdowns(channels),payments:finishBreakdowns(payments),products:groupRows(products),categories:groupRows(categories),hours:finishBreakdowns(hours),
    anomalies:[...anomalies.values()].sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'zh-HK')),
    generatedAt:number(now)
  };
}

export function calculateDayCloseReconciliation({report,cashCounted=0,openingFloat=0,cashExpenses=0}={}){
  const knownDrawerExpected=round(number(openingFloat)+number(report?.summary?.cashExpected)-number(cashExpenses));
  const unverifiedTotal=Math.max(0,number(report?.summary?.unverifiedDirectTotal));
  const inferredUnverifiedCash=round(Math.max(0,Math.min(unverifiedTotal,number(cashCounted)-knownDrawerExpected)));
  const inferredUnverifiedNonCash=round(unverifiedTotal-inferredUnverifiedCash);
  const cashExpectedAfterReconciliation=round(knownDrawerExpected+inferredUnverifiedCash);
  const cashDifference=round(number(cashCounted)-cashExpectedAfterReconciliation);
  return {knownDrawerExpected,unverifiedTotal,inferredUnverifiedCash,inferredUnverifiedNonCash,cashExpectedAfterReconciliation,cashDifference};
}

export function createDayClose({orders=[],now=Date.now(),terminalId='SMT',cashCounted=0,cashBreakdown={},openingFloat=0,cashWithdrawn,cashRetained,expenses=[],reason='',approvedOverride=false,existing=[],backupId=''}={}){
  const report=buildOperationalReport(orders,{now});
  const cashExpenses=(Array.isArray(expenses)?expenses:[]).filter(row=>String(row.paymentMethod||'現金')==='現金').reduce((sum,row)=>sum+number(row.amount),0);
  const reconciliation=calculateDayCloseReconciliation({report,cashCounted,openingFloat,cashExpenses});
  const cashExpectedAfterExpenses=reconciliation.cashExpectedAfterReconciliation;
  const cashDifference=reconciliation.cashDifference;
  const differenceThreshold=round(report.summary.netSales*.03);
  const reviewRequired=Math.abs(cashDifference)>differenceThreshold;
  if(reviewRequired&&!String(reason).trim())throw new Error('現金差異超出門檻，必須填寫差異原因');
  if(reviewRequired&&!approvedOverride)throw new Error('現金差異超出門檻，必須由有權人明確授權通過');
  const withdrawn=cashWithdrawn===undefined?0:round(cashWithdrawn);
  const retained=cashRetained===undefined?round(cashCounted-withdrawn):round(cashRetained);
  if(withdrawn<0||retained<0||Math.abs(round(withdrawn+retained)-round(cashCounted))>.001)throw new Error('提取及留底現金必須等於實際點算總額');
  const businessDate=report.businessWindow.id;
  const version=(Array.isArray(existing)?existing:[]).filter(row=>row.businessDate===businessDate).reduce((max,row)=>Math.max(max,number(row.version)),0)+1;
  return {
    id:`DAYCLOSE-${businessDate}-V${version}`,
    businessDate,version,status:'closed',createdAt:number(now),terminalId:String(terminalId||'SMT'),
    report:clone(report),cashCounted:round(cashCounted),cashBreakdown:clone(cashBreakdown||{}),openingFloat:round(openingFloat),cashWithdrawn:withdrawn,cashRetained:retained,
    cashExpectedAfterExpenses,cashDifference,differenceThreshold,reconciliation:clone(reconciliation),reviewRequired,
    expenses:clone(Array.isArray(expenses)?expenses:[]),differenceReason:String(reason||'').trim(),backupId:String(backupId||''),
    reviewApproval:{approved:reviewRequired?Boolean(approvedOverride):false,terminalId:reviewRequired?String(terminalId||'SMT'):'',at:reviewRequired?number(now):null},
    audit:[
      ...(reviewRequired?[{type:'day_close.difference_override_approved',terminalId:String(terminalId||'SMT'),at:number(now),businessDate,cashDifference,differenceThreshold,reason:String(reason||'').trim()}]:[]),
      {type:'day_close.completed',terminalId:String(terminalId||'SMT'),at:number(now),businessDate,version,cashDifference,backupId:String(backupId||'')}
    ]
  };
}

function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}
function csvRow(values){return values.map(csvCell).join(',');}

export function buildCsvExport(report,orders=[]){
  const selected=new Set(report?.orderIds||[]);
  const rows=(Array.isArray(orders)?orders:[]).filter(order=>selected.has(order.id));
  const lines=['\ufeff'+csvRow(['磨飯 SMT','營業報表',report?.businessWindow?.id||''])];
  lines.push('',csvRow(['營業摘要','數值']));
  Object.entries(report?.summary||{}).forEach(([key,value])=>lines.push(csvRow([key,value])));
  lines.push('',csvRow(['訂單明細']),csvRow(['訂單號','渠道','付款方式','付款狀態','狀態','金額','時間']));
  rows.forEach(order=>lines.push(csvRow([order.id,order.source,order.paymentMethod,order.paymentStatus,order.status,order.amount,new Date(orderTime(order)).toISOString()])));
  lines.push('',csvRow(['商品明細']),csvRow(['商品','分類','數量','銷售額','涉及訂單']));
  (report?.products||[]).forEach(item=>lines.push(csvRow([item.name,item.category,item.quantity,item.amount,item.orders])));
  return lines.join('\r\n');
}

function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
  return JSON.stringify(value);
}

function checksumOf(value){
  const text=stable(value);
  let hash=0x811c9dc5;
  for(let index=0;index<text.length;index++){
    hash^=text.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return 'fnv1a32-'+hash.toString(16).padStart(8,'0');
}

export function createBackupEnvelope(values,{now=Date.now(),terminalId='SMT',reason='manual'}={}){
  const safeValues=Object.fromEntries(Object.entries(values||{}).filter(([key])=>key.startsWith('morefun:')).sort(([a],[b])=>a.localeCompare(b)));
  const manifest={contract:'morefun.backup.v1',schemaVersion:1,createdAt:number(now),terminalId:String(terminalId||'SMT'),reason:String(reason||'manual'),keyCount:Object.keys(safeValues).length};
  const checksum=checksumOf({manifest,values:safeValues});
  return {id:`BACKUP-${number(now)}`,manifest,values:safeValues,checksum};
}

export function validateBackupEnvelope(envelope){
  const errors=[];
  if(envelope?.manifest?.contract!=='morefun.backup.v1')errors.push('備份格式不正確');
  if(number(envelope?.manifest?.schemaVersion)!==1)errors.push('備份版本不支援');
  if(!envelope?.values||typeof envelope.values!=='object'||Array.isArray(envelope.values))errors.push('備份內容缺失');
  if(Object.keys(envelope?.values||{}).some(key=>!key.startsWith('morefun:')))errors.push('備份含非 SMT 資料');
  const expected=checksumOf({manifest:envelope?.manifest||{},values:envelope?.values||{}});
  if(envelope?.checksum!==expected)errors.push('備份校驗失敗');
  return {ok:errors.length===0,errors,expectedChecksum:expected};
}

export function restoreBackupValues(current,envelope,scope='all'){
  const validation=validateBackupEnvelope(envelope);
  if(!validation.ok)throw new Error(validation.errors.join('；'));
  const next=scope==='all'
    ? Object.fromEntries(Object.entries(current||{}).filter(([key])=>!key.startsWith('morefun:')))
    : {...(current||{})};
  const include=key=>scope==='all'||(scope==='settings'&&(key.includes('settings')||key.includes('printers')||key.includes('terminal-id')||key.includes('ui-scale')));
  Object.entries(envelope.values).forEach(([key,value])=>{if(include(key))next[key]=value;});
  return next;
}

export function buildDiagnosticReport({version='unknown',terminalId='SMT',operations={},printers={},storageKeys=0,updateSource='',capabilities={}}={}, {now=Date.now()}={}){
  const jobs=Array.isArray(printers.jobs)?printers.jobs:[];
  return {
    contract:'morefun.diagnostic.v1',createdAt:number(now),version,terminalId,
    storage:{keys:number(storageKeys)},
    sync:{pending:(operations.outbox||[]).filter(row=>!['sent','completed'].includes(row.status)).length},
    print:{queued:jobs.filter(row=>row.status==='queued').length,blocked:jobs.filter(row=>row.status==='blocked').length,failed:jobs.filter(row=>row.status==='failed').length},
    update:{status:updateSource?'source_configured':'not_configured',source:updateSource||''},
    capabilities:{...capabilities}
  };
}
