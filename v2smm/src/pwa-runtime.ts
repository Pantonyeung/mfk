import type {SmmRuntimePort,SmmReadModelSnapshot,SmmPendingIntent,SmmCommandResult} from './product-types';
import {createSmmLanOrderAdapter} from './smt-lan-adapter';
import {createPwaLanTransport,readSmmLanPwaConfig} from './pwa-lan';

const CLOUD_SNAPSHOT_URL='/api/smm/snapshot?storeId=MF01';

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}
function isSnapshot(value:unknown):value is SmmReadModelSnapshot{
  if(!isRecord(value))return false;
  if(typeof value.observedAt!=='string')return false;
  for(const key of ['orders','work','channels','dineSessions','printHealth','refundRequests'] as const){
    if(!Array.isArray(value[key]))return false;
  }
  if(value.menu!==undefined){
    if(!isRecord(value.menu)||typeof value.menu.revision!=='string'||!Array.isArray(value.menu.categories)||!Array.isArray(value.menu.products))return false;
  }
  return true;
}
async function withTimeout<T>(work:Promise<T>,timeoutMs=3500):Promise<T>{
  let timer:number|undefined;
  try{
    return await Promise.race([
      work,
      new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(new Error('SMM_READ_TIMEOUT')),timeoutMs);}),
    ]);
  }finally{if(timer!==undefined)window.clearTimeout(timer);}
}
async function lanRequest(payload:object){
  const config=readSmmLanPwaConfig();if(!config)throw new Error('SMM_LAN_NOT_CONFIGURED');
  const response=await fetch('http://'+config.host+':'+config.port+'/smm/v1/request',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({deviceId:config.deviceId,action:'request',payload}),
  });
  if(!response.ok)throw new Error('SMM_LAN_HTTP_'+response.status);
  const json=await response.json() as Record<string,unknown>;
  if(json.ok===false)throw new Error(String(json.code||'SMM_LAN_REJECTED'));
  return json;
}
async function readCloudSnapshot():Promise<SmmReadModelSnapshot>{
  const response=await fetch(CLOUD_SNAPSHOT_URL,{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('SMM_INTERNET_HTTP_'+response.status);
  const json=await response.json();
  if(!isSnapshot(json))throw new Error('SMM_INTERNET_SNAPSHOT_INVALID');
  return Object.freeze({...json,connectionPath:'INTERNET' as const});
}

export function createPwaRuntimePort():SmmRuntimePort{
  const config=readSmmLanPwaConfig();
  const orders=config?createSmmLanOrderAdapter(createPwaLanTransport(config)):null;
  return Object.freeze({
    portId:'MFK_SMM_PORT_V1' as const,
    async readSnapshot(){
      if(config){
        try{
          const raw=await withTimeout(lanRequest({protocolVersion:1,type:'smm.lan.snapshot.v1',storeId:'MF01'}));
          if(!isSnapshot(raw))throw new Error('SMM_LAN_SNAPSHOT_INVALID');
          return Object.freeze({...raw,connectionPath:'LAN' as const});
        }catch{
          // LAN is optional. A bad/unsupported LAN response must never blank or
          // block the staff app; fall through to the Internet projection.
        }
      }
      return await readCloudSnapshot();
    },
    submitOrder(intent:SmmPendingIntent):Promise<SmmCommandResult>{
      return orders
        ?orders.submitOrder(intent)
        :Promise.resolve(Object.freeze({state:'NOT_CONNECTED' as const,message:'Internet 已連接；員工正式提交仍需可信門店提交通道，草稿已保存。'}));
    },
    readSubmission(submissionId:string):Promise<SmmCommandResult>{
      return orders
        ?orders.readSubmission(submissionId)
        :Promise.resolve(Object.freeze({state:'NOT_CONNECTED' as const,message:'Internet 已連接；原提交讀回需要 LAN。'}));
    },
  });
}
