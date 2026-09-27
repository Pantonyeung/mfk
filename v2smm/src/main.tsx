import {Component,StrictMode,type ErrorInfo,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {StageZeroGate} from './StageZero';
import {installSmmRuntimePort} from './runtime';
import {createPwaRuntimePort} from './pwa-runtime';
import './styles.css';

class SmmErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){
    console.error('SMM_RENDER_RECOVERED',error,info.componentStack);
  }
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="app-shell"><section className="panel"><h2>SMM 顯示已自動保護</h2><p>剛才收到不完整資料，介面已阻止白屏。請重新載入；Internet 資料通道會繼續可用。</p><button className="primary" onClick={()=>location.reload()}>重新載入</button></section></main>;
  }
}

installSmmRuntimePort(createPwaRuntimePort());

const root=document.getElementById('root');
if(!root)throw new Error('MFK_SMM_ROOT_REQUIRED');
createRoot(root).render(<StrictMode><SmmErrorBoundary><StageZeroGate><App/></StageZeroGate></SmmErrorBoundary></StrictMode>);
