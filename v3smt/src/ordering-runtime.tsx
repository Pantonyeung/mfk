import {useEffect,useState,useSyncExternalStore} from 'react';

import {selectMfpOrderingCatalog} from './ordering-selector.ts';
import {MfpOrderingWorkspace} from './ordering-workspace.tsx';
import type {MfpOrderingCatalog,MfpOrderingSurface} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpSyncCoordinator,MfpSyncProjectionStore} from './sync-port.ts';

export function MfpOrderingRuntime({surface,security,sync,projectionStore}:{
  surface:MfpOrderingSurface;
  security:MfpSecurityPort;
  sync:MfpSyncCoordinator;
  projectionStore:MfpSyncProjectionStore;
}){
  const syncSnapshot=useSyncExternalStore(sync.subscribe,sync.getSnapshot,sync.getSnapshot);
  const [catalog,setCatalog]=useState<MfpOrderingCatalog|null>(null);
  useEffect(()=>{
    let active=true;
    void projectionStore.readActive()
      .then(projection=>{if(active)setCatalog(selectMfpOrderingCatalog(projection));})
      .catch(()=>{/* Keep the previous valid catalog visible. */});
    return()=>{active=false;};
  },[projectionStore,syncSnapshot.appliedSeq,syncSnapshot.state]);
  return <MfpOrderingWorkspace surface={surface} catalog={catalog} security={security} syncSnapshot={syncSnapshot}/>;
}
