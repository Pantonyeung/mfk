import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {QueryClientProvider} from '@tanstack/react-query';
import {MfkAdminApp} from './App.tsx';
import {AdminCanonicalBootstrap} from './AdminCanonicalBootstrap.tsx';
import {adminQueryClient} from './admin-query-client.ts';
import './styles.css';
import './admin-control-plane.css';


window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={adminQueryClient}>
      <AdminCanonicalBootstrap>
        <BrowserRouter>
          <MfkAdminApp/>
        </BrowserRouter>
      </AdminCanonicalBootstrap>
    </QueryClientProvider>
  </StrictMode>,
);
