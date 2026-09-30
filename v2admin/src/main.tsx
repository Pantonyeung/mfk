import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {MfkAdminApp} from './App.tsx';
import {AdminCanonicalBootstrap} from './AdminCanonicalBootstrap.tsx';
import './styles.css';
import './admin-control-plane.css';


window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <AdminCanonicalBootstrap>
      <BrowserRouter>
        <MfkAdminApp/>
      </BrowserRouter>
    </AdminCanonicalBootstrap>
  </StrictMode>,
);
