import {createContext,useContext,useEffect,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {AdminDayCloseRefundAddendum,AdminRefundEvent} from '../../contracts/admin-refund-v1.ts';

export interface V3ProjectedOrderItem{
  readonly id:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
}
export interface V3ProjectedOrder{
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
  readonly refunds?:readonly Record<string,unknown>[];
  readonly items:readonly V3ProjectedOrderItem[];
}
export interface V3ProjectedDay{
  readonly date:string;
  readonly grossMinor:number;
  readonly adjustmentMinor:number;
  readonly netMinor:number;
  readonly orders:number;
  readonly cashSalesMinor:number;
  readonly refundMinor?:number;
  readonly cashRefundMinor?:number;
  readonly openingCash:Record<string,unknown>|null;
  readonly dayClose:Record<string,unknown>|null;
}

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}
function endpoint(path:string,storeId:string){
  return apiBase()+path+'?storeId='+encodeURIComponent(storeId);
}
async function getJson(path:string,storeId:string,sessionToken:string){
  const response=await fetch(endpoint(path,storeId),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:{'x-mfk-admin-session':sessionToken,'accept':'application/json'},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.code||path+'_HTTP_'+response.status));
  return body;
}

export async function readV3ProjectedOrders(input:{storeId:string;sessionToken:string}):Promise<readonly V3ProjectedOrder[]>{
  const body=await getJson('/api/projection/orders',input.storeId,input.sessionToken);
  return Array.isArray(body.orders)?body.orders as unknown as readonly V3ProjectedOrder[]:[];
}
export async function readV3ProjectedDays(input:{storeId:string;sessionToken:string}):Promise<readonly V3ProjectedDay[]>{
  const body=await getJson('/api/projection/reports',input.storeId,input.sessionToken);
  return Array.isArray(body.days)?body.days as unknown as readonly V3ProjectedDay[]:[];
}
export async function readV3RefundProjection(input:{storeId:string;sessionToken:string}):Promise<{refunds:readonly AdminRefundEvent[];addenda:readonly AdminDayCloseRefundAddendum[]}>{
  const body=await getJson('/api/admin-sync/refunds',input.storeId,input.sessionToken);
  return{
    refunds:Array.isArray(body.refunds)?body.refunds as unknown as readonly AdminRefundEvent[]:[],
    addenda:Array.isArray(body.addenda)?body.addenda as unknown as readonly AdminDayCloseRefundAddendum[]:[],
  };
}

export function v3ProjectionOrdersKey(storeId:string){return ['mfk','admin-v3','projection','orders',storeId] as const;}
export function v3ProjectionReportsKey(storeId:string){return ['mfk','admin-v3','projection','reports',storeId] as const;}
export function v3ProjectionRefundsKey(storeId:string){return ['mfk','admin-v3','projection','refunds',storeId] as const;}

interface V3ReadModelContextValue{
  readonly orders:readonly V3ProjectedOrder[];
  readonly days:readonly V3ProjectedDay[];
  readonly refunds:readonly AdminRefundEvent[];
  readonly refundAddenda:readonly AdminDayCloseRefundAddendum[];
  readonly ordersPending:boolean;
  readonly reportsPending:boolean;
  readonly refundsPending:boolean;
  readonly ordersRefreshing:boolean;
  readonly reportsRefreshing:boolean;
  readonly refundsRefreshing:boolean;
  readonly ordersError:Error|null;
  readonly reportsError:Error|null;
  readonly refundsError:Error|null;
  readonly refresh:()=>Promise<void>;
}
const V3ReadModelContext=createContext<V3ReadModelContextValue|null>(null);

export function V3ReadModelProvider({storeId,sessionToken,children}:{storeId:string;sessionToken:string;children:ReactNode}){
  const queryClient=useQueryClient();
  const ordersKey=v3ProjectionOrdersKey(storeId);
  const reportsKey=v3ProjectionReportsKey(storeId);
  const refundsKey=v3ProjectionRefundsKey(storeId);
  const orders=useQuery({
    queryKey:ordersKey,
    queryFn:()=>readV3ProjectedOrders({storeId,sessionToken}),
    staleTime:0,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    retry:1,
  });
  const reports=useQuery({
    queryKey:reportsKey,
    queryFn:()=>readV3ProjectedDays({storeId,sessionToken}),
    staleTime:0,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    retry:1,
  });

  const refunds=useQuery({
    queryKey:refundsKey,
    queryFn:()=>readV3RefundProjection({storeId,sessionToken}),
    staleTime:0,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    retry:1,
  });

  useEffect(()=>{
    if(typeof window==='undefined'||typeof WebSocket==='undefined')return;
    let socket:WebSocket|null=null;
    let reconnect:number|undefined;
    let closed=false;
    const invalidate=()=>{
      void queryClient.invalidateQueries({queryKey:ordersKey});
      void queryClient.invalidateQueries({queryKey:reportsKey});
      void queryClient.invalidateQueries({queryKey:refundsKey});
    };
    const connect=()=>{
      if(closed)return;
      const protocol=window.location.protocol==='https:'?'wss:':'ws:';
      try{
        socket=new WebSocket(protocol+'//'+window.location.host+'/api/admin-sync/events?storeId='+encodeURIComponent(storeId));
        socket.addEventListener('open',invalidate);
        socket.addEventListener('message',event=>{
          try{
            const message=JSON.parse(String(event.data)) as {type?:string};
            if(message.type==='SMT_PROJECTION_AVAILABLE'||message.type==='ADMIN_REFUND_AVAILABLE')invalidate();
          }catch{}
        });
        socket.addEventListener('close',()=>{
          socket=null;
          if(!closed)reconnect=window.setTimeout(connect,5000);
        });
        socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
      }catch{
        reconnect=window.setTimeout(connect,5000);
      }
    };
    connect();
    return()=>{
      closed=true;
      if(reconnect!==undefined)window.clearTimeout(reconnect);
      try{socket?.close();}catch{}
    };
  },[queryClient,storeId]);

  const value:V3ReadModelContextValue={
    orders:orders.data??[],
    days:reports.data??[],
    refunds:refunds.data?.refunds??[],
    refundAddenda:refunds.data?.addenda??[],
    ordersPending:orders.isPending,
    reportsPending:reports.isPending,
    refundsPending:refunds.isPending,
    ordersRefreshing:orders.isFetching&&!orders.isPending,
    reportsRefreshing:reports.isFetching&&!reports.isPending,
    refundsRefreshing:refunds.isFetching&&!refunds.isPending,
    ordersError:orders.error as Error|null,
    reportsError:reports.error as Error|null,
    refundsError:refunds.error as Error|null,
    refresh:async()=>{await Promise.all([orders.refetch(),reports.refetch(),refunds.refetch()]);},
  };
  return <V3ReadModelContext.Provider value={value}>{children}</V3ReadModelContext.Provider>;
}

export function useV3ReadModels(){
  const value=useContext(V3ReadModelContext);
  if(!value)throw new Error('V3_READ_MODEL_PROVIDER_REQUIRED');
  return value;
}
