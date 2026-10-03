import {useQuery} from '@tanstack/react-query';

import {
  type MfpPrintHardwareBinding,
  type MfpPrintHardwareSession,
} from './print-hardware-domain.ts';
import {MfpPrintHardwareWorkspace} from './print-hardware-workspace.tsx';
import type {MfpOrderingSurface} from './ordering-domain.ts';

const unavailable=()=>Promise.reject(new Error('MFP_PRINT_HARDWARE_BINDING_UNAVAILABLE'));

export const mfpPrintHardwareRuntimeBinding:MfpPrintHardwareBinding=Object.freeze({
  authority:Object.freeze({
    readPrintModel:unavailable,authorizeDispatch:unavailable,requestReprint:unavailable,
    requestSafeRetry:unavailable,ensureCancelNotice:unavailable,
  }),
  gateway:Object.freeze({
    readGatewaySnapshot:unavailable,enqueueCanonicalPrintJob:unavailable,readEndpointBindings:unavailable,
    applyEndpointBinding:unavailable,probeEndpoint:unavailable,testEndpoint:unavailable,
  }),
});

export function MfpPrintHardwareRuntime({surface,session}:{surface:MfpOrderingSurface;session:MfpPrintHardwareSession}){
  const readback=useQuery({
    queryKey:['mfp','print-hardware'],queryFn:session.read,refetchInterval:false,retry:false,
  });
  if(readback.isPending)return <section className="mfp-operations-state" aria-busy="true"><b>正在讀取 Print / Hardware…</b><span>由 canonical PrintJob 同 Carrier gateway readback 重建。</span></section>;
  if(readback.error||!readback.data)return <section className="mfp-operations-state" role="alert"><b>Print / Hardware 暫未接駁</b><span>{readback.error instanceof Error?readback.error.message:'MFP_PRINT_HARDWARE_BINDING_UNAVAILABLE'}</span><button type="button" onClick={()=>void readback.refetch()}>重新讀取</button></section>;
  return <MfpPrintHardwareWorkspace surface={surface} session={session} readback={readback.data} onRefresh={()=>void readback.refetch()}/>;
}
