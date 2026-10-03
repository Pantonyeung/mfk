import original,{type FormalTestAcceptanceEnv} from './formal-test-acceptance-worker.ts';
import {linkedGateway,LINKED_SCOPE,type LinkedEnv} from '../../integrations/v3-linked-test.ts';

/** Same formal POS asset service; only the isolated linked-test gateway is additionally admitted. */
export default{
  async fetch(request:Request,env:FormalTestAcceptanceEnv&LinkedEnv):Promise<Response>{
    const response=await linkedGateway(request,env,'pos');
    if(response)return response;
    const url=new URL(request.url);
    if(env.MFP_V3_LINKED_TEST_ENABLED==='1'&&request.method==='GET'&&['/__mfk/health','/__mfk/build'].includes(url.pathname)){
      const originalResponse=await original.fetch(request,env);
      return Response.json({...await originalResponse.json(),mode:'CONNECTED_TEST',scope:LINKED_SCOPE,linkedTestEnabled:true,formalOrderCreated:false,paymentConfirmed:false,formalCheckoutConnected:false,physicalPrintConnected:false},{headers:{'cache-control':'no-store','x-mfk-smt-mode':'CONNECTED_TEST'}});
    }
    return original.fetch(request,env);
  },
};
