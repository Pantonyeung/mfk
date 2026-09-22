import {useEffect,useState,type ReactNode} from 'react';
import {NavLink,useLocation} from 'react-router';
import {ADMIN_CAPABILITY_GROUPS,findAdminCapability} from './admin-capabilities.ts';
import {readAdminSyncAcks,readAdminSyncStatus} from './admin-sync-client.ts';

const statusLabel={
  READY:'可設定',
  READ_ONLY:'只讀資料',
  P1:'保留功能',
  GOVERNANCE:'治理',
} as const;


function AdminSyncTopState(){
  const [version,setVersion]=useState(0);
  const [ack,setAck]=useState<{revision:number;deviceId:string;appliedAt:string}|null>(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{
      setVersion(value=>value+1);
      void readAdminSyncAcks().then(rows=>{
        if(!active)return;
        const latest=rows[0];
        setAck(latest?{revision:latest.revision,deviceId:latest.deviceId,appliedAt:latest.appliedAt}:null);
      });
    };
    window.addEventListener('mfk-admin-sync',refresh);
    window.addEventListener('focus',refresh);
    refresh();
    return()=>{active=false;window.removeEventListener('mfk-admin-sync',refresh);window.removeEventListener('focus',refresh);};
  },[]);
  void version;
  const status=readAdminSyncStatus();
  const stateLabel=status.state==='PUBLISHED'?'已送到雲端'
    :status.state==='PUBLISHING'?'同步中'
    :status.state==='QUEUED'?'等待同步'
    :status.state==='ERROR'?'同步失敗'
    :'未有同步';
  const ackLabel=ack
    ?'SMT 已套用 R'+ack.revision
    :'等待 SMT 回讀';
  return <div className="mfk-admin-topstate"><b>Admin → SMT 自動同步</b><span>{status.revision?'R'+status.revision+' · ':''}{stateLabel} · {ackLabel}</span></div>;
}

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
      <div className="mfk-admin-authority"><b>營運控制台</b><span>設定、記錄、報表、治理</span></div>
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
        <div><small>磨飯營運管理</small><strong>{active?.label??'管理後台'}</strong></div>
        <AdminSyncTopState/>
      </header>
      <div className="mfk-admin-workspace">{children}</div>
    </main>
  </div>;
}
