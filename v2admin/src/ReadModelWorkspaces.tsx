import {useState} from 'react';

function ReadHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>MFK READ MODEL · NOT_WIRED</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" disabled>Refresh 未接駁</button></div>
  </header>;
}

export function OverviewWorkspace(){
  return <section className="admin-editor-page">
    <ReadHeader title="營運總覽" description="Admin 首頁只聚合 MFK read models、Readiness 同 Pending Changes；唔持有交易 mutation。"/>
    <div className="admin-kpi-grid">
      {[
        ['今日銷售','—','REPORTING_NOT_WIRED'],
        ['訂單','—','ORDER_READ_NOT_WIRED'],
        ['待處理','—','ACTION_QUEUE_NOT_WIRED'],
        ['目前 Menu','—','CONFIG_READ_NOT_WIRED'],
      ].map(([label,value,state])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{state}</small></article>)}
    </div>
    <div className="admin-overview-columns">
      <section className="admin-read-card"><header><h2>Readiness</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">未接 MFK readiness read model。</div></section>
      <section className="admin-read-card"><header><h2>Pending Changes</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">未接 Admin published / draft revision readback。</div></section>
      <section className="admin-read-card"><header><h2>Action Queue</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">未接 canonical exception/action projection。</div></section>
    </div>
  </section>;
}

export function CapacityWorkspace(){
  const [dailyLimit,setDailyLimit]=useState('');
  const [warningAt,setWarningAt]=useState('80');
  const [hardStop,setHardStop]=useState(false);
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>CAPACITY POLICY · NOT_WIRED</small><h1>每日產能／原料額度</h1><p>設定提示／容量 policy；預設唔可以無聲變成交易 blocker。</p></div><div className="admin-editor-actions"><button className="publish" disabled>Publish 未接駁</button></div></header>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>每日容量</h2><label><span>每日上限（空白 = 無設定）</span><input inputMode="numeric" value={dailyLimit} onChange={event=>setDailyLimit(event.target.value)} placeholder="例如 300"/></label><label><span>提醒門檻 %</span><input inputMode="numeric" value={warningAt} onChange={event=>setWarningAt(event.target.value)}/></label></article>
      <article className="admin-policy-card"><h2>行為</h2><label className="admin-toggle"><input type="checkbox" checked={hardStop} onChange={event=>setHardStop(event.target.checked)}/><span>Hard stop（預設 OFF；需要獨立 authority review）</span></label><div className="admin-callout compact">目前只做 policy shape；唔會影響 SMT 接單。</div></article>
    </div>
  </section>;
}

export function OpenOrdersWorkspace(){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('ALL');
  return <section className="admin-editor-page">
    <ReadHeader title="進行中訂單" description="Admin 只讀正式 MFK Order / Fulfillment projection；所有操作之後都要調 canonical command。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Order / Pickup / External reference"/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">全部狀態</option><option value="PENDING">待處理</option><option value="PRODUCTION">製作中</option><option value="READY">可取餐</option></select><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>Order</span><span>來源</span><span>金額</span><span>狀態</span><span>時間</span></header><div className="admin-read-empty">ORDER_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}


export function OrdersHistoryWorkspace(){
  const [query,setQuery]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <ReadHeader title="訂單歷史" description="只讀正式 MFK Order history。Admin 唔建立第二份訂單資料。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Order / Pickup / External reference"/><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>Order</span><span>來源</span><span>金額</span><span>狀態</span><span>完成時間</span></header><div className="admin-read-empty">ORDER_HISTORY_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}

export function ExceptionsWorkspace(){
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('PAYMENT');
  return <section className="admin-editor-page">
    <ReadHeader title="退款／異常" description="只提供查詢／治理入口。Refund、Tender Correction、Cancel 等 mutation 必須由各自 MFK domain command 執行。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>查詢</h2><label><span>類型</span><select value={kind} onChange={event=>setKind(event.target.value)}><option value="PAYMENT">Payment / Tender</option><option value="REFUND">Refund</option><option value="CANCEL">Cancel</option><option value="PRINT">Print</option></select></label><label><span>Order / Transaction</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="輸入 identity"/></label><button disabled>查詢未接駁</button></article>
      <article className="admin-read-card"><header><h2>Result</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">未有 canonical exception readback。</div></article>
    </div>
  </section>;
}

export function SalesReportWorkspace(){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <ReadHeader title="銷售報表" description="所有數字只可來自 MFK canonical reporting projection；Admin 唔自行重算交易 truth。"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button disabled>讀取未接駁</button></div>
    <div className="admin-kpi-grid"><article><span>Gross</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Adjustments</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Net</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Orders</span><strong>—</strong><small>NOT_WIRED</small></article></div>
    <section className="admin-read-table"><header><span>日期</span><span>Gross</span><span>Adjustment</span><span>Net</span><span>Orders</span></header><div className="admin-read-empty">REPORTING_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}

export function OperationsReportWorkspace(){
  return <section className="admin-editor-page">
    <ReadHeader title="營運報表" description="營運效率、Fulfillment、Channel、Print health 只讀 MFK projection。"/>
    <div className="admin-kpi-grid"><article><span>Avg Fulfillment</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Delayed</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Print Exceptions</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Channel Exceptions</span><strong>—</strong><small>NOT_WIRED</small></article></div>
    <section className="admin-read-card"><header><h2>Operations Timeline</h2><span>NOT_WIRED</span></header><div className="admin-read-empty">OPERATIONS_REPORT_NOT_WIRED</div></section>
  </section>;
}

export function AuditWorkspace(){
  const [actor,setActor]=useState('');
  const [domain,setDomain]=useState('ALL');
  return <section className="admin-editor-page">
    <ReadHeader title="操作記錄" description="Audit 只讀不可變事件 custody；唔代替 Domain truth。"/>
    <div className="admin-filterbar"><input value={actor} onChange={event=>setActor(event.target.value)} placeholder="Actor / identity"/><select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部 Domain</option><option value="ADMIN_CONFIG">Admin Config</option><option value="ORDER">Order</option><option value="PAYMENT">Payment</option><option value="PRINT">Print</option><option value="CHANNEL">Channel</option></select><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>時間</span><span>Actor</span><span>Domain</span><span>Action</span><span>Result</span></header><div className="admin-read-empty">AUDIT_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}
