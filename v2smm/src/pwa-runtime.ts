import type {SmmRuntimePort,SmmCartLine,SmmReadModelSnapshot,SmmQuoteSnapshot,SmmPendingIntent,SmmCommandResult} from './product-types';
import {createSmmLanOrderAdapter} from './smt-lan-adapter';
import {createPwaLanTransport,readSmmLanPwaConfig} from './pwa-lan';

async function request(payload:object){
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

export function createPwaLanRuntimePort():SmmRuntimePort|null{
  const config=readSmmLanPwaConfig();if(!config)return null;
  const orders=createSmmLanOrderAdapter(createPwaLanTransport(config));
  return Object.freeze({
    portId:'MFK_SMM_PORT_V1' as const,
    async readSnapshot(){return await request({protocolVersion:1,type:'smm.lan.snapshot.v1',storeId:'MF01'}) as unknown as SmmReadModelSnapshot;},
    async quoteCart(cart:readonly SmmCartLine[]){return await request({protocolVersion:1,type:'smm.lan.quote.v1',storeId:'MF01',cart}) as unknown as SmmQuoteSnapshot;},
    submitOrder(intent:SmmPendingIntent):Promise<SmmCommandResult>{return orders.submitOrder(intent);},
    readSubmission(submissionId:string):Promise<SmmCommandResult>{return orders.readSubmission(submissionId);},
  });
}
