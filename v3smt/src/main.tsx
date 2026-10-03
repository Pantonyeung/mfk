import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {LinkedPosWorkspace} from './linked-pos-workspace.tsx';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFP_V3_ROOT_MISSING');

if(import.meta.env.VITE_MFP_V3_LINKED_TEST==='1'){
  createRoot(root).render(<StrictMode><LinkedPosWorkspace/></StrictMode>);
}else{
  // The linked surface never imports or mounts the formal/native application runtime.
  void import('./normal-app-entry.tsx').then(({mountNormalApp})=>mountNormalApp(root));
}
