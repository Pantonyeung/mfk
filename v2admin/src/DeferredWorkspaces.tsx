import {useState} from 'react';

function MigrationHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>MIGRATION_ONLY · NO CONNECTION</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" className="publish" disabled>Publish 未接駁</button></div>
  </header>;
}

export function InventoryWorkspace(){
  const [search,setSearch]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="庫存統計" description="搬入庫存檢視操作面；目前唔接 inventory truth，亦唔可以用呢個頁面阻交易。"/>
    <div className="admin-filterbar"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜尋原料／品項"/><button disabled>讀取未接駁</button></div>
    <section className="admin-read-table"><header><span>品項</span><span>目前數量</span><span>單位</span><span>狀態</span><span>更新時間</span></header><div className="admin-read-empty">INVENTORY_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}

export function PresentationWorkspace({surface}:{surface:'CUSTOMER'|'OWNER'|'FRONTLINE'}){
  const [headline,setHeadline]=useState('');
  const [showPromos,setShowPromos]=useState(true);
  const [showCategories,setShowCategories]=useState(true);
  const title=surface==='CUSTOMER'?'客戶端首頁':surface==='OWNER'?'Owner 今日首頁':'SMT／SMM 點單版面';
  return <section className="admin-editor-page">
    <MigrationHeader title={title} description="只搬 Presentation Config 編輯面；唔會直接修改任何 Port。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>內容</h2><label><span>主標題</span><input value={headline} onChange={event=>setHeadline(event.target.value)} placeholder="顯示標題"/></label><label className="admin-toggle"><input type="checkbox" checked={showPromos} onChange={event=>setShowPromos(event.target.checked)}/><span>顯示 Promotion 區</span></label><label className="admin-toggle"><input type="checkbox" checked={showCategories} onChange={event=>setShowCategories(event.target.checked)}/><span>顯示分類導覽</span></label></article>
      <article className="admin-policy-card"><h2>Preview State</h2><div className="admin-read-empty">{surface}_PRESENTATION_PREVIEW_NOT_WIRED</div></article>
    </div>
  </section>;
}

export function StoreBindingWorkspace(){
  const [provider,setProvider]=useState('');
  const [externalStore,setExternalStore]=useState('');
  const [mfkStore,setMfkStore]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="門店授權映射" description="只搬 Store identity mapping 編輯面；未接 Channel Adapter 前唔會建立任何 provider binding。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Mapping Draft</h2><label><span>Provider</span><input value={provider} onChange={event=>setProvider(event.target.value)} placeholder="Provider"/></label><label><span>External Store ID</span><input value={externalStore} onChange={event=>setExternalStore(event.target.value)} placeholder="External Store"/></label><label><span>MFK Store ID</span><input value={mfkStore} onChange={event=>setMfkStore(event.target.value)} placeholder="MFK Store"/></label></article>
      <article className="admin-policy-card"><h2>Binding Readback</h2><div className="admin-read-empty">STORE_BINDING_NOT_WIRED</div></article>
    </div>
  </section>;
}

export function Customer360Workspace(){
  const [query,setQuery]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="Customer 360" description="搬入 Customer 查詢／歷史操作面；Customer identity / loyalty truth 尚未接駁。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="電話／Customer ID"/><button disabled>搜尋未接駁</button></div>
    <div className="admin-policy-grid two"><section className="admin-read-card"><header><h2>Profile</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">CUSTOMER_PROFILE_NOT_WIRED</div></section><section className="admin-read-card"><header><h2>Orders</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">CUSTOMER_ORDER_HISTORY_NOT_WIRED</div></section></div>
  </section>;
}

export function LoyaltyWorkspace(){
  const [name,setName]=useState('');
  const [threshold,setThreshold]=useState('');
  const [multiplier,setMultiplier]=useState('1');
  return <section className="admin-editor-page">
    <MigrationHeader title="會員等級／積分" description="只搬 loyalty policy 編輯面；未建立第二會員 ledger。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>Tier Draft</h2><label><span>等級名稱</span><input value={name} onChange={event=>setName(event.target.value)}/></label><label><span>門檻</span><input value={threshold} onChange={event=>setThreshold(event.target.value)} inputMode="numeric"/></label><label><span>積分倍率</span><input value={multiplier} onChange={event=>setMultiplier(event.target.value)} inputMode="decimal"/></label></article><article className="admin-policy-card"><h2>Ledger</h2><div className="admin-read-empty">LOYALTY_LEDGER_NOT_WIRED</div></article></div>
  </section>;
}

export function CouponsWorkspace(){
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [kind,setKind]=useState('FIXED');
  const [value,setValue]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="優惠券" description="只搬 Coupon policy 編輯面；唔接 Pricing/Checkout 前唔會影響 Quote。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>Coupon Draft</h2><label><span>名稱</span><input value={name} onChange={event=>setName(event.target.value)}/></label><label><span>Code</span><input value={code} onChange={event=>setCode(event.target.value)}/></label><label><span>類型</span><select value={kind} onChange={event=>setKind(event.target.value)}><option value="FIXED">固定金額</option><option value="PERCENT">百分比</option></select></label><label><span>數值</span><input value={value} onChange={event=>setValue(event.target.value)}/></label></article><article className="admin-policy-card"><h2>Quote Impact</h2><div className="admin-read-empty">COUPON_PRICING_NOT_WIRED</div></article></div>
  </section>;
}

export function RfmWorkspace(){
  const [range,setRange]=useState('90');
  return <section className="admin-editor-page">
    <MigrationHeader title="RFM 客戶分析" description="只搬分析入口；所有指標將來只讀 MFK reporting projection。"/>
    <div className="admin-filterbar"><label><span>分析日數</span><input value={range} onChange={event=>setRange(event.target.value)} inputMode="numeric"/></label><button disabled>分析未接駁</button></div>
    <div className="admin-kpi-grid"><article><span>Recent</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Frequent</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>High Value</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>At Risk</span><strong>—</strong><small>NOT_WIRED</small></article></div>
  </section>;
}

export function AnnouncementsWorkspace(){
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [audience,setAudience]=useState('ALL_STAFF');
  return <section className="admin-editor-page">
    <MigrationHeader title="公告／通知" description="只搬公告編輯面；未接任何 push / realtime channel。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>Announcement Draft</h2><label><span>標題</span><input value={title} onChange={event=>setTitle(event.target.value)}/></label><label><span>內容</span><textarea rows={6} value={body} onChange={event=>setBody(event.target.value)}/></label><label><span>對象</span><select value={audience} onChange={event=>setAudience(event.target.value)}><option value="ALL_STAFF">全部員工</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option></select></label></article><article className="admin-policy-card"><h2>Delivery</h2><div className="admin-read-empty">NOTIFICATION_DELIVERY_NOT_WIRED</div></article></div>
  </section>;
}

export function AdvancedWorkspace(){
  const [rawMaterials,setRawMaterials]=useState(false);
  const [diagnostics,setDiagnostics]=useState(false);
  const [developer,setDeveloper]=useState(false);
  return <section className="admin-editor-page">
    <MigrationHeader title="進階設定" description="低頻／高風險能力只搬入口同控制形狀；未經 Owner 開 seam 唔會接任何系統。"/>
    <div className="admin-policy-grid">
      <article className="admin-policy-card"><h2>原材料</h2><label className="admin-toggle"><input type="checkbox" checked={rawMaterials} onChange={event=>setRawMaterials(event.target.checked)}/><span>顯示原材料進階功能</span></label><span className="admin-not-wired-chip">DEFERRED</span></article>
      <article className="admin-policy-card"><h2>Diagnostics</h2><label className="admin-toggle"><input type="checkbox" checked={diagnostics} onChange={event=>setDiagnostics(event.target.checked)}/><span>顯示診斷工具</span></label><span className="admin-not-wired-chip">DEFERRED</span></article>
      <article className="admin-policy-card"><h2>Developer</h2><label className="admin-toggle"><input type="checkbox" checked={developer} onChange={event=>setDeveloper(event.target.checked)}/><span>顯示開發工具</span></label><span className="admin-not-wired-chip">DEFERRED</span></article>
    </div>
  </section>;
}
