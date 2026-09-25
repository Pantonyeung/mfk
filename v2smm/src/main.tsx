import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {installSmmRuntimePort} from './runtime';
import {createPwaLanRuntimePort} from './pwa-runtime';
import './styles.css';

const lanPort=createPwaLanRuntimePort();
if(lanPort)installSmmRuntimePort(lanPort);

const root=document.getElementById('root');
if(!root)throw new Error('MFK_SMM_ROOT_REQUIRED');
createRoot(root).render(<StrictMode><App/></StrictMode>);
