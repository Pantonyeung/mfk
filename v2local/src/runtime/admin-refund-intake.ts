import {validateAdminRefundList,type AdminRefundEvent} from '../../../contracts/admin-refund-v1.ts';
import {readSmtDeviceId,SMT_ADMIN_CONFIG_ENDPOINT,subscribeSmtCloudDoorbell} from './admin-config-sync.ts';
import {localRuntime} from './local-runtime.ts';

export const ADMIN_REFUND_INTAKE_STATUS_KEY='mfk.admin-refund-intake.status.v1' as const;

export interface AdminRefundIntakeStatus{
  readonly updatedAt:string;
  readonly fetched:number;
  readonly applied:number;
  readonly idempotent:number;
  readonly failed:readonly {readonly refundId:string;readonly code:string}[];
}

function writeStatus(status:AdminRefundIntakeStatus){
  try{localStorage.setItem(ADMIN_REFUND_INTAKE_STATUS_KEY,JSON.stringify(status));}catch{}
}
export function readAdminRefundIntakeStatus():AdminRefundIntakeStatus|null{
  try{
    const value=JSON.parse(localStorage.getItem(ADMIN_REFUND_INTAKE_STATUS_KEY)||'null');
    return value&&typeof value==='object'?value as AdminRefundIntakeStatus:null;
  }catch{return null;}
}

let reconciling=false;
export async function reconcileAdminRefunds(){
  if(reconciling||typeof fetch==='undefined')return readAdminRefundIntakeStatus();
  reconciling=true;
  try{
    const url=SMT_ADMIN_CONFIG_ENDPOINT+'/api/admin-sync/smt-refunds?storeId=MF01&deviceId='+encodeURIComponent(readSmtDeviceId());
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error('ADMIN_REFUND_INTAKE_HTTP_'+response.status);
    const refunds=validateAdminRefundList(await response.json());
    let applied=0,idempotent=0;
    const failed:{refundId:string;code:string}[]=[];
    for(const refund of refunds){
      try{
        const result=localRuntime.applyAdminRefundEvent(refund);
        if(result.disposition==='APPLIED')applied+=1;
        else idempotent+=1;
      }catch(error){
        failed.push({
          refundId:(refund as AdminRefundEvent).refundId,
          code:error instanceof Error?error.message:'ADMIN_REFUND_APPLY_FAILED',
        });
      }
    }
    const status=Object.freeze({
      updatedAt:new Date().toISOString(),
      fetched:refunds.length,
      applied,
      idempotent,
      failed:Object.freeze(failed),
    });
    writeStatus(status);
    return status;
  }finally{
    reconciling=false;
  }
}

let installed=false;
export function installAdminRefundIntake(){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const reconcile=()=>void reconcileAdminRefunds();
  subscribeSmtCloudDoorbell(event=>{
    if(event.type==='ADMIN_REFUND_AVAILABLE')reconcile();
  });
  window.addEventListener('online',reconcile);
  window.addEventListener('focus',reconcile);
  window.setTimeout(reconcile,0);
}
