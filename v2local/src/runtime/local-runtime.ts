import {printTextLan} from './native-print.ts';

export interface SmtOperationalMetric{readonly id:string;readonly label:string;readonly value:string;readonly detail?:string}
export interface SmtOrderListItemViewModel{readonly orderId:string;readonly orderIdLabel:string;readonly itemCount:number;readonly totalLabel:string;readonly paymentLabel:string;readonly fulfillmentLabel:string;readonly sourceLabel?:string;readonly localSequenceLabel?:string}
export interface SmtOrderDetailViewModel extends SmtOrderListItemViewModel{readonly attention:readonly string[];readonly metrics:readonly SmtOperationalMetric[]}
export interface SmtOrdersProjection{readonly items:readonly SmtOrderListItemViewModel[];readonly detailsByOrderId?:Readonly<Record<string,SmtOrderDetailViewModel>>;readonly selectedOrderId?:string;readonly selectedOrder?:SmtOrderDetailViewModel}
export interface SmtDiningQueueItemViewModel{readonly id:string;readonly codeLabel:string;readonly partySize:number;readonly statusLabel:string}
export interface SmtDiningTableViewModel{readonly id:string;readonly areaLabel:string;readonly label:string;readonly state:'available'|'occupied'|'attention';readonly partySize?:number;readonly outstandingLabel?:string}
export interface SmtDiningSessionViewModel{readonly sessionId:string;readonly tableLabels:readonly string[];readonly statusLabel:string;readonly metrics:readonly SmtOperationalMetric[]}
export interface SmtDiningProjection{readonly businessDate:string;readonly revision:number;readonly queue:readonly SmtDiningQueueItemViewModel[];readonly tables:readonly SmtDiningTableViewModel[];readonly selectedSession?:SmtDiningSessionViewModel}
export type SmtAvailabilityStatus='available'|'soldout'|'paused';
export interface SmtAvailabilityNodeViewModel{readonly nodeId:string;readonly label:string;readonly detail?:string;readonly status:SmtAvailabilityStatus;readonly sourceLabel?:string}
export interface SmtAvailabilityProjection{readonly revision:number;readonly nodes:readonly SmtAvailabilityNodeViewModel[];readonly canChange:boolean}

export interface StoredOrder{
  id:string;display:string;createdAt:string;totalMinor:number;paymentLabel:string;fulfillmentLabel:'待處理'|'可取餐'|'已完成';sourceLabel:string;
  items:readonly {id:string;name:string;qty:number;unitMinor:number}[];
}
interface Persisted{orders:StoredOrder[];availability:Record<string,SmtAvailabilityStatus>}
const KEY='mfk.v2local.runtime.v1';
const PRINTER_BINDING_KEY='mfk.v2local.printers.v2';
const listeners=new Set<()=>void>();
const defaults:Persisted={orders:[],availability:{}};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
function read():Persisted{
  try{
    const value=JSON.parse(localStorage.getItem(KEY)||'null');
    return value&&typeof value==='object'?{orders:Array.isArray(value.orders)?value.orders:[],availability:value.availability||{}}:clone(defaults);
  }catch{return clone(defaults)}
}
let data=read();
function save(){localStorage.setItem(KEY,JSON.stringify(data));listeners.forEach(fn=>fn())}
const money=(minor:number)=>'$'+(minor/100).toFixed(2);

export interface CleanSmtCoreRuntimePort{
  subscribe(listener:()=>void):()=>void;
  readOrders?(selectedOrderId?:string):Promise<SmtOrdersProjection>;
  markOrderReady?(orderId:string):Promise<{readonly orderId:string;readonly canonicalRevision:number;readonly status:'READY'}>;
  printOrderReceipt?(orderId:string):Promise<{readonly printJobId:string;readonly state:string}>;
  readDining?(selectedSessionId?:string):Promise<SmtDiningProjection>;
  readAvailability?():Promise<SmtAvailabilityProjection>;
  setAvailability?(nodeId:string,status:SmtAvailabilityStatus,expectedRevision:number):Promise<SmtAvailabilityProjection>;
}
export interface MfkLocalRuntime extends CleanSmtCoreRuntimePort{
  createOrder(input:{items:readonly {id:string;name:string;qty:number;unitMinor:number}[];totalMinor:number;paymentLabel:string;sourceLabel?:string}):StoredOrder;
  orders():readonly StoredOrder[];
  clear():void;
}

const productNames:Record<string,string>={
  riceball:'原味飯團',tuna:'紫菜吞拿魚飯團',pork:'泡菜豬肉飯團',bento:'肉燥便當',
  curry:'咖喱便當',wedges:'香脆薯角',milkTea:'台式奶茶',lemonTea:'手打檸檬茶'
};

export const localRuntime:MfkLocalRuntime=Object.freeze({
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  createOrder(input){
    const n=data.orders.length+1;
    const order:StoredOrder={
      id:'MFK-'+Date.now().toString(36),
      display:'P'+String(n).padStart(3,'0'),
      createdAt:new Date().toISOString(),
      totalMinor:input.totalMinor,
      paymentLabel:input.paymentLabel,
      fulfillmentLabel:'待處理',
      sourceLabel:input.sourceLabel||'現場',
      items:input.items.map(item=>({...item})),
    };
    data={...data,orders:[order,...data.orders]};save();return order;
  },
  orders(){return data.orders},
  clear(){data=clone(defaults);save()},
  async readOrders(selectedOrderId){
    const items=data.orders.map(order=>({
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),
      totalLabel:money(order.totalMinor),paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,
      sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
    }));
    const selectedId=selectedOrderId&&data.orders.some(x=>x.id===selectedOrderId)?selectedOrderId:data.orders[0]?.id;
    const details:Record<string,SmtOrderDetailViewModel>={};
    for(const order of data.orders)details[order.id]={
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),totalLabel:money(order.totalMinor),
      paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      attention:[],metrics:[
        {id:'time',label:'時間',value:new Date(order.createdAt).toLocaleTimeString('zh-HK')},
        {id:'items',label:'件數',value:String(order.items.reduce((s,x)=>s+x.qty,0))},
        {id:'total',label:'總額',value:money(order.totalMinor)}
      ]
    };
    return {items,detailsByOrderId:details,selectedOrderId:selectedId,selectedOrder:selectedId?details[selectedId]:undefined};
  },
  async markOrderReady(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
    data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,fulfillmentLabel:'可取餐'}:x)};save();
    return {orderId,canonicalRevision:Date.now(),status:'READY'};
  },
  async printOrderReceipt(orderId){
    const order=data.orders.find(x=>x.id===orderId);if(!order)throw new Error('ORDER_NOT_FOUND');
    const lines=['磨飯 MFK',order.display,'------------------------------',...order.items.map(x=>x.name+' x'+x.qty),'------------------------------','TOTAL '+money(order.totalMinor),order.paymentLabel];
    let bindings:readonly {id:string;role:string;host:string;port:number;name:string;model:string;capability:'receipt-80mm/kitchen'|'label-58mm'}[]=[];
    try{const value=JSON.parse(localStorage.getItem(PRINTER_BINDING_KEY)||'[]');if(Array.isArray(value))bindings=value;}catch{}
    const printer=bindings.find(x=>x.role==='顧客小票'&&String(x.host||'').trim());
    if(!printer)throw new Error('RECEIPT_PRINTER_NOT_BOUND');
    const result=await printTextLan({
      endpointId:printer.id,
      host:String(printer.host).trim(),
      port:Number(printer.port)||9100,
      displayName:printer.name||'顧客小票打印機',
      model:printer.model||'LAN PRINTER',
      capability:'receipt-80mm/kitchen',
      text:'\x1b\x40'+lines.join('\n')+'\n\n\n'
    });
    if(!result.ok)throw new Error(result.code||'PRINT_FAILED');
    return {printJobId:'local-'+order.id,state:result.code==='ACKNOWLEDGED'?'COMPLETED':'SENT'};
  },
  async readDining(){
    return {
      businessDate:new Date().toISOString().slice(0,10),revision:1,queue:[],
      tables:[
        {id:'A1',areaLabel:'A區',label:'A1',state:'available'},
        {id:'A2',areaLabel:'A區',label:'A2',state:'available'},
        {id:'A3',areaLabel:'A區',label:'A3',state:'available'},
        {id:'B1',areaLabel:'B區',label:'B1',state:'available'},
      ]
    };
  },
  async readAvailability(){
    return {revision:1,nodes:Object.entries(productNames).map(([nodeId,label])=>({nodeId,label,status:data.availability[nodeId]||'available',sourceLabel:'LOCAL'})),canChange:true};
  },
  async setAvailability(nodeId,status){
    data={...data,availability:{...data.availability,[nodeId]:status}};save();
    return {revision:1,nodes:Object.entries(productNames).map(([id,label])=>({nodeId:id,label,status:data.availability[id]||'available',sourceLabel:'LOCAL'})),canChange:true};
  }
});
