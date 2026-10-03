import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {V3SmtApp} from './App.tsx';
import {v3SmtQueryClient} from './state-authority.ts';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_SMT_V3_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={v3SmtQueryClient}>
      <V3SmtApp/>
    </QueryClientProvider>
  </StrictMode>,
);
