import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {MfkAdminApp} from './App.tsx';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <MfkAdminApp/>
    </BrowserRouter>
  </StrictMode>,
);
