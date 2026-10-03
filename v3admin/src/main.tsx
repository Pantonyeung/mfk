import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {V3AdminApp} from './App.tsx';
import {v3AdminQueryClient} from './state-authority.ts';
import './styles.css';
import {LinkedAdminApp} from './linked-admin.tsx';
const CurrentAdminApp=import.meta.env.VITE_MFP_V3_LINKED_TEST==='1'?LinkedAdminApp:V3AdminApp;

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_V3_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={v3AdminQueryClient}>
      <CurrentAdminApp/>
    </QueryClientProvider>
  </StrictMode>,
);
