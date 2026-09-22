import type {SmmRuntimePort} from './product-types';

declare global {
  interface Window {
    __MFK_SMM_PRODUCT_PORT__?:SmmRuntimePort;
  }
}

export function resolveSmmRuntimePort():SmmRuntimePort|null{
  if(typeof window==='undefined')return null;
  const candidate=window.__MFK_SMM_PRODUCT_PORT__;
  return candidate?.portId==='MFK_SMM_PORT_V1'?candidate:null;
}
