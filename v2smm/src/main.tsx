import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {installSmmRuntimePort} from './runtime';
import {createNativeSmmRuntimePort} from './native-runtime';
import './styles.css';

const nativePort=createNativeSmmRuntimePort();
if(nativePort)installSmmRuntimePort(nativePort);

const root=document.getElementById('root');
if(!root)throw new Error('MFK_SMM_ROOT_REQUIRED');
createRoot(root).render(<StrictMode><App/></StrictMode>);
