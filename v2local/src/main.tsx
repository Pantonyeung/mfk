import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';
import {MfkV2LocalApp} from './App.tsx';
import {installSmtAdminAutoSync} from './runtime/admin-config-sync.ts';
import {installStaffSessionInvalidation} from './runtime/staff-auth.ts';
import {installKeetaOrderIntake} from './runtime/keeta-order-intake.ts';
import {installKeetaOrderLifecycle} from './runtime/keeta-order-lifecycle.ts';
import {installKeetaAfterSales} from './runtime/keeta-after-sale.ts';
import {installCustomerCloudBridge} from './runtime/customer-cloud-intake.ts';
import {localRuntime} from './runtime/local-runtime.ts';
import {createSmmLanIngress} from './runtime/smm-lan-ingress.ts';
import type {SmmLanOrderRequest} from '../../contracts/smm-lan-v1.ts';
import {readLocalCashOpenings,readLocalDayCloses} from './runtime/local-operations.ts';
import {
  installProjectionOutboxAutoFlush,
  queueCashOpeningProjection,
  queueDayCloseProjection,
  queueOrderProjection,
} from './runtime/projection-outbox.ts';
import './styles.css';

installSmtAdminAutoSync();
installStaffSessionInvalidation();
installProjectionOutboxAutoFlush();
installKeetaOrderIntake();
installKeetaOrderLifecycle();
installKeetaAfterSales();
installCustomerCloudBridge();

const smmLanIngress=createSmmLanIngress(localRuntime);
declare global{interface Window{__MFK_SMM_LAN_HANDLE__?:(deviceId:string,payload:string)=>string}}
window.__MFK_SMM_LAN_HANDLE__=(deviceId,payload)=>{
  try{
    const request=JSON.parse(payload) as SmmLanOrderRequest;
    if(request.type==='smm.lan.order.submit.v1')return JSON.stringify(smmLanIngress.submit(request,{deviceId,trusted:true}));
    if((request as {type?:string}).type==='smm.lan.order.readback.v1'){
      return JSON.stringify(smmLanIngress.readSubmission((request as unknown as {submissionId:string}).submissionId));
    }
    return JSON.stringify({protocolVersion:1,type:'smm.lan.order.result.v1',disposition:'REJECTED',reasonCode:'SMM_LAN_OPERATION_UNSUPPORTED'});
  }catch{
    return JSON.stringify({protocolVersion:1,type:'smm.lan.order.result.v1',disposition:'REJECTED',reasonCode:'SMM_LAN_PAYLOAD_INVALID'});
  }
};

for(const order of localRuntime.orders())queueOrderProjection(order);
for(const opening of readLocalCashOpenings())queueCashOpeningProjection(opening);
const latestCloseByDate=new Map<string,ReturnType<typeof readLocalDayCloses>[number]>();
for(const close of readLocalDayCloses()){
  const current=latestCloseByDate.get(close.businessDate);
  if(!current||close.version>current.version||close.version===current.version&&close.createdAt>current.createdAt){
    latestCloseByDate.set(close.businessDate,close);
  }
}
for(const close of latestCloseByDate.values())queueDayCloseProjection(close);

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ROOT_MISSING');
createRoot(root).render(<StrictMode><HashRouter><MfkV2LocalApp/></HashRouter></StrictMode>);
