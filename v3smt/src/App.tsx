import {useEffect} from 'react';
import {V3_SMT_STATE_AUTHORITY,useV3SmtUi} from './state-authority.ts';

function viewportSurface(): 'DESKTOP'|'HANDHELD'{
  return window.matchMedia('(max-width: 767px)').matches?'HANDHELD':'DESKTOP';
}

export function V3SmtApp(){
  const {surface,setSurface}=useV3SmtUi();

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 767px)');
    const update=()=>setSurface(query.matches?'HANDHELD':'DESKTOP');
    update();
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[setSurface]);

  return <main className="v3smt-shell" data-surface={surface}>
    <header>
      <small>PARALLEL PREVIEW · NO PRODUCTION ROUTING</small>
      <h1>MFK SMT V3</h1>
      <p>Desktop + Handheld 共用同一 Store Kernel Authority。</p>
    </header>
    <section className="v3smt-grid">
      <article><span>Surface</span><strong>{surface}</strong></article>
      <article><span>Formal Transaction</span><strong>{V3_SMT_STATE_AUTHORITY.formalTransaction}</strong></article>
      <article><span>Periodic Business Polling</span><strong>{String(V3_SMT_STATE_AUTHORITY.periodicBusinessPolling)}</strong></article>
      <article><span>V2 Client State Imported</span><strong>{String(V3_SMT_STATE_AUTHORITY.v2ClientStateImported)}</strong></article>
    </section>
  </main>;
}
