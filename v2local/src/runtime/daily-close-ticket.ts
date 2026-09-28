import type {PrintableOrder} from './print-routing.ts';
import type {LocalDayClose} from './local-operations.ts';

const ESC='\x1b';
const GS='\x1d';
const INIT=ESC+'@';
const LEFT=ESC+'a'+String.fromCharCode(0);
const CENTER=ESC+'a'+String.fromCharCode(1);
const BOLD_ON=ESC+'E'+String.fromCharCode(1);
const BOLD_OFF=ESC+'E'+String.fromCharCode(0);
const NORMAL=GS+'!'+String.fromCharCode(0);
const DOUBLE=GS+'!'+String.fromCharCode(0x11);
const RULE='------------------------------------------\n';
const money=(minor:number)=>{const n=Math.round(Number(minor)||0);return (n<0?'-':'')+String.fromCharCode(36)+(Math.abs(n)/100).toFixed(2)};

export interface DailyCloseBreakdownRow{
  readonly label:string;
  readonly orders:number;
  readonly grossMinor:number;
  readonly refundMinor?:number;
  readonly netMinor:number;
}
export interface DailyClosePaymentRow{
  readonly label:string;
  readonly orders:number;
  readonly amountMinor:number;
}
export interface DailyClosePrintData{
  readonly businessDate:string;
  readonly closedAt:string;
  readonly orderCount:number;
  readonly itemUnits:number;
  readonly grossMinor:number;
  readonly refundMinor?:number;
  readonly netMinor:number;
  readonly channelRows:readonly DailyCloseBreakdownRow[];
  readonly paymentRows:readonly DailyClosePaymentRow[];
  readonly refundRows:readonly DailyClosePaymentRow[];
  readonly refundDetails:readonly {
    readonly id:string;
    readonly orderId:string;
    readonly display:string;
    readonly originalCreatedAt:string;
    readonly executionAt:string;
    readonly method:string;
    readonly amountMinor:number;
    readonly items:string;
  }[];
  readonly close:LocalDayClose;
}

function channelName(sourceLabel:string){
  const value=String(sourceLabel||'').trim();
  if(/^Keeta\b/i.test(value))return 'Keeta';
  if(/^Foodpanda\b/i.test(value))return 'Foodpanda';
  if(/^自家\b|^MoreFun\b|^網站\b/i.test(value))return '自家 App／網站';
  if(/^WhatsApp\b|^電話\b|電話／WhatsApp|WhatsApp／電話/.test(value))return 'WhatsApp／電話';
  if(/^現場\b|^店內\b/.test(value))return '店內';
  return value||'其他';
}

function paymentParts(paymentLabel:string,totalMinor:number){
  const value=String(paymentLabel||'').trim();
  const known=['CASH','FPS','ALIPAY','WECHAT','PAYME'] as const;
  if(/^COMBO\b/i.test(value)){
    const parts:{label:string;amountMinor:number}[]=[];
    const regex=/(CASH|FPS|ALIPAY|WECHAT|PAYME)\s+\$?([0-9]+(?:\.[0-9]{1,2})?)/gi;
    let match:RegExpExecArray|null;
    while((match=regex.exec(value))){
      parts.push({label:String(match[1]).toUpperCase(),amountMinor:Math.round(Number(match[2])*100)});
    }
    if(parts.length)return parts;
    return [{label:'COMBO',amountMinor:totalMinor}];
  }
  for(const tender of known){
    if(value.toUpperCase().includes(tender))return[{label:tender,amountMinor:totalMinor}];
  }
  if(value.includes('現金'))return[{label:'CASH',amountMinor:totalMinor}];
  return[{label:value||'未記錄',amountMinor:totalMinor}];
}

export function buildDailyClosePrintData(input:{
  readonly orders:readonly PrintableOrder[];
  readonly close:LocalDayClose;
  readonly refundMinor?:number;
  readonly refunds?:readonly {
    readonly id:string;
    readonly orderId:string;
    readonly display:string;
    readonly originalCreatedAt:string;
    readonly executionAt:string;
    readonly method:string;
    readonly amountMinor:number;
    readonly items:string;
  }[];
}):DailyClosePrintData{
  const sales=input.orders;
  const grossMinor=sales.reduce((sum,order)=>sum+Math.max(0,Number(order.totalMinor)||0),0);
  const refundMinor=input.refundMinor;
  const netMinor=refundMinor===undefined?grossMinor:grossMinor-refundMinor;
  const itemUnits=sales.reduce((sum,order)=>sum+order.items.reduce((s,item)=>s+Math.max(0,Number(item.qty)||0),0),0);

  const channels=new Map<string,{orders:number;grossMinor:number}>();
  for(const order of sales){
    const label=channelName(order.sourceLabel);
    const row=channels.get(label)??{orders:0,grossMinor:0};
    row.orders+=1;
    row.grossMinor+=Math.max(0,Number(order.totalMinor)||0);
    channels.set(label,row);
  }

  const payments=new Map<string,{orders:Set<string>;amountMinor:number}>();
  for(const order of sales){
    for(const part of paymentParts(order.paymentLabel,Math.max(0,Number(order.totalMinor)||0))){
      const row=payments.get(part.label)??{orders:new Set<string>(),amountMinor:0};
      row.orders.add(order.id);
      row.amountMinor+=part.amountMinor;
      payments.set(part.label,row);
    }
  }

  const refundPayments=new Map<string,{orders:Set<string>;amountMinor:number}>();
  for(const refund of input.refunds??[]){
    const label=String(refund.method||'未記錄').trim()||'未記錄';
    const row=refundPayments.get(label)??{orders:new Set<string>(),amountMinor:0};
    row.orders.add(String(refund.id||'REFUND'));
    row.amountMinor+=Math.max(0,Number(refund.amountMinor)||0);
    refundPayments.set(label,row);
  }

  return Object.freeze({
    businessDate:input.close.businessDate,
    closedAt:new Date(input.close.createdAt).toISOString(),
    orderCount:sales.length,
    itemUnits,
    grossMinor,
    ...(refundMinor===undefined?{}:{refundMinor}),
    netMinor,
    channelRows:Object.freeze([...channels.entries()].sort(([a],[b])=>a.localeCompare(b,'zh-HK')).map(([label,row])=>Object.freeze({
      label,orders:row.orders,grossMinor:row.grossMinor,netMinor:row.grossMinor,
    }))),
    paymentRows:Object.freeze([...payments.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([label,row])=>Object.freeze({
      label,orders:row.orders.size,amountMinor:row.amountMinor,
    }))),
    refundRows:Object.freeze([...refundPayments.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([label,row])=>Object.freeze({
      label,orders:row.orders.size,amountMinor:row.amountMinor,
    }))),
    refundDetails:Object.freeze([...(input.refunds??[])].sort((a,b)=>b.executionAt.localeCompare(a.executionAt)).map(row=>Object.freeze({...row}))),
    close:input.close,
  });
}

export function renderDailyCloseTicket(data:DailyClosePrintData){
  const channelLines=data.channelRows.length
    ?data.channelRows.map(row=>row.label+'  '+row.orders+'單  '+money(row.grossMinor)+'\n').join('')
    :'—\n';
  const paymentLines=data.paymentRows.length
    ?data.paymentRows.map(row=>row.label+'  '+row.orders+'單  '+money(row.amountMinor)+'\n').join('')
    :'—\n';
  const refundPaymentLines=data.refundRows.length
    ?data.refundRows.map(row=>row.label+'  '+row.orders+'筆  -'+money(row.amountMinor)+'\n').join('')
    :'—\n';
  const refundLine=data.refundMinor===undefined
    ?'退款總額：—（未接正式退款帳）\n'
    :'退款總額：-'+money(data.refundMinor)+'\n';
  const refundDetailLines=data.refundDetails.length
    ?data.refundDetails.map(row=>{
      const original=new Date(row.originalCreatedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false});
      const execution=new Date(row.executionAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false});
      return row.display+' · '+row.items+'\n'
        +'原單：'+original+'\n'
        +'退款：'+execution+' · '+row.method+' · -'+money(row.amountMinor)+'\n';
    }).join('')
    :'—\n';

  return INIT
    +CENTER+BOLD_ON+DOUBLE+'More Fun  磨飯\n'+NORMAL+BOLD_OFF
    +'日結單 / DAILY CLOSE\n'+LEFT
    +RULE
    +'營業日：'+data.businessDate+'\n'
    +'結算時間：'+new Date(data.closedAt).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false})+'\n'
    +RULE
    +BOLD_ON+'【總覽】\n'+BOLD_OFF
    +'總訂單數：'+data.orderCount+' 單\n'
    +'總件數：'+data.itemUnits+' 件\n'
    +'銷售總額：'+money(data.grossMinor)+'\n'
    +refundLine
    +'淨額：'+money(data.netMinor)+'\n'
    +RULE
    +BOLD_ON+'【渠道】\n'+BOLD_OFF
    +channelLines
    +RULE
    +BOLD_ON+'【付款方式／銷售入賬】\n'+BOLD_OFF
    +paymentLines
    +RULE
    +BOLD_ON+'【退款方式】\n'+BOLD_OFF
    +refundPaymentLines
    +RULE
    +BOLD_ON+'【退款明細】\n'+BOLD_OFF
    +refundDetailLines
    +RULE
    +BOLD_ON+'【現金核數】\n'+BOLD_OFF
    +'開櫃金：'+money(data.close.openingCashMinor)+'\n'
    +'現金銷售：'+money(data.close.cashSalesMinor)+'\n'
    +'現金退款：-'+money(data.close.cashRefundMinor)+'\n'
    +'應有現金：'+money(data.close.expectedCashMinor)+'\n'
    +'實點現金：'+money(data.close.countedCashMinor)+'\n'
    +'差額：'+(data.close.cashDifferenceMinor<0?'-':'')+money(Math.abs(data.close.cashDifferenceMinor))+'\n'
    +(data.close.cashRemovedMinor===undefined?'':'提走現金：'+money(data.close.cashRemovedMinor)+'\n')
    +(data.close.retainedCashMinor===undefined?'':'留櫃現金：'+money(data.close.retainedCashMinor)+'\n')
    +(data.close.note?'備註：'+data.close.note+'\n':'')
    +RULE
    +CENTER+'More Fun Kitchen\n— 手作・真食・更有味 —\n'+LEFT
    +'\n\n';
}
