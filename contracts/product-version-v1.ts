export const MFK_PRODUCT_VERSION='1.0.0.0.0.1';
export const MFK_SOURCE_SHA=String(import.meta.env.VITE_MFK_SOURCE_SHA||'DEV');
export const MFK_BUILD_AT=String(import.meta.env.VITE_MFK_BUILD_AT||'DEV');
export function mfkVersionLabel(port:string){
  return Object.freeze({port,version:MFK_PRODUCT_VERSION,sourceSha:MFK_SOURCE_SHA,buildAt:MFK_BUILD_AT});
}
