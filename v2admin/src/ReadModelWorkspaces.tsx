import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router';
import {useAdminDraft,validateAdminDraft} from './admin-draft.tsx';
import {readAdminAudit,readAdminReleases,readAdminStored,usePersistentAdminState} from './admin-local-store.ts';

function ReadHeader({title,description,badge='只讀資料'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head"><div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div></header>;
}
const money=(minor:number)=>'HK$'+(minor/100).toFixed(2);

export function OverviewWorkspace(){
  const {draft,dirty}=useAdminDraft();
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    const bump=()=>setTick(value=>value+1);
    window.addEventListener('mfk-admin-audit',bump);
    window.addEventListener('mfk-admin-release',bump);
    return()=>{window.removeEventListener('mfk-admin-audit',bump);window.removeEventListener('mfk-admin-release',bump);};
  },[]);
  void tick;
  const errors=validateAdminDraft(draft);
  const releases=readAdminReleases();
  const audit=readAdminAudit();
  const printers=readAdminStored<Array<{active:boolean}>>('logical-printers.v1',[]);
  const staff=readAdminStored<Array<{active:boolean}>>('staff.v1',[]);
  const readiness=[
    ['菜單資料',errors.length===0?'就緒':errors.length+' 項問題','/admin/catalog/products'],
    ['設定版本',releases[0]?'R'+releases[0].version:'未建立','/admin/publish'],
    ['打印用途',printers.length?printers.filter(row=>row.active).length+' 個啟用':'未設定','/admin/print'],
    ['人員權限',staff.length?staff.filter(row=>row.active).length+' 人啟用':'未設定','/admin/staff'],
  ] as const;
  return <section className="admin-editor-page">
    <ReadHeader title="今日" description="Admin 每日入口：先睇資料完整度、待發布變更、最近設定活動同需要處理嘅問題。"/>
    <div className="admin-kpi-grid">
      <article><span>商品</span><strong>{draft.products.length}</strong><small>{draft.products.filter(row=>row.active).length} 啟用</small></article>
      <article><span>選項組／套餐</span><strong>{draft.modifierGroups.length} / {draft.combos.length}</strong><small>菜單結構</small></article>
      <article><span>待發布變更</span><strong>{dirty?'1':'0'}</strong><small>{dirty?'有草稿變更':'草稿已對齊版本'}</small></article>
      <article><span>資料問題</span><strong>{errors.length}</strong><small>{errors.length?'需要處理':'完整性通過'}</small></article>
    </div>
    <div className="admin-overview-columns">
      <section className="admin-read-card">
        <header><h2>營運準備</h2><span>{errors.length?'需處理':'Admin 就緒'}</span></header>
        <div className="admin-editor-list">{readiness.map(([label,state,path])=><article className="admin-policy-row" key={label}><span>{label}</span><b>{state}</b><Link to={path}>前往</Link></article>)}</div>
        <small>Readiness 只係狀態聚合，唔會變成門店交易 blocker。</small>
      </section>
      <section className="admin-read-card"><header><h2>待發布變更</h2><span>{dirty?'有變更':'冇變更'}</span></header><div className="admin-read-empty">{dirty?'草稿已有修改，請先完成檢查同建立設定版本。':'目前冇未發布草稿變更。'}</div><Link to="/admin/publish">查看版本管理</Link></section>
      <section className="admin-read-card"><header><h2>最近操作</h2><span>{audit.length}</span></header>{audit.length?<div className="admin-editor-list">{audit.slice(0,5).map(row=><article key={row.id}><b>{row.action}</b><small>{row.target} · {new Date(row.at).toLocaleString('zh-HK')}</small></article>)}</div>:<div className="admin-read-empty">未有操作記錄。</div>}<Link to="/admin/system/audit">查看全部</Link></section>
    </div>
  </section>;
}

interface CapacityConfig{dailyLimit:string;warningAt:number;hardStop:boolean;note:string}
export function CapacityWorkspace(){
  const [config,setConfig]=usePersistentAdminState<CapacityConfig>('capacity.v1',{dailyLimit:'',warningAt:80,hardStop:false,note:''});
  return <section className="admin-editor-page">
    <ReadHeader title="每日產能／原料額度" description="設定提示、每日容量同注意事項。預設只提醒；強制停止屬高風險設定，正式接入前仍需 authority review。" badge="已自動保存設定"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>每日容量</h2><label><span>每日上限（空白 = 無設定）</span><input inputMode="numeric" value={config.dailyLimit} onChange={event=>setConfig({...config,dailyLimit:event.target.value})}/></label><label><span>提醒門檻 %</span><input type="number" min={1} max={100} value={config.warningAt} onChange={event=>setConfig({...config,warningAt:Number(event.target.value)||80})}/></label><label><span>備註</span><textarea rows={4} value={config.note} onChange={event=>setConfig({...config,note:event.target.value})}/></label></article>
      <article className="admin-policy-card"><h2>行為</h2><label className="admin-toggle"><input type="checkbox" checked={config.hardStop} onChange={event=>setConfig({...config,hardStop:event.target.checked})}/><span>強制停止（預設關閉）</span></label><div className="admin-callout compact">產能／庫存設定唔可以無聲成為第二套交易 authority。</div></article>
    </div>
  </section>;
}

interface OrderReadRow{orderId:string;source:string;amountMinor:number;status:string;createdAt:string;completedAt?:string;pickupCode?:string;externalRef?:string}
function useOrderRows(){
  return usePersistentAdminState<OrderReadRow[]>('orders-read.v1',[]);
}
export function OpenOrdersWorkspace(){
  const [rows]=useOrderRows();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('ALL');
  const filtered=rows.filter(row=>!row.completedAt&&(status==='ALL'||row.status===status)&&(!query||[row.orderId,row.pickupCode,row.externalRef].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())));
  return <section className="admin-editor-page">
    <ReadHeader title="進行中訂單" description="只讀正式 Order projection。Admin 唔建立第二份訂單 truth，亦唔喺呢個頁面直接改交易。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單／取餐／平台參考編號"/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="ALL">全部狀態</option><option value="PENDING">待處理</option><option value="PRODUCTION">進行中</option><option value="READY">可取餐</option></select><span>{filtered.length} 張</span></div>
    {filtered.length===0?<div className="admin-read-empty">目前未有正式訂單資料。介面同查詢條件已完成，未接 read model 前唔會製造假訂單。</div>:<section className="admin-read-table"><header><span>訂單</span><span>來源</span><span>金額</span><span>狀態</span><span>時間</span></header>{filtered.map(row=><article key={row.orderId}><span>{row.orderId}</span><span>{row.source}</span><span>{money(row.amountMinor)}</span><span>{row.status}</span><span>{new Date(row.createdAt).toLocaleString('zh-HK')}</span></article>)}</section>}
  </section>;
}

export function OrdersHistoryWorkspace(){
  const [rows]=useOrderRows();
  const [query,setQuery]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const filtered=rows.filter(row=>row.completedAt&&(!query||[row.orderId,row.pickupCode,row.externalRef].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()))&&(!from||row.completedAt!.slice(0,10)>=from)&&(!to||row.completedAt!.slice(0,10)<=to));
  return <section className="admin-editor-page">
    <ReadHeader title="訂單歷史" description="查詢正式 Order history；Admin 唔複製另一份交易資料。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單／取餐／平台參考編號"/><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><span>{filtered.length} 張</span></div>
    {filtered.length===0?<div className="admin-read-empty">目前未有正式訂單歷史資料。</div>:<section className="admin-read-table"><header><span>訂單</span><span>來源</span><span>金額</span><span>狀態</span><span>完成時間</span></header>{filtered.map(row=><article key={row.orderId}><span>{row.orderId}</span><span>{row.source}</span><span>{money(row.amountMinor)}</span><span>{row.status}</span><span>{row.completedAt?new Date(row.completedAt).toLocaleString('zh-HK'):'—'}</span></article>)}</section>}
  </section>;
}

interface ExceptionReadRow{id:string;orderId:string;kind:'PAYMENT'|'REFUND'|'CANCEL'|'PRINT';state:'OPEN'|'UNKNOWN'|'RESOLVED';reason:string;updatedAt:string}
export function ExceptionsWorkspace(){
  const [rows]=usePersistentAdminState<ExceptionReadRow[]>('exceptions-read.v1',[]);
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('ALL');
  const filtered=rows.filter(row=>(kind==='ALL'||row.kind===kind)&&(!query||row.orderId.includes(query)||row.id.includes(query)));
  return <section className="admin-editor-page">
    <ReadHeader title="退款／異常" description="集中查詢 Refund、Tender Correction、Cancel、Print exception。真正 mutation 仍交返責任 domain，Unknown 唔會被當 Failed。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單／事件編號"/><select value={kind} onChange={event=>setKind(event.target.value)}><option value="ALL">全部類型</option><option value="PAYMENT">付款方式</option><option value="REFUND">退款</option><option value="CANCEL">取消</option><option value="PRINT">打印</option></select><span>{filtered.length} 項</span></div>
    {filtered.length===0?<div className="admin-read-empty">目前未有正式異常／退款資料。</div>:<section className="admin-read-table"><header><span>事件</span><span>訂單</span><span>類型</span><span>狀態</span><span>更新</span></header>{filtered.map(row=><article key={row.id}><span>{row.id}</span><span>{row.orderId}</span><span>{row.kind}</span><span>{row.state}</span><span>{new Date(row.updatedAt).toLocaleString('zh-HK')}</span></article>)}</section>}
  </section>;
}

interface SalesMetricRow{date:string;grossMinor:number;adjustmentMinor:number;netMinor:number;orders:number}
export function SalesReportWorkspace(){
  const [rows]=usePersistentAdminState<SalesMetricRow[]>('report-sales.v1',[]);
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const filtered=rows.filter(row=>(!from||row.date>=from)&&(!to||row.date<=to));
  const total=(key:'grossMinor'|'adjustmentMinor'|'netMinor'|'orders')=>filtered.reduce((sum,row)=>sum+row[key],0);
  return <section className="admin-editor-page">
    <ReadHeader title="銷售報表" description="固定可信 Sales read model；顯示 metricVersion / freshness / completeness 之前，Admin 唔會自行重算 transaction truth。"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><span>{filtered.length} 日</span></div>
    <div className="admin-kpi-grid"><article><span>總額</span><strong>{money(total('grossMinor'))}</strong><small>正式資料</small></article><article><span>調整</span><strong>{money(total('adjustmentMinor'))}</strong><small>退款／更正</small></article><article><span>淨額</span><strong>{money(total('netMinor'))}</strong><small>正式資料</small></article><article><span>訂單</span><strong>{total('orders')}</strong><small>完成訂單</small></article></div>
    {filtered.length===0?<div className="admin-read-empty">目前未有正式銷售 read model。報表結構、篩選同數字責任已完成，唔會用 demo 數字冒充正式報表。</div>:<section className="admin-read-table"><header><span>日期</span><span>總額</span><span>調整</span><span>淨額</span><span>訂單</span></header>{filtered.map(row=><article key={row.date}><span>{row.date}</span><span>{money(row.grossMinor)}</span><span>{money(row.adjustmentMinor)}</span><span>{money(row.netMinor)}</span><span>{row.orders}</span></article>)}</section>}
  </section>;
}

interface OpsMetric{businessDate:string;avgFulfillmentMinutes:number;delayed:number;printExceptions:number;channelExceptions:number}
export function OperationsReportWorkspace(){
  const [rows]=usePersistentAdminState<OpsMetric[]>('report-operations.v1',[]);
  const latest=rows[0];
  return <section className="admin-editor-page">
    <ReadHeader title="營運報表" description="固定可信 Operations read model：出餐、延誤、打印、平台異常，唔自行推算。"/>
    <div className="admin-kpi-grid"><article><span>平均出餐時間</span><strong>{latest?latest.avgFulfillmentMinutes+' 分鐘':'—'}</strong><small>{latest?.businessDate??'未有資料'}</small></article><article><span>延誤</span><strong>{latest?.delayed??'—'}</strong><small>正式資料</small></article><article><span>打印異常</span><strong>{latest?.printExceptions??'—'}</strong><small>正式資料</small></article><article><span>平台異常</span><strong>{latest?.channelExceptions??'—'}</strong><small>正式資料</small></article></div>
    {rows.length===0?<div className="admin-read-empty">目前未有正式營運 read model。</div>:<section className="admin-read-card"><header><h2>營運時間線</h2><span>{rows.length} 日</span></header>{rows.map(row=><article key={row.businessDate}>{row.businessDate} · 平均 {row.avgFulfillmentMinutes} 分鐘 · 延誤 {row.delayed}</article>)}</section>}
  </section>;
}

export function AuditWorkspace(){
  const [version,setVersion]=useState(0);
  useEffect(()=>{const bump=()=>setVersion(value=>value+1);window.addEventListener('mfk-admin-audit',bump);return()=>window.removeEventListener('mfk-admin-audit',bump);},[]);
  void version;
  const rows=readAdminAudit();
  const [query,setQuery]=useState('');
  const filtered=rows.filter(row=>!query||[row.action,row.target,row.reason].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="admin-editor-page">
    <ReadHeader title="操作記錄" description="Admin 設定 mutation 會留下不可變式操作記錄：時間、動作、目標、原因，以及可用嘅 before / after 摘要。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋動作／目標／原因"/><span>{filtered.length} 筆</span></div>
    {filtered.length===0?<div className="admin-read-empty">未有操作記錄。</div>:<section className="admin-read-table"><header><span>時間</span><span>動作</span><span>目標</span><span>原因</span><span>記錄 ID</span></header>{filtered.map(row=><article key={row.id}><span>{new Date(row.at).toLocaleString('zh-HK')}</span><span>{row.action}</span><span>{row.target}</span><span>{row.reason||'—'}</span><code>{row.id}</code></article>)}</section>}
  </section>;
}
