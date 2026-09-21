import type {ReactNode} from 'react';
import {NavLink,useLocation} from 'react-router';
import {ADMIN_CAPABILITY_GROUPS,findAdminCapability} from './admin-capabilities.ts';

const statusLabel={
  NOT_WIRED:'待接駁',
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
          to={group.capabilities[0]?.path??'/admin/overview'}
          className={group.id===activeGroup.id?'active':''}
        ><span>{group.label}</span><small>{group.capabilities.length}</small></NavLink>)}
      </nav>
      <div className="mfk-admin-authority"><b>CONTROL PLANE</b><span>MFK authority only</span></div>
    </aside>

    <aside className="mfk-admin-section">
      <header><small>功能組</small><strong>{activeGroup.label}</strong></header>
      <nav>
        {activeGroup.capabilities.map(item=><NavLink
          key={item.id}
          to={item.path}
          className={({isActive})=>isActive?'active':''}
        ><span>{item.label}</span><small data-status={item.status}>{statusLabel[item.status]}</small></NavLink>)}
      </nav>
    </aside>

    <main className="mfk-admin-main">
      <header className="mfk-admin-topbar">
        <div><small>OWNER → ADMIN → SMT</small><strong>{active?.label??'MFK Admin'}</strong></div>
        <div className="mfk-admin-topstate"><b>MFK Admin 控制面</b><span>Domain adapters 尚未接駁</span></div>
      </header>
      <div className="mfk-admin-workspace">{children}</div>
    </main>
  </div>;
}
