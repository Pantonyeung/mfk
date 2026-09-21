import type {ReactNode} from 'react';
import {NavLink,useLocation} from 'react-router';
import {ADMIN_CAPABILITY_GROUPS,findAdminCapability} from './admin-capabilities.ts';

const statusLabel={
  WIRED_CURRENT:'已接 MFK',
  READ_ONLY_CURRENT:'MFK 只讀',
  NEEDS_ADAPTER:'待接駁',
  DEFERRED:'保留／延後',
  RETIRED:'已退役',
} as const;

export function AdminShell({children}:{children:ReactNode}){
  const location=useLocation();
  const active=findAdminCapability(location.pathname);
  const activeGroup=ADMIN_CAPABILITY_GROUPS.find(group=>group.capabilities.some(item=>item.id===active?.id))??ADMIN_CAPABILITY_GROUPS[0]!;
  return <div className="mfk-admin-shell">
    <aside className="mfk-admin-rail">
      <div className="mfk-admin-brand"><b>磨</b><span>MFK ADMIN</span></div>
      <nav aria-label="MFK Admin 功能">
        {ADMIN_CAPABILITY_GROUPS.map(group=><NavLink
          key={group.id}
          to={group.capabilities[0]?.mfkPath??'/admin/overview'}
          className={group.id===activeGroup.id?'active':''}
        ><span>{group.label}</span><small>{group.capabilities.length}</small></NavLink>)}
      </nav>
      <div className="mfk-admin-authority"><b>ADMIN CONTROL PLANE</b><span>Legacy writers disabled</span></div>
    </aside>

    <aside className="mfk-admin-section">
      <header><small>功能組</small><strong>{activeGroup.label}</strong></header>
      <nav>
        {activeGroup.capabilities.map(item=><NavLink
          key={item.id}
          to={item.mfkPath}
          className={({isActive})=>isActive?'active':''}
        ><span>{item.label}</span><small data-status={item.status}>{statusLabel[item.status]}</small></NavLink>)}
      </nav>
    </aside>

    <main className="mfk-admin-main">
      <header className="mfk-admin-topbar">
        <div><small>OWNER → ADMIN → SMT</small><strong>{active?.label??'MFK Admin'}</strong></div>
        <div className="mfk-admin-topstate"><b>乾淨抽取模式</b><span>所有舊 API / DB writer 預設停用</span></div>
      </header>
      <div className="mfk-admin-workspace">{children}</div>
    </main>
  </div>;
}
