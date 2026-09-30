import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {ADMIN_MENU_GROUPS,destinationForPath,menuForDestination,type AdminMenuGroup} from './navigation.ts';
import {
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingSkeleton,
  PageHeader,
  ResponsiveRecordList,
  SearchField,
  StaleBanner,
  StatusBadge,
} from './ui.tsx';

const SKELETON_COLUMNS=[{key:'name',label:'名稱'},{key:'status',label:'狀態'},{key:'updatedAt',label:'最後更新'}] as const;

function currentPath(){
  return destinationForPath(typeof window==='undefined'?'/admin/overview':window.location.pathname).path;
}

function PrimaryNavigation({activeMenu,onSelect}:{activeMenu:AdminMenuGroup;onSelect:(menu:AdminMenuGroup)=>void}){
  return <nav className="v3-menu-primary" aria-label="主要功能">
    {ADMIN_MENU_GROUPS.map(menu=><button key={menu.id} type="button" className={menu.id===activeMenu.id?'is-active':''} aria-current={menu.id===activeMenu.id?'true':undefined} onClick={()=>onSelect(menu)}>
      <span className="v3-menu-index">{menu.index}</span><span className="v3-menu-label">{menu.label}</span>
    </button>)}
  </nav>;
}

function SecondaryNavigation({menu,path,onBack,onNavigate}:{menu:AdminMenuGroup;path:string;onBack?:()=>void;onNavigate:(path:string)=>void}){
  return <div className="v3-menu-secondary">
    {onBack?<button className="v3-nav-back" type="button" onClick={onBack}>返回主要功能</button>:null}
    <div className="v3-secondary-title"><small>{menu.index}</small><strong>{menu.label}</strong></div>
    <nav aria-label={`${menu.label}頁面`}>{menu.destinations.map(destination=><button key={destination.path} type="button" className={destination.path===path?'is-active':''} aria-current={destination.path===path?'page':undefined} onClick={()=>onNavigate(destination.path)}>{destination.title}</button>)}</nav>
  </div>;
}

type CanonicalState='pending'|'error'|'fresh'|'refreshing'|'stale';

function RouteSkeleton({path,canonicalState,onRefresh}:{path:string;canonicalState:CanonicalState;onRefresh:()=>void}){
  const destination=destinationForPath(path);
  const menu=menuForDestination(destination);
  return <>
    <PageHeader eyebrow={menu.label} title={destination.title} description="共用版面已建立；業務資料與操作會按垂直切片正式接駁。" aside={<><StatusBadge tone={destination.authority==='read-only'?'neutral':'warning'}>{destination.authority==='read-only'?'只讀':'尚未接駁'}</StatusBadge><button className="v3-primary" type="button" disabled title="業務功能尚未接駁">{destination.primaryAction}</button></>}/>
    {canonicalState==='stale'?<StaleBanner onRefresh={onRefresh}/>:canonicalState==='refreshing'?<div className="v3-refreshing" role="status">正在重新讀取正式資料…</div>:null}
    {canonicalState==='pending'?<LoadingSkeleton/>:canonicalState==='error'?<ErrorState description="未能建立可信工作區。" action={<button type="button" onClick={onRefresh}>重新讀取</button>}/>:<section className="v3-list-surface">
      <div className="v3-list-tools"><SearchField value="" onChange={()=>{}} disabled/><FilterBar><button type="button" disabled title="業務資料接駁後可用">篩選</button></FilterBar></div>
      <ResponsiveRecordList columns={SKELETON_COLUMNS} rows={[]} empty={<EmptyState title={destination.empty} description="目前只顯示 UI 基礎，唔會用假資料冒充正式結果。"/>}/>
    </section>}
  </>;
}

export function AdminShell({storeId,displayName,releaseStatus,canonicalState,onRefresh,onDiagnostics,onSignOut,children}:{
  storeId:string;
  displayName:string;
  releaseStatus:ReactNode;
  canonicalState:CanonicalState;
  onRefresh:()=>void;
  onDiagnostics:()=>void;
  onSignOut:()=>void;
  children?:ReactNode;
}){
  const [path,setPath]=useState(currentPath);
  const selectedDestination=useMemo(()=>destinationForPath(path),[path]);
  const selectedMenu=useMemo(()=>menuForDestination(selectedDestination),[selectedDestination]);
  const [activeMenu,setActiveMenu]=useState(selectedMenu);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [mobileStep,setMobileStep]=useState<'menus'|'destinations'>('menus');

  useEffect(()=>{
    const onPopState=()=>setPath(currentPath());
    window.addEventListener('popstate',onPopState);
    return ()=>window.removeEventListener('popstate',onPopState);
  },[]);
  useEffect(()=>setActiveMenu(selectedMenu),[selectedMenu]);
  useEffect(()=>{
    if(!drawerOpen)return;
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setDrawerOpen(false);};
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  },[drawerOpen]);

  const navigate=(nextPath:string)=>{
    window.history.pushState({},'',nextPath);
    setPath(nextPath);
    setDrawerOpen(false);
    setMobileStep('menus');
  };
  const selectMenu=(menu:AdminMenuGroup)=>{
    setActiveMenu(menu);
    if(drawerOpen||window.matchMedia('(max-width: 1179px)').matches){setDrawerOpen(true);setMobileStep('destinations');}
  };

  return <div className="v3-app-shell">
    <aside className="v3-sidebar" aria-label="Admin 功能導覽"><PrimaryNavigation activeMenu={activeMenu} onSelect={selectMenu}/><SecondaryNavigation menu={activeMenu} path={path} onNavigate={navigate}/></aside>
    {drawerOpen?<><button className="v3-drawer-backdrop" type="button" aria-label="關閉功能選單" onClick={()=>setDrawerOpen(false)}/><aside className="v3-drawer" aria-label="流動版功能導覽">
      <div className="v3-drawer-head"><strong>功能選單</strong><button type="button" onClick={()=>setDrawerOpen(false)}>關閉</button></div>
      {mobileStep==='menus'?<PrimaryNavigation activeMenu={activeMenu} onSelect={selectMenu}/>:<SecondaryNavigation menu={activeMenu} path={path} onBack={()=>setMobileStep('menus')} onNavigate={navigate}/>}
    </aside></>:null}
    <div className="v3-main-column">
      <header className="v3-topbar">
        <button className="v3-menu-trigger" type="button" aria-expanded={drawerOpen} onClick={()=>{setMobileStep('menus');setDrawerOpen(true);}}>功能</button>
        <a className="v3-brand" href="/admin/overview" onClick={event=>{event.preventDefault();navigate('/admin/overview');}}><span>MFK</span><strong>Admin V3</strong></a>
        <div className="v3-context"><span>{storeId}</span><strong>{displayName}</strong></div>
        <div className="v3-top-actions"><button type="button" onClick={onDiagnostics}>系統資訊</button><button type="button" onClick={onSignOut}>登出</button></div>
      </header>
      {releaseStatus}
      <main className="v3-content"><RouteSkeleton path={path} canonicalState={canonicalState} onRefresh={onRefresh}/>{children}</main>
    </div>
  </div>;
}
