export interface V3ClientReleaseIdentity{
  readonly releaseId:string;
  readonly sourceSha:string;
  readonly buildTime:string;
}

export const V3_RELEASE_REFETCH_INTERVAL_MS=60_000;

declare const __MFK_CLIENT_RELEASE_ID__:string;
declare const __MFK_CLIENT_SOURCE_SHA__:string;
declare const __MFK_CLIENT_BUILD_TIME__:string;

export const V3_CLIENT_RELEASE:V3ClientReleaseIdentity=Object.freeze({
  releaseId:__MFK_CLIENT_RELEASE_ID__,
  sourceSha:__MFK_CLIENT_SOURCE_SHA__,
  buildTime:__MFK_CLIENT_BUILD_TIME__,
});

export async function readServingRelease():Promise<V3ClientReleaseIdentity>{
  const response=await fetch('/release.json?ts='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('V3_ADMIN_RELEASE_MANIFEST_HTTP_'+response.status);
  const row=await response.json() as Partial<V3ClientReleaseIdentity>;
  if(!row.releaseId||!row.sourceSha||!row.buildTime)throw new Error('V3_ADMIN_RELEASE_MANIFEST_INVALID');
  return Object.freeze({
    releaseId:String(row.releaseId),
    sourceSha:String(row.sourceSha),
    buildTime:String(row.buildTime),
  });
}

export function releaseIdentityMatches(client:V3ClientReleaseIdentity,serving:V3ClientReleaseIdentity){
  return client.releaseId===serving.releaseId
    &&client.sourceSha===serving.sourceSha
    &&client.buildTime===serving.buildTime;
}

export function releaseVerificationMatches(
  client:V3ClientReleaseIdentity,
  serving:V3ClientReleaseIdentity|undefined,
  verificationCurrent:boolean,
){
  return verificationCurrent&&serving?releaseIdentityMatches(client,serving):null;
}
