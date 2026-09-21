import {Navigate,Route,Routes,useLocation} from 'react-router';
import {AdminShell} from './AdminShell.tsx';
import {ADMIN_CAPABILITIES,findAdminCapability} from './admin-capabilities.ts';
import {MFK_ADMIN_AUTHORITY} from './admin-authority.ts';

const statusTitle={
  NOT_WIRED:'等待 MFK Domain Adapter',
  DEFERRED:'能力保留，暫不啟用',
  RETIRED:'能力已退役',
} as const;

function CapabilityPage(){
  const location=useLocation();
  const capability=findAdminCapability(location.pathname);
  if(!capability)return <Navigate to="/admin/overview" replace/>;

  return <section className="mfk-admin-capability">
    <header>
      <div><small>MFK ADMIN</small><h1>{capability.label}</h1><p>{capability.purpose}</p></div>
      <span className={'status '+capability.status.toLowerCase()}>{statusTitle[capability.status]}</span>
    </header>

    <div className="mfk-admin-facts">
      <article><span>MFK Route</span><b>{capability.path}</b></article>
      <article><span>Truth Owner</span><b>{capability.owner}</b></article>
      <article><span>Wiring</span><b>{capability.status}</b></article>
      <article><span>Live Mutation</span><b>{MFK_ADMIN_AUTHORITY.liveMutationEnabled?'ON':'OFF'}</b></article>
    </div>

    <section className="mfk-admin-rule-card">
      <h2>主權流程</h2>
      <div className="authority-flow">
        <span>Owner Decision</span><i>→</i><span>Admin Draft</span><i>→</i><span>Validate</span><i>→</i><span>Publish</span><i>→</i><span>Active Revision</span><i>→</i><span>SMT Execute</span>
      </div>
      <p>目前頁面只整理 MFK Admin 自己嘅操作面同責任邊界。未有 Domain Adapter 嘅功能一律維持 NOT_WIRED，唔會假裝已經執行成功。</p>
    </section>

    <section className="mfk-admin-donor-check">
      <header><h2>Current MFK State</h2><span>{capability.status}</span></header>
      <p>呢項能力已經有 MFK 路徑同 Truth Owner。下一階段先由獨立工作將佢接到對應 MFK Domain，唔會喺 Admin 裏面重造第二套 engine。</p>
    </section>
  </section>;
}

export function MfkAdminApp(){
  return <AdminShell><Routes>
    {ADMIN_CAPABILITIES.map(item=><Route key={item.id} path={item.path} element={<CapabilityPage/>}/>)}
    <Route path="/" element={<Navigate to="/admin/overview" replace/>}/>
    <Route path="*" element={<Navigate to="/admin/overview" replace/>}/>
  </Routes></AdminShell>;
}
