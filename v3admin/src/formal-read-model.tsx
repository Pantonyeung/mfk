export const V3_OPERATIONAL_EVENT_CHANNEL_STATUS='UNBOUND' as const;
import {createContext,useContext,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {AdminDayCloseRefundAddendum,AdminRefundEvent} from '../../contracts/admin-refund-v1.ts';
import type {MfkAdminConfigAck} from '../../contracts/admin-config-sync-v1.ts';

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
  readonly printEvidence?:Readonly<{
    readonly scope:'DINING_INITIAL';
    readonly certainty:'TRANSPORT_ONLY';
    readonly attemptedAt:string;
    readonly completedAt?:string;
    readonly state:'DONE'|'FAILED'|'UNKNOWN';
    readonly planned:number;
    readonly sent:number;
    readonly failed:number;
    readonly results:readonly Readonly<{
      readonly jobId:string;
      readonly role:string;
      readonly ok:boolean;
      readonly code:string;
    }>[];
  }>;
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

export interface V3KeetaLiveStatus{
  readonly provider:'KEETA';
  readonly market:'HONG_KONG';
  readonly canonicalStoreId:string;
  readonly providerShopId:number|null;
  readonly readyForAuthorization:boolean;
  readonly missingConfig:readonly string[];
  readonly oauth:{
    readonly state:'NOT_CONNECTED'|'CONNECTED'|'EXPIRED'|'REAUTH_REQUIRED';
    readonly expiresAt:string|null;
    readonly tokenSource:string|null;
    readonly autoRefresh?:{readonly state:string;readonly nextRefreshAt:string|null;readonly lastSuccessAt:string|null;readonly lastError:string|null};
  };
  readonly webhook:{
    readonly callbackUrl:string;
    readonly acceptedCount:number;
    readonly duplicateCount:number;
    readonly conflictCount:number;
    readonly lastAcceptedAt:string|null;
    readonly lastSignatureFailureAt:string|null;
  };
  readonly knownExternalBlocker:string|null;
}
export interface V3KeetaCommercialRow{
  readonly state:'WEBHOOK_CAPTURED'|'PROVIDER_CONFIRMED';
  readonly provider:'KEETA';
  readonly canonicalStoreId:string;
  readonly providerShopId:number;
  readonly providerOrderId:string;
  readonly providerOrderCode:string;
  readonly canonicalOrderId:string|null;
  readonly canonicalDisplay:string|null;
  readonly capturedAt:string;
  readonly providerConfirmedAt:string|null;
  readonly latestEvidenceRef:string;
  readonly snapshot:{
    readonly currency:string;
    readonly merchandiseSubtotalMinor?:number;
    readonly customerPaidMinor?:number;
    readonly shippingFeeMinor?:number;
    readonly customerPlatformFeeMinor?:number;
    readonly minimumOrderTopUpMinor?:number;
    readonly merchantCommissionMinor?:number;
    readonly merchantActivityFeeMinor?:number;
    readonly merchantEarningsMinor?:number;
    readonly settlementAuthority:'UNKNOWN'|'PROVIDER_ESTIMATE'|'PROVIDER_CONFIRMED'|'PAID_RECONCILED';
    readonly capturedAt:string;
    readonly providerEvidenceRef:string;
  };
}

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}
function endpoint(path:string,storeId:string){
  return apiBase()+path+'?storeId='+encodeURIComponent(storeId);
}
async function requestJson(path:string,storeId:string,sessionToken:string,method:'GET'|'POST'){
  const response=await fetch(endpoint(path,storeId),{
    method,
    cache:'no-store',
    credentials:'include',
    headers:{'x-mfk-admin-session':sessionToken,'accept':'application/json','content-type':'application/json'},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.code||path+'_HTTP_'+response.status));
  return body;
}
async function getJson(path:string,storeId:string,sessionToken:string){return requestJson(path,storeId,sessionToken,'GET');}
async function postJson(path:string,storeId:string,sessionToken:string){return requestJson(path,storeId,sessionToken,'POST');}

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

export async function readV3KeetaLiveStatus(input:{storeId:string;sessionToken:string}):Promise<V3KeetaLiveStatus>{
  return await postJson('/api/keeta/admin/status',input.storeId,input.sessionToken) as unknown as V3KeetaLiveStatus;
}
export async function readV3KeetaCommercialRows(input:{storeId:string;sessionToken:string}):Promise<readonly V3KeetaCommercialRow[]>{
  const body=await postJson('/api/keeta/admin/commercial/list',input.storeId,input.sessionToken);
  return Array.isArray(body.items)?body.items as unknown as readonly V3KeetaCommercialRow[]:[];
}

export async function readV3AdminAcks(input:{storeId:string;sessionToken:string}):Promise<readonly MfkAdminConfigAck[]>{
  const body=await getJson('/api/admin-sync/acks',input.storeId,input.sessionToken);
  return Array.isArray(body.acks)?body.acks as unknown as readonly MfkAdminConfigAck[]:[];
}

export function v3ProjectionOrdersKey(storeId:string){return ['mfk','admin-v3','projection','orders',storeId] as const;}
export function v3ProjectionReportsKey(storeId:string){return ['mfk','admin-v3','projection','reports',storeId] as const;}
export function v3ProjectionRefundsKey(storeId:string){return ['mfk','admin-v3','projection','refunds',storeId] as const;}
export function v3KeetaStatusKey(storeId:string){return ['mfk','admin-v3','keeta','status',storeId] as const;}
export function v3KeetaCommercialKey(storeId:string){return ['mfk','admin-v3','keeta','commercial',storeId] as const;}
export function v3AdminAcksKey(storeId:string){return ['mfk','admin-v3','sync','acks',storeId] as const;}

interface V3ReadModelContextValue{
  readonly orders:readonly V3ProjectedOrder[];
  readonly days:readonly V3ProjectedDay[];
  readonly refunds:readonly AdminRefundEvent[];
  readonly refundAddenda:readonly AdminDayCloseRefundAddendum[];
  readonly keetaStatus:V3KeetaLiveStatus|null;
  readonly keetaCommercial:readonly V3KeetaCommercialRow[];
  readonly acks:readonly MfkAdminConfigAck[];
  readonly ordersPending:boolean;
  readonly reportsPending:boolean;
  readonly refundsPending:boolean;
  readonly keetaPending:boolean;
  readonly acksPending:boolean;
  readonly ordersRefreshing:boolean;
  readonly reportsRefreshing:boolean;
  readonly refundsRefreshing:boolean;
  readonly keetaRefreshing:boolean;
  readonly acksRefreshing:boolean;
  readonly ordersError:Error|null;
  readonly reportsError:Error|null;
  readonly refundsError:Error|null;
  readonly keetaError:Error|null;
  readonly acksError:Error|null;
  readonly allDataUpdatedAt:number;
  readonly anyRefreshing:boolean;
  readonly anyError:boolean;
  readonly refresh:()=>Promise<void>;
}
const V3ReadModelContext=createContext<V3ReadModelContextValue|null>(null);

export function V3ReadModelProvider({storeId,sessionToken,children}:{storeId:string;sessionToken:string;children:ReactNode}){
  const ordersKey=v3ProjectionOrdersKey(storeId);
  const reportsKey=v3ProjectionReportsKey(storeId);
  const refundsKey=v3ProjectionRefundsKey(storeId);
  const keetaStatusKey=v3KeetaStatusKey(storeId);
  const keetaCommercialKey=v3KeetaCommercialKey(storeId);
  const acksKey=v3AdminAcksKey(storeId);
  const orders=useQuery({
    queryKey:ordersKey,
    queryFn:()=>readV3ProjectedOrders({storeId,sessionToken}),
    staleTime:0,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    refetchInterval:false,
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
    refetchInterval:false,
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
    refetchInterval:false,
    retry:1,
  });

  const keetaStatus=useQuery({
    queryKey:keetaStatusKey,
    queryFn:()=>readV3KeetaLiveStatus({storeId,sessionToken}),
    staleTime:30*1000,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    refetchInterval:false,
    retry:1,
  });
  const keetaCommercial=useQuery({
    queryKey:keetaCommercialKey,
    queryFn:()=>readV3KeetaCommercialRows({storeId,sessionToken}),
    staleTime:30*1000,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    refetchInterval:false,
    retry:1,
  });

  const acks=useQuery({
    queryKey:acksKey,
    queryFn:()=>readV3AdminAcks({storeId,sessionToken}),
    staleTime:0,
    gcTime:5*60*1000,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    refetchInterval:false,
    retry:1,
  });

  // The unaudited generic event endpoint remains blocked; do not create a reconnect loop.


  const updatedTimes=[
    orders.dataUpdatedAt,
    reports.dataUpdatedAt,
    refunds.dataUpdatedAt,
    keetaStatus.dataUpdatedAt,
    keetaCommercial.dataUpdatedAt,
    acks.dataUpdatedAt,
  ];
  const allDataUpdatedAt=updatedTimes.every(value=>value>0)?Math.min(...updatedTimes):0;
  const anyRefreshing=[orders,reports,refunds,keetaStatus,keetaCommercial,acks].some(query=>query.isFetching);
  const anyError=[orders,reports,refunds,keetaStatus,keetaCommercial,acks].some(query=>Boolean(query.error));

  const value:V3ReadModelContextValue={
    orders:orders.data??[],
    days:reports.data??[],
    refunds:refunds.data?.refunds??[],
    refundAddenda:refunds.data?.addenda??[],
    keetaStatus:keetaStatus.data??null,
    keetaCommercial:keetaCommercial.data??[],
    acks:acks.data??[],
    ordersPending:orders.isPending,
    reportsPending:reports.isPending,
    refundsPending:refunds.isPending,
    keetaPending:keetaStatus.isPending||keetaCommercial.isPending,
    acksPending:acks.isPending,
    ordersRefreshing:orders.isFetching&&!orders.isPending,
    reportsRefreshing:reports.isFetching&&!reports.isPending,
    refundsRefreshing:refunds.isFetching&&!refunds.isPending,
    keetaRefreshing:(keetaStatus.isFetching&&!keetaStatus.isPending)||(keetaCommercial.isFetching&&!keetaCommercial.isPending),
    acksRefreshing:acks.isFetching&&!acks.isPending,
    ordersError:orders.error as Error|null,
    reportsError:reports.error as Error|null,
    refundsError:refunds.error as Error|null,
    keetaError:(keetaStatus.error??keetaCommercial.error) as Error|null,
    acksError:acks.error as Error|null,
    allDataUpdatedAt,
    anyRefreshing,
    anyError,
    refresh:async()=>{await Promise.all([orders.refetch(),reports.refetch(),refunds.refetch(),keetaStatus.refetch(),keetaCommercial.refetch(),acks.refetch()]);},
  };
  return <V3ReadModelContext.Provider value={value}>{children}</V3ReadModelContext.Provider>;
}

export function useV3ReadModels(){
  const value=useContext(V3ReadModelContext);
  if(!value)throw new Error('V3_READ_MODEL_PROVIDER_REQUIRED');
  return value;
}
