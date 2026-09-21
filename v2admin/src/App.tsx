import {Navigate,Route,Routes,useLocation} from 'react-router';
import {AdminShell} from './AdminShell.tsx';
import {ADMIN_CAPABILITIES,findAdminCapability} from './admin-capabilities.ts';

const statusTitle={
  WIRED_CURRENT:'已接 MFK Authority',
  READ_ONLY_CURRENT:'已接 MFK Read Model',
  NEEDS_ADAPTER:'等待接駁 MFK Authority',
  DEFERRED:'能力保留，暫不啟用',
  RETIRED:'舊能力已退役',
} as const;

function CapabilityPage(){
  const location=useLocation();
  const capability=findAdminCapability(location.pathname);
  if(!capability)return <Navigate to="/admin/overview" replace/>;
  return <section className="mfk-admin-capability">
    <header>
      <div><small>V2 ADMIN DONOR → MFK</small><h1>{capability.label}</h1><p>{capability.note}</p></div>
      <span className={'status '+capability.status.toLowerCase()}>{statusTitle[capability.status]}</span>
    </header>

    <div className="mfk-admin-facts">
      <article><span>舊 V2 路徑</span><b>{capability.donorPath??'舊版未有正式 Route'}</b></article>
      <article><span>MFK 路徑</span><b>{capability.mfkPath}</b></article>
      <article><span>MFK Truth Owner</span><b>{capability.owner}</b></article>
      <article><span>Legacy Writer</span><b>DISABLED</b></article>
    </div>

    <section className="mfk-admin-rule-card">
      <h2>主權規則</h2>
      <div className="authority-flow">
        <span>Owner Decision</span><i>→</i><span>Admin Draft</span><i>→</i><span>Validate</span><i>→</i><span>Publish</span><i>→</i><span>Active Revision</span><i>→</i><span>SMT Execute</span>
      </div>
      <p>呢個頁面目前只係由舊 Morefun V2 乾淨抽出嘅功能位置。舊 API、舊 DB、舊 mutation authority 一律冇啟用；之後只會接返 MFK 重新定義嘅 canonical owner。</p>
    </section>

    <section className="mfk-admin-donor-check">
      <header><h2>Donor Extraction</h2><span>{capability.status}</span></header>
      <p>功能已列入完整 Admin Capability Inventory，唔會因為未接駁就消失。接駁時只改呢個 domain seam，唔會重造其他主權。</p>
    </section>
  </section>;
}

export function MfkAdminApp(){
  return <AdminShell><Routes>
    {ADMIN_CAPABILITIES.map(item=><Route key={item.id} path={item.mfkPath} element={<CapabilityPage/>}/>)}
    <Route path="/" element={<Navigate to="/admin/overview" replace/>}/>
    <Route path="*" element={<CapabilityPage/>}/>
  </Routes></AdminShell>;
}
