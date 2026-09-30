import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {V3AdminApp} from './App.tsx';
import {v3AdminQueryClient} from './state-authority.ts';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_V3_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={v3AdminQueryClient}>
      <V3AdminApp/>
    </QueryClientProvider>
  </StrictMode>,
);
