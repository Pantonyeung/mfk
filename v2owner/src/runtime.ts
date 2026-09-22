import type {OwnerRuntimePort} from './product-types';

declare global {
  interface Window {
    __MFK_OWNER_PRODUCT_PORT__?:OwnerRuntimePort;
  }
}

export function resolveOwnerRuntimePort():OwnerRuntimePort|null{
  if(typeof window==='undefined')return null;
  const candidate=window.__MFK_OWNER_PRODUCT_PORT__;
  return candidate?.portId==='MFK_OWNER_PORT_V1'?candidate:null;
}
