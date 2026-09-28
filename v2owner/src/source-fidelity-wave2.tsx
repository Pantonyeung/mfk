import {useMemo,useState} from 'react';
import type {OwnerConnectionState,OwnerReadModelSnapshot} from './product-types';

type BackProps={onBack:()=>void};

function formatObserved(value?:string){
  if(!value)return '未有更新時間';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '未有更新時間';
  return date.toLocaleString('zh-HK',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function humanHealth(value:string){
  if(value==='HEALTHY')return '正常';
  if(value==='DEGRADED')return '需要留意';
  if(value==='OFFLINE')return '離線';
  if(value==='MISCONFIGURED')return '設定需要處理';
  if(value==='ATTENTION')return '需要處理';
  return '狀態未明';
}

function humanDeviceKind(value:string){
  const normalized=value.toUpperCase();
  if(normalized.includes('SMT')||normalized.includes('POS'))return '主收銀設備';
  if(normalized.includes('SMM')||normalized.includes('TABLET'))return '流動點餐設備';
  if(normalized.includes('PRINTER')||normalized.includes('PRINT'))return '打印設備';
  if(normalized.includes('LABEL'))return '標籤設備';
  if(normalized.includes('ROUTER')||normalized.includes('NETWORK'))return '網絡設備';
  if(normalized.includes('CLOUD'))return '雲端連接';
  return '店舖設備';
}

function isConnectionReadOnly(value:OwnerConnectionState){
  return value==='OFFLINE_READONLY'||value==='PERMISSION_DENIED'||value==='UNKNOWN'||value==='ERROR';
}

function SourceHead({eyebrow,title,detail,onBack}:{eyebrow:string;title:string;detail:string;onBack:()=>void}){
  return <header className="wave2-head">
    <button className="wave2-back" type="button" onClick={onBack} aria-label="返回更多">‹</button>
    <div><span>{eyebrow}</span><h1>{title}</h1><small>{detail}</small></div>
  </header>;
}

function AssetSlot({name,label,className=''}:{name:string;label:string;className?:string}){
  return <span className={'wave2-art-slot '+className} data-final-art-slot={name} aria-label={label}><i aria-hidden="true"/></span>;
}

function EmptyCard({title,detail}:{title:string;detail:string}){
  return <section className="card wave2-empty"><h2>{title}</h2><p>{detail}</p></section>;
}

function SafeUnavailable({title,detail}:{title:string;detail:string}){
  return <section className="safe-unavailable" data-safe-unavailable="true">
    <strong>{title}</strong>
    <p>{detail}</p>
  </section>;
}

export function DeviceHealthPage({snapshot,onBack}:{snapshot:OwnerReadModelSnapshot|null}&BackProps){
  const devices=snapshot?.devices??[];
  const [filter,setFilter]=useState<'ALL'|'HEALTHY'|'ATTENTION'>('ALL');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=devices.find(item=>item.deviceId===selectedId)??null;
  const filtered=devices.filter(item=>filter==='ALL'||(filter==='HEALTHY'?item.health==='HEALTHY':item.health!=='HEALTHY'));
  const healthy=devices.filter(item=>item.health==='HEALTHY').length;
  const attention=devices.length-healthy;

  if(selected){
    return <section className="page wave2-page device-page">
      <SourceHead eyebrow="設備／打印" title="設備詳情" detail="先睇營運影響，再決定下一步。" onBack={()=>setSelectedId(null)}/>
      <section className="card device-detail-hero">
        <AssetSlot name={'owner-device-'+selected.kind.toLowerCase()+'-icon'} label="設備圖示位置"/>
        <div><strong>{selected.name}</strong><small>{humanDeviceKind(selected.kind)}</small></div>
        <span className={'wave2-status '+selected.health.toLowerCase()}>{humanHealth(selected.health)}</span>
      </section>
      <section className="card wave2-detail-card">
        <h2>目前狀態</h2>
        <div className="wave2-detail-grid">
          <div><span>設備類型</span><strong>{humanDeviceKind(selected.kind)}</strong></div>
          <div><span>上次在線</span><strong>{formatObserved(selected.lastSeen)}</strong></div>
          <div><span>店內配對</span><strong>{selected.binding?'已設定':'未提供'}</strong></div>
          <div><span>打印工作</span><strong>{selected.jobs??'未有需要處理'}</strong></div>
          <div className="wide"><span>受影響範圍</span><strong>{selected.affected??'未見明確影響'}</strong></div>
        </div>
      </section>
      <SafeUnavailable title="遠端診斷暫未開放" detail="目前可以安全查看設備狀態，但未有正式遠端測試、重新配對或測試打印入口。舊打印工作亦唔會因設備恢復而自動重印。"/>
      <section className="card device-history-card">
        <div className="section-head"><div><span className="eyebrow">裝置紀錄</span><h2>最近狀態</h2></div></div>
        <div className="wave2-timeline"><article><i/><div><strong>{humanHealth(selected.health)}</strong><small>{formatObserved(selected.lastSeen)}</small></div></article></div>
      </section>
    </section>;
  }

  return <section className="page wave2-page device-page">
    <SourceHead eyebrow="設備／打印" title="設備狀態" detail="收銀、流動點餐、打印同網絡，一眼睇清邊部需要處理。" onBack={onBack}/>
    <section className="wave2-summary-grid">
      <article><span>設備</span><strong>{devices.length}</strong><small>目前可見</small></article>
      <article><span>正常</span><strong>{healthy}</strong><small>狀態穩定</small></article>
      <article><span>需留意</span><strong>{attention}</strong><small>離線或異常</small></article>
    </section>
    <div className="wave2-filter-tabs" aria-label="設備篩選">
      <button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>全部</button>
      <button className={filter==='HEALTHY'?'active':''} onClick={()=>setFilter('HEALTHY')}>正常</button>
      <button className={filter==='ATTENTION'?'active':''} onClick={()=>setFilter('ATTENTION')}>異常</button>
    </div>
    {!filtered.length?<EmptyCard title={devices.length?'呢個分類暫時冇設備':'設備資料尚未提供'} detail={devices.length?'切換其他分類查看。':'正式設備資料出現後會喺呢度顯示，唔會用假設備補位。'}/>:<div className="wave2-list">
      {filtered.map(item=><button type="button" className="card device-row" key={item.deviceId} onClick={()=>setSelectedId(item.deviceId)}>
        <AssetSlot name={'owner-device-'+item.kind.toLowerCase()+'-icon'} label="設備圖示位置"/>
        <div className="device-row-copy"><strong>{item.name}</strong><small>{humanDeviceKind(item.kind)} · {item.affected??'未見明確影響'}</small><em>{item.lastSeen?'更新 '+formatObserved(item.lastSeen):'更新時間未提供'}</em></div>
        <span className={'wave2-status '+item.health.toLowerCase()}>{humanHealth(item.health)}</span>
      </button>)}
    </div>}
  </section>;
}

const FIXED_REPORTS=[
  {id:'R1',title:'今日營業',detail:'有效營業額、訂單、平均訂單金額'},
  {id:'R2',title:'時段分析',detail:'營業時段表現'},
  {id:'R3',title:'商品表現',detail:'商品與分類表現'},
  {id:'R4',title:'渠道表現',detail:'各接單來源表現'},
  {id:'R5',title:'付款方式',detail:'目前有效付款方式分布'},
  {id:'R6',title:'交易調整',detail:'取消、退款與金額調整'},
  {id:'R7',title:'員工與工時',detail:'出勤與營運人力摘要'},
  {id:'R8',title:'營運健康',detail:'渠道、設備與異常摘要'},
] as const;

function matchReport(report:{reportId:string;name:string},definition:(typeof FIXED_REPORTS)[number],index:number){
  const id=report.reportId.toUpperCase();
  if(id===definition.id||id.startsWith(definition.id+'-')||id.startsWith(definition.id+'_'))return true;
  const keywords=[
    ['今日','營業','sales'],['時段','hour'],['商品','product'],['渠道','channel'],
    ['付款','tender','payment'],['調整','refund','cancel'],['員工','staff','labor'],['健康','health','operation'],
  ][index];
  return keywords.some(keyword=>(report.name+' '+report.reportId).toLowerCase().includes(keyword.toLowerCase()));
}

export function ReportsPage({snapshot,onBack}:{snapshot:OwnerReadModelSnapshot|null}&BackProps){
  const reports=snapshot?.reports??[];
  const [selected,setSelected]=useState<number|null>(null);
  const mapped=FIXED_REPORTS.map((definition,index)=>({
    definition,
    report:reports.find(item=>matchReport(item,definition,index))??reports[index]??null,
  }));

  if(selected!==null){
    const item=mapped[selected];
    return <section className="page wave2-page reports-page">
      <SourceHead eyebrow="固定報表" title={item.definition.title} detail={item.definition.detail} onBack={()=>setSelected(null)}/>
      {item.report?<>
        <section className="card report-hero"><span>今日</span><strong>{item.report.value}</strong><small>{item.report.compare??'暫無比較資料'}</small></section>
        <section className="card report-detail-card"><div><span>資料狀態</span><strong>{item.report.freshness||'未提供'}</strong></div><p>呢張固定報表只供查看；需要其他分析可返回報表首頁。</p></section>
      </>:<SafeUnavailable title="呢張報表暫未有資料" detail="目前資料來源未提供呢項固定報表。畫面會保持空白狀態，唔會自行計算另一套數字。"/>}
    </section>;
  }

  return <section className="page wave2-page reports-page">
    <SourceHead eyebrow="數據" title="報表" detail="先睇今日營運，再落入固定報表了解原因。" onBack={onBack}/>
    <div className="wave2-filter-tabs report-range" aria-label="報表時段">
      <button className="active">今日</button>
      <button disabled title="暫未有正式時段資料">過去 7 日</button>
      <button disabled title="暫未有正式時段資料">過去 30 日</button>
    </div>
    <section className="card report-overview">
      <div className="section-head"><div><span className="eyebrow">營業概覽</span><h2>今日重點</h2></div><small>{snapshot?.observedAt?'更新 '+formatObserved(snapshot.observedAt):'更新時間未提供'}</small></div>
      <div className="report-kpi-grid">
        <article><span>訂單數量</span><strong>{snapshot?.today?.orderCount??'—'}</strong><small>正式訂單</small></article>
        <article><span>有效營業額</span><strong>{snapshot?.today?.salesLabel??'—'}</strong><small>{snapshot?.today?.comparisonLabel??'暫無比較資料'}</small></article>
        <article><span>平均訂單金額</span><strong>{snapshot?.today?.averageOrderLabel??'—'}</strong><small>按目前資料</small></article>
        <article><span>需要留意</span><strong>{(snapshot?.actions??[]).filter(item=>item.state!=='RESOLVED').length}</strong><small>待處理事項</small></article>
      </div>
    </section>
    <div className="report-fixed-heading"><div><span>固定報表</span><strong>8 張</strong></div><small>只讀 · 按正式資料顯示</small></div>
    <div className="report-fixed-grid">
      {mapped.map((item,index)=><button type="button" className="card report-card" key={item.definition.id} onClick={()=>setSelected(index)}>
        <AssetSlot name={'owner-report-'+item.definition.id.toLowerCase()+'-icon'} label="報表圖示位置"/>
        <div><span>{item.definition.id}</span><strong>{item.definition.title}</strong><small>{item.definition.detail}</small></div>
        <aside><b>{item.report?.value??'—'}</b><em>{item.report?.compare??(item.report?.freshness||'未有資料')}</em></aside>
      </button>)}
    </div>
    <SafeUnavailable title="歷史時段暫未開放" detail="目前只收到今日固定報表，過去 7 日、30 日同自訂日期未有正式查詢資料，所以保持停用。"/>
    <p className="wave2-footnote">報表只顯示既有固定資料；唔提供自由報表編輯器。</p>
  </section>;
}

export type ManagerMode='manager-log'|'checklist'|'handoff';

export function ManagerLogPage({mode,snapshot,onNavigate,onBack}:{mode:ManagerMode;snapshot:OwnerReadModelSnapshot|null;onNavigate:(mode:ManagerMode)=>void}&BackProps){
  const activeActions=(snapshot?.actions??[]).filter(item=>item.state!=='RESOLVED').length;
  const channelIssues=(snapshot?.channels??[]).filter(item=>item.health!=='HEALTHY').length;
  const deviceIssues=(snapshot?.devices??[]).filter(item=>item.health!=='HEALTHY').length;

  return <section className="page wave2-page manager-page">
    <SourceHead eyebrow="店長管理" title={mode==='manager-log'?'經理日誌':mode==='checklist'?'每日檢查清單':'交接摘要'} detail={mode==='manager-log'?'記錄店內重要營運事項。':mode==='checklist'?'開舖、營業中、收舖分段查看。':'將真正未處理事項整理畀下一更。'} onBack={onBack}/>
    <div className="manager-segmented">
      <button className={mode==='manager-log'?'active':''} onClick={()=>onNavigate('manager-log')}>經理日誌</button>
      <button className={mode==='checklist'?'active':''} onClick={()=>onNavigate('checklist')}>檢查清單</button>
      <button className={mode==='handoff'?'active':''} onClick={()=>onNavigate('handoff')}>交接</button>
    </div>

    {mode==='manager-log'?<>
      <section className="card manager-daily-overview">
        <div className="manager-progress-block">
          <span>今日檢查</span><strong>—</strong><small>正式完成進度未提供</small>
        </div>
        <div className="manager-overview-stats">
          <article><span>待處理</span><strong>{activeActions}</strong><small>需要跟進</small></article>
          <article><span>渠道</span><strong>{channelIssues}</strong><small>需要留意</small></article>
          <article><span>設備</span><strong>{deviceIssues}</strong><small>需要留意</small></article>
        </div>
      </section>
      <section className="manager-focus">
        <div className="section-head"><div><span className="eyebrow">今日重點</span><h2>需要留意</h2></div></div>
        <div className="manager-focus-list">
          <article className="card"><strong>待處理事項</strong><span>{activeActions?activeActions+' 項未完成':'暫時冇未完成事項'}</span></article>
          <article className="card"><strong>渠道與設備</strong><span>{channelIssues+deviceIssues?channelIssues+deviceIssues+' 項需要留意':'暫時正常'}</span></article>
          <article className="card"><strong>正式日誌</strong><span>未連接</span></article>
        </div>
      </section>
      <div className="manager-category-chips"><span>營運</span><span>商品</span><span>客人</span><span>維修</span><span>員工</span><span>其他</span></div>
      <SafeUnavailable title="正式共享日誌未連接" detail="現階段可以安全查看營運重點，但未有共享日誌資料入口；新增、回覆、修改同刪除保持停用，亦唔會用本機私人筆記冒充店舖正式紀錄。"/>
      <button className="primary wide manager-disabled-action" disabled>新增記錄</button>
    </>:null}

    {mode==='checklist'?<>
      <section className="card checklist-progress"><span>今日檢查</span><strong>—</strong><small>正式完成進度未提供</small></section>
      <div className="checklist-stage-list">
        {['開舖檢查','營業中檢查','收舖檢查'].map(item=><article className="card" key={item}><div><strong>{item}</strong><small>暫未有正式清單資料</small></div><span>未連接</span></article>)}
      </div>
      <SafeUnavailable title="清單操作暫未開放" detail="目前未有正式共享檢查清單來源。勾選、文字、數字與完成進度都保持唯讀，避免建立另一套任務資料。"/>
    </>:null}

    {mode==='handoff'?<>
      <section className="handoff-summary-grid">
        <article><span>待處理</span><strong>{activeActions}</strong><small>仍需跟進</small></article>
        <article><span>渠道</span><strong>{channelIssues}</strong><small>需要留意</small></article>
        <article><span>設備</span><strong>{deviceIssues}</strong><small>需要留意</small></article>
      </section>
      <section className="card handoff-card">
        <h2>交接重點</h2>
        <div><span>待處理事項</span><strong>{activeActions?activeActions+' 項未完成':'暫時冇未完成事項'}</strong></div>
        <div><span>渠道／設備</span><strong>{channelIssues+deviceIssues?channelIssues+deviceIssues+' 項需要留意':'暫時正常'}</strong></div>
        <div><span>現金差異</span><strong>{snapshot?.cash?.varianceLabel??'未有資料'}</strong></div>
        <div><span>檢查清單</span><strong>未連接</strong></div>
      </section>
      <SafeUnavailable title="交接確認暫未開放" detail="目前只可查看已有營運資料摘要；正式檢查清單與共享交接紀錄未連接，所以唔會寫入另一份交接真相。"/>
    </>:null}
  </section>;
}

type ActivityFilter='ALL'|'IMPORTANT'|'SYSTEM';

export function ActivityAuditPage({snapshot,onBack}:{snapshot:OwnerReadModelSnapshot|null}&BackProps){
  const records=snapshot?.activity??[];
  const [filter,setFilter]=useState<ActivityFilter>('ALL');
  const [actor,setActor]=useState('ALL');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const actors=useMemo(()=>Array.from(new Set(records.map(item=>item.actor).filter(Boolean))),[records]);
  const important=(item:(typeof records)[number])=>!/(完成|成功|正常|已確認)/.test(item.result)||/(退款|取消|售罄|打印|渠道|權限|差異)/.test(item.title);
  const filtered=records.filter(item=>{
    if(actor!=='ALL'&&item.actor!==actor)return false;
    if(filter==='SYSTEM'&&!/系統|system/i.test(item.actor))return false;
    if(filter==='IMPORTANT'&&!important(item))return false;
    return true;
  });
  const selected=records.find(item=>item.activityId===selectedId)??null;

  if(selected){
    const requester=selected.requester??selected.actor;
    const approver=selected.approver;
    return <section className="page wave2-page activity-page">
      <SourceHead eyebrow="活動紀錄" title={selected.title} detail="睇清邊個做、對邊樣嘢做、結果係乜。" onBack={()=>setSelectedId(null)}/>
      <section className="card activity-detail-hero">
        <AssetSlot name="owner-activity-detail-icon" label="活動紀錄圖示位置"/>
        <div><span>{formatObserved(selected.observedAt)}</span><strong>{selected.result}</strong><small>{selected.target??'未有指定對象'}</small></div>
      </section>
      <section className="card wave2-detail-card">
        <h2>紀錄內容</h2>
        <div className="wave2-detail-grid">
          <div><span>操作人</span><strong>{requester}</strong></div>
          <div><span>批核人</span><strong>{approver??'不適用'}</strong></div>
          <div><span>時間</span><strong>{formatObserved(selected.observedAt)}</strong></div>
          <div><span>結果</span><strong>{selected.result}</strong></div>
          <div className="wide"><span>對象</span><strong>{selected.target??'未有資料'}</strong></div>
          <div className="wide"><span>備註</span><strong>{selected.detail??'未有補充資料'}</strong></div>
        </div>
      </section>
      {(selected.linkedActionId||selected.incidentId||selected.correlationId)?<p className="wave2-footnote">呢項活動已連結相關營運紀錄；技術細節留喺診斷頁。</p>:null}
    </section>;
  }

  return <section className="page wave2-page activity-page">
    <SourceHead eyebrow="管理" title="活動紀錄" detail="人睇得明嘅操作歷史，技術細節留畀診斷工具。" onBack={onBack}/>
    <div className="activity-toolbar">
      <div className="wave2-filter-tabs">
        <button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>全部</button>
        <button className={filter==='IMPORTANT'?'active':''} onClick={()=>setFilter('IMPORTANT')}>重要</button>
        <button className={filter==='SYSTEM'?'active':''} onClick={()=>setFilter('SYSTEM')}>系統</button>
      </div>
      <button className="activity-filter-button" onClick={()=>setFiltersOpen(true)}>篩選</button>
    </div>
    {!filtered.length?<EmptyCard title={records.length?'暫時冇符合條件嘅紀錄':'活動紀錄尚未提供'} detail={records.length?'調整篩選條件再查看。':'有正式活動資料之後會顯示喺呢度。'}/>:<div className="activity-feed">
      {filtered.map(item=><button type="button" className="card activity-row" key={item.activityId} onClick={()=>setSelectedId(item.activityId)}>
        <AssetSlot name="owner-activity-feed-icon" label="活動圖示位置"/>
        <div><strong>{item.title}</strong><small>{item.actor} · {formatObserved(item.observedAt)}</small><em>{item.target??item.detail??'查看詳情'}</em></div>
        <span>{item.result}</span>
      </button>)}
    </div>}
    {filtersOpen?<div className="overlay"><section className="sheet wave2-filter-sheet" role="dialog" aria-modal="true">
      <header><div><span>活動紀錄</span><h2>篩選</h2></div><button onClick={()=>setFiltersOpen(false)}>✕</button></header>
      <label><span>操作人</span><select value={actor} onChange={event=>setActor(event.target.value)}><option value="ALL">全部操作人</option>{actors.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      <div className="sheet-actions"><button onClick={()=>{setActor('ALL');setFilter('ALL')}}>清除</button><button className="primary" onClick={()=>setFiltersOpen(false)}>套用</button></div>
    </section></div>:null}
  </section>;
}

type MoreTarget='channels'|'planning'|'sellability'|'staff'|'devices'|'reports'|'manager-log'|'checklist'|'handoff'|'activity'|'settings-summary';

export function MoreHubPage({snapshot,connection,onOpen,onTool}:{snapshot:OwnerReadModelSnapshot|null;connection:OwnerConnectionState;onOpen:(target:MoreTarget)=>void;onTool:(tool:'customers'|'marketing'|'settlement'|'cash'|'inventory'|'notifications'|'admin'|'recovery')=>void}){
  const groups=[
    {title:'營運管理',items:[
      {id:'sellability',label:'商品供應',detail:'售罄／恢復',state:String(snapshot?.sellability.length??0)},
      {id:'channels',label:'渠道',detail:'接單與健康',state:String(snapshot?.channels.length??0)},
      {id:'staff',label:'員工',detail:'出勤與角色摘要',state:String(snapshot?.staff.length??0)},
      {id:'devices',label:'設備／打印',detail:'設備與打印健康',state:String(snapshot?.devices.length??0)},
    ]},
    {title:'數據分析',items:[
      {id:'reports',label:'報表',detail:'八張固定營運報表',state:String(snapshot?.reports.length??0)},
      {id:'customers-tool',label:'客戶',detail:'新客／回頭客摘要',state:snapshot?.customers?'已有資料':'稍後'},
      {id:'marketing-tool',label:'推廣',detail:'活動成效摘要',state:String(snapshot?.campaigns.length??0)},
      {id:'inventory-tool',label:'庫存提示',detail:'低庫存／盤點提示',state:String(snapshot?.inventory.length??0)},
    ]},
    {title:'店長管理',items:[
      {id:'manager-log',label:'經理日誌',detail:'營運記錄與回覆',state:'未連接'},
      {id:'checklist',label:'檢查清單',detail:'開舖／營業中／收舖',state:'未連接'},
      {id:'handoff',label:'交接摘要',detail:'未完成事項集中查看',state:'查看'},
      {id:'activity',label:'活動紀錄',detail:'操作與結果歷史',state:String(snapshot?.activity.length??0)},
    ]},
    {title:'設定與支援',items:[
      {id:'settings-summary',label:'設定摘要',detail:'目前可見設定與狀態',state:'唯讀'},
      {id:'admin-tool',label:'前往 Admin',detail:'產品、價格、權限等正式設定',state:'開啟'},
      {id:'recovery-tool',label:'資料狀態',detail:'離線、延遲與部分資料',state:humanConnectionState(connection)},
      {id:'notifications-tool',label:'通知',detail:'即時、摘要與收件箱',state:String(snapshot?.notifications.length??0)},
    ]},
  ] as const;

  const click=(id:string)=>{
    if(id==='customers-tool')return onTool('customers');
    if(id==='marketing-tool')return onTool('marketing');
    if(id==='inventory-tool')return onTool('inventory');
    if(id==='admin-tool')return onTool('admin');
    if(id==='recovery-tool')return onTool('recovery');
    if(id==='notifications-tool')return onTool('notifications');
    onOpen(id as MoreTarget);
  };

  return <section className="page wave2-page more-hub-page">
    <header className="more-owner-card">
      <AssetSlot name="owner-more-store-banner" label="店舖品牌圖像位置" className="banner"/>
      <div><span>更多</span><h1>{snapshot?.store?.storeName??'磨飯'}</h1><small>{snapshot?.store?.businessDate??'營業日未有資料'} · {snapshot?.store?.operatingStatus??'店舖狀態未提供'}</small></div>
    </header>
    {groups.map(group=><section className="more-group" key={group.title}>
      <h2>{group.title}</h2>
      <div className="more-group-list">{group.items.map(item=><button type="button" key={item.id} onClick={()=>click(item.id)}>
        <AssetSlot name={'owner-more-'+item.id+'-icon'} label={item.label+'圖示位置'}/>
        <div><strong>{item.label}</strong><small>{item.detail}</small></div>
        <span>{item.state}</span><b aria-hidden="true">›</b>
      </button>)}</div>
    </section>)}
  </section>;
}

export function SettingsSummaryPage({snapshot,connection,onAdmin,onBack}:{snapshot:OwnerReadModelSnapshot|null;connection:OwnerConnectionState;onAdmin:()=>void}&BackProps){
  return <section className="page wave2-page settings-summary-page">
    <SourceHead eyebrow="設定" title="設定摘要" detail="手機只睇重點；結構性設定返 Admin 處理。" onBack={onBack}/>
    <section className="card wave2-detail-card">
      <h2>店舖</h2>
      <div className="wave2-detail-grid">
        <div><span>門店</span><strong>{snapshot?.store?.storeName??'未有資料'}</strong></div>
        <div><span>營業日</span><strong>{snapshot?.store?.businessDate??'未有資料'}</strong></div>
        <div><span>店舖狀態</span><strong>{snapshot?.store?.operatingStatus??'未有資料'}</strong></div>
        <div><span>資料狀態</span><strong>{humanConnectionState(connection)}</strong></div>
      </div>
    </section>
    <section className="card wave2-detail-card">
      <h2>營運資料</h2>
      <div className="wave2-detail-grid">
        <div><span>渠道</span><strong>{snapshot?.channels.length??0} 項</strong></div>
        <div><span>商品供應</span><strong>{snapshot?.sellability.length??0} 項</strong></div>
        <div><span>員工</span><strong>{snapshot?.staff.length??0} 位</strong></div>
        <div><span>設備</span><strong>{snapshot?.devices.length??0} 部</strong></div>
      </div>
    </section>
    <button className="primary wide" onClick={onAdmin}>前往 Admin</button>
  </section>;
}

export function humanConnectionState(value:OwnerConnectionState){
  if(value==='FRESH')return '資料最新';
  if(value==='LOADING')return '更新中';
  if(value==='EMPTY')return '暫無資料';
  if(value==='STALE')return '資料稍舊';
  if(value==='PARTIAL')return '部分資料';
  if(value==='OFFLINE_READONLY')return '離線，只可查看';
  if(value==='PERMISSION_DENIED')return '權限不足';
  if(value==='UNKNOWN')return '狀態未明';
  return '更新失敗';
}

export function wave2CanMutate(connection:OwnerConnectionState){
  return !isConnectionReadOnly(connection);
}
