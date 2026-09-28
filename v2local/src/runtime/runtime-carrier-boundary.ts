export interface MfkRuntimeReleaseIdentity{
  readonly runtimeVersion:string;
  readonly runtimeChannel:'candidate'|'stable';
  readonly releaseId?:string;
}

export interface MfkRuntimeReadyBridge{
  postMessage(message:string):void;
}

const APP_ORIGIN='https://appassets.androidplatform.net';

export function readMfkRuntimeReleaseIdentity(url:URL):MfkRuntimeReleaseIdentity|null{
  if(url.origin!==APP_ORIGIN)return null;

  const runtimeChannel=url.searchParams.get('runtimeChannel');
  if(runtimeChannel!=='candidate'&&runtimeChannel!=='stable')return null;

  const runtimeVersion=url.searchParams.get('runtimeVersion')?.trim()??'';
  if(!runtimeVersion)return null;

  if(url.pathname==='/baseline/index.html'){
    return runtimeChannel==='stable'&&runtimeVersion==='packaged-baseline'
      ?{runtimeVersion,runtimeChannel}
      :null;
  }

  if(url.pathname!=='/runtime/index.html')return null;

  const releaseId=url.searchParams.get('releaseId')?.trim()??'';
  if(!releaseId||releaseId!==runtimeVersion)return null;
  if(!/^[A-Za-z0-9._-]{1,96}$/.test(releaseId))return null;

  return{releaseId,runtimeVersion,runtimeChannel};
}

export function signalMfkRuntimeReady(
  url:URL,
  bridge:MfkRuntimeReadyBridge|undefined,
):boolean{
  const identity=readMfkRuntimeReleaseIdentity(url);
  if(!identity||!bridge)return false;

  bridge.postMessage(JSON.stringify({
    type:'runtime.ready',
    bridgeVersion:1,
    ...(identity.releaseId?{releaseId:identity.releaseId}:{})
  }));
  return true;
}

export function createMfkRuntimeReadyOnce(){
  let signaled=false;
  return(url:URL,bridge:MfkRuntimeReadyBridge|undefined):boolean=>{
    if(signaled)return false;
    const sent=signalMfkRuntimeReady(url,bridge);
    if(sent)signaled=true;
    return sent;
  };
}
