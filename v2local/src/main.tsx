import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';
import {MfkV2LocalApp} from './App.tsx';
import './styles.css';

const root=document.getElementById('root');
if(!root)throw new Error('MFK_ROOT_MISSING');
createRoot(root).render(<StrictMode><HashRouter><MfkV2LocalApp/></HashRouter></StrictMode>);
