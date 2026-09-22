import {useState} from 'react';

function MigrationHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>功能尚未啟用</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" className="publish" disabled>尚未可發布</button></div>
  </header>;
}

export function InventoryWorkspace(){
  const [search,setSearch]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="庫存統計" description="提供庫存檢視介面；目前庫存資料尚未啟用，亦唔會用呢個頁面阻止交易。"/>
    <div className="admin-filterbar"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜尋原料／品項"/><button disabled>讀取未接駁</button></div>
    <section className="admin-read-table"><header><span>品項</span><span>目前數量</span><span>單位</span><span>狀態</span><span>更新時間</span></header><div className="admin-read-empty">庫存資料尚未啟用</div></section>
  </section>;
}

export function PresentationWorkspace({surface}:{surface:'CUSTOMER'|'OWNER'|'FRONTLINE'}){
  const [headline,setHeadline]=useState('');
  const [showPromos,setShowPromos]=useState(true);
  const [showCategories,setShowCategories]=useState(true);
  const title=surface==='CUSTOMER'?'客戶端首頁':surface==='OWNER'?'老闆今日首頁':'前線點單版面';
  return <section className="admin-editor-page">
    <MigrationHeader title={title} description="只管理顯示設定；未發布前唔會直接改動其他裝置。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>內容</h2><label><span>主標題</span><input value={headline} onChange={event=>setHeadline(event.target.value)} placeholder="顯示標題"/></label><label className="admin-toggle"><input type="checkbox" checked={showPromos} onChange={event=>setShowPromos(event.target.checked)}/><span>顯示推廣區</span></label><label className="admin-toggle"><input type="checkbox" checked={showCategories} onChange={event=>setShowCategories(event.target.checked)}/><span>顯示分類導覽</span></label></article>
      <article className="admin-policy-card"><h2>預覽狀態</h2><div className="admin-read-empty">{surface}_PRESENTATION_PREVIEW_尚未啟用</div></article>
    </div>
  </section>;
}

export function StoreBindingWorkspace(){
  const [provider,setProvider]=useState('');
  const [externalStore,setExternalStore]=useState('');
  const [mfkStore,setMfkStore]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="門店授權映射" description="只管理門店同平台嘅對應設定；相關連接未啟用前，唔會建立任何平台綁定。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>對應草稿</h2><label><span>平台</span><input value={provider} onChange={event=>setProvider(event.target.value)} placeholder="Provider"/></label><label><span>平台門店編號</span><input value={externalStore} onChange={event=>setExternalStore(event.target.value)} placeholder="平台門店"/></label><label><span>磨飯門店編號</span><input value={mfkStore} onChange={event=>setMfkStore(event.target.value)} placeholder="磨飯門店"/></label></article>
      <article className="admin-policy-card"><h2>綁定結果</h2><div className="admin-read-empty">門店綁定尚未啟用</div></article>
    </div>
  </section>;
}

export function Customer360Workspace(){
  const [query,setQuery]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="顧客資料" description="提供顧客查詢同歷史記錄介面；顧客身份同會員資料尚未啟用。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="電話／顧客編號"/><button disabled>搜尋未接駁</button></div>
    <div className="admin-policy-grid two"><section className="admin-read-card"><header><h2>顧客資料</h2><span>尚未啟用</span></header><div className="admin-read-empty">顧客資料尚未啟用</div></section><section className="admin-read-card"><header><h2>訂單</h2><span>尚未啟用</span></header><div className="admin-read-empty">顧客訂單記錄尚未啟用</div></section></div>
  </section>;
}

export function LoyaltyWorkspace(){
  const [name,setName]=useState('');
  const [threshold,setThreshold]=useState('');
  const [multiplier,setMultiplier]=useState('1');
  return <section className="admin-editor-page">
    <MigrationHeader title="會員等級／積分" description="只管理會員規則；唔會建立另一套會員帳簿。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>會員等級草稿</h2><label><span>等級名稱</span><input value={name} onChange={event=>setName(event.target.value)}/></label><label><span>門檻</span><input value={threshold} onChange={event=>setThreshold(event.target.value)} inputMode="numeric"/></label><label><span>積分倍率</span><input value={multiplier} onChange={event=>setMultiplier(event.target.value)} inputMode="decimal"/></label></article><article className="admin-policy-card"><h2>積分記錄</h2><div className="admin-read-empty">積分記錄尚未啟用</div></article></div>
  </section>;
}

export function CouponsWorkspace(){
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [kind,setKind]=useState('FIXED');
  const [value,setValue]=useState('');
  return <section className="admin-editor-page">
    <MigrationHeader title="優惠券" description="只管理優惠券規則；相關計價同結帳功能未啟用前，唔會影響訂單金額。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>優惠券草稿</h2><label><span>名稱</span><input value={name} onChange={event=>setName(event.target.value)}/></label><label><span>優惠碼</span><input value={code} onChange={event=>setCode(event.target.value)}/></label><label><span>類型</span><select value={kind} onChange={event=>setKind(event.target.value)}><option value="FIXED">固定金額</option><option value="PERCENT">百分比</option></select></label><label><span>數值</span><input value={value} onChange={event=>setValue(event.target.value)}/></label></article><article className="admin-policy-card"><h2>訂單金額影響</h2><div className="admin-read-empty">優惠計價尚未啟用</div></article></div>
  </section>;
}

export function RfmWorkspace(){
  const [range,setRange]=useState('90');
  return <section className="admin-editor-page">
    <MigrationHeader title="客戶分群分析" description="提供分析入口；所有指標只會讀取正式報表資料。"/>
    <div className="admin-filterbar"><label><span>分析日數</span><input value={range} onChange={event=>setRange(event.target.value)} inputMode="numeric"/></label><button disabled>分析未接駁</button></div>
    <div className="admin-kpi-grid"><article><span>近期消費</span><strong>—</strong><small>尚未啟用</small></article><article><span>消費頻率</span><strong>—</strong><small>尚未啟用</small></article><article><span>高價值顧客</span><strong>—</strong><small>尚未啟用</small></article><article><span>可能流失</span><strong>—</strong><small>尚未啟用</small></article></div>
  </section>;
}

export function AnnouncementsWorkspace(){
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [audience,setAudience]=useState('ALL_STAFF');
  return <section className="admin-editor-page">
    <MigrationHeader title="公告／通知" description="提供公告編輯介面；通知發送功能尚未啟用。"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>公告草稿</h2><label><span>標題</span><input value={title} onChange={event=>setTitle(event.target.value)}/></label><label><span>內容</span><textarea rows={6} value={body} onChange={event=>setBody(event.target.value)}/></label><label><span>對象</span><select value={audience} onChange={event=>setAudience(event.target.value)}><option value="ALL_STAFF">全部員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option></select></label></article><article className="admin-policy-card"><h2>發送狀態</h2><div className="admin-read-empty">通知發送尚未啟用</div></article></div>
  </section>;
}

export function AdvancedWorkspace(){
  const [rawMaterials,setRawMaterials]=useState(false);
  const [diagnostics,setDiagnostics]=useState(false);
  const [developer,set技術支援]=useState(false);
  return <section className="admin-editor-page">
    <MigrationHeader title="進階設定" description="低頻或高風險功能目前只提供入口；未正式批准前唔會啟用任何連接。"/>
    <div className="admin-policy-grid">
      <article className="admin-policy-card"><h2>原材料</h2><label className="admin-toggle"><input type="checkbox" checked={rawMaterials} onChange={event=>setRawMaterials(event.target.checked)}/><span>顯示原材料進階功能</span></label><span className="admin-not-wired-chip">稍後開放</span></article>
      <article className="admin-policy-card"><h2>系統狀態</h2><label className="admin-toggle"><input type="checkbox" checked={diagnostics} onChange={event=>setDiagnostics(event.target.checked)}/><span>顯示診斷工具</span></label><span className="admin-not-wired-chip">稍後開放</span></article>
      <article className="admin-policy-card"><h2>技術支援</h2><label className="admin-toggle"><input type="checkbox" checked={developer} onChange={event=>set技術支援(event.target.checked)}/><span>顯示開發工具</span></label><span className="admin-not-wired-chip">稍後開放</span></article>
    </div>
  </section>;
}
