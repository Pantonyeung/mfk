import type {SmmLanOrderRequest,SmmLanOrderResponse} from '../../../contracts/smm-lan-v1.ts';

export interface SmmWebAcceptanceIngress{
  submit(input:SmmLanOrderRequest,context:{deviceId:string;trusted:boolean}):SmmLanOrderResponse;
}

async function getPending(){
  const response=await fetch('/__mfk/smm-acceptance/pending',{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)throw new Error('SMM_WEB_ACCEPTANCE_PENDING_HTTP_'+response.status);
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  return Array.isArray(body.orders)?body.orders:[];
}

async function ack(request:SmmLanOrderRequest,result:SmmLanOrderResponse){
  const response=await fetch('/__mfk/smm-acceptance/ack',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      submissionId:request.submissionId,
      idempotencyKey:request.idempotencyKey,
      result,
    }),
  });
  if(!response.ok)throw new Error('SMM_WEB_ACCEPTANCE_ACK_HTTP_'+response.status);
}

let installed=false;
let reconciling=false;
let timer:number|undefined;

export async function reconcileSmmWebAcceptanceIntake(ingress:SmmWebAcceptanceIngress){
  if(reconciling||typeof navigator!=='undefined'&&navigator.onLine===false)return;
  reconciling=true;
  try{
    const rows=await getPending();
    for(const raw of rows){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
      const row=raw as Record<string,unknown>;
      const request=row.request as SmmLanOrderRequest|undefined;
      if(!request||request.protocolVersion!==1||request.type!=='smm.lan.order.submit.v1')continue;

      let result:SmmLanOrderResponse;
      try{
        result=ingress.submit(request,{deviceId:'WEB-ACCEPTANCE',trusted:true});
      }catch(error){
        result=Object.freeze({
          protocolVersion:1,
          type:'smm.lan.order.result.v1',
          requestId:String(request.requestId||''),
          submissionId:String(request.submissionId||''),
          idempotencyKey:String(request.idempotencyKey||''),
          disposition:'REJECTED',
          reasonCode:error instanceof Error?error.message:'SMM_WEB_ACCEPTANCE_COMMIT_FAILED',
        });
      }
      await ack(request,result);
    }
  }catch{
    // Temporary browser acceptance must never affect local SMT truth or crash UI.
  }finally{
    reconciling=false;
  }
}

export function installSmmWebAcceptanceIntake(ingress:SmmWebAcceptanceIngress){
  if(installed||typeof window==='undefined')return;
  installed=true;
  const reconcile=()=>void reconcileSmmWebAcceptanceIntake(ingress);
  window.addEventListener('online',reconcile);
  window.addEventListener('focus',reconcile);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconcile();});
  timer=window.setInterval(()=>{
    if(document.visibilityState==='visible'&&navigator.onLine)reconcile();
  },1500);
  window.setTimeout(reconcile,0);
}
