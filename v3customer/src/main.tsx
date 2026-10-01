import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {CustomerV3App} from './App';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_CUSTOMER_V3_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <CustomerV3App/>
  </StrictMode>,
);
