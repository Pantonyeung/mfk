import {createCloudCustomerRuntimePort} from './cloud-runtime';
import type {CustomerRuntimePort} from './product-types';

declare global {
  interface Window {
    __MFK_CUSTOMER_PRODUCT_PORT__?:CustomerRuntimePort;
  }
}

export function resolveCustomerRuntimePort():CustomerRuntimePort|null{
  if(typeof window==='undefined')return null;
  const candidate=window.__MFK_CUSTOMER_PRODUCT_PORT__;
  if(candidate?.portId==='MFK_CUSTOMER_PORT_V1')return candidate;
  return createCloudCustomerRuntimePort();
}
