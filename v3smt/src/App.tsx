import {useEffect} from 'react';
import {MFP_STATE_AUTHORITY,useMfpUi} from './state-authority.ts';
import {MfpSecurityHarness} from './security-harness.tsx';
import {mfpSecurityPort} from './security-runtime.ts';

export function V3SmtApp(){
  const {surface,setSurface}=useMfpUi();

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 767px)');
    const update=()=>setSurface(query.matches?'MFP_MOBILE':'MFP_PAD');
    update();
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[setSurface]);

  return <main className="v3smt-shell" data-surface={surface}>
    <header>
      <small>PARALLEL PREVIEW · NO PRODUCTION ROUTING</small>
      <h1>MoreFun POS</h1>
      <p>MFP Pad + MFP Mobile 共用同一 Store Kernel Authority。</p>
    </header>
    <section className="v3smt-grid">
      <article><span>Surface</span><strong>{surface}</strong></article>
      <article><span>Formal Transaction</span><strong>{MFP_STATE_AUTHORITY.formalTransaction}</strong></article>
      <article><span>Periodic Business Polling</span><strong>{String(MFP_STATE_AUTHORITY.periodicBusinessPolling)}</strong></article>
      <article><span>V2 Client State Imported</span><strong>{String(MFP_STATE_AUTHORITY.v2ClientStateImported)}</strong></article>
    </section>
    <MfpSecurityHarness security={mfpSecurityPort}/>
  </main>;
}
