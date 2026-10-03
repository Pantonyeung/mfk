import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {CustomerV3App} from './App';
import {LinkedCustomerApp} from './linked-test-app';
import './styles.css';
import './screens.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_CUSTOMER_V3_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    {import.meta.env.VITE_MFP_V3_LINKED_TEST==='1'?<LinkedCustomerApp/>:<CustomerV3App/>}
  </StrictMode>,
);
