import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';
import {MfkV2LocalApp} from './App.tsx';
import {installSmtAdminAutoSync} from './runtime/admin-config-sync.ts';
import {installStaffSessionInvalidation} from './runtime/staff-auth.ts';
import {installKeetaOrderIntake} from './runtime/keeta-order-intake.ts';
import {installKeetaOrderLifecycle} from './runtime/keeta-order-lifecycle.ts';
import {localRuntime} from './runtime/local-runtime.ts';
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
