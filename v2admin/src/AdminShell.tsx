import {useEffect,useRef,useState,type ReactNode} from 'react';
import {NavLink,useLocation,useNavigate} from 'react-router';
import {ADMIN_CAPABILITY_GROUPS,findAdminCapability} from './admin-capabilities.ts';
import {readActiveAdminRelease,type ActiveAdminReleaseRef} from './admin-local-store.ts';
import {readAdminSyncAcks,readAdminSyncStatus,type AdminSyncStatus} from './admin-sync-client.ts';
import {AdminStatusBadge,type AdminTone} from './AdminUiPrimitives.tsx';

const statusLabel={
  READY:'可設定',
  READ_ONLY:'只讀',
  P1:'保留',
  GOVERNANCE:'治理',
} as const;

const mobileCoreGroups=new Set(['today','orders','menu','operations']);

interface AdminSyncAckView{revision:number;fingerprint:string;deviceId:string;appliedAt:string}

export function deriveAdminSyncPresentation({
  activeRelease,status,acks,online,
}:{
  activeRelease:ActiveAdminReleaseRef|null;
  status:AdminSyncStatus;
  acks:readonly AdminSyncAckView[];
  online:boolean;
}):{tone:AdminTone;title:string;detail:string}{
  if(!activeRelease)return {tone:'neutral',title:'未有啟用版本',detail:'保存後會自動排入 Admin → SMT 同步'};

  const currentAck=status.revision===activeRelease.version&&status.fingerprint
    ?acks.find(row=>row.revision===activeRelease.version&&row.fingerprint===status.fingerprint)
    :undefined;
  const latestAck=acks[0];
  const title='R'+activeRelease.version;

  if(!online)return {tone:'warning',title,detail:'離線 · 顯示最後已知同步狀態'};
  if(status.state==='ERROR'&&status.revision===activeRelease.version)return {tone:'danger',title,detail:'同步失敗'+(status.error?' · '+status.error:'')};
  if(status.state==='QUEUED'&&status.revision===activeRelease.version)return {tone:'info',title,detail:'已保存 · 等待同步'};
  if(status.state==='PUBLISHING'&&status.revision===activeRelease.version)return {tone:'info',title,detail:'正在送往雲端'};
  if(currentAck)return {tone:'success',title,detail:'SMT 已套用 · '+currentAck.deviceId};
  if(status.state==='PUBLISHED'&&status.revision===activeRelease.version)return {tone:'warning',title,detail:'雲端已接收 · 等待 matching SMT 回讀'};
  if(latestAck)return {tone:'warning',title,detail:'目前未有 matching 回讀 · 最近只見 R'+latestAck.revision};
  return {tone:'warning',title,detail:'未觀察到 matching SMT 回讀'};
}

function AdminSyncTopState(){
  const [version,setVersion]=useState(0);
  const [acks,setAcks]=useState<readonly AdminSyncAckView[]>([]);
  const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);

  useEffect(()=>{
    let active=true;
    const refresh=()=>{
      setVersion(value=>value+1);
      setOnline(navigator.onLine);
      void readAdminSyncAcks().then(rows=>{
        if(!active)return;
        setAcks(rows.map(row=>({revision:row.revision,fingerprint:row.fingerprint,deviceId:row.deviceId,appliedAt:row.appliedAt})));
      });
    };
    window.addEventListener('mfk-admin-sync',refresh);
    window.addEventListener('mfk-admin-release',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('online',refresh);
    window.addEventListener('offline',refresh);
    refresh();
    return()=>{
      active=false;
      window.removeEventListener('mfk-admin-sync',refresh);
      window.removeEventListener('mfk-admin-release',refresh);
      window.removeEventListener('focus',refresh);
      window.removeEventListener('online',refresh);
      window.removeEventListener('offline',refresh);
    };
  },[]);

  void version;
  const activeRelease=readActiveAdminRelease();
  const status=readAdminSyncStatus();
  const {tone,title,detail}=deriveAdminSyncPresentation({activeRelease,status,acks,online});

  return <div className="mfk-admin-topstate" data-tone={tone} aria-live="polite">
    <AdminStatusBadge tone={tone}>{title}</AdminStatusBadge>
    <span>{detail}</span>
  </div>;
}

export function AdminShell({children}:{children:ReactNode}){
  const location=useLocation();
  const navigate=useNavigate();
  const moreDialog=useRef<HTMLDialogElement>(null);
  const active=findAdminCapability(location.pathname);
  const activeGroup=ADMIN_CAPABILITY_GROUPS.find(group=>group.capabilities.some(item=>item.id===active?.id))??ADMIN_CAPABILITY_GROUPS[0]!;
  const mobileGroups=ADMIN_CAPABILITY_GROUPS.filter(group=>mobileCoreGroups.has(group.id));
  const moreGroups=ADMIN_CAPABILITY_GROUPS.filter(group=>!mobileCoreGroups.has(group.id));
  const moreIsActive=!mobileCoreGroups.has(activeGroup.id);

  useEffect(()=>{if(moreDialog.current?.open)moreDialog.current.close();},[location.pathname]);

  const openMore=()=>moreDialog.current?.showModal();
  const closeMore=()=>moreDialog.current?.close();

  return <div className="mfk-admin-shell">
    <a className="mfk-admin-skip-link" href="#admin-main-content">跳到主要內容</a>

    <aside className="mfk-admin-rail">
      <div className="mfk-admin-brand"><b>MFK</b><span>營運管理</span></div>
      <nav aria-label="管理後台主要功能">
        {ADMIN_CAPABILITY_GROUPS.map((group,index)=><NavLink
          key={group.id}
          to={group.capabilities[0]?.path??'/admin/overview'}
          className={group.id===activeGroup.id?'active':''}
          aria-current={group.id===activeGroup.id?'page':undefined}
        ><span className="mfk-admin-nav-index">{String(index+1).padStart(2,'0')}</span><strong>{group.label}</strong><small>{group.capabilities.length} 個功能</small></NavLink>)}
      </nav>
      <div className="mfk-admin-authority"><b>Control Plane</b><span>設定、記錄、報表、治理</span></div>
    </aside>

    <main className="mfk-admin-main" id="admin-main-content" tabIndex={-1}>
      <header className="mfk-admin-topbar">
        <div className="mfk-admin-page-identity">
          <small>{activeGroup.label} / {active?.label??'管理後台'}</small>
          <strong>{active?.label??'管理後台'}</strong>
        </div>
        <AdminSyncTopState/>
      </header>

      <section className="mfk-admin-context" aria-label={activeGroup.label+'功能'}>
        <div className="mfk-admin-context-title">
          <span className="mfk-admin-context-group">{activeGroup.label}</span>
          <label className="mfk-admin-section-select"><span className="admin-visually-hidden">目前頁面</span><select aria-label={activeGroup.label+'目前頁面'} value={active?.path??activeGroup.capabilities[0]?.path} onChange={event=>navigate(event.target.value)}>{activeGroup.capabilities.map(item=><option key={item.id} value={item.path}>{item.label}</option>)}</select></label>
        </div>
      </section>

      <div className="mfk-admin-workspace">
        <details className="mfk-admin-focus-workspace" key={location.pathname}>
          <summary>
            <div className="mfk-admin-focus-copy">
              <span>{activeGroup.label}</span>
              <h1>{active?.label??'管理後台'}</h1>
              <p>{active?.purpose??'按需要打開工作區。'}</p>
            </div>
            <span className="mfk-admin-focus-action" aria-hidden="true"><span className="when-closed">打開</span><span className="when-open">收起</span><i>⌄</i></span>
          </summary>
          <div className="mfk-admin-focus-body">{children}</div>
        </details>
      </div>
    </main>

    <nav className="mfk-admin-mobile-nav" aria-label="手機主要功能">
      {mobileGroups.map(group=><NavLink key={group.id} to={group.capabilities[0]?.path??'/admin/overview'} className={group.id===activeGroup.id?'active':''}><span>{group.label}</span></NavLink>)}
      <button type="button" className={moreIsActive?'active':''} aria-haspopup="dialog" onClick={openMore}><span>更多</span></button>
    </nav>

    <dialog ref={moreDialog} className="mfk-admin-more-dialog" aria-labelledby="mfk-admin-more-title" onClick={event=>{if(event.target===event.currentTarget)closeMore();}}>
      <div className="mfk-admin-more-sheet">
        <header><div><small>全部功能</small><h2 id="mfk-admin-more-title">更多管理範圍</h2></div><button type="button" onClick={closeMore} aria-label="關閉更多功能">關閉</button></header>
        <div className="mfk-admin-more-groups">
          {moreGroups.map(group=><section key={group.id}>
            <h3>{group.label}</h3>
            <div>{group.capabilities.map(item=><NavLink key={item.id} to={item.path}><span>{item.label}</span><small>{statusLabel[item.status]}</small></NavLink>)}</div>
          </section>)}
        </div>
      </div>
    </dialog>
  </div>;
}
