import './acceptance-runtime';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_SMM_ROOT_REQUIRED');
createRoot(root).render(<StrictMode><App/></StrictMode>);
