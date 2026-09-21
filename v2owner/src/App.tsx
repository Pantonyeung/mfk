import {useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import capabilitiesJson from './capabilities.json';
import {
  actionItems,activity,adminLinks,channels,devices,notifications,orders,readiness,recoveryStates,reports,sellability,staff,today,
  type ActionItem,type ChannelRow,type OwnerOrder,type SellabilityRow
} from './fixtures';

type View='today'|'queue'|'orders'|'more';
type ReadState='FRESH'|'STALE'|'OFFLINE'|'UNKNOWN'|'PARTIAL'|'FAILURE';
type Tool='reports'|'sellability'|'channels'|'staff'|'devices'|'notifications'|'manager'|'activity'|'admin'|'capabilities'|'recovery';
type Capability={CAP_ID:string;GROUP:string;LABEL:string;SURFACE:string;KIND:'READ_SHAPE'|'COMMAND_SHAPE';STATUS:'MIGRATED_SHAPE'|'NOT_WIRED';OWNER:string};
type Confirmation={label:string;target:string;impact:string;approval:string};

const capabilities=capabilitiesJson as Capability[];
const commandCount=capabilities.filter(item=>item.KIND==='COMMAND_SHAPE').length;
const stateOrder:ReadState[]=['FRESH','STALE','OFFLINE','UNKNOWN','PARTIAL','FAILURE'];

export function App(){
  const [view,setView]=useState<View>('today');
  const [readState,setReadState]=useState<ReadState>('FRESH');
  const [notice,setNotice]=useState<string|null>(null);
  const [tool,setTool]=useState<Tool|null>(null);
  const [selectedOrder,setSelectedOrder]=useState<OwnerOrder|null>(null);
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);
  const [query,setQuery]=useState('');
  const [source,setSource]=useState('全部');
  const [segment,setSegment]=useState<'current'|'completed'>('current');

  const visibleOrders=useMemo(()=>orders.filter(order=>{
    const segmentOk=segment==='current'?order.status!=='已取餐':order.status==='已取餐';
    const sourceOk=source==='全部'||order.source===source;
    const queryOk=!query||[order.code,order.source,order.status,order.externalRef].join(' ').toLowerCase().includes(query.toLowerCase());
    return segmentOk&&sourceOk&&queryOk;
  }),[segment,source,query]);

  const showNotWired=(label:string)=>{
    setNotice(label+'：NOT_WIRED｜今輪只保留 Command UX，未送出任何 live command。');
  };
  const requestCommand=(label:string,target:string,impact:string,approval='Owner / Manager approval presentation')=>{
    setConfirmation({label,target,impact,approval});
  };
  const cycleReadState=()=>{
    const index=stateOrder.indexOf(readState);
    setReadState(stateOrder[(index+1)%stateOrder.length]);
  };

  return <main className={'app-shell state-'+readState.toLowerCase()}>
    <header className="topbar">
      <div className="brand-mark">磨</div>
      <div className="brand-copy"><strong>MFK Owner</strong><span>{today.store} · Mobile Command Surface</span></div>
      <button className="state-pill" onClick={cycleReadState} aria-label="切換 migration 展示狀態"><i/>{readState}</button>
    </header>

    <section className="authority-strip" role="status">
      <b>PORT_MIGRATION_ONLY</b><span>Observation · Alerting · Review · Bounded Decision</span><em>Command = NOT_WIRED</em>
    </section>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    {readState!=='FRESH'?<RecoveryBanner state={readState} onAction={()=>showNotWired('重新確認')}/>:null}

    <section className="stage">
      {view==='today'?<TodayPage state={readState} onOpenQueue={()=>setView('queue')} onOpenTool={setTool}/>:null}
      {view==='queue'?<QueuePage onCommand={requestCommand}/>:null}
      {view==='orders'?<OrdersPage rows={visibleOrders} segment={segment} setSegment={setSegment} query={query} setQuery={setQuery} source={source} setSource={setSource} onOpen={setSelectedOrder}/>:null}
      {view==='more'?<MorePage onOpenTool={setTool}/>:null}
    </section>

    <nav className="bottom-nav" aria-label="Owner 主要功能">
      <NavButton active={view==='today'} label="今日" glyph="◆" onClick={()=>setView('today')}/>
      <NavButton active={view==='queue'} label="待處理" glyph="!" badge={String(actionItems.length)} onClick={()=>setView('queue')}/>
      <NavButton active={view==='orders'} label="訂單" glyph="▤" onClick={()=>setView('orders')}/>
      <NavButton active={view==='more'} label="更多" glyph="•••" onClick={()=>setView('more')}/>
    </nav>

    {tool?<ToolDrawer tool={tool} close={()=>setTool(null)} onCommand={requestCommand} onNotWired={showNotWired}/>:null}
    {selectedOrder?<OrderDrawer order={selectedOrder} close={()=>setSelectedOrder(null)}/>:null}
    {confirmation?<ConfirmationSheet value={confirmation} close={()=>setConfirmation(null)} onConfirm={()=>{showNotWired(confirmation.label);setConfirmation(null)}}/>:null}
  </main>;
}

function RecoveryBanner({state,onAction}:{state:ReadState;onAction:()=>void}){
  const copy:Record<ReadState,string>={
    FRESH:'資料展示正常',
    STALE:'資料可能延遲；所有 Card 必須以「截至」理解。',
    OFFLINE:'Owner App 離線只顯示 last-known / fixture shape；不可假裝遠端操作成功。',
    UNKNOWN:'未能確認結果；禁止 blind retry。',
    PARTIAL:'部分 domain 有結果，部分仍未證明。',
    FAILURE:'已知失敗只可進安全 recovery presentation。',
  };
  return <section className="recovery-banner"><div><strong>{state}</strong><span>{copy[state]}</span></div><button onClick={onAction}>重新確認</button></section>;
}

function TodayPage({state,onOpenQueue,onOpenTool}:{state:ReadState;onOpenQueue:()=>void;onOpenTool:(tool:Tool)=>void}){
  return <section className="page">
    <header className="page-head">
      <div><span>今日 · Business Day {today.businessDay}</span><h1>而家間舖點？</h1><small>資料狀態：{state} · fixture 截至 {today.observedAt}</small></div>
      <b className="mode-tag">READ SHAPE</b>
    </header>

    <section className="kpi-grid" aria-label="今日核心 KPI">
      <Kpi label="有效營業額" value={today.sales} compare={today.compare+' '+today.compareLabel}/>
      <Kpi label="訂單" value={today.orders} compare="正式單摘要 shape"/>
      <Kpi label="平均訂單" value={today.aov} compare="有效營業額 / 有效單量 shape"/>
    </section>

    <section className="card attention-card">
      <div className="section-head"><div><span className="eyebrow danger">優先 0</span><h2>需要你處理</h2></div><b className="count-badge">{today.attention}</b></div>
      <p>只放真正需要人介入的 Action Item；正常單唔搶 Owner attention。</p>
      <button className="primary wide" onClick={onOpenQueue}>查看待處理</button>
    </section>

    <section className="card">
      <div className="section-head"><div><span className="eyebrow">Readiness</span><h2>營運健康</h2></div><button className="link-btn" onClick={()=>onOpenTool('recovery')}>Recovery</button></div>
      <div className="readiness-grid">{readiness.map(item=><article key={item.label}><span>{item.label}</span><strong className={'tone-'+item.tone}>{item.value}</strong></article>)}</div>
      <div className="fresh-row"><span>Store：{today.store}</span><span>資料截至 {today.observedAt}</span></div>
    </section>

    <section className="card compact-card">
      <div className="section-head"><div><span className="eyebrow orange">現場</span><h2>Staff Now</h2></div><button className="link-btn" onClick={()=>onOpenTool('staff')}>查看</button></div>
      <div className="split-summary"><div><strong>{today.staffNow}</strong><span>目前在場</span></div><div><strong>1</strong><span>休息中</span></div><div><strong>0</strong><span>打卡異常</span></div></div>
    </section>

    <section className="card insight-card">
      <div className="section-head"><div><span className="eyebrow purple">解釋層</span><h2>今日趨勢</h2></div><button className="link-btn" onClick={()=>onOpenTool('reports')}>報表</button></div>
      <div className="bar-chart">{[28,35,44,52,71,64,82,76,66,58].map((height,index)=><i key={index} style={{height:height+'%'}}/>)}</div>
      <div className="fresh-row"><span>19:00–20:00 較高</span><span>商品 #1：紫米飯餐</span></div>
    </section>
  </section>;
}

function QueuePage({onCommand}:{onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <section className="page">
    <header className="page-head"><div><span>Exception / Action Queue</span><h1>待處理</h1><small>Projection / orchestration only · 不擁有 mutation</small></div><b className="hero-number">{actionItems.length}</b></header>
    <div className="cards">{actionItems.map(item=><ActionCard key={item.id} item={item} onCommand={onCommand}/>)}</div>
    <section className="card rule-card"><strong>Resolved ≠ Dismissed</strong><p>今輪只展示 dedupe、severity、owner domain、certainty、confirmation shape。無 live resolution。</p></section>
  </section>;
}

function ActionCard({item,onCommand}:{item:ActionItem;onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <article className={'action-card severity-'+(item.severity==='緊急'?'urgent':item.severity==='注意'?'attention':'info')}>
    <div className="action-top"><span>{item.domain} · {item.elapsed}</span><b>{item.severity}</b></div>
    <h2>{item.title}</h2><p>{item.detail}</p>
    <div className="fact-row"><span>Target：{item.target}</span><em className={'certainty '+item.certainty.toLowerCase()}>{item.certainty}</em></div>
    <div className="action-buttons">
      <button onClick={()=>onCommand('Acknowledge Alert',item.target,'只係處理確認 shape，不代表 underlying problem resolved。')}>確認已閱</button>
      <button className="primary" onClick={()=>onCommand(item.action,item.target,'Bounded decision presentation only；唔會改 Order / Payment / Print / Provider truth。')}>{item.action}</button>
    </div>
  </article>;
}

function OrdersPage({rows,segment,setSegment,query,setQuery,source,setSource,onOpen}:{rows:OwnerOrder[];segment:'current'|'completed';setSegment:(v:'current'|'completed')=>void;query:string;setQuery:(v:string)=>void;source:string;setSource:(v:string)=>void;onOpen:(order:OwnerOrder)=>void}){
  return <section className="page">
    <header className="page-head"><div><span>Order Oversight</span><h1>訂單</h1><small>Read-only projection · 一張 Card 唔代表一個 global status</small></div><b className="hero-number">{rows.length}</b></header>
    <div className="segmented"><button className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button><button className={segment==='completed'?'active':''} onClick={()=>setSegment('completed')}>已完成</button></div>
    <label className="search"><span>搜尋</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="單號／來源／狀態／外部編號"/></label>
    <div className="chip-row">{['全部','Keeta','現場','自家客戶端','電話'].map(item=><button key={item} className={source===item?'active':''} onClick={()=>setSource(item)}>{item}</button>)}</div>
    <div className="cards">{rows.map(order=><button className="order-card" key={order.code} onClick={()=>onOpen(order)}>
      <div className="order-card-top"><div><small>{order.time} · {order.source}</small><h2>#{order.code}</h2></div><span className={'certainty '+order.readback.toLowerCase()}>{order.readback}</span></div>
      <div className="order-card-main"><strong>{order.status}</strong><b>{order.amount}</b></div>
      <div className="order-card-meta"><span>{order.fulfillment}</span><span>{order.tender}</span><span>{order.externalRef!=='—'?'外部 '+order.externalRef:'門店單'}</span></div>
      <em>查看 Drill-down →</em>
    </button>)}</div>
  </section>;
}

function OrderDrawer({order,close}:{order:OwnerOrder;close:()=>void}){
  return <div className="overlay"><section className="drawer order-drawer" role="dialog" aria-modal="true">
    <DrawerHead title={'Order #'+order.code} subtitle={order.source+' · '+order.time} close={close}/>
    <div className="detail-grid"><Detail label="狀態" value={order.status}/><Detail label="Readback" value={order.readback}/><Detail label="有效金額" value={order.amount}/><Detail label="Tender" value={order.tender}/></div>
    <DetailSection title="Order Identity"><p>Display #{order.code} · External {order.externalRef}</p></DetailSection>
    <DetailSection title="Items">{order.items.map(item=><p key={item}>{item}</p>)}</DetailSection>
    <DetailSection title="Fulfillment"><p>{order.fulfillment}</p></DetailSection>
    <DetailSection title="Side-effects">{order.prints.map(item=><p key={item}>{item}</p>)}</DetailSection>
    <DetailSection title="Linked Exceptions">{order.exceptions.length?order.exceptions.map(item=><p key={item}>{item}</p>):<p>無已知 exception</p>}</DetailSection>
    <DetailSection title="Timeline">{order.timeline.map(item=><p key={item}>{item}</p>)}</DetailSection>
    <div className="boundary-box">READ_SHAPE ONLY｜本頁冇 Checkout、Payment、Formal Order、Print、Drawer 或 Store Kernel command。</div>
  </section></div>;
}

function MorePage({onOpenTool}:{onOpenTool:(tool:Tool)=>void}){
  const tools:{id:Tool;title:string;detail:string;state:string}[]=[
    {id:'reports',title:'報表',detail:'固定 8 張可信報表 shape',state:'READ'},
    {id:'sellability',title:'商品／售罄',detail:'Sold-out / Restore UX',state:'NOT_WIRED'},
    {id:'channels',title:'渠道',detail:'Health / Pause / Snooze',state:'NOT_WIRED'},
    {id:'staff',title:'員工',detail:'Who’s working / role summary',state:'READ'},
    {id:'devices',title:'設備／Printer',detail:'Health / job certainty',state:'READ'},
    {id:'notifications',title:'Alerts / Notifications',detail:'Immediate / Digest / Inbox',state:'READ'},
    {id:'manager',title:'Manager Log / Checklist',detail:'營運交接 shape',state:'LOCAL'},
    {id:'activity',title:'Activity',detail:'Human-readable audit projection',state:'READ'},
    {id:'admin',title:'前往 Admin',detail:'正式設定只 deep-link UX',state:'NOT_WIRED'},
    {id:'recovery',title:'Recovery States',detail:'Offline / Stale / Unknown / Partial',state:'READ'},
    {id:'capabilities',title:'Capability Registry',detail:capabilities.length+' 項 · '+commandCount+' commands',state:String(capabilities.length)},
  ];
  return <section className="page">
    <header className="page-head"><div><span>更多</span><h1>營運工具</h1><small>Structural config 留 Admin；physical / transaction execution 留 SMT。</small></div><b className="mode-tag">MIGRATED</b></header>
    <div className="tool-grid">{tools.map(item=><button key={item.id} className="tool-card" onClick={()=>onOpenTool(item.id)}>
      <span>◆</span><strong>{item.title}</strong><small>{item.detail}</small><em>{item.state}</em>
    </button>)}</div>
  </section>;
}

function ToolDrawer({tool,close,onCommand,onNotWired}:{tool:Tool;close:()=>void;onCommand:(label:string,target:string,impact:string,approval?:string)=>void;onNotWired:(label:string)=>void}){
  const titles:Record<Tool,string>={
    reports:'固定報表',sellability:'商品／售罄',channels:'渠道健康',staff:'Staff Presence',devices:'Device / Printer Health',
    notifications:'Alerts / Notifications',manager:'Manager Log / Checklist',activity:'Activity Feed',admin:'Admin Deep-link',
    capabilities:'Owner Capability Registry',recovery:'Recovery States'
  };
  return <div className="overlay"><section className="drawer" role="dialog" aria-modal="true">
    <DrawerHead title={titles[tool]} subtitle="MFK Owner migration surface" close={close}/>
    {tool==='reports'?<ReportsTool/>:null}
    {tool==='sellability'?<SellabilityTool onCommand={onCommand}/>:null}
    {tool==='channels'?<ChannelsTool onCommand={onCommand}/>:null}
    {tool==='staff'?<StaffTool/>:null}
    {tool==='devices'?<DevicesTool/>:null}
    {tool==='notifications'?<NotificationsTool/>:null}
    {tool==='manager'?<ManagerTool onNotWired={onNotWired}/>:null}
    {tool==='activity'?<ActivityTool/>:null}
    {tool==='admin'?<AdminTool onNotWired={onNotWired}/>:null}
    {tool==='capabilities'?<CapabilityTool/>:null}
    {tool==='recovery'?<RecoveryTool onNotWired={onNotWired}/>:null}
  </section></div>;
}

function ReportsTool(){
  const [selected,setSelected]=useState(reports[0]);
  return <><div className="report-picker">{reports.map(report=><button key={report.id} className={selected.id===report.id?'active':''} onClick={()=>setSelected(report)}>{report.name}</button>)}</div>
    <section className="report-hero"><span>{selected.name}</span><strong>{selected.value}</strong><em>{selected.compare}</em><small>{selected.freshness}</small></section>
    <div className="large-bars">{selected.bars.map((value,index)=><i key={index} style={{height:Math.max(8,value)+'%'}}/>)}</div>
    <div className="boundary-box">Fixed report / trend / drill-down presentation only。Report 唔會直接修改 business state。</div>
  </>;
}

function SellabilityTool({onCommand}:{onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <><p className="callout">Product / Option / Modifier / Combo Child quick-control presentation。Inventory 唔會喺呢度變 transaction authority。</p>
    <div className="list-stack">{sellability.map(row=><SellabilityRowView key={row.id} row={row} onCommand={onCommand}/>)}</div>
  </>;
}
function SellabilityRowView({row,onCommand}:{row:SellabilityRow;onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <article className="list-row"><div><strong>{row.name}</strong><small>{row.grain} · {row.scope}</small></div><div className="row-actions"><span>{row.state}</span><button onClick={()=>onCommand(row.action,row.name,'只會展示 Sellability bounded command flow；今輪 zero live mutation。')}>{row.action}</button></div></article>;
}

function ChannelsTool({onCommand}:{onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <><p className="callout">Health ≠ Availability。Desired / Observed / Freshness 分開顯示。</p>
    <div className="list-stack">{channels.map(row=><ChannelView key={row.id} row={row} onCommand={onCommand}/>)}</div>
  </>;
}
function ChannelView({row,onCommand}:{row:ChannelRow;onCommand:(label:string,target:string,impact:string,approval?:string)=>void}){
  return <article className="channel-row"><div className="channel-head"><strong>{row.name}</strong><span className={'health '+healthClass(row.health)}>{row.health}</span></div><div className="channel-facts"><span>Desired：{row.desired}</span><span>Observed：{row.observed}</span><span>Freshness：{row.freshness}</span></div><button disabled={row.action==='查看'} onClick={()=>onCommand(row.action,row.name,'Pause / Resume / Snooze 只影響新 intake presentation；不影響已成立 Order。')}>{row.action}</button></article>;
}

function StaffTool(){
  return <div className="list-stack">{staff.map(member=><article className="staff-row" key={member.id}><div className="staff-head"><div><strong>{member.name}</strong><span>{member.role}</span></div><b>{member.clock}</b></div><div className="staff-facts"><span>排班：{member.schedule}</span><span>實際：{member.actual}</span><span>休息：{member.breakState}</span><span>工時：{member.hours}</span></div><small>Permission shape：{member.permissions}</small></article>)}</div>;
}

function DevicesTool(){
  return <><p className="callout">Owner 只睇 health / impact / binding / job certainty。無 physical print / reroute command。</p><div className="list-stack">{devices.map(device=><article className="device-row" key={device.id}><div className="device-head"><div><strong>{device.name}</strong><span>{device.kind}</span></div><b className={'health '+healthClass(device.health)}>{device.health}</b></div><div className="device-facts"><span>Last seen：{device.lastSeen}</span><span>{device.binding}</span><span>Jobs：{device.jobs}</span><span>Affected：{device.affected}</span></div></article>)}</div></>;
}

function NotificationsTool(){
  return <><div className="segmented three"><button className="active">全部</button><button>即時</button><button>摘要</button></div><div className="list-stack">{notifications.map(item=><article className="notification-row" key={item.id}><div><span className={'cadence cadence-'+cadenceClass(item.cadence)}>{item.cadence}</span><small>{item.time}</small></div><strong>{item.title}</strong><p>{item.detail}</p><em>{item.state}</em></article>)}</div></>;
}

function ManagerTool({onNotWired}:{onNotWired:(label:string)=>void}){
  const [checked,setChecked]=useState<Record<string,boolean>>({open:true,mid:false,close:false});
  return <><section className="manager-note"><span>Manager Log</span><strong>21:20｜晚市人流正常</strong><p>Keeta 有間歇性讀數延遲；前線繼續本地營運。</p><button onClick={()=>onNotWired('新增 Manager Log')}>新增記錄</button></section>
    <section className="checklist"><h3>今日 Checklist</h3>{[['open','開舖 readiness'],['mid','中段補貨／設備巡查'],['close','收舖交接']].map(([id,label])=><label key={id}><input type="checkbox" checked={Boolean(checked[id])} onChange={()=>setChecked(current=>({...current,[id]:!current[id]}))}/><span>{label}</span><small>Session-only preview</small></label>)}</section>
    <div className="boundary-box">Checklist tick 只存在目前 session，唔寫入任何 DB。</div>
  </>;
}

function ActivityTool(){
  return <div className="timeline">{activity.map((item,index)=><article key={index}><i/><div><span>{item.time} · {item.actor}</span><strong>{item.action}</strong><small>{item.target} · {item.result}</small></div></article>)}</div>;
}

function AdminTool({onNotWired}:{onNotWired:(label:string)=>void}){
  return <><p className="callout">Owner 唔 author 正式設定。所有 structural work 只保留「前往 Admin」UX shape。</p><div className="list-stack">{adminLinks.map(link=><article className="admin-link" key={link.id}><div><strong>{link.label}</strong><small>{link.detail}</small></div><button onClick={()=>onNotWired('前往 Admin：'+link.label)}>前往 Admin</button></article>)}</div></>;
}

function CapabilityTool(){
  const groups=[...new Set(capabilities.map(item=>item.GROUP))];
  return <><div className="registry-summary"><div><strong>{capabilities.length}</strong><span>Capabilities</span></div><div><strong>{commandCount}</strong><span>Command Shapes</span></div><div><strong>0</strong><span>Live Wiring</span></div></div><div className="registry">{groups.map(group=><section key={group}><h3>{group}</h3>{capabilities.filter(item=>item.GROUP===group).map(item=><article key={item.CAP_ID}><div><strong>{item.LABEL}</strong><small>{item.CAP_ID}</small></div><div><span>{item.KIND}</span><em className={item.STATUS==='NOT_WIRED'?'red':''}>{item.STATUS}</em><small>{item.OWNER}</small></div></article>)}</section>)}</div></>;
}

function RecoveryTool({onNotWired}:{onNotWired:(label:string)=>void}){
  return <><div className="list-stack">{recoveryStates.map(item=><article className="recovery-state" key={item.state}><strong>{item.state}</strong><p>{item.meaning}</p><small>{item.action}</small>{item.state==='RETRY'?<button onClick={()=>onNotWired('Retry')}>Retry presentation</button>:null}</article>)}</div></>;
}

function ConfirmationSheet({value,close,onConfirm}:{value:Confirmation;close:()=>void;onConfirm:()=>void}){
  const [reason,setReason]=useState('營運處理');
  const [preview,setPreview]=useState<'確認'|'PENDING'|'RESULT'|'FAILURE'|'UNKNOWN'>('確認');
  return <div className="overlay top"><section className="sheet confirm-sheet" role="dialog" aria-modal="true">
    <div className="sheet-grabber"/><header><div><span>Bounded Action Confirmation</span><h2>{value.label}</h2><small>{value.target}</small></div><button onClick={close}>×</button></header>
    <section className="impact-box"><span>影響預覽</span><p>{value.impact}</p></section>
    <label className="field">原因<select value={reason} onChange={event=>setReason(event.target.value)}><option>營運處理</option><option>現場要求</option><option>異常覆核</option><option>其他</option></select></label>
    <section className="approval-box"><span>Approval Presentation</span><strong>{value.approval}</strong><small>今輪無 Auth / Approval command。</small></section>
    <section className="command-preview"><span>狀態 Shape</span><div>{['確認','PENDING','RESULT','FAILURE','UNKNOWN'].map(item=><button key={item} className={preview===item?'active':''} onClick={()=>setPreview(item as typeof preview)}>{item}</button>)}</div><p>{commandPreviewCopy(preview)}</p></section>
    <div className="boundary-box">STATUS = NOT_WIRED｜按「確認」只會顯示 migration feedback；唔會發 command。</div>
    <div className="sheet-actions"><button onClick={close}>取消</button><button className="primary" onClick={onConfirm}>確認（NOT_WIRED）</button></div>
  </section></div>;
}

function commandPreviewCopy(state:'確認'|'PENDING'|'RESULT'|'FAILURE'|'UNKNOWN'){
  const copy={
    '確認':'等待使用者確認／reason／approval。',
    'PENDING':'命令已建立但未有終局的 UI 位置；今輪不會真的建立 operation。',
    'RESULT':'Canonical readback / result 的 UI 位置。',
    'FAILURE':'已知失敗的 UI 位置；不可偽裝成功。',
    'UNKNOWN':'未能證明結果；禁止 blind retry。',
  };
  return copy[state];
}

function Kpi({label,value,compare}:{label:string;value:string;compare:string}){return <article className="kpi"><span>{label}</span><strong>{value}</strong><small>{compare}</small><em>截至 {today.observedAt}</em></article>}
function Detail({label,value}:{label:string;value:string}){return <article className="detail"><span>{label}</span><strong>{value}</strong></article>}
function DetailSection({title,children}:{title:string;children:ReactNode}){return <section className="detail-section"><h3>{title}</h3><div>{children}</div></section>}
function DrawerHead({title,subtitle,close}:{title:string;subtitle:string;close:()=>void}){return <header className="drawer-head"><div><span>{subtitle}</span><h2>{title}</h2></div><button onClick={close}>×</button></header>}
function NavButton({active,label,glyph,badge,onClick}:{active:boolean;label:string;glyph:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}><span>{glyph}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>}
function cadenceClass(value:'即時'|'摘要'|'收件箱'){return value==='即時'?'immediate':value==='摘要'?'digest':'inbox'}
function healthClass(value:string){return value==='正常'?'good':value==='降級'?'warn':value==='離線'?'bad':'unknown'}
