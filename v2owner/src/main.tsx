import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';

window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});

const root=document.getElementById('root');
if(!root)throw new Error('MFK_OWNER_ROOT_REQUIRED');
createRoot(root).render(<StrictMode><App/></StrictMode>);
