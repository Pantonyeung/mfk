import {useState} from 'react';
import {Link} from 'react-router';

function ReadHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>資料尚未啟用</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" disabled>重新整理尚未開放</button></div>
  </header>;
}

export function OverviewWorkspace(){
  const readiness=[
    ['菜單／設定','UNKNOWN','/admin/publish'],
    ['Channel','UNKNOWN','/admin/channels'],
    ['裝置／打印機','UNKNOWN','/admin/devices'],
    ['營業日記錄','UNKNOWN','/admin/business-day'],
  ] as const;
  return <section className="admin-editor-page">
    <ReadHeader title="今日" description="每日營運入口：顯示準備狀態、核心數字、待發布變更同待處理事項。首頁只顯示狀態，真正操作會帶你去相應頁面。"/>
    <div className="admin-kpi-grid">
      {[
        ['今日銷售','—','REPORTING_尚未啟用'],
        ['訂單','—','ORDER_READ_尚未啟用'],
        ['待處理','—','ACTION_QUEUE_尚未啟用'],
        ['目前菜單','—','CONFIG_READ_尚未啟用'],
      ].map(([label,value,state])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{state}</small></article>)}
    </div>
    <div className="admin-overview-columns">
      <section className="admin-read-card">
        <header><h2>營運準備</h2><span>尚未啟用</span></header>
        <div className="admin-editor-list">
          {readiness.map(([label,state,path])=><article className="admin-policy-row" key={label}><span>{label}</span><b>{state}</b><Link to={path}>前往責任頁</Link></article>)}
        </div>
        <small>營運準備 只係狀態聚合；Degraded / Unknown 唔會自動變成 transaction blocker。</small>
      </section>
      <section className="admin-read-card"><header><h2>待發布變更</h2><span>尚未啟用</span></header><div className="admin-read-empty">未啟用已發布版本同草稿版本讀取。</div><Link to="/admin/publish">開啟 待發布變更</Link></section>
      <section className="admin-read-card"><header><h2>待處理事項</h2><span>尚未啟用</span></header><div className="admin-read-empty">待處理事項資料尚未啟用。</div><Link to="/admin/action-queue">開啟 待處理事項</Link></section>
    </div>
  </section>;
}
export function CapacityWorkspace(){
  const [dailyLimit,setDailyLimit]=useState('');
  const [warningAt,setWarningAt]=useState('80');
  const [hardStop,setHardStop]=useState(false);
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>CAPACITY POLICY · 尚未啟用</small><h1>每日產能／原料額度</h1><p>設定提示同產能規則；預設唔會無聲阻止交易。</p></div><div className="admin-editor-actions"><button className="publish" disabled>尚未可發布</button></div></header>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>每日容量</h2><label><span>每日上限（空白 = 無設定）</span><input inputMode="numeric" value={dailyLimit} onChange={event=>setDailyLimit(event.target.value)} placeholder="例如 300"/></label><label><span>提醒門檻 %</span><input inputMode="numeric" value={warningAt} onChange={event=>setWarningAt(event.target.value)}/></label></article>
      <article className="admin-policy-card"><h2>行為</h2><label className="admin-toggle"><input type="checkbox" checked={hardStop} onChange={event=>setHardStop(event.target.checked)}/><span>強制停止（預設關閉；啟用前需要額外確認）</span></label><div className="admin-callout compact">目前只提供設定介面；唔會影響門店接單。</div></article>
    </div>
  </section>;
}

export function OpenOrdersWorkspace(){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('ALL');
  return <section className="admin-editor-page">
    <ReadHeader title="進行中訂單" description="呢度只顯示正式訂單同出餐狀態；任何操作都會由相應功能處理。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單／取餐／平台參考編號"/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">全部狀態</option><option value="PENDING">待處理</option><option value="PRODUCTION">製作中</option><option value="READY">可取餐</option></select><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>訂單</span><span>來源</span><span>金額</span><span>狀態</span><span>時間</span></header><div className="admin-read-empty">ORDER_READ_MODEL_尚未啟用</div></section>
  </section>;
}


export function OrdersHistoryWorkspace(){
  const [query,setQuery]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <ReadHeader title="訂單歷史" description="只顯示正式訂單記錄，唔會另外建立一份訂單資料。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單／取餐／平台參考編號"/><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>訂單</span><span>來源</span><span>金額</span><span>狀態</span><span>完成時間</span></header><div className="admin-read-empty">ORDER_HISTORY_READ_MODEL_尚未啟用</div></section>
  </section>;
}

export function ExceptionsWorkspace(){
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('PAYMENT');
  return <section className="admin-editor-page">
    <ReadHeader title="退款／異常" description="只提供查詢同處理入口。退款、更改付款方式、取消等操作會由相應功能執行。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>查詢</h2><label><span>類型</span><select value={kind} onChange={event=>setKind(event.target.value)}><option value="PAYMENT">付款方式</option><option value="REFUND">退款</option><option value="CANCEL">取消</option><option value="PRINT">打印</option></select></label><label><span>訂單／交易</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="輸入編號"/></label><button disabled>查詢未接駁</button></article>
      <article className="admin-read-card"><header><h2>結果</h2><span>尚未啟用</span></header><div className="admin-read-empty">未有正式異常資料。</div></article>
    </div>
  </section>;
}

export function SalesReportWorkspace(){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <ReadHeader title="銷售報表" description="所有數字只會讀取正式報表資料，後台唔會自行重算交易結果。"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button disabled>讀取未接駁</button></div>
    <div className="admin-kpi-grid"><article><span>總額</span><strong>—</strong><small>尚未啟用</small></article><article><span>調整</span><strong>—</strong><small>尚未啟用</small></article><article><span>淨額</span><strong>—</strong><small>尚未啟用</small></article><article><span>訂單</span><strong>—</strong><small>尚未啟用</small></article></div>
    <section className="admin-read-table"><header><span>日期</span><span>總額</span><span>調整</span><span>淨額</span><span>訂單</span></header><div className="admin-read-empty">REPORTING_READ_MODEL_尚未啟用</div></section>
  </section>;
}

export function OperationsReportWorkspace(){
  return <section className="admin-editor-page">
    <ReadHeader title="營運報表" description="營運效率、出餐、平台同打印狀態只讀取正式資料。"/>
    <div className="admin-kpi-grid"><article><span>平均出餐時間</span><strong>—</strong><small>尚未啟用</small></article><article><span>延誤</span><strong>—</strong><small>尚未啟用</small></article><article><span>打印異常</span><strong>—</strong><small>尚未啟用</small></article><article><span>平台異常</span><strong>—</strong><small>尚未啟用</small></article></div>
    <section className="admin-read-card"><header><h2>營運時間線</h2><span>尚未啟用</span></header><div className="admin-read-empty">OPERATIONS_REPORT_尚未啟用</div></section>
  </section>;
}

export function AuditWorkspace(){
  const [actor,setActor]=useState('');
  const [domain,setDomain]=useState('ALL');
  return <section className="admin-editor-page">
    <ReadHeader title="操作記錄" description="操作記錄只供查閱，唔會改動任何正式資料。"/>
    <div className="admin-filterbar"><input value={actor} onChange={event=>setActor(event.target.value)} placeholder="操作人／編號"/><select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部範圍</option><option value="ADMIN_CONFIG">後台設定</option><option value="ORDER">訂單</option><option value="PAYMENT">付款</option><option value="PRINT">打印</option><option value="CHANNEL">平台</option></select><button disabled>搜尋未接駁</button></div>
    <section className="admin-read-table"><header><span>時間</span><span>操作人</span><span>範圍</span><span>操作</span><span>結果</span></header><div className="admin-read-empty">AUDIT_READ_MODEL_尚未啟用</div></section>
  </section>;
}
