import {createCloudOwnerRuntimePort} from './cloud-runtime';
import type {OwnerRuntimePort} from './product-types';

declare global {
  interface Window {
    __MFK_OWNER_PRODUCT_PORT__?:OwnerRuntimePort;
  }
}

export function resolveOwnerRuntimePort():OwnerRuntimePort|null{
  if(typeof window==='undefined')return null;
  const injected=window.__MFK_OWNER_PRODUCT_PORT__;
  if(injected?.portId==='MFK_OWNER_PORT_V1')return injected;
  return createCloudOwnerRuntimePort();
}
