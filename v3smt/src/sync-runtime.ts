import type {MfpSyncCoordinator} from './sync-port.ts';

interface MfpSyncLifecycleEnvironment{
  addEventListener(type:'online'|'offline',listener:()=>void):void;
  removeEventListener(type:'online'|'offline',listener:()=>void):void;
  document:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>;
  navigator:Pick<Navigator,'onLine'>;
}

export function startMfpSyncLifecycle(
  sync:MfpSyncCoordinator,
  environment:MfpSyncLifecycleEnvironment=window,
){
  const run=(task:Promise<void>)=>{void task.catch(()=>{});};
  const online=()=>run(sync.networkOnline());
  const offline=()=>sync.networkOffline();
  const resume=()=>{if(environment.document.visibilityState==='visible')run(sync.resumed());};
  environment.addEventListener('online',online);
  environment.addEventListener('offline',offline);
  environment.document.addEventListener('visibilitychange',resume);
  const disconnectDoorbell=sync.connectDoorbell();
  run(sync.restore().then(()=>environment.navigator.onLine?sync.startup():sync.networkOffline()));
  return()=>{
    disconnectDoorbell();
    environment.removeEventListener('online',online);
    environment.removeEventListener('offline',offline);
    environment.document.removeEventListener('visibilitychange',resume);
  };
}
