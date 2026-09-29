declare const __MFK_SOURCE_SHA__:string;
declare const __MFK_BUILD_AT__:string;
export const MFK_PRODUCT_VERSION='1.0.0.0.0.1';
export const MFK_SOURCE_SHA=typeof __MFK_SOURCE_SHA__==='string'?__MFK_SOURCE_SHA__:'DEV';
export const MFK_BUILD_AT=typeof __MFK_BUILD_AT__==='string'?__MFK_BUILD_AT__:'DEV';
export function mfkVersionLabel(port:string){
  return Object.freeze({port,version:MFK_PRODUCT_VERSION,sourceSha:MFK_SOURCE_SHA,buildAt:MFK_BUILD_AT});
}
