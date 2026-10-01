import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {ADMIN_MENU_GROUPS,destinationForPath,menuForDestination,type AdminMenuGroup} from './navigation.ts';
import {ProductListPage} from './product-list.tsx';
import {AvailabilityPage} from './availability-page.tsx';
import {AdminWorkspace} from './admin-workspaces.tsx';
import {ModifiersPage,CombosPage} from './catalog-functional-pages.tsx';
import {CategoriesPage,PricingPage,MenuDisplayPage} from './catalog-core-pages.tsx';
import {DiningTablesPage} from './dining-tables-page.tsx';
import {ChannelPage,PermissionsPage,PrintRulesPage,PrintTemplatesPage,PrintersPage,QuickReasonsPage,RolesPage,StaffPage,StoreSettingsPage} from './admin-functional-pages.tsx';
import {AccessPage,BusinessDayPage,CapacityPage,CashClosePage,DevicesPage,OtaPage,PublishFlowPage} from './admin-operations-pages.tsx';
import {OrdersPage,ReportPage} from './admin-read-pages.tsx';
import {AuditPage,DiagnosticsPage,EffectiveSettingsPage,IntegrationsPage,TodayPage} from './admin-system-pages.tsx';
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
    <nav aria-label={menu.label+'頁面'}>{menu.destinations.map(destination=><button key={destination.path} type="button" className={destination.path===path?'is-active':''} aria-current={destination.path===path?'page':undefined} onClick={()=>onNavigate(destination.path)}>{destination.title}</button>)}</nav>
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

export function AdminShell({storeId,displayName,releaseStatus,canonicalState,canonicalSnapshot,previewMode=false,initialPath,onRefresh,onDiagnostics,onSignOut,children}:{
  storeId:string;
  displayName:string;
  releaseStatus:ReactNode;
  canonicalState:CanonicalState;
  canonicalSnapshot?:unknown;
  previewMode?:boolean;
  initialPath?:string;
  onRefresh:()=>void;
  onDiagnostics:()=>void;
  onSignOut:()=>void;
  children?:ReactNode;
}){
  const [path,setPath]=useState(()=>initialPath??currentPath());
  const selectedDestination=useMemo(()=>destinationForPath(path),[path]);
  const selectedMenu=useMemo(()=>menuForDestination(selectedDestination),[selectedDestination]);
  const [activeMenu,setActiveMenu]=useState(selectedMenu);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [mobileStep,setMobileStep]=useState<'menus'|'destinations'>('menus');

  useEffect(()=>{
    if(previewMode)return;
    const onPopState=()=>setPath(currentPath());
    window.addEventListener('popstate',onPopState);
    return ()=>window.removeEventListener('popstate',onPopState);
  },[previewMode]);
  useEffect(()=>setActiveMenu(selectedMenu),[selectedMenu]);
  useEffect(()=>{
    if(!drawerOpen)return;
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setDrawerOpen(false);};
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  },[drawerOpen]);

  const navigate=(nextPath:string)=>{
    if(!previewMode)window.history.pushState({},'',nextPath);
    setPath(nextPath);
    setDrawerOpen(false);
    setMobileStep('menus');
  };
  const selectMenu=(menu:AdminMenuGroup)=>{
    setActiveMenu(menu);
    if(drawerOpen||window.matchMedia('(max-width: 1179px)').matches){setDrawerOpen(true);setMobileStep('destinations');}
  };

  const routeContent=path==='/admin/overview'&&previewMode
    ?<TodayPage mode="overview" onNavigate={navigate}/>
    :path==='/admin/action-queue'&&previewMode
      ?<TodayPage mode="queue" onNavigate={navigate}/>
      :path==='/admin/orders/open'&&previewMode
        ?<OrdersPage mode="open"/>
    :path==='/admin/orders/history'&&previewMode
      ?<OrdersPage mode="history"/>
      :path==='/admin/orders/exceptions'&&previewMode
        ?<OrdersPage mode="exceptions"/>
        :path==='/admin/catalog/products'
          ?<ProductListPage canonicalSnapshot={canonicalSnapshot} previewMode={previewMode} onReviewDraft={()=>navigate('/admin/publish/pending')}/>
    :path==='/admin/catalog/categories'&&previewMode
      ?<CategoriesPage/>
      :path==='/admin/catalog/modifiers'&&previewMode
        ?<ModifiersPage/>
        :path==='/admin/catalog/combos'&&previewMode
          ?<CombosPage/>
          :path==='/admin/catalog/pricing'&&previewMode
            ?<PricingPage/>
            :path==='/admin/catalog/menu-display'&&previewMode
              ?<MenuDisplayPage/>
              :path==='/admin/availability'
                ?<AvailabilityPage canonicalSnapshot={canonicalSnapshot} previewMode={previewMode}/>
                :path==='/admin/business-day'&&previewMode
                  ?<BusinessDayPage/>
                  :path==='/admin/cash-close'&&previewMode
                    ?<CashClosePage/>
                    :path==='/admin/operations/capacity'&&previewMode
                      ?<CapacityPage/>
                      :path==='/admin/channels'&&previewMode
                  ?<ChannelPage mode="overview"/>
                  :path==='/admin/channels/accept-policy'&&previewMode
                    ?<ChannelPage mode="accept"/>
                    :path==='/admin/channels/sync-policy'&&previewMode
                      ?<ChannelPage mode="sync"/>
                      :path==='/admin/channels/store-binding'&&previewMode
                        ?<ChannelPage mode="binding"/>
                        :path==='/admin/channels/product-mapping'&&previewMode
                          ?<ChannelPage mode="mapping"/>
                          :path==='/admin/channels/mapping-failure'&&previewMode
                            ?<ChannelPage mode="failures"/>
                            :path==='/admin/channels/net-estimate'&&previewMode
                              ?<ChannelPage mode="estimate"/>
                              :path==='/admin/print/printers'&&previewMode
                                ?<PrintersPage/>
                                :path==='/admin/print/templates'&&previewMode
                                  ?<PrintTemplatesPage/>
                                  :path==='/admin/print/rules'&&previewMode
                                    ?<PrintRulesPage/>
                                    :path==='/admin/devices'&&previewMode
                                      ?<DevicesPage/>
                                      :path==='/admin/ota'&&previewMode
                                        ?<OtaPage/>
                                        :path==='/admin/staff'&&previewMode
                                          ?<StaffPage/>
                                          :path==='/admin/roles'&&previewMode
                                            ?<RolesPage/>
                                            :path==='/admin/permissions'&&previewMode
                                              ?<PermissionsPage/>
                                              :path==='/admin/access'&&previewMode
                                                ?<AccessPage/>
                                                :path==='/admin/reports/sales'&&previewMode
                                                  ?<ReportPage mode="sales"/>
                                                  :path==='/admin/reports/products'&&previewMode
                                                    ?<ReportPage mode="products"/>
                                                    :path==='/admin/reports/channels'&&previewMode
                                                      ?<ReportPage mode="channels"/>
                                                      :path==='/admin/reports/refunds'&&previewMode
                                                        ?<ReportPage mode="refunds"/>
                                                        :path==='/admin/reports/operations'&&previewMode
                                                          ?<ReportPage mode="operations"/>
                                                          :path==='/admin/reports/export'&&previewMode
                                                            ?<ReportPage mode="export"/>
                                                            :path==='/admin/publish/pending'&&previewMode
                                                              ?<PublishFlowPage mode="pending"/>
                                                  :path==='/admin/publish'&&previewMode
                                                    ?<PublishFlowPage mode="publish"/>
                                                    :path==='/admin/publish/versions'&&previewMode
                                                      ?<PublishFlowPage mode="versions"/>
                                                      :path==='/admin/publish/rollback'&&previewMode
                                                        ?<PublishFlowPage mode="rollback"/>
                                                        :path==='/admin/system/audit'&&previewMode
                                                          ?<AuditPage/>
                                                          :path==='/admin/system/diagnostics'&&previewMode
                                                            ?<DiagnosticsPage/>
                                                            :path==='/admin/system/integrations'&&previewMode
                                                              ?<IntegrationsPage/>
                                                              :path==='/admin/system/advanced'&&previewMode
                                                                ?<EffectiveSettingsPage onNavigate={navigate}/>
                                                                :path==='/admin/store/settings'&&previewMode
                                            ?<StoreSettingsPage mode="settings"/>
                                            :path==='/admin/store/hours'&&previewMode
                                              ?<StoreSettingsPage mode="hours"/>
                                              :path==='/admin/store/business-day'&&previewMode
                                                ?<StoreSettingsPage mode="business-day"/>
                                                :path==='/admin/store/operations'&&previewMode
                                                  ?<StoreSettingsPage mode="operations"/>
                                                  :path==='/admin/store/quick-reasons'&&previewMode
                                                    ?<QuickReasonsPage/>
                                                    :path==='/admin/store/tables'&&previewMode
                                                      ?<DiningTablesPage/>
                                                      :previewMode
                                                        ?<AdminWorkspace path={path} previewMode/>
                                                        :<RouteSkeleton path={path} canonicalState={canonicalState} onRefresh={onRefresh}/>;

  return <div className="v3-app-shell" data-preview={previewMode?'true':'false'}>
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
        {previewMode?<div className="v3-preview-topbadge">只供介面驗收</div>:<div className="v3-top-actions"><button type="button" onClick={onDiagnostics}>系統資訊</button><button type="button" onClick={onSignOut}>登出</button></div>}
      </header>
      {releaseStatus}
      <main className="v3-content">{routeContent}{children}</main>
    </div>
  </div>;
}
