import type {SmmRuntimePort,SmmPendingIntent,SmmCommandResult,SmmReadModelSnapshot,SmmCartLine,SmmQuoteSnapshot} from './product-types';
import {createSmmLanOrderAdapter,type SmmLanTransport} from './smt-lan-adapter';
import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../contracts/smm-lan-v1';

declare global{
  interface Window{
    MfkSmmNative?:{
      connection():string;
      configure(host:string,port:number,deviceId:string,pairingToken:string):void;
      send(correlationId:string,payload:string):void;
    };
    __MFK_SMM_NATIVE_RESULT__?:(correlationId:string,payload:string)=>void;
  }
}

type NativeResponse=SmmLanOrderResponse|SmmLanSubmissionReadbackResponse;
const pending=new Map<string,{resolve:(value:NativeResponse)=>void;reject:(reason:Error)=>void;timer:number}>();

window.__MFK_SMM_NATIVE_RESULT__=(correlationId,payload)=>{
  const item=pending.get(correlationId);if(!item)return;
  window.clearTimeout(item.timer);pending.delete(correlationId);
  try{item.resolve(JSON.parse(payload) as NativeResponse);}catch{item.reject(new Error('SMM_NATIVE_RESPONSE_INVALID'));}
};

function sendNative(request:object):Promise<SmmLanOrderResponse|SmmLanSubmissionReadbackResponse>{
  const bridge=window.MfkSmmNative;
  if(!bridge)return Promise.reject(new Error('SMM_NATIVE_BRIDGE_UNAVAILABLE'));
  const correlationId=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=window.setTimeout(()=>{pending.delete(correlationId);reject(new Error('SMM_NATIVE_TIMEOUT'));},6500);
    pending.set(correlationId,{resolve,reject,timer});
    bridge.send(correlationId,JSON.stringify(request));
  });
}

const transport:SmmLanTransport={
  async send(request){
    try{return{kind:'RESPONSE',response:await sendNative(request) as SmmLanOrderResponse};}
    catch{return{kind:'UNKNOWN'};}
  },
  async readSubmission(submissionId){
    try{
      const response=await sendNative({protocolVersion:1,type:'smm.lan.order.readback.v1',submissionId,storeId:'MF01'});
      return response as SmmLanSubmissionReadbackResponse;
    }catch{return{state:'UNAVAILABLE'};}
  },
};

const orders=createSmmLanOrderAdapter(transport);

export function createNativeSmmRuntimePort():SmmRuntimePort|null{
  if(!window.MfkSmmNative)return null;
  return Object.freeze({
    portId:'MFK_SMM_PORT_V1' as const,
    async readSnapshot():Promise<SmmReadModelSnapshot>{
      throw new Error('SMM_SNAPSHOT_LAN_NOT_CONNECTED');
    },
    async quoteCart(_cart:readonly SmmCartLine[]):Promise<SmmQuoteSnapshot>{
      throw new Error('SMM_QUOTE_LAN_NOT_CONNECTED');
    },
    submitOrder(intent:SmmPendingIntent):Promise<SmmCommandResult>{return orders.submitOrder(intent);},
    readSubmission(submissionId:string):Promise<SmmCommandResult>{return orders.readSubmission(submissionId);},
  });
}
