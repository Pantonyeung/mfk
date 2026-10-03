import {useEffect,useReducer} from 'react';
import {MfpApplicationRuntime,mfpOrderOperationsRuntimeBinding} from './order-operations-runtime.tsx';
import {MFP_STATE_AUTHORITY,mfpSyncProjectionStore,useMfpUi} from './state-authority.ts';
import {MfpSecurityHarness} from './security-harness.tsx';
import {mfpSecurityPort} from './security-runtime.ts';
import {MfpSyncHarness} from './sync-harness.tsx';
import {mfpSyncCoordinator} from './sync-binding.ts';
import {mfpCheckoutRuntimeBinding} from './checkout-runtime.ts';
import {mfpPrintHardwareRuntimeBinding} from './print-hardware-runtime.tsx';
import {signalMfpRuntimeReadyOnce} from './a9-runtime.ts';

export function V3SmtApp(){
  const {surface,setSurface}=useMfpUi();
  const [,refreshSecurity]=useReducer(value=>value+1,0);

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 767px)');
    const update=()=>setSurface(query.matches?'MFP_MOBILE':'MFP_PAD');
    update();
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[setSurface]);

  useEffect(()=>{signalMfpRuntimeReadyOnce(new URL(window.location.href),window.moreFunNative);},[]);

  return <main className="v3smt-shell" data-surface={surface}>
    <header className="mfp-app-head">
      <small>驗收預覽</small>
      <h1>MoreFun POS</h1>
      <p>店員工作台</p>
    </header>
    <MfpApplicationRuntime surface={surface} security={mfpSecurityPort} sync={mfpSyncCoordinator} projectionStore={mfpSyncProjectionStore} checkout={mfpCheckoutRuntimeBinding} operations={mfpOrderOperationsRuntimeBinding} print={mfpPrintHardwareRuntimeBinding}/>
    <details className="mfp-diagnostics">
      <summary>進階診斷</summary>
      <section className="v3smt-grid">
        <article><span>Surface</span><strong>{surface}</strong></article>
        <article><span>Formal Transaction</span><strong>{MFP_STATE_AUTHORITY.formalTransaction}</strong></article>
        <article><span>Periodic Business Polling</span><strong>{String(MFP_STATE_AUTHORITY.periodicBusinessPolling)}</strong></article>
        <article><span>V2 Client State Imported</span><strong>{String(MFP_STATE_AUTHORITY.v2ClientStateImported)}</strong></article>
      </section>
      <MfpSyncHarness sync={mfpSyncCoordinator}/>
      <MfpSecurityHarness security={mfpSecurityPort} onStateChange={refreshSecurity}/>
    </details>
  </main>;
}
