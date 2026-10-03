import original from './worker.js';
import {linkedGateway,linkedJson} from '../integrations/v3-linked-test.ts';
import type {LinkedEnv} from '../integrations/v3-linked-test.ts';
export default {async fetch(request:Request,env:LinkedEnv){
  const linked=await linkedGateway(request,env,'customer');if(linked)return linked;
  // Generic providers remain closed; never fall through to an SPA success page.
  const path=new URL(request.url).pathname;
  if(path==='/api'||path.startsWith('/api/'))return linkedJson({code:'CUSTOMER_PROVIDER_UNAVAILABLE'},503);
  return original.fetch(request,env);
}};
