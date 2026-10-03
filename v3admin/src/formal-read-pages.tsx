import {useMemo,useState} from 'react';
import {useV3ReadModels,type V3ProjectedDay,type V3ProjectedOrder} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';
import type {AdminRefundEvent} from '../../contracts/admin-refund-v1.ts';

function money(minor:number){return 'HK$'+(Math.max(0,Number(minor)||0)/100).toFixed(2);}
function hkt(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}
function isCompleted(order:V3ProjectedOrder){
  return order.fulfillmentLabel==='已完成'||order.fulfillmentLabel==='已取消';
}
function statusTone(label:string){
  if(label.includes('完成')||label.includes('可取'))return 'good' as const;
  if(label.includes('取消'))return 'neutral' as const;
  if(label.includes('延誤')||label.includes('異常'))return 'warning' as const;
  return 'neutral' as const;
}

function OrderDetail({order,onClose}:{order:V3ProjectedOrder;onClose:()=>void}){
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>SMT Cloud Projection · 只讀</small><h2>{order.display||order.orderId}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-formal-draft-meta">
            <div><span>Order ID</span><strong>{order.orderId}</strong></div>
            <div><span>來源</span><strong>{order.sourceLabel}</strong></div>
            <div><span>金額</span><strong>{money(order.totalMinor)}</strong></div>
            <div><span>狀態</span><strong>{order.fulfillmentLabel}</strong></div>
            <div><span>付款</span><strong>{order.paymentLabel}</strong></div>
            <div><span>營業日</span><strong>{order.businessDate}</strong></div>
            <div><span>建立</span><strong>{hkt(order.createdAt)}</strong></div>
            <div><span>最後更新</span><strong>{hkt(order.updatedAt)}</strong></div>
          </div>
        </section>
        <section className="v3-functional-section"><h3>商品</h3><div className="v3-action-list">{order.items.map(item=><article key={item.id}><div><strong>{item.name}</strong><small>{item.id}</small></div><strong>× {item.qty}</strong><span>{money(item.unitMinor)}</span></article>)}</div></section>
        {order.staffName?<div className="v3-mobile-form-note">處理人員：{order.staffName}</div>:null}
        <div className="v3-mobile-form-note">Admin 只讀 SMT Projection；取消、退款、付款方式修正等 transaction mutation 唔喺 Admin 執行。</div>
      </div>
    </section>
  </div>;
}

export function FormalOrdersPage({mode}:{mode:'open'|'history'}){
  const read=useV3ReadModels();
  const [query,setQuery]=useState('');
  const [source,setSource]=useState('ALL');
  const [selected,setSelected]=useState<V3ProjectedOrder|null>(null);
  const rows=useMemo(()=>read.orders.filter(order=>{
    const modeMatch=mode==='open'?!isCompleted(order):isCompleted(order);
    const q=query.trim().toLocaleLowerCase();
    const queryMatch=!q||(order.orderId+' '+order.display+' '+order.sourceLabel+' '+order.items.map(item=>item.name).join(' ')).toLocaleLowerCase().includes(q);
    return modeMatch&&queryMatch&&(source==='ALL'||order.sourceLabel===source);
  }),[read.orders,mode,query,source]);
  const sources=[...new Set(read.orders.map(order=>order.sourceLabel).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-HK'));
  const title=mode==='open'?'進行中訂單':'訂單歷史';
  return <div className="v3-functional-page">
    <PageHeader eyebrow="訂單監察" title={title} description="真正讀 SMT Cloud Projection；Admin 保持只讀，唔成為 Order authority。" aside={<button type="button" disabled={read.ordersRefreshing} onClick={()=>void read.refresh()}>{read.ordersRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.ordersError?<div className="v3-error">未能讀取 SMT Projection：{read.ordersError.message}</div>:null}
    {read.ordersPending?<div className="v3-refreshing">正在讀取正式訂單 Projection…</div>:null}
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋訂單編號、來源、商品"/></div><div className="v3-product-selects"><label><span>來源</span><select value={source} onChange={event=>setSource(event.target.value)}><option value="ALL">全部來源</option>{sources.map(item=><option key={item}>{item}</option>)}</select></label></div></section>
    {!read.ordersPending&&!rows.length?<section className="v3-product-empty"><h2>{mode==='open'?'目前未有進行中訂單':'目前未有訂單歷史'}</h2><p>未有 authoritative projection 時唔會製造假訂單。</p></section>:<div className="v3-action-list">{rows.map(order=><article key={order.orderId} className="is-clickable" onClick={()=>setSelected(order)}><div><strong>{order.display||order.orderId}</strong><small>{order.sourceLabel} · {hkt(order.createdAt)}{order.staffName?' · '+order.staffName:''}</small></div><strong>{money(order.totalMinor)}</strong><StatusBadge tone={statusTone(order.fulfillmentLabel)}>{order.fulfillmentLabel}</StatusBadge></article>)}</div>}
    {selected?<OrderDetail order={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function total(rows:readonly V3ProjectedDay[],key:keyof Pick<V3ProjectedDay,'grossMinor'|'adjustmentMinor'|'netMinor'|'orders'|'cashSalesMinor'|'refundMinor'|'cashRefundMinor'>){
  return rows.reduce((sum,row)=>sum+Number(row[key]||0),0);
}

export function FormalSalesReportPage(){
  const read=useV3ReadModels();
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const rows=useMemo(()=>read.days.filter(row=>(!from||row.date>=from)&&(!to||row.date<=to)),[read.days,from,to]);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="銷售" description="由 SMT durable projection 讀取；Admin 報表只讀，唔成為 Order / Cash authority。" aside={<button type="button" disabled={read.reportsRefreshing} onClick={()=>void read.refresh()}>{read.reportsRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.reportsError?<div className="v3-error">未能讀取正式報表 Projection：{read.reportsError.message}</div>:null}
    {read.reportsPending?<div className="v3-refreshing">正在讀取正式銷售 Projection…</div>:null}
    <section className="v3-product-toolbar"><div className="v3-product-selects"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label></div></section>
    <section className="v3-whole-kpi-grid">
      <article><span>銷售總額</span><strong>{money(total(rows,'grossMinor'))}</strong><small>SMT projected gross</small></article>
      <article><span>退款總額</span><strong>{money(total(rows,'refundMinor'))}</strong><small>按實際退款日</small></article>
      <article><span>淨額</span><strong>{money(total(rows,'netMinor'))}</strong><small>gross - refund</small></article>
      <article><span>訂單數</span><strong>{total(rows,'orders')}</strong><small>projected orders</small></article>
    </section>
    {!read.reportsPending&&!rows.length?<section className="v3-product-empty"><h2>目前未有銷售 Projection</h2><p>未有正式資料時唔會顯示假 HK$0 當成功結果。</p></section>:<div className="v3-price-edit-list">{rows.map(row=><article key={row.date}><div><strong>{row.date}</strong><small>現金銷售 {money(row.cashSalesMinor)} · 現金退款 {money(Number(row.cashRefundMinor||0))}</small></div><strong>{money(row.netMinor)}</strong><StatusBadge tone="good">{row.orders} 張單</StatusBadge></article>)}</div>}
  </div>;
}

export function FormalTodayPage({onNavigate}:{onNavigate:(path:string)=>void}){
  const read=useV3ReadModels();
  const latest=read.days[0];
  const openOrders=read.orders.filter(order=>!isCompleted(order));
  const refundMinor=Number(latest?.refundMinor||0);
  const grossMinor=Number(latest?.grossMinor||0);
  const orderCount=Number(latest?.orders||0);
  const aov=orderCount>0?Math.round(grossMinor/orderCount):0;
  const hasData=Boolean(latest);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="今日" title="營運總覽" description="首頁生意數字直接讀 SMT Cloud Projection；未有資料會顯示未知／未同步，唔會冒充 0。"/>
    {(read.ordersError||read.reportsError)?<div className="v3-error">正式 Projection 暫時未能確認。{read.ordersError?.message??read.reportsError?.message}</div>:null}
    <section className="v3-whole-kpi-grid">
      <article><span>今日有效營業額</span><strong>{hasData?money(Number(latest.netMinor||0)):'—'}</strong><small>{hasData?latest.date:'未有正式 Projection'}</small><StatusBadge tone={hasData?'good':'unknown'}>{hasData?'正式 Projection':'結果未明'}</StatusBadge></article>
      <article><span>訂單數</span><strong>{hasData?orderCount:'—'}</strong><small>{openOrders.length} 張進行中</small></article>
      <article><span>平均客單價</span><strong>{hasData?money(aov):'—'}</strong><small>gross ÷ orders</small></article>
      <article><span>退款／調整</span><strong>{hasData?money(refundMinor):'—'}</strong><small>按實際退款日</small></article>
    </section>
    <section className="v3-whole-two-col">
      <article className="v3-whole-panel"><header><h2>今日訂單流</h2><button type="button" onClick={()=>onNavigate('/admin/orders/open')}>查看進行中訂單</button></header><div className="v3-readiness-stack"><div><span>進行中</span><StatusBadge tone={openOrders.length?'warning':'good'}>{openOrders.length} 張</StatusBadge></div><div><span>Projection</span><StatusBadge tone={read.ordersError?'unknown':'good'}>{read.ordersError?'結果未明':'已讀取'}</StatusBadge></div></div></article>
      <article className="v3-whole-panel"><header><h2>銷售詳情</h2><button type="button" onClick={()=>onNavigate('/admin/reports/sales')}>查看銷售報表</button></header><div className="v3-readiness-stack"><div><span>現金銷售</span><strong>{hasData?money(latest.cashSalesMinor):'—'}</strong></div><div><span>淨額</span><strong>{hasData?money(latest.netMinor):'—'}</strong></div></div></article>
    </section>
  </div>;
}


function RefundDetail({refund,onClose}:{refund:AdminRefundEvent;onClose:()=>void}){
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>正式退款事件 · 只讀</small><h2>{refund.display||refund.orderId}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-formal-draft-meta">
            <div><span>Refund ID</span><strong>{refund.refundId}</strong></div>
            <div><span>Order ID</span><strong>{refund.orderId}</strong></div>
            <div><span>退款金額</span><strong>{money(refund.amountMinor)}</strong></div>
            <div><span>退款方式</span><strong>{refund.method}</strong></div>
            <div><span>原營業日</span><strong>{refund.originalBusinessDate}</strong></div>
            <div><span>執行營業日</span><strong>{refund.executionBusinessDate}</strong></div>
            <div><span>執行時間</span><strong>{hkt(refund.executionAt)}</strong></div>
            <div><span>Addendum</span><strong>{refund.addendumVersionLabel}</strong></div>
          </div>
        </section>
        <section className="v3-functional-section"><h3>退款項目</h3><div className="v3-action-list">{refund.lines.map(line=><article key={line.lineId}><div><strong>{line.itemName}</strong><small>{line.lineId}</small></div><strong>× {line.quantity}</strong><span>{money(line.amountMinor)}</span></article>)}</div></section>
        {refund.note?<div className="v3-mobile-form-note">{refund.note}</div>:null}
        <div className="v3-mobile-form-note">Admin 呢頁只讀已完成正式退款事件；退款 mutation 唔喺 V3 Admin 執行。</div>
      </div>
    </section>
  </div>;
}

export function FormalOrderExceptionsPage(){
  const read=useV3ReadModels();
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<AdminRefundEvent|null>(null);
  const rows=read.refunds.filter(refund=>!query.trim()||(refund.refundId+' '+refund.orderId+' '+refund.display+' '+refund.lines.map(line=>line.itemName).join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="v3-functional-page">
    <PageHeader eyebrow="訂單監察" title="訂單異常" description="目前正式可讀 evidence 先接退款事件；付款修正、取消、打印異常要等各自 server read model，唔會用假資料補。" aside={<button type="button" disabled={read.refundsRefreshing} onClick={()=>void read.refresh()}>{read.refundsRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.refundsError?<div className="v3-error">未能讀取正式退款 evidence：{read.refundsError.message}</div>:null}
    <div className="v3-mobile-form-note">Coverage：REFUND 已接正式 server evidence；PAYMENT / CANCEL / PRINT exception aggregation 尚未有 V3 verified read seam。</div>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋退款／訂單／商品"/></div></section>
    {read.refundsPending?<div className="v3-refreshing">正在讀取正式退款 evidence…</div>:!rows.length?<section className="v3-product-empty"><h2>目前未有正式退款事件</h2></section>:<div className="v3-action-list">{rows.map(refund=><article key={refund.refundId} className="is-clickable" onClick={()=>setSelected(refund)}><div><strong>{refund.display||refund.orderId}</strong><small>{refund.refundId} · {refund.executionBusinessDate} · {refund.method}</small></div><strong>{money(refund.amountMinor)}</strong><StatusBadge tone="good">已退款</StatusBadge></article>)}</div>}
    {selected?<RefundDetail refund={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function FormalRefundReportPage(){
  const read=useV3ReadModels();
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const rows=read.refunds.filter(refund=>(!from||refund.executionBusinessDate>=from)&&(!to||refund.executionBusinessDate<=to));
  const amount=rows.reduce((sum,refund)=>sum+refund.amountMinor,0);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="退款" description="正式退款報表直接讀 server refund evidence；按實際退款執行日統計。" aside={<button type="button" disabled={read.refundsRefreshing} onClick={()=>void read.refresh()}>{read.refundsRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.refundsError?<div className="v3-error">{read.refundsError.message}</div>:null}
    <section className="v3-product-toolbar"><div className="v3-product-selects"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label></div></section>
    <section className="v3-whole-kpi-grid"><article><span>退款總額</span><strong>{money(amount)}</strong><small>{rows.length} 筆</small></article><article><span>退款事件</span><strong>{rows.length}</strong><small>正式 evidence</small></article><article><span>Addenda</span><strong>{read.refundAddenda.length}</strong><small>Day-close non-posting reference</small></article></section>
    <div className="v3-price-edit-list">{rows.map(refund=><article key={refund.refundId}><div><strong>{refund.display||refund.orderId}</strong><small>{refund.executionBusinessDate} · {refund.method} · {refund.addendumVersionLabel}</small></div><strong>{money(refund.amountMinor)}</strong><StatusBadge tone="good">已確認</StatusBadge></article>)}</div>
  </div>;
}
