import {useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {MfpCheckoutRuntimeBinding} from './checkout-runtime.ts';
import {
  createMfpOrderOperationSession,
  openMfpSplitCheckout,
  validateMfpOrderOperationsReadModel,
  type MfpA5CheckoutEntry,
  type MfpFormalOrderCheckoutPart,
  type MfpOrderOperation,
  type MfpOrderOperationsReadPort,
} from './order-operations-domain.ts';
import {
  MfpOperationsNavigation,
  MfpOrderOperationsWorkspace,
  type MfpAppPage,
  type MfpOperationalPage,
} from './order-operations-workspace.tsx';
import {MfpOrderingRuntime} from './ordering-runtime.tsx';
import type {MfpNormalizedOrderingIntent,MfpOrderingSurface} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpSyncCoordinator,MfpSyncProjectionStore} from './sync-port.ts';
import type {MfpTenderConfig} from './checkout-domain.ts';
import {createMfpPrintHardwareSession,type MfpPrintHardwareBinding,type MfpPrintHardwareSession} from './print-hardware-domain.ts';
import {MfpPrintHardwareRuntime,mfpPrintHardwareRuntimeBinding} from './print-hardware-runtime.tsx';

type OperationsBinding=Readonly<{
  authority:MfpOrderOperationsReadPort&Required<Pick<MfpOrderOperationsReadPort,'readOperations'>>;
  splitCheckout:MfpA5CheckoutEntry;
  tenders:readonly MfpTenderConfig[];
}>;

const unavailable=()=>Promise.reject(new Error('MFP_ORDER_OPERATIONS_BINDING_UNAVAILABLE'));

export const mfpOrderOperationsRuntimeBinding:OperationsBinding=Object.freeze({
  authority:Object.freeze({readOrder:unavailable,readOperations:unavailable}),
  splitCheckout:Object.freeze({openFormalOrderPart(){throw new Error('MFP_A5_SPLIT_CHECKOUT_BINDING_UNAVAILABLE');}}),
  tenders:Object.freeze([]),
});

const message=(error:unknown)=>error instanceof Error?error.message:'MFP_ORDER_OPERATION_UNAVAILABLE';

function MfpOrderOperationsRuntime({surface,page,security,binding,pendingDiningIntent,onDiningAdmitted,onReturnToOrdering,printSession,onOpenPrintHardware}:{
  surface:MfpOrderingSurface;
  page:MfpOperationalPage;
  security:MfpSecurityPort;
  binding:OperationsBinding;
  pendingDiningIntent:MfpNormalizedOrderingIntent|null;
  onDiningAdmitted:()=>void;
  onReturnToOrdering:()=>void;
  printSession:MfpPrintHardwareSession;
  onOpenPrintHardware:()=>void;
}){
  const [operationStatus,setOperationStatus]=useState('');
  const sessions=useRef(new Map<string,ReturnType<typeof createMfpOrderOperationSession>>());
  const readback=useQuery({
    queryKey:['mfp','order-operations'],
    queryFn:async()=>validateMfpOrderOperationsReadModel(await binding.authority.readOperations()),
    refetchInterval:false,
  });

  const submit=async(operation:MfpOrderOperation)=>{
    const key=JSON.stringify(operation);
    let session=sessions.current.get(key);
    if(!session){
      // ponytail: 128 identities bound one open UI session; move to a shared registry only if that ceiling is observed.
      if(sessions.current.size>=128)sessions.current.delete(sessions.current.keys().next().value!);
      session=createMfpOrderOperationSession({
        storeId:readback.data?.storeId,
        operation,
        operationId:`MFP-A6-${crypto.randomUUID()}`,
        security,
        authority:binding.authority,
      });
      sessions.current.set(key,session);
    }
    setOperationStatus('UNKNOWN · 正在向 Store Kernel 查核');
    try{
      const outcome=await session.submit();
      if(outcome.state==='COMMITTED'){
        setOperationStatus('SOURCE_VERIFIED · 正式操作已由 canonical readback 確認');
        if(operation.kind==='CANCEL'&&outcome.order?.cancelNoticeIntent==='CANCEL_NOTICE_REQUIRED'){
          void printSession.ensureCancelNotice(operation.orderId,`MFP-A7-CANCEL-${operation.orderId}-${outcome.order.revision}`)
            .then(()=>setOperationStatus('SOURCE_VERIFIED · 正式操作已確認 · Cancel Notice 已提交'))
            .catch(error=>setOperationStatus(`SOURCE_VERIFIED · 正式操作已確認 · PRINT ATTENTION · ${message(error)}`));
        }
        if(operation.kind==='ADMIT_DINING_ORDER')onDiningAdmitted();
      }
      else if(outcome.state==='REJECTED')setOperationStatus(`REJECTED · ${outcome.result.rejectionCode}`);
      else setOperationStatus('UNKNOWN · 未能確認結果，重試會先做 readback');
      await readback.refetch();
    }catch(error){setOperationStatus(`UNKNOWN · ${message(error)}`);}
  };

  const split=async(part:MfpFormalOrderCheckoutPart)=>{
    try{
      await Promise.resolve(openMfpSplitCheckout(binding.splitCheckout,part));
      setOperationStatus('SOURCE_VERIFIED · 已交由 A5 Checkout');
    }catch(error){setOperationStatus(`BLOCKED · ${message(error)}`);}
  };

  if(readback.isPending)return <section className="mfp-operations-state" aria-busy="true"><b>正在讀取正式訂單…</b><span>畫面只會顯示 canonical readback。</span></section>;
  if(readback.error||!readback.data)return <section className="mfp-operations-state" role="alert"><b>Order Operations 暫未接駁</b><span>{message(readback.error)}</span><button type="button" onClick={()=>void readback.refetch()}>重新讀取</button></section>;
  return <MfpOrderOperationsWorkspace surface={surface} page={page} model={readback.data} tenders={binding.tenders} operationStatus={operationStatus} pendingDiningIntent={pendingDiningIntent} onOperation={operation=>void submit(operation)} onSplitCheckout={part=>void split(part)} onTool={tool=>{if(tool==='Print Devices')onOpenPrintHardware();else setOperationStatus(tool==='Day Close'||tool==='Reports'?'BLOCKED · 需要現有 A5 Money / Reporting runtime binding':'BLOCKED · 此工具會由後續 Stage 接駁');}} onReturnToOrdering={onReturnToOrdering} printSession={printSession}/>;
}

export function MfpApplicationRuntime({surface,security,sync,projectionStore,checkout,operations=mfpOrderOperationsRuntimeBinding,print=mfpPrintHardwareRuntimeBinding}:{
  surface:MfpOrderingSurface;
  security:MfpSecurityPort;
  sync:MfpSyncCoordinator;
  projectionStore:MfpSyncProjectionStore;
  checkout:MfpCheckoutRuntimeBinding;
  operations?:OperationsBinding;
  print?:MfpPrintHardwareBinding;
}){
  const [page,setPage]=useState<MfpAppPage>('ORDERING');
  const [pendingDiningIntent,setPendingDiningIntent]=useState<MfpNormalizedOrderingIntent|null>(null);
  const printSession=useRef<MfpPrintHardwareSession|null>(null);
  if(!printSession.current)printSession.current=createMfpPrintHardwareSession(print);
  return <div className="mfp-application-runtime">
    <MfpOperationsNavigation surface={surface} active={page} onNavigate={setPage}/>
    <div className="mfp-application-workspace">
      <div hidden={page!=='ORDERING'}><MfpOrderingRuntime surface={surface} security={security} sync={sync} projectionStore={projectionStore} checkout={checkout} onDiningIntent={intent=>{setPendingDiningIntent(intent);setPage('DINING');}}/></div>
      {page==='PRINT_HARDWARE'?<MfpPrintHardwareRuntime surface={surface} session={printSession.current}/>:null}
      {page!=='ORDERING'&&page!=='PRINT_HARDWARE'?<MfpOrderOperationsRuntime surface={surface} page={page} security={security} binding={operations} pendingDiningIntent={pendingDiningIntent} onDiningAdmitted={()=>setPendingDiningIntent(null)} onReturnToOrdering={()=>setPage('ORDERING')} printSession={printSession.current} onOpenPrintHardware={()=>setPage('PRINT_HARDWARE')}/>:null}
    </div>
  </div>;
}
