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
import {ChannelHealthPage,type OwnerChannelCommandFlight} from './channel-health';
import {MonthlyTargetSummaryCard,PlanningPage} from './planning';
import type {
  OwnerAuthSession,
  OwnerChannelCommandInput,
  OwnerConnectionState,
  OwnerPlanningSaveInput,
  OwnerPlanningSnapshot,
  OwnerReadModelSnapshot,
  OwnerRuntimePort,
} from './product-types';

type View='today'|'queue'|'orders'|'more';
type SecondaryView='channels'|'planning';
type Tool='reports'|'sellability'|'staff'|'devices'|'customers'|'marketing'|'settlement'|'cash'|'inventory'|'notifications'|'manager'|'activity'|'admin'|'recovery';
type Confirmation={label:string;target:string;impact:string;actionId?:string};

export function App(){
  const local=useMemo(()=>readOwnerLocalWorkspace(),[]);
  const [view,setView]=useState<View>(local.activeView);
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
  const [secondary,setSecondary]=useState<SecondaryView|null>(()=>typeof window!=='undefined'&&window.location.pathname==='/channels'?'channels':typeof window!=='undefined'&&window.location.pathname==='/planning'?'planning':null);
  const [channelCommandFlight,setChannelCommandFlight]=useState<OwnerChannelCommandFlight|null>(null);
  const [planning,setPlanning]=useState<OwnerPlanningSnapshot|null>(null);
  const [planningLoading,setPlanningLoading]=useState(false);
  const [planningSaving,setPlanningSaving]=useState(false);

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
    setSecondary(next);
    if(typeof window!=='undefined'){
      const path=next==='channels'?'/channels':'/planning';
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
      if(path==='/channels'){setSecondary('channels');return}
      if(path==='/planning'){setSecondary('planning');return}
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
    catch{setNotice('未能讀取 canonical planning；唔會用本機資料代替。');}
    finally{setPlanningLoading(false);}
  };
  useEffect(()=>{if(secondary==='planning'&&ownerSession)void loadPlanning(planning?.plan.monthKey);},[secondary,ownerSession?.sessionToken]);

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
      setNotice('正式狀態仍未明；只可重新確認讀回，禁止再次提交。');
      return;
    }
    if(actionId&&commandFlight?.actionId===actionId&&(commandFlight.state==='PENDING'||commandFlight.state==='UNKNOWN')){
      setNotice('呢項操作仍在等待正式讀回；禁止重複提交。');
      return;
    }
    setConfirmation({label,target,impact:impact+' 正式狀態必須等目標系統讀回。',actionId});
  };

  const executeBounded=async(value:Confirmation)=>{
    setConfirmation(null);
    if(connection==='OFFLINE_READONLY'){setNotice('離線唯讀：遠端操作已停用。');return}
    if(value.actionId&&isCanonicalActionUnknown(snapshot?.actions??[],value.actionId)){
      setNotice('正式狀態仍未明；禁止再次提交，只可重新確認讀回。');
      setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'Canonical projection 仍 UNKNOWN；只可重新確認讀回，禁止 blind resend。'});
      return;
    }
    if(!port?.requestBoundedAction){setNotice('遠端操作服務尚未連接；冇改變任何正式狀態。');return}

    if(value.actionId)setCommandFlight({actionId:value.actionId,state:'PENDING',message:'正在提交／等待 canonical readback。'});

    try{
      const result=await port.requestBoundedAction({actionType:value.label,target:value.target,reason:value.impact,operationId:crypto.randomUUID()});
      if(result.state==='CONFIRMED'){
        setNotice('操作已提交並取得確認；正在重新讀取正式狀態。');
        const readback=await refresh();
        if(value.actionId){
          const canonicalUnknown=readback?isCanonicalActionUnknown(readback.actions,value.actionId):false;
          setCommandFlight(
            !readback
              ?{actionId:value.actionId,state:'UNKNOWN',message:'操作已確認，但最新正式狀態未能讀回。只可重新確認，禁止重送。'}
              :canonicalUnknown
                ?{actionId:value.actionId,state:'UNKNOWN',message:'最新 canonical projection 仍 UNKNOWN；禁止重送，只可重新確認讀回。'}
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
      setNotice('操作結果未明；請重新確認正式狀態，唔好重複提交。');
      if(value.actionId)setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'結果未明；只可重新確認 canonical readback，禁止 blind resend。'});
    }catch{
      setNotice('操作結果未明；請重新確認正式狀態，唔好重複提交。');
      if(value.actionId)setCommandFlight({actionId:value.actionId,state:'UNKNOWN',message:'結果未明；只可重新確認 canonical readback，禁止 blind resend。'});
    }
  };

  const recheckAction=async(actionId:string)=>{
    setCommandFlight({actionId,state:'PENDING',message:'正在重新確認正式狀態。'});
    const readback=await refresh();
    if(!readback){
      setCommandFlight({actionId,state:'UNKNOWN',message:'仍未能取得正式讀回；禁止 blind resend。'});
      return;
    }
    if(isCanonicalActionUnknown(readback.actions,actionId)){
      setCommandFlight({actionId,state:'UNKNOWN',message:'Canonical projection 仍 UNKNOWN；保持鎖定，只可再次重新確認讀回。'});
      return;
    }
    setCommandFlight(null);
  };

  const executeChannelCommand=async(input:OwnerChannelCommandInput)=>{
    if(connection==='OFFLINE_READONLY'||connection==='PERMISSION_DENIED'){setNotice('目前只可讀取，渠道操作已停用。');return}
    if(!port?.commandChannel){setNotice('呢個渠道未有 canonical command seam；冇改變任何正式狀態。');return}
    setChannelCommandFlight({channelId:input.channelId,state:'PENDING',message:'Read current → command → canonical readback。'});
    try{
      const result=await port.commandChannel(input);
      setChannelCommandFlight({channelId:input.channelId,state:result.state==='CONFIRMED'?'CONFIRMED':result.state,message:result.message});
      await refresh();
    }catch{
      setChannelCommandFlight({channelId:input.channelId,state:'UNKNOWN',message:'結果未明；只可重新讀回，禁止 blind retry。'});
    }
  };
  const recheckChannel=async(channelId:string)=>{
    setChannelCommandFlight({channelId,state:'PENDING',message:'正在重新讀取 canonical channel state。'});
    const next=await refresh();
    const channel=next?.channels.find(item=>item.channelId===channelId);
    if(!channel||channel.readback==='UNKNOWN')setChannelCommandFlight({channelId,state:'UNKNOWN',message:'正式狀態仍未明；保持鎖定。'});
    else setChannelCommandFlight(null);
  };
  const savePlanning=async(input:OwnerPlanningSaveInput)=>{
    if(!port?.savePlanning){setNotice('Planning writer 尚未連接；冇寫入本機假資料。');return}
    setPlanningSaving(true);
    try{
      const result=await port.savePlanning(input);
      if(result.state==='CONFIRMED'&&result.snapshot){setPlanning(result.snapshot);setNotice('規劃已保存並完成 canonical readback。');}
      else if(result.state==='REJECTED'){setNotice('規劃版本已更新；請重新讀取再修改。');await loadPlanning(input.monthKey);}
      else setNotice('保存結果未明；請重新讀取，唔好重複提交。');
    }catch{setNotice('保存結果未明；請重新讀取，唔好重複提交。');}
    finally{setPlanningSaving(false);}
  };

  const connectionLabel=connection==='FRESH'?'資料新鮮':connection==='LOADING'?'同步中':connection==='EMPTY'?'暫無資料':connection==='STALE'?'資料稍舊':connection==='PARTIAL'?'部分資料':connection==='OFFLINE_READONLY'?'離線唯讀':connection==='PERMISSION_DENIED'?'權限不足':connection==='UNKNOWN'?'狀態未明':'同步失敗';

  if(!authChecked){
    return <main className="app-shell owner-auth-shell"><section className="owner-auth-gate"><strong>正在驗證 Owner 工作階段</strong><p>正式資料未完成身份確認前唔會載入。</p></section></main>;
  }
  if(port?.loginOwner&&!ownerSession){
    return <main className="app-shell owner-auth-shell"><form className="owner-auth-gate" onSubmit={event=>{event.preventDefault();void login();}}>
      <span>OWNER ACCESS</span><h1>老闆登入</h1>
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
      <div className="brand-copy"><strong>老闆中心</strong><span>{snapshot?.store?.storeName??'未連接門店'} · {snapshot?.store?.businessDate??'營業日未有資料'}</span></div>
      {ownerSession?<button className="owner-session-pill" onClick={()=>void logout()} title="登出 Owner 工作階段">{ownerSession.displayName} · 登出</button>:null}
      <button className="state-pill" onClick={()=>void refresh()} aria-label="重新同步"><i/>{connectionLabel}</button>
    </header>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    <GlobalStateBanner state={connection} onRetry={()=>void refresh()}/>

    <section className="stage">
      {secondary==='channels'?<ChannelHealthPage channels={snapshot?.channels??[]} connection={connection} commandFlight={channelCommandFlight} onCommand={input=>void executeChannelCommand(input)} onRecheck={channelId=>void recheckChannel(channelId)} onBack={()=>changeView('more')}/>:null}
      {secondary==='planning'?<PlanningPage value={planning} loading={planningLoading} saving={planningSaving} onMonthChange={monthKey=>void loadPlanning(monthKey)} onSave={input=>void savePlanning(input)} onBack={()=>changeView('more')}/>:null}
      {!secondary&&view==='today'?<TodayPage connection={connection} snapshot={snapshot} onQueue={()=>changeView('queue')} onActiveOrders={()=>openOrdersScope('ACTIVE')} onDineInOrders={()=>openOrdersScope('DINE_IN_OPEN')} onChannels={()=>openSecondary('channels')} onPlanning={()=>openSecondary('planning')} onTool={setTool}/>:null}
      {!secondary&&view==='queue'?<ActionQueuePage connection={connection} items={openActions} activity={snapshot?.activity??[]} commandFlight={commandFlight} onCommand={requestBounded} onRecheck={actionId=>void recheckAction(actionId)}/>:null}
      {!secondary&&view==='orders'?<OrderOversightPage connection={connection} orders={snapshot?.orders??[]} scope={ordersScope} onScopeReset={()=>setOrdersScope('DEFAULT')}/>:null}
      {!secondary&&view==='more'?<MorePage snapshot={snapshot} connection={connection} onTool={setTool} onChannels={()=>openSecondary('channels')} onPlanning={()=>openSecondary('planning')}/>:null}
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
      managerNote={managerNote}
      handoffNote={handoffNote}
      checklist={checklist}
      setManagerNote={value=>{setManagerNote(value);persistLocal({managerNote:value})}}
      setHandoffNote={value=>{setHandoffNote(value);persistLocal({handoffNote:value})}}
      setChecklist={value=>{setChecklist(value);persistLocal({checklist:value})}}
      onCommand={requestBounded}
      onAdmin={async()=>{
        if(!port?.requestAdminDeepLink){setNotice('Admin 導航服務尚未連接。');return}
        try{setNotice((await port.requestAdminDeepLink()).message)}catch{setNotice('暫時未能開啟 Admin。')}
      }}
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
  onPlanning,
  onTool,
}:{
  connection:OwnerConnectionState;
  snapshot:OwnerReadModelSnapshot|null;
  onQueue:()=>void;
  onActiveOrders:()=>void;
  onDineInOrders:()=>void;
  onChannels:()=>void;
  onPlanning:()=>void;
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
    {!today?<Empty title={connection==='OFFLINE_READONLY'?'今日數據尚未連接':'暫時未有今日數據'} detail="正式營業額、訂單同平均單未有讀回之前唔會顯示假 KPI。"/>:
      <section className="kpi-grid"><Kpi label="有效營業額" value={today.salesLabel} compare={today.comparisonLabel}/><Kpi label="訂單" value={String(today.orderCount)} compare="正式有效單摘要"/><Kpi label="平均訂單" value={today.averageOrderLabel} compare="有效營業額 / 有效單量"/></section>}
    <TodayLiveOrdersCard value={vm.liveOrders} onOpenActive={onActiveOrders}/>
    <DineInOpenChecksCard value={vm.dineIn} onOpenDineIn={onDineInOrders}/>
    <TodayActionSummaryCard value={vm.actionSummary} onOpen={onQueue}/>
    <TodayHealthSummaryCard value={vm.healthSummary} onChannels={onChannels} onDevices={()=>onTool('devices')}/>
    <TodayStaffSummaryCard value={vm.staffSummary} onOpen={()=>onTool('staff')}/>
    <MonthlyTargetSummaryCard value={snapshot?.planning} onOpen={onPlanning}/>
    <TodayInsightCard value={vm.insight}/>
  </section>;
}

function MorePage({snapshot,connection,onTool,onChannels,onPlanning}:{snapshot:OwnerReadModelSnapshot|null;connection:OwnerConnectionState;onTool:(tool:Tool)=>void;onChannels:()=>void;onPlanning:()=>void}){
  const tools:{id:Tool;title:string;detail:string;state:string}[]=[
    {id:'reports',title:'報表',detail:'固定可信摘要',state:String(snapshot?.reports.length??0)},
    {id:'sellability',title:'商品供應',detail:'售罄／恢復有限操作',state:connection==='FRESH'?'可查詢':'未連接'},
    {id:'staff',title:'員工',detail:'在場／角色／權限摘要',state:String(snapshot?.staff.length??0)},
    {id:'devices',title:'設備／打印',detail:'健康／影響範圍／Job certainty',state:String(snapshot?.devices.length??0)},
    {id:'customers',title:'客戶',detail:'CRM Lite／新客／回頭客／同意',state:snapshot?.customers?'已讀取':'未連接'},
    {id:'marketing',title:'推廣',detail:'Campaign／Attribution／Funding',state:String(snapshot?.campaigns.length??0)},
    {id:'settlement',title:'平台結算',detail:'銷售／費用／撥款／差異',state:String(snapshot?.settlements.length??0)},
    {id:'cash',title:'現金',detail:'Expected / Actual / Over-short',state:snapshot?.cash?'已讀取':'未連接'},
    {id:'inventory',title:'庫存',detail:'低庫存／盤點／耗損提示',state:String(snapshot?.inventory.length??0)},
    {id:'notifications',title:'通知',detail:'即時／摘要／收件箱',state:String(snapshot?.notifications.length??0)},
    {id:'manager',title:'經理日誌',detail:'本機筆記／Checklist／交接草稿',state:'本機'},
    {id:'activity',title:'活動紀錄',detail:'Requester / Approver / Result / Readback',state:String(snapshot?.activity.length??0)},
    {id:'admin',title:'前往 Admin',detail:'設定留喺 Admin',state:'導航'},
    {id:'recovery',title:'資料狀態',detail:'Offline / Stale / Unknown / Partial',state:connection},
  ];
  return <section className="page"><header className="page-head"><div><span>更多</span><h1>營運工具</h1><small>設定留 Admin；交易、付款、打印同實體設備執行留喺責任端。</small></div></header><div className="tool-grid"><button className="tool-card" onClick={onChannels}><strong>渠道</strong><small>健康／接單／有限控制</small><em>{String(snapshot?.channels.length??0)}</em></button><button className="tool-card" onClick={onPlanning}><strong>營業目標與成本</strong><small>Monthly Target / Cost Planning</small><em>{snapshot?.planning?.plan.revision?'已設定':'未設定'}</em></button>{tools.map(item=><button key={item.id} className="tool-card" onClick={()=>onTool(item.id)} data-icon-state="AI_ASSET_PENDING"><strong>{item.title}</strong><small>{item.detail}</small><em>{item.state}</em></button>)}</div></section>;
}

function ToolDrawer({tool,snapshot,connection,managerNote,handoffNote,checklist,setManagerNote,setHandoffNote,setChecklist,onCommand,onAdmin,onClose}:{tool:Tool;snapshot:OwnerReadModelSnapshot|null;connection:OwnerConnectionState;managerNote:string;handoffNote:string;checklist:readonly OwnerChecklistItem[];setManagerNote:(v:string)=>void;setHandoffNote:(v:string)=>void;setChecklist:(v:readonly OwnerChecklistItem[])=>void;onCommand:(label:string,target:string,impact:string)=>void;onAdmin:()=>void;onClose:()=>void}){
  const title=tool==='reports'?'報表':tool==='sellability'?'商品供應':tool==='staff'?'員工':tool==='devices'?'設備／打印':tool==='customers'?'客戶':tool==='marketing'?'推廣':tool==='settlement'?'平台結算':tool==='cash'?'現金':tool==='inventory'?'庫存':tool==='notifications'?'通知':tool==='manager'?'經理日誌':tool==='activity'?'活動紀錄':tool==='admin'?'Admin':tool==='recovery'?'資料狀態':'工具';
  return <div className="overlay"><section className="drawer" role="dialog" aria-modal="true"><DrawerHead title={title} subtitle="老闆中心" close={onClose}/>
    {tool==='reports'?<ListOrEmpty rows={snapshot?.reports??[]} render={item=><div className="list-row" key={item.reportId}><div><strong>{item.name}</strong><small>{item.compare??item.freshness}</small></div><b>{item.value}</b></div>} empty="報表尚未連接"/>:null}
    {tool==='sellability'?<ListOrEmpty rows={snapshot?.sellability??[]} render={item=><div className="list-row" key={item.targetId}><div><strong>{item.name}</strong><small>{item.grain} · {item.scope} · {item.state}</small></div><button onClick={()=>onCommand(item.state==='AVAILABLE'?'標記售罄':'恢復供應',item.targetId,'有限度供應狀態操作；必須等正式讀回。')}>{item.state==='AVAILABLE'?'售罄':'恢復'}</button></div>} empty="商品供應資料尚未連接"/>:null}
    {tool==='staff'?<ListOrEmpty rows={snapshot?.staff??[]} render={item=><div className="list-row" key={item.staffId}><div><strong>{item.name}</strong><small>{item.role} · {item.permissions}</small></div><span>{item.presence}</span></div>} empty="員工資料尚未連接"/>:null}
    {tool==='devices'?<ListOrEmpty rows={snapshot?.devices??[]} render={item=><div className="list-row" key={item.deviceId}><div><strong>{item.name}</strong><small>{item.kind} · {item.affected??'未有影響摘要'} · {item.jobs??'未有 Job 摘要'}</small></div><span>{item.health}</span></div>} empty="設備資料尚未連接"/>:null}
    {tool==='customers'?snapshot?.customers?<div className="metric-grid"><Metric label="客戶" value={snapshot.customers.totalLabel}/><Metric label="新客" value={snapshot.customers.newLabel}/><Metric label="回頭客" value={snapshot.customers.returningLabel}/><Metric label="同意狀態" value={snapshot.customers.consentLabel}/></div>:<Empty title="客戶摘要尚未連接" detail="唔會用假 CRM 數字代替。"/>:null}
    {tool==='marketing'?<ListOrEmpty rows={snapshot?.campaigns??[]} render={item=><div className="list-row" key={item.campaignId}><div><strong>{item.name}</strong><small>Attributed Orders：{item.attributedOrdersLabel} · {item.fundingLabel??'Funding 未提供'}</small></div><b>{item.attributedSalesLabel}</b></div>} empty="推廣資料尚未連接"/>:null}
    {tool==='settlement'?<ListOrEmpty rows={snapshot?.settlements??[]} render={(item,index)=><div className="list-row" key={item.channel+'-'+index}><div><strong>{item.channel}</strong><small>銷售 {item.salesLabel} · 費用 {item.feesLabel} · {item.finality}</small></div><b>{item.payoutLabel}</b></div>} empty="結算資料尚未連接"/>:null}
    {tool==='cash'?snapshot?.cash?<div className="metric-grid"><Metric label="應有" value={snapshot.cash.expectedLabel}/><Metric label="實有" value={snapshot.cash.actualLabel}/><Metric label="差異" value={snapshot.cash.varianceLabel}/><Metric label="交更" value={snapshot.cash.closeoutState}/></div>:<Empty title="現金摘要尚未連接" detail="Owner App 唔會開錢箱或者改付款結果。"/>:null}
    {tool==='inventory'?<ListOrEmpty rows={snapshot?.inventory??[]} render={item=><div className="list-row" key={item.itemId}><div><strong>{item.name}</strong><small>{item.detail}</small></div><span>{item.state}</span></div>} empty="庫存提示尚未連接"/>:null}
    {tool==='notifications'?<ListOrEmpty rows={snapshot?.notifications??[]} render={item=><div className="list-row" key={item.notificationId}><div><strong>{item.title}</strong><small>{item.detail}</small></div><span>{item.cadence}</span></div>} empty="暫時冇通知"/>:null}
    {tool==='activity'?<ListOrEmpty rows={snapshot?.activity??[]} render={item=><div className="activity-card" key={item.activityId}><strong>{item.title}</strong><p>{item.actor} · {new Date(item.observedAt).toLocaleString('zh-HK')}</p><small>Requester：{item.requester??'—'} · Approver：{item.approver??'—'} · Result：{item.result} · Readback：{item.readback??'—'}</small></div>} empty="活動紀錄尚未連接"/>:null}
    {tool==='manager'?<ManagerWorkspace managerNote={managerNote} handoffNote={handoffNote} checklist={checklist} setManagerNote={setManagerNote} setHandoffNote={setHandoffNote} setChecklist={setChecklist}/>:null}
    {tool==='admin'?<><p className="callout">正式設定、權限、產品、價格、渠道同規則由 Admin 負責；Owner 只提供導航入口。</p><button className="primary wide" onClick={onAdmin}>前往 Admin</button></>:null}
    {tool==='recovery'?<><div className="diag-line"><span>連線</span><b>{connection}</b><small>{snapshot?.observedAt?new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有讀回'}</small></div><p className="callout">OFFLINE / STALE / UNKNOWN / PARTIAL 都係資料狀態；未知唔等於失敗，冇目標讀回唔算成功。</p></>:null}
  </section></div>;
}

function ManagerWorkspace({managerNote,handoffNote,checklist,setManagerNote,setHandoffNote,setChecklist}:{managerNote:string;handoffNote:string;checklist:readonly OwnerChecklistItem[];setManagerNote:(v:string)=>void;setHandoffNote:(v:string)=>void;setChecklist:(v:readonly OwnerChecklistItem[])=>void}){
  return <section className="manager-workspace"><p className="callout">以下只係本機私人草稿，唔係共享營運真相、唔會改 Admin/SMT 狀態。</p><label>經理筆記<textarea value={managerNote} onChange={e=>setManagerNote(e.target.value)} placeholder="記低要跟進嘅事項"/></label><div>{checklist.map(item=><label className="check-row" key={item.id}><input type="checkbox" checked={item.done} onChange={e=>setChecklist(checklist.map(row=>row.id===item.id?{...row,done:e.target.checked}:row))}/><span>{item.label}</span></label>)}</div><label>交接草稿<textarea value={handoffNote} onChange={e=>setHandoffNote(e.target.value)} placeholder="交畀下一更嘅本機備忘"/></label></section>;
}

function ConfirmationSheet({value,onClose,onConfirm}:{value:Confirmation;onClose:()=>void;onConfirm:()=>void}){
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><DrawerHead title={value.label} subtitle={value.target} close={onClose}/><p className="callout">{value.impact}</p><div className="sheet-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={onConfirm}>提交操作意圖</button></div></section></div>;
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
