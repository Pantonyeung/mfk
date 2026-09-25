import type {SmmLanOrderRequest,SmmLanOrderResponse} from '../../../contracts/smm-lan-v1.ts';
import {readSmtDeviceId} from './admin-config-sync.ts';

const ENDPOINT='https://smm.morefunos.com';

export interface SmmCanonicalIngress{
  submit(input:SmmLanOrderRequest,context:{deviceId:string;trusted:boolean}):SmmLanOrderResponse;
}

async function getPending(deviceId:string){
  const response=await fetch(
    ENDPOINT+'/api/smm/smt/orders/pending?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {cache:'no-store'},
  );
  if(response.status===401||response.status===404)return[];
  if(!response.ok)throw new Error('SMM_CLOUD_PENDING_HTTP_'+response.status);
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  return Array.isArray(body.orders)?body.orders:[];
}

async function ack(deviceId:string,request:SmmLanOrderRequest,result:SmmLanOrderResponse){
  const response=await fetch(
    ENDPOINT+'/api/smm/smt/orders/ack?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        submissionId:request.submissionId,
        idempotencyKey:request.idempotencyKey,
        result,
      }),
    },
  );
  if(!response.ok&&response.status!==404)throw new Error('SMM_CLOUD_ACK_HTTP_'+response.status);
}

let installed=false;
let reconciling=false;
let timer:number|undefined;

export async function reconcileSmmCloudIntake(ingress:SmmCanonicalIngress){
  if(reconciling||typeof navigator!=='undefined'&&navigator.onLine===false)return;
  reconciling=true;
  const deviceId=readSmtDeviceId();
  try{
    const rows=await getPending(deviceId);
    for(const raw of rows){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
      const row=raw as Record<string,unknown>;
      const request=row.request as SmmLanOrderRequest|undefined;
      if(!request||request.protocolVersion!==1||request.type!=='smm.lan.order.submit.v1')continue;
      let result:SmmLanOrderResponse;
      try{
        result=ingress.submit(request,{deviceId,trusted:true});
      }catch(error){
        result=Object.freeze({
          protocolVersion:1,
          type:'smm.lan.order.result.v1',
          requestId:String(request.requestId||''),
          submissionId:String(request.submissionId||''),
          idempotencyKey:String(request.idempotencyKey||''),
          disposition:'REJECTED',
          reasonCode:error instanceof Error?error.message:'SMM_CLOUD_INTAKE_FAILED',
        });
      }
      await ack(deviceId,request,result);
    }
  }catch{
    // Cloud staff intent delivery is assistive only. Local SMT transaction truth
    // remains available and this poller must never block the Store Kernel.
  }finally{
    reconciling=false;
  }
}

export function installSmmCloudIntake(ingress:SmmCanonicalIngress){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const reconcile=()=>void reconcileSmmCloudIntake(ingress);
  window.addEventListener('online',reconcile);
  window.addEventListener('focus',reconcile);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconcile();});
  timer=window.setInterval(()=>{
    if(document.visibilityState==='visible'&&navigator.onLine)reconcile();
  },3000);
  window.setTimeout(reconcile,0);
}
