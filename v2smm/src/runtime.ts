import type {SmmRuntimePort} from './product-types';

declare global {
  interface Window {
    __MFK_SMM_PRODUCT_PORT__?:SmmRuntimePort;
  }
}

const PORT_ID='MFK_SMM_PORT_V1' as const;

function validPort(value:unknown):value is SmmRuntimePort{
  return Boolean(value)&&typeof value==='object'&&(value as SmmRuntimePort).portId===PORT_ID;
}

/**
 * Stable SMM integration boundary.
 *
 * UI code consumes SmmRuntimePort only. Transport/LAN/auth implementations are
 * installed outside the UI through __MFK_SMM_PRODUCT_PORT__. This deliberately
 * prevents the current UI redesign from owning SMT networking or canonical
 * transaction semantics.
 */
export function resolveSmmRuntimePort():SmmRuntimePort|null{
  if(typeof window==='undefined')return null;
  const candidate=window.__MFK_SMM_PRODUCT_PORT__;
  return validPort(candidate)?candidate:null;
}

export function installSmmRuntimePort(port:SmmRuntimePort):()=>void{
  if(typeof window==='undefined')return()=>{};
  if(!validPort(port))throw new Error('SMM_RUNTIME_PORT_INVALID');
  const previous=window.__MFK_SMM_PRODUCT_PORT__;
  window.__MFK_SMM_PRODUCT_PORT__=port;
  window.dispatchEvent(new CustomEvent('mfk-smm-runtime-port',{detail:{state:'INSTALLED',portId:PORT_ID}}));
  return()=>{
    if(window.__MFK_SMM_PRODUCT_PORT__===port)window.__MFK_SMM_PRODUCT_PORT__=previous;
    window.dispatchEvent(new CustomEvent('mfk-smm-runtime-port',{detail:{state:'REMOVED',portId:PORT_ID}}));
  };
}
