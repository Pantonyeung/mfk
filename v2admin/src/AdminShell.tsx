import type {ReactNode} from 'react';
import {NavLink,useLocation} from 'react-router';
import {ADMIN_CAPABILITY_GROUPS,findAdminCapability} from './admin-capabilities.ts';

const statusLabel={
  NOT_WIRED:'未啟用',
  DEFERRED:'稍後開放',
  RETIRED:'已停用',
} as const;

export function AdminShell({children}:{children:ReactNode}){
  const location=useLocation();
  const active=findAdminCapability(location.pathname);
  const activeGroup=ADMIN_CAPABILITY_GROUPS.find(group=>group.capabilities.some(item=>item.id===active?.id))??ADMIN_CAPABILITY_GROUPS[0]!;

  return <div className="mfk-admin-shell">
    <aside className="mfk-admin-rail">
      <div className="mfk-admin-brand"><b>磨</b><span>管理後台</span></div>
      <nav aria-label="管理後台功能">
        {ADMIN_CAPABILITY_GROUPS.map(group=><NavLink
          key={group.id}
          to={group.capabilities[0]?.path??'/admin/overview'}
          className={group.id===activeGroup.id?'active':''}
        ><span>{group.label}</span><small>{group.capabilities.length}</small></NavLink>)}
      </nav>
      <div className="mfk-admin-authority"><b>設定與發布</b><span>以已發布設定為準</span></div>
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
        <div><small>設定 → 發布 → 門店生效</small><strong>{active?.label??'MFK Admin'}</strong></div>
        <div className="mfk-admin-topstate"><b>營運管理</b><span>部分功能尚未啟用</span></div>
      </header>
      <div className="mfk-admin-workspace">{children}</div>
    </main>
  </div>;
}
