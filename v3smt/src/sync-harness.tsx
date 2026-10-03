import {useSyncExternalStore} from 'react';
import type {MfpSyncCoordinator} from './sync-port.ts';

export function MfpSyncHarness({sync}:{sync:MfpSyncCoordinator}){
  const snapshot=useSyncExternalStore(sync.subscribe,sync.getSnapshot,sync.getSnapshot);
  const catchUp=()=>{void sync.manualCatchUp().catch(()=>{});};
  return <section className="mfp-sync" aria-labelledby="mfp-sync-title">
    <div className="mfp-sync-heading">
      <div><small>A3 VERIFICATION HARNESS</small><h2 id="mfp-sync-title">Sync + Offline</h2></div>
      <button type="button" onClick={catchUp}>Manual Catch-up</button>
    </div>
    <div className="mfp-sync-grid">
      <article><span>Connection</span><strong>{snapshot.connection}</strong></article>
      <article><span>State</span><strong>{snapshot.state}</strong></article>
      <article><span>HeadSeq</span><strong>{snapshot.headSeq??'—'}</strong></article>
      <article><span>AppliedSeq</span><strong>{snapshot.appliedSeq??'—'}</strong></article>
      <article><span>LKG available</span><strong>{snapshot.lkgAvailable?'YES':'NO'}</strong></article>
      <article><span>Last Applied At</span><strong>{snapshot.lastAppliedAt??'—'}</strong></article>
    </div>
    {snapshot.lastError&&<p className="mfp-sync-error">{snapshot.lastError}</p>}
  </section>;
}
