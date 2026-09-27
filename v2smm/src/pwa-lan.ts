import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../contracts/smm-lan-v1';
import type {SmmLanTransport} from './smt-lan-adapter';

export interface SmmLanPwaConfig{readonly host:string;readonly port:number;readonly deviceId:string;readonly pairingToken?:string}
const KEY='mfk.smm.lan-pwa.v1';

export function readSmmLanPwaConfig():SmmLanPwaConfig|null{
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&typeof v.host==='string'&&typeof v.deviceId==='string'?v:null}catch{return null}
}
export function saveSmmLanPwaConfig(value:SmmLanPwaConfig){localStorage.setItem(KEY,JSON.stringify(value));}
function base(c:SmmLanPwaConfig){return 'http://'+c.host+':'+c.port}

async function post(c:SmmLanPwaConfig,envelope:object,signal?:AbortSignal){
  const r=await fetch(base(c)+'/smm/v1/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope),cache:'no-store',signal});
  if(!r.ok)throw new Error('SMM_LAN_HTTP_'+r.status);
  return await r.json() as Record<string,unknown>;
}
export async function probeSmmLan(c:SmmLanPwaConfig,signal?:AbortSignal){
  const r=await fetch(base(c)+'/smm/v1/health',{cache:'no-store',signal});
  if(!r.ok)throw new Error('SMM_LAN_HEALTH_'+r.status);
  return await r.json();
}
export async function pairSmmLan(c:SmmLanPwaConfig){
  const r=await post(c,{deviceId:c.deviceId,action:'pair',pairingToken:c.pairingToken??''});
  if(r.ok!==true)throw new Error(String(r.code||'SMM_PAIRING_REJECTED'));
  return r;
}
export function createPwaLanTransport(c:SmmLanPwaConfig):SmmLanTransport{
  return{
    async send(request:SmmLanOrderRequest,signal){
      try{
        const r=await post(c,{deviceId:c.deviceId,action:'request',payload:request},signal);
        if(r.ok===false&&r.code==='SMM_DEVICE_NOT_TRUSTED')return{kind:'UNAVAILABLE'};
        return{kind:'RESPONSE',response:r as unknown as SmmLanOrderResponse};
      }catch(error){
        if(error instanceof DOMException&&error.name==='AbortError')return{kind:'UNKNOWN'};
        return{kind:'UNAVAILABLE'};
      }
    },
    async readSubmission(submissionId,signal){
      try{
        const r=await post(c,{deviceId:c.deviceId,action:'request',payload:{protocolVersion:1,type:'smm.lan.order.readback.v1',submissionId,storeId:'MF01'}},signal);
        return r as unknown as SmmLanSubmissionReadbackResponse;
      }catch{return{state:'UNAVAILABLE'};}
    },
  };
}
