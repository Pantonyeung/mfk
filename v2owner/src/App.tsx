import {mfkVersionLabel} from '../../contracts/product-version-v1.ts';
import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {readOwnerLocalWorkspace,writeOwnerLocalWorkspace,type OwnerChecklistItem} from './persistence';
import {resolveOwnerRuntimePort} from './runtime';
import {buildOwnerTodayViewModel} from './today-view-model';
import {
  DineInOpenChecksCard,
  GlobalStateBanner,
  TodayActionSummaryCard,
  TodayContextHeader,
  TodayHealthSummaryCard,
  TodayInsightCard,
  TodayLiveOrdersCard,
  TodayStaffSummaryCard,
} from './today-components';
import {ActionQueuePage,type OwnerActionCommandFlight} from './stage02-action-queue';
import {isCanonicalActionUnknown,selectOpenActions} from './stage02-open-actions';
import {OrderOversightPage} from './stage03-order-oversight';
import type {OwnerOrderScope} from './stage03-view-model';
import {ChannelHealthPage} from './channel-health';
import {PlanningPage} from './planning';
import {SellabilityPage} from './sellability';
import {StaffOverviewPage} from './staff-overview';
import {ActivityAuditPage,DeviceHealthPage,ManagerLogPage,MoreHubPage,ReportsPage,SettingsSummaryPage,type ManagerMode} from './source-fidelity-wave2';
import type {
  OwnerAuthSession,
  OwnerConnectionState,
  OwnerPlanningSaveInput,
  OwnerPlanningSnapshot,
  OwnerReadModelSnapshot,
  OwnerRuntimePort,
  OwnerSellabilityCommandInput,
  OwnerSellabilityCommandResult,
} from './product-types';

type View='today'|'queue'|'orders'|'more';
type SecondaryView='channels'|'planning'|'sellability'|'staff'|'devices'|'reports'|'manager-log'|'checklist'|'handoff'|'activity'|'settings-summary';
type Tool='customers'|'marketing'|'settlement'|'cash'|'inventory'|'notifications'|'admin'|'recovery';
type Confirmation={label:string;target:string;impact:string;actionId?:string};

const SECONDARY_PATHS:Record<SecondaryView,string>={
  channels:'/channels',planning:'/planning',sellability:'/sellability',staff:'/staff',
  devices:'/devices',reports:'/reports','manager-log':'/manager-log',checklist:'/checklist',
  handoff:'/handoff',activity:'/activity','settings-summary':'/settings-summary',
};
function secondaryFromPath(path:string):SecondaryView|null{
  for(const [view,route] of Object.entries(SECONDARY_PATHS))if(route===path)return view as SecondaryView;
  return null;
}
function primaryFromPath(path:string,fallback:View):View{
  if(path==='/actions')return 'queue';
  if(path==='/orders')return 'orders';
  if(path==='/more')return 'more';
  if(path==='/today'||path==='/')return 'today';
  return fallback;
}

export function App(){
  const local=useMemo(()=>readOwnerLocalWorkspace(),[]);
  const [view,setView]=useState<View>(()=>typeof window==='undefined'?local.activeView:primaryFromPath(window.location.pathname,local.activeView));
  const [managerNote,setManagerNote]=useState(local.managerNote);
  const [handoffNote,setHandoffNote]=useState(local.handoffNote);
  const [checklist,setChecklist]=useState<readonly OwnerChecklistItem[]>(local.checklist);
  const [port]=useState<OwnerRuntimePort|null>(()=>resolveOwnerRuntimePort());
  const [connection,setConnection]=useState<OwnerConnectionState>(port?'LOADING':'OFFLINE_READONLY');
  const [snapshot,setSnapshot]=useState<OwnerReadModelSnapshot|null>(null);
  const [ownerSession,setOwnerSession]=useState<OwnerAuthSession|null>(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [loginStaffId,setLoginStaffId]=useState('');
  const [loginPin,setLoginPin]=useState('');
  const [loginBusy,setLoginBusy]=useState(false);
  const [loginError,setLoginError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [tool,setTool]=useState<Tool|null>(null);
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);
  const [commandFlight,setCommandFlight]=useState<OwnerActionCommandFlight|null>(null);
  const [ordersScope,setOrdersScope]=useState<OwnerOrderScope>('DEFAULT');
  const [secondary,setSecondary]=useState<SecondaryView|null>(()=>typeof window==='undefined'?null:secondaryFromPath(window.location.pathname));
  const [planning,setPlanning]=useState<OwnerPlanningSnapshot|null>(null);
  const [planningLoading,setPlanningLoading]=useState(false);
  const [planningSaving,setPlanningSaving]=useState(false);
  const [sellabilityBusy,setSellabilityBusy]=useState(false);
  const [sellabilityResult,setSellabilityResult]=useState<OwnerSellabilityCommandResult|null>(null);

  const persistLocal=(next?:Partial<{view:View;managerNote:string;handoffNote:string;checklist:readonly OwnerChecklistItem[]}>)=>{
    writeOwnerLocalWorkspace({
      activeView:next?.view??view,
      managerNote:next?.managerNote??managerNote,
      handoffNote:next?.handoffNote??handoffNote,
      checklist:next?.checklist??checklist,
    });
  };

  const changeView=(next:View)=>{
    setSecondary(null);setView(next);persistLocal({view:next});
    if(typeof window!=='undefined'){
      const path=next==='today'?'/today':next==='queue'?'/actions':next==='orders'?'/orders':'/more';
      if(window.location.pathname!==path)window.history.pushState({},'',path);
    }
  };
  const openSecondary=(next:SecondaryView)=>{
    setSecondary(next);setView('more');persistLocal({view:'more'});
    if(typeof window!=='undefined'){
      const path=SECONDARY_PATHS[next];
      if(window.location.pathname!==path)window.history.pushState({},'',path);
    }
  };

  const refresh=async():Promise<OwnerReadModelSnapshot|null>=>{
    if(!port){setConnection('OFFLINE_READONLY');setSnapshot(null);return null}
    setConnection('LOADING');
    try{
      const next=await port.readSnapshot();
      setSnapshot(next);
      setConnection(resolveSnapshotState(next));
      return next;
    }catch(reason){
      const code=typeof reason==='object'&&reason&&'code' in reason?String((reason as {code?:unknown}).code||''):'';
      if(code==='OWNER_SESSION_REQUIRED'||code==='OWNER_SESSION_UNAUTHORIZED'){
        setOwnerSession(null);setConnection('PERMISSION_DENIED');
      }else if(code==='OWNER_NETWORK_ERROR'){
        setConnection('OFFLINE_READONLY');
      }else{
        setConnection('ERROR');
      }
      return null;
    }
  };

  useEffect(()=>{
    let cancelled=false;
    void(async()=>{
      if(port?.readOwnerSession){
        const session=await port.readOwnerSession();
        if(cancelled)return;
        setOwnerSession(session);setAuthChecked(true);
        if(!session){setConnection('PERMISSION_DENIED');return}
      }else setAuthChecked(true);
      await refresh();
    })();
    return()=>{cancelled=true};
  },[port]);

  useEffect(()=>{
    if(!port||!ownerSession)return;
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    const focus=()=>void refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    document.addEventListener('visibilitychange',visible);window.addEventListener('focus',focus);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',focus);};
  },[port,ownerSession?.sessionToken]);

  useEffect(()=>{
    const pop=()=>{
      const path=window.location.pathname;
      const nextSecondary=secondaryFromPath(path);
      if(nextSecondary){setSecondary(nextSecondary);setView('more');return}
      setSecondary(null);
      if(path==='/actions')setView('queue');
      else if(path==='/orders')setView('orders');
      else if(path==='/more')setView('more');
      else setView('today');
    };
    window.addEventListener('popstate',pop);
    return()=>window.removeEventListener('popstate',pop);
  },[]);

  const loadPlanning=async(monthKey?:string)=>{
    if(!port?.readPlanning)return;
    const key=monthKey??new Date(Date.now()+8*60*60*1000).toISOString().slice(0,7);
    setPlanningLoading(true);
    try{setPlanning(await port.readPlanning(key));}
    catch{setNotice('未能讀取最新規劃；暫時唔會用舊資料代替。');}
    finally{setPlanningLoading(false);}
  };
  const loadSellability=async()=>{
    if(!port?.readSellability){const next=await refresh();return next?.sellability??null}
    try{
      const items=await port.readSellability();
      setSnapshot(current=>current?{...current,sellability:items}:current);
      return items;
    }catch{
      setNotice('未能確認最新商品供應狀態；暫時保持未有資料。');
      return null;
    }
  };
  const commandSellability=async(input:OwnerSellabilityCommandInput)=>{
    if(!port?.commandSellability){setNotice('商品供應操作暫未連接；正式狀態沒有改變。');return}
    if(connection==='OFFLINE_READONLY'||connection==='PERMISSION_DENIED'){setNotice('目前只可讀取；售罄操作已停用。');return}
    setSellabilityBusy(true);
    try{
      const result=await port.commandSellability(input);
      if(result.state==='CONFIRMED')setNotice('售罄操作已完成，並已確認各項商品狀態。');
      else if(result.state==='PARTIAL')setNotice('部分商品已完成更新；其餘商品狀態仍待確認。');
      else setNotice('操作結果未能確認；請先重新整理，暫時唔好重複操作。');
      await loadSellability();
    }catch{setNotice('操作結果未能確認；請先重新整理最新狀態，暫時唔好重複操作。');}
    finally{setSellabilityBusy(false);}
  };

  const loadChannels=async()=>{
    if(!port?.readChannels){
      const next=await refresh();
      return next?.channels??null;
    }
    try{
      const channels=await port.readChannels();
      setSnapshot(current=>current?{...current,channels}:current);
      return channels;
    }catch{
      setNotice('未能確認最新渠道狀態；暫時保持未有資料。');
      return null;
    }
  };
  useEffect(()=>{if(secondary==='planning'&&ownerSession)void loadPlanning(planning?.plan.monthKey);},[secondary,ownerSession?.sessionToken]);
  useEffect(()=>{if(secondary==='channels'&&ownerSession)void loadChannels();},[secondary,ownerSession?.sessionToken]);
  useEffect(()=>{if(secondary==='sellability'&&ownerSession)void loadSellability();},[secondary,ownerSession?.sessionToken]);

  const login=async()=>{
    if(!port?.loginOwner||loginBusy)return;
    setLoginBusy(true);setLoginError(null);
    try{
      const session=await port.loginOwner(loginStaffId,loginPin);
      setOwnerSession(session);setLoginPin('');setConnection('LOADING');await refresh();
    }catch(reason){
      const code=typeof reason==='object'&&reason&&'code' in reason?String((reason as {code?:unknown}).code||''):'';
      setConnection(code==='OWNER_NETWORK_ERROR'?'OFFLINE_READONLY':'PERMISSION_DENIED');
      setLoginError(
        code==='OWNER_NETWORK_ERROR'
          ?'暫時未能連接 Owner 服務，請檢查網絡後再試。'
          :code==='OWNER_AUTH_UNAUTHORIZED'||code==='OWNER_AUTH_UNAVAILABLE'
            ?'Staff ID 或 PIN 未能通過 Owner 身份驗證。'
            :'未能完成 Owner 身份驗證，請重新嘗試。'
      );
    }finally{setLoginBusy(false);}
  };
  const logout=async()=>{
    await port?.logoutOwner?.();setOwnerSession(null);setSnapshot(null);setConnection('PERMISSION_DENIED');
  };

  const openActions=useMemo(()=>selectOpenActions(snapshot?.actions??[]),[snapshot?.actions]);

  const openOrdersScope=(scope:OwnerOrderScope)=>{
    setOrdersScope(scope);
    changeView('orders');
  };

  const requestBounded=(label:string,target:string,impact:string,actionId?:string)=>{
    if(connection==='OFFLINE_READONLY'){setNotice('離線唯讀：遠端操作已停用。');return}
    if(connection==='PERMISSION_DENIED'){setNotice('目前身份冇權執行呢個操作。');return}
    if(actionId&&isCanonicalActionUnknown(snapshot?.actions??[],actionId)){
      setNotice('處理結果仍未確認；請先重新檢查最新狀態，暫時唔好再次提交。');
      return;
    }
    if(actionId&&commandFlight?.actionId===actionId&&(commandFlight.state==='PENDING'||commandFlight.state==='UNKNOWN')){
      setNotice('呢項操作仍在確認中；暫時唔好重複提交。');
      return;
    }
    setConfirmation({label,target,impact:impact+' 完成後會再次確認最新狀態。',actionId});
  };

  const executeBounded=async(value:Confirmation)=>{
    setConfirmation(null);
    if(connection==='OFFLINE_READONLY'){setNotice('離線唯讀：遠端操作已停用。');return}
    if(value.actionId&&isCanonicalActionUnknown(snapshot?.actions??[],value.actionId)){
      setNotice('處理結果仍未確認；請先重新檢查最新狀態，暫時唔好再次提交。');
      setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'最新狀態仍未能確認；請先重新檢查，暫時唔好再次提交。'});
      return;
    }
    if(!port?.requestBoundedAction){setNotice('遠端操作暫未開放；正式狀態沒有改變。');return}

    if(value.actionId)setCommandFlight({actionId:value.actionId,state:'PENDING',message:'正在提交並確認最新狀態。'});

    try{
      const result=await port.requestBoundedAction({actionType:value.label,target:value.target,reason:value.impact,operationId:crypto.randomUUID()});
      if(result.state==='CONFIRMED'){
        setNotice('操作已提交並取得確認；正在重新讀取正式狀態。');
        const readback=await refresh();
        if(value.actionId){
          const canonicalUnknown=readback?isCanonicalActionUnknown(readback.actions,value.actionId):false;
          setCommandFlight(
            !readback
              ?{actionId:value.actionId,state:'UNKNOWN',message:'操作已送出，但最新狀態暫時未能確認。請先重新檢查，暫時唔好再提交。'}
              :canonicalUnknown
                ?{actionId:value.actionId,state:'UNKNOWN',message:'最新狀態仍未能確認；請先重新檢查，暫時唔好再提交。'}
                :null
          );
        }
        return;
      }
      if(result.state==='REJECTED'){
        setNotice('操作未獲接受；正式狀態未改變。');
        if(value.actionId)setCommandFlight({actionId:value.actionId,state:'REJECTED',message:'操作未獲接受；可檢查條件後再決定。'});
        return;
      }
      if(result.state==='FAILED'){
        setNotice('操作未完成；正式狀態未被標記為已解決。');
        if(value.actionId)setCommandFlight({actionId:value.actionId,state:'FAILED',message:'操作未完成；請檢查目前狀態。'});
        return;
      }
      setNotice('操作結果未能確認；請先重新檢查最新狀態，暫時唔好重複提交。');
      if(value.actionId)setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'結果未能確認；請先重新檢查最新狀態，暫時唔好再次提交。'});
    }catch{
      setNotice('操作結果未明；請重新確認正式狀態，唔好重複提交。');
      if(value.actionId)setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'結果未能確認；請先重新檢查最新狀態，暫時唔好再次提交。'});
    }
  };

  const recheckAction=async(actionId:string)=>{
    setCommandFlight({actionId,state:'PENDING',message:'正在重新檢查最新狀態。'});
    const readback=await refresh();
    if(!readback){
      setCommandFlight({actionId,state:'UNKNOWN',message:'仍未能確認最新狀態；暫時唔好再次提交。'});
      return;
    }
    if(isCanonicalActionUnknown(readback.actions,actionId)){
      setCommandFlight({actionId,state:'UNKNOWN',message:'最新狀態仍未能確認；暫時保持鎖定，請稍後再重新檢查。'});
      return;
    }
    setCommandFlight(null);
  };

  const recheckChannel=async(channelId:string)=>{
    const channels=await loadChannels();
    const channel=channels?.find(item=>item.channelId===channelId);
    if(!channel||channel.readback==='UNKNOWN')setNotice('渠道狀態仍未能確認；暫時只供查看。');
  };
  const savePlanning=async(input:OwnerPlanningSaveInput)=>{
    if(!port?.savePlanning){setNotice('規劃儲存功能暫未連接；資料沒有被更改。');return}
    setPlanningSaving(true);
    try{
      const result=await port.savePlanning(input);
      if(result.state==='CONFIRMED'&&result.snapshot){setPlanning(result.snapshot);setNotice('規劃已保存並完成狀態確認。');}
      else if(result.state==='REJECTED'){setNotice('規劃版本已更新；請重新讀取再修改。');await loadPlanning(input.monthKey);}
      else setNotice('保存結果未能確認；請先重新整理，暫時唔好重複提交。');
    }catch{setNotice('保存結果未能確認；請先重新整理，暫時唔好重複提交。');}
    finally{setPlanningSaving(false);}
  };

  const connectionLabel=humanConnectionLabel(connection);
  const openAdmin=async()=>{
    if(!port?.requestAdminDeepLink){setNotice('Admin 導航服務尚未連接。');return}
    try{setNotice((await port.requestAdminDeepLink()).message)}catch{setNotice('暫時未能開啟 Admin。')}
  };

  if(!authChecked){
    return <main className="app-shell owner-auth-shell"><section className="owner-auth-gate"><strong>正在驗證 Owner 工作階段</strong><p>正式資料未完成身份確認前唔會載入。</p></section></main>;
  }
  if(port?.loginOwner&&!ownerSession){
    return <main className="app-shell owner-auth-shell"><form className="owner-auth-gate" onSubmit={event=>{event.preventDefault();void login();}}>
      <span>老闆專用</span><h1>老闆登入</h1>
      <p>使用 Admin 已發布嘅 OWNER 登入編號同 PIN。身份未確認前不會讀取訂單、電話或營業資料。</p>
      <label><span>登入編號</span><input value={loginStaffId} onChange={event=>setLoginStaffId(event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64))} autoComplete="username" placeholder="例如 1111" /></label>
      <label><span>PIN</span><input value={loginPin} onChange={event=>setLoginPin(event.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" type="password" autoComplete="current-password" /></label>
      {loginError?<div className="owner-auth-error" role="alert">{loginError}</div>:null}
      <button type="submit" disabled={loginBusy||!loginStaffId.trim()||loginPin.length<4}>{loginBusy?'驗證中…':'登入'}</button>
    </form></main>;
  }

  return <main className="app-shell">
    <header className="topbar">
      <img className="brand-logo" src="/brand/morefun-logo-canonical.png" alt="磨飯 More Fun" />
      <div className="brand-copy"><strong>{snapshot?.store?.storeName??'磨飯'}</strong><span>Owner App · {snapshot?.store?.businessDate??'營業日未有資料'}</span></div>
      {ownerSession?<button className="owner-session-pill" onClick={()=>void logout()} title="登出 Owner 工作階段">{ownerSession.displayName} · 登出</button>:null}
      <button className="state-pill" onClick={()=>void refresh()} aria-label="重新同步"><i/>{connectionLabel}</button>
    </header>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    <GlobalStateBanner state={connection} onRetry={()=>void refresh()}/>

    <section className="stage">
      {secondary==='channels'?<ChannelHealthPage channels={snapshot?.channels??[]} connection={connection} onRecheck={channelId=>void recheckChannel(channelId)} onBack={()=>changeView('more')}/>:null}
      {secondary==='planning'?<PlanningPage value={planning} loading={planningLoading} saving={planningSaving} onMonthChange={monthKey=>void loadPlanning(monthKey)} onSave={input=>void savePlanning(input)} onBack={()=>changeView('more')}/>:null}
      {secondary==='sellability'?<SellabilityPage items={snapshot?.sellability??[]} connection={connection} busy={sellabilityBusy} result={sellabilityResult} onDismissResult={()=>setSellabilityResult(null)} onCommand={input=>void commandSellability(input)} onReload={()=>void loadSellability()} onBack={()=>changeView('more')}/>:null}
      {secondary==='staff'?<StaffOverviewPage staff={snapshot?.staff??[]} activity={snapshot?.activity??[]} connection={connection} observedAt={snapshot?.observedAt} onBack={()=>changeView('more')}/>:null}
      {secondary==='devices'?<DeviceHealthPage snapshot={snapshot} onBack={()=>changeView('more')}/>:null}
      {secondary==='reports'?<ReportsPage snapshot={snapshot} onBack={()=>changeView('more')}/>:null}
      {secondary==='manager-log'||secondary==='checklist'||secondary==='handoff'?<ManagerLogPage mode={secondary as ManagerMode} snapshot={snapshot} onNavigate={mode=>openSecondary(mode)} onBack={()=>changeView('more')}/>:null}
      {secondary==='activity'?<ActivityAuditPage snapshot={snapshot} onBack={()=>changeView('more')}/>:null}
      {secondary==='settings-summary'?<SettingsSummaryPage snapshot={snapshot} connection={connection} onAdmin={()=>void openAdmin()} onBack={()=>changeView('more')}/>:null}
      {!secondary&&view==='today'?<TodayPage connection={connection} snapshot={snapshot} onQueue={()=>changeView('queue')} onActiveOrders={()=>openOrdersScope('ACTIVE')} onDineInOrders={()=>openOrdersScope('DINE_IN_OPEN')} onChannels={()=>openSecondary('channels')} onStaff={()=>openSecondary('staff')} onDevices={()=>openSecondary('devices')} onTool={setTool}/>:null}
      {!secondary&&view==='queue'?<ActionQueuePage connection={connection} items={openActions} activity={snapshot?.activity??[]} commandFlight={commandFlight} onCommand={requestBounded} onRecheck={actionId=>void recheckAction(actionId)}/>:null}
      {!secondary&&view==='orders'?<OrderOversightPage connection={connection} orders={snapshot?.orders??[]} scope={ordersScope} onScopeReset={()=>setOrdersScope('DEFAULT')}/>:null}
      {!secondary&&view==='more'?<MoreHubPage snapshot={snapshot} connection={connection} onOpen={openSecondary} onTool={setTool}/>:null}
    </section>

    <nav className="bottom-nav" aria-label="主要功能">
      <Nav active={view==='today'} label="今日" onClick={()=>changeView('today')}/>
      <Nav active={view==='queue'} label="待處理" badge={openActions.length?String(openActions.length):undefined} onClick={()=>changeView('queue')}/>
      <Nav active={view==='orders'} label="訂單" onClick={()=>openOrdersScope('DEFAULT')}/>
      <Nav active={view==='more'||secondary!==null} label="更多" onClick={()=>changeView('more')}/>
    </nav>

    {tool?<ToolDrawer
      tool={tool}
      snapshot={snapshot}
      connection={connection}
      onCommand={requestBounded}
      onAdmin={()=>void openAdmin()}
      onClose={()=>setTool(null)}
    />:null}
    {confirmation?<ConfirmationSheet value={confirmation} onClose={()=>setConfirmation(null)} onConfirm={()=>void executeBounded(confirmation)}/>:null}
  </main>;
}

function TodayPage({
  connection,
  snapshot,
  onQueue,
  onActiveOrders,
  onDineInOrders,
  onChannels,
  onStaff,
  onDevices,
  onTool,
}:{
  connection:OwnerConnectionState;
  snapshot:OwnerReadModelSnapshot|null;
  onQueue:()=>void;
  onActiveOrders:()=>void;
  onDineInOrders:()=>void;
  onChannels:()=>void;
  onStaff:()=>void;
  onDevices:()=>void;
  onTool:(tool:Tool)=>void;
}){
  const vm=buildOwnerTodayViewModel(snapshot);
  const today=snapshot?.today;
  return <section className="page">
    <TodayContextHeader
      storeName={vm.storeName}
      businessDate={vm.businessDate}
      operatingStatus={vm.operatingStatus}
      freshness={vm.storeFreshness}
      observedAt={vm.observedAt}
    />
    {!today?<Empty title={connection==='OFFLINE_READONLY'?'今日數據尚未連接':'暫時未有今日數據'} detail="營業資料暫未更新完成，呢度唔會顯示推算數字。"/>:
      <section className="kpi-grid"><Kpi label="有效營業額" value={today.salesLabel} compare={today.comparisonLabel}/><Kpi label="有效訂單" value={String(today.orderCount)} compare="已完成並仍然有效"/><Kpi label="平均訂單金額" value={today.averageOrderLabel} compare="目前每張有效訂單平均"/></section>}
    <TodayLiveOrdersCard value={vm.liveOrders} onOpenActive={onActiveOrders}/>
    <DineInOpenChecksCard value={vm.dineIn} onOpenDineIn={onDineInOrders}/>
    <TodayActionSummaryCard value={vm.actionSummary} onOpen={onQueue}/>
    <TodayHealthSummaryCard value={vm.healthSummary} onChannels={onChannels} onDevices={onDevices}/>
    <TodayStaffSummaryCard value={vm.staffSummary} onOpen={onStaff}/>
    <TodayInsightCard value={vm.insight}/>
  </section>;
}

function ToolDrawer({tool,snapshot,connection,onCommand,onAdmin,onClose}:{tool:Tool;snapshot:OwnerReadModelSnapshot|null;connection:OwnerConnectionState;onCommand:(label:string,target:string,impact:string)=>void;onAdmin:()=>void;onClose:()=>void}){
  const title=tool==='customers'?'客戶':tool==='marketing'?'推廣':tool==='settlement'?'平台結算':tool==='cash'?'現金':tool==='inventory'?'庫存':tool==='notifications'?'通知':tool==='admin'?'Admin':tool==='recovery'?'資料狀態':'工具';
  return <div className="overlay"><section className="drawer" role="dialog" aria-modal="true"><DrawerHead title={title} subtitle="老闆中心" close={onClose}/>
    {tool==='customers'?snapshot?.customers?<div className="metric-grid"><Metric label="客戶" value={snapshot.customers.totalLabel}/><Metric label="新客" value={snapshot.customers.newLabel}/><Metric label="回頭客" value={snapshot.customers.returningLabel}/><Metric label="同意狀態" value={snapshot.customers.consentLabel}/></div>:<Empty title="客戶摘要尚未連接" detail="唔會用假 CRM 數字代替。"/>:null}
    {tool==='marketing'?<ListOrEmpty rows={snapshot?.campaigns??[]} render={item=><div className="list-row" key={item.campaignId}><div><strong>{item.name}</strong><small>相關訂單：{item.attributedOrdersLabel} · {item.fundingLabel??'資助資料未提供'}</small></div><b>{item.attributedSalesLabel}</b></div>} empty="推廣資料尚未連接"/>:null}
    {tool==='settlement'?<ListOrEmpty rows={snapshot?.settlements??[]} render={(item,index)=><div className="list-row" key={item.channel+'-'+index}><div><strong>{item.channel}</strong><small>銷售 {item.salesLabel} · 費用 {item.feesLabel} · {item.finality}</small></div><b>{item.payoutLabel}</b></div>} empty="結算資料尚未連接"/>:null}
    {tool==='cash'?snapshot?.cash?<div className="metric-grid"><Metric label="應有" value={snapshot.cash.expectedLabel}/><Metric label="實有" value={snapshot.cash.actualLabel}/><Metric label="差異" value={snapshot.cash.varianceLabel}/><Metric label="交更" value={snapshot.cash.closeoutState}/></div>:<Empty title="現金摘要尚未連接" detail="Owner App 唔會開錢箱或者改付款結果。"/>:null}
    {tool==='inventory'?<ListOrEmpty rows={snapshot?.inventory??[]} render={item=><div className="list-row" key={item.itemId}><div><strong>{item.name}</strong><small>{item.detail}</small></div><span>{item.state}</span></div>} empty="庫存提示尚未連接"/>:null}
    {tool==='notifications'?<ListOrEmpty rows={snapshot?.notifications??[]} render={item=><div className="list-row" key={item.notificationId}><div><strong>{item.title}</strong><small>{item.detail}</small></div><span>{item.cadence}</span></div>} empty="暫時冇通知"/>:null}
    {tool==='admin'?<><p className="callout">正式設定、權限、產品、價格、渠道同規則由 Admin 負責；Owner 只提供導航入口。</p><button className="primary wide" onClick={onAdmin}>前往 Admin</button></>:null}
    {tool==='recovery'?<><div className="diag-line"><span>連線</span><b>{humanConnectionLabel(connection)}</b><small>{snapshot?.observedAt?new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有更新時間'}</small></div><p className="callout">資料未確認完整前會保持相應提示，唔會將未明結果當成成功。</p></>:null}
  </section></div>;
}

function ConfirmationSheet({value,onClose,onConfirm}:{value:Confirmation;onClose:()=>void;onConfirm:()=>void}){
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><DrawerHead title={value.label} subtitle={value.target} close={onClose}/><p className="callout">{value.impact}</p><div className="sheet-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={onConfirm}>提交操作意圖</button></div></section></div>;
}


function humanConnectionLabel(value:OwnerConnectionState){
  if(value==='FRESH')return '資料新鮮';
  if(value==='LOADING')return '同步中';
  if(value==='EMPTY')return '暫無資料';
  if(value==='STALE')return '資料稍舊';
  if(value==='PARTIAL')return '部分資料';
  if(value==='OFFLINE_READONLY')return '離線唯讀';
  if(value==='PERMISSION_DENIED')return '權限不足';
  if(value==='UNKNOWN')return '狀態未明';
  return '同步失敗';
}

function resolveSnapshotState(snapshot:OwnerReadModelSnapshot):OwnerConnectionState{
  if(snapshot.globalState)return snapshot.globalState;
  if(!snapshot.store){
    const hasData=Boolean(snapshot.today)||snapshot.actions.length>0||snapshot.orders.length>0||snapshot.readiness.length>0;
    return hasData?'PARTIAL':'EMPTY';
  }
  if(snapshot.store.freshness==='STALE')return 'STALE';
  if(snapshot.store.freshness==='PARTIAL')return 'PARTIAL';
  if(snapshot.store.freshness==='UNKNOWN')return 'UNKNOWN';
  return 'FRESH';
}

function Empty({title,detail}:{title:string;detail:string}){return <section className="card empty-state"><h2>{title}</h2><p>{detail}</p></section>}
function Kpi({label,value,compare}:{label:string;value:string;compare:string}){return <article className="kpi"><span>{label}</span><strong>{value}</strong><small>{compare}</small></article>}
function Nav({active,label,badge,onClick}:{active:boolean;label:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick} data-icon-state="AI_ASSET_PENDING"><span>{label}</span>{badge?<em>{badge}</em>:null}</button>}
function DrawerHead({title,subtitle,close}:{title:string;subtitle:string;close:()=>void}){return <header className="drawer-head"><div><small>{subtitle}</small><h2>{title}</h2></div><button onClick={close}>✕</button></header>}
function Detail({label,value}:{label:string;value:string}){return <div><span>{label}</span><strong>{value}</strong></div>}
function DetailSection({title,children}:{title:string;children:ReactNode}){return <section className="detail-section"><h3>{title}</h3>{children}</section>}
function Metric({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
function ListOrEmpty<T>({rows,render,empty}:{rows:readonly T[];render:(item:T,index:number)=>ReactNode;empty:string}){return rows.length?<>{rows.map(render)}</>:<Empty title={empty} detail="未有正式讀回之前唔會顯示假資料。"/>}

export function OwnerBuildIdentity(){const v=mfkVersionLabel('OWNER');return <small data-mfk-build-identity="OWNER">OWNER · v{v.version} · {v.sourceSha.slice(0,12)}</small>}
