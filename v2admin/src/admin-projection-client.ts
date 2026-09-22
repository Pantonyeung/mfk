import {readAdminStored,writeAdminStored} from './admin-local-store.ts';

const PUBLISHER_KEY='sync-publisher-key.v1';
const CACHE_KEY='smt-projection-cache.v1';

export interface AdminProjectedOrder{
  readonly orderId:string;
  readonly display:string;
  readonly createdAt:string;
  readonly updatedAt:string;
  readonly businessDate:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly fulfillmentLabel:string;
  readonly sourceLabel:string;
  readonly staffId?:string;
  readonly staffName?:string;
  readonly items:readonly {readonly id:string;readonly name:string;readonly qty:number;readonly unitMinor:number}[];
}

export interface AdminProjectedDay{
  readonly date:string;
  readonly grossMinor:number;
  readonly adjustmentMinor:number;
  readonly netMinor:number;
  readonly orders:number;
  readonly cashSalesMinor:number;
  readonly openingCash:Record<string,unknown>|null;
  readonly dayClose:Record<string,unknown>|null;
}

interface Cache{
  readonly orders:readonly AdminProjectedOrder[];
  readonly days:readonly AdminProjectedDay[];
  readonly updatedAt?:string;
  readonly error?:string;
}

const EMPTY:Cache=Object.freeze({orders:Object.freeze([]),days:Object.freeze([])});
let cache=readAdminStored<Cache>(CACHE_KEY,EMPTY);
const listeners=new Set<()=>void>();
let socket:WebSocket|null=null;
let installed=false;
let reconnectTimer:number|undefined;

function emit(){for(const listener of listeners)listener();}
function writeCache(next:Cache){
  cache=Object.freeze({
    ...next,
    orders:Object.freeze([...(next.orders??[])]),
    days:Object.freeze([...(next.days??[])]),
  });
  writeAdminStored(CACHE_KEY,cache);
  emit();
}
function authHeaders(){
  const key=readAdminStored<string>(PUBLISHER_KEY,'');
  return key?{'x-mfk-admin-publish-key':key}:{};
}

export function readAdminProjectedOrders(){return cache.orders??[];}
export function readAdminProjectedDays(){return cache.days??[];}
export function readAdminProjectionStatus(){return {updatedAt:cache.updatedAt,error:cache.error};}
export function subscribeAdminProjection(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);}

export async function refreshAdminProjection(){
  if(typeof fetch==='undefined')return cache;
  const headers=authHeaders();
  if(!('x-mfk-admin-publish-key' in headers)){
    writeCache({...cache,error:'ADMIN_PROJECTION_AUTH_KEY_MISSING'});
    return cache;
  }
  try{
    const [ordersResponse,reportsResponse]=await Promise.all([
      fetch('/api/projection/orders?storeId=MF01',{cache:'no-store',credentials:'same-origin',headers}),
      fetch('/api/projection/reports?storeId=MF01',{cache:'no-store',credentials:'same-origin',headers}),
    ]);
    if(!ordersResponse.ok)throw new Error('ORDERS_PROJECTION_HTTP_'+ordersResponse.status);
    if(!reportsResponse.ok)throw new Error('REPORTS_PROJECTION_HTTP_'+reportsResponse.status);
    const ordersBody=await ordersResponse.json() as {orders?:AdminProjectedOrder[]};
    const reportsBody=await reportsResponse.json() as {days?:AdminProjectedDay[]};
    writeCache({
      orders:Array.isArray(ordersBody.orders)?ordersBody.orders:[],
      days:Array.isArray(reportsBody.days)?reportsBody.days:[],
      updatedAt:new Date().toISOString(),
    });
    return cache;
  }catch(error){
    writeCache({...cache,error:error instanceof Error?error.message:'ADMIN_PROJECTION_REFRESH_FAILED'});
    return cache;
  }
}

function connect(){
  if(typeof window==='undefined'||typeof WebSocket==='undefined')return;
  if(socket&&socket.readyState<=WebSocket.OPEN)return;
  try{
    const protocol=location.protocol==='https:'?'wss:':'ws:';
    socket=new WebSocket(protocol+'//'+location.host+'/api/admin-sync/events?storeId=MF01');
    socket.addEventListener('open',()=>void refreshAdminProjection());
    socket.addEventListener('message',event=>{
      try{
        const row=JSON.parse(String(event.data)) as {type?:string};
        if(row.type==='SMT_PROJECTION_AVAILABLE')void refreshAdminProjection();
      }catch{}
    });
    socket.addEventListener('close',()=>{
      socket=null;
      if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);
      reconnectTimer=window.setTimeout(connect,5000);
    });
    socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
  }catch{
    reconnectTimer=window.setTimeout(connect,5000);
  }
}

export function installAdminProjectionLiveRead(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const refresh=()=>void refreshAdminProjection();
  window.addEventListener('focus',refresh);
  window.addEventListener('online',refresh);
  window.setTimeout(refresh,0);
  connect();
}
