import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {MfkAdminApp} from './App.tsx';
import {installAdminSyncAutoFlush} from './admin-sync-client.ts';
import {installAdminProjectionLiveRead} from './admin-projection-client.ts';
import './styles.css';

installAdminSyncAutoFlush();
installAdminProjectionLiveRead();

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ADMIN_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <MfkAdminApp/>
    </BrowserRouter>
  </StrictMode>,
);
