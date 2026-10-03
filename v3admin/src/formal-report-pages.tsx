import {useMemo,useState} from 'react';
import {useV3ReadModels,type V3ProjectedOrder} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function money(minor:number){return 'HK$'+(Number(minor||0)/100).toFixed(2);}
function completedSalesOrders(orders:readonly V3ProjectedOrder[]){
  return orders.filter(order=>order.fulfillmentLabel==='已完成');
}
function csvCell(value:unknown){
  const text=String(value??'');
  return /[",\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}
function downloadCsv(filename:string,rows:readonly (readonly unknown[])[]){
  if(typeof window==='undefined')return;
  const content='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  URL.revokeObjectURL(url);
}

export function FormalProductReportPage(){
  const read=useV3ReadModels();
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>{
    const map=new Map<string,{id:string;name:string;qty:number;grossMinor:number;orders:Set<string>}>();
    for(const order of completedSalesOrders(read.orders)){
      for(const item of order.items){
        const key=item.id||item.name;
        const current=map.get(key)??{id:item.id,name:item.name,qty:0,grossMinor:0,orders:new Set<string>()};
        current.qty+=Number(item.qty||0);
        current.grossMinor+=Number(item.qty||0)*Number(item.unitMinor||0);
        current.orders.add(order.orderId);
        map.set(key,current);
      }
    }
    const needle=query.trim().toLocaleLowerCase();
    return [...map.values()].filter(item=>!needle||(item.name+' '+item.id).toLocaleLowerCase().includes(needle)).sort((a,b)=>b.grossMinor-a.grossMinor||b.qty-a.qty);
  },[read.orders,query]);

  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="產品" description="由 SMT 已完成訂單 Projection 即時計算商品件數同銷售額；唔建立第二 Sales authority。" aside={<button type="button" disabled={read.ordersRefreshing} onClick={()=>void read.refresh()}>{read.ordersRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.ordersError?<div className="v3-error">{read.ordersError.message}</div>:null}
    <div className="v3-mobile-form-note">數字係由 authoritative Order Projection 派生；未有正式 Projection 時唔會補假排行榜。</div>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品"/></div></section>
    {read.ordersPending?<div className="v3-refreshing">正在讀取正式訂單 Projection…</div>:!rows.length?<section className="v3-product-empty"><h2>目前未有可計算產品報表嘅已完成訂單</h2></section>:<div className="v3-price-edit-list">{rows.map((item,index)=><article key={item.id||item.name}><div><strong>{index+1}. {item.name}</strong><small>{item.id} · {item.orders.size} 張單</small></div><strong>{item.qty} 件 · {money(item.grossMinor)}</strong><StatusBadge tone="good">Projection</StatusBadge></article>)}</div>}
  </div>;
}

export function FormalChannelReportPage(){
  const read=useV3ReadModels();
  const rows=useMemo(()=>{
    const orderById=new Map(read.orders.map(order=>[order.orderId,order]));
    const refundsBySource=new Map<string,number>();
    for(const refund of read.refunds){
      const source=orderById.get(refund.orderId)?.sourceLabel??'未識別來源';
      refundsBySource.set(source,(refundsBySource.get(source)??0)+Number(refund.amountMinor||0));
    }
    const map=new Map<string,{source:string;orders:number;grossMinor:number;refundMinor:number}>();
    for(const order of completedSalesOrders(read.orders)){
      const source=order.sourceLabel||'未識別來源';
      const current=map.get(source)??{source,orders:0,grossMinor:0,refundMinor:0};
      current.orders+=1;current.grossMinor+=Number(order.totalMinor||0);map.set(source,current);
    }
    for(const [source,refundMinor] of refundsBySource){
      const current=map.get(source)??{source,orders:0,grossMinor:0,refundMinor:0};
      current.refundMinor=refundMinor;map.set(source,current);
    }
    return [...map.values()].sort((a,b)=>b.grossMinor-a.grossMinor);
  },[read.orders,read.refunds]);

  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="渠道" description="由已完成 Order Projection + 正式 Refund evidence 按來源聚合；Provider settlement 仍然獨立顯示。" aside={<button type="button" disabled={read.ordersRefreshing||read.refundsRefreshing} onClick={()=>void read.refresh()}>重新讀取</button>}/>
    {(read.ordersError||read.refundsError)?<div className="v3-error">{read.ordersError?.message??read.refundsError?.message}</div>:null}
    {!rows.length?<section className="v3-product-empty"><h2>目前未有渠道報表資料</h2></section>:<div className="v3-price-edit-list">{rows.map(row=><article key={row.source}><div><strong>{row.source}</strong><small>{row.orders} 張已完成訂單 · 退款 {money(row.refundMinor)}</small></div><strong>{money(row.grossMinor-row.refundMinor)}</strong><StatusBadge tone="good">淨投影</StatusBadge></article>)}</div>}
  </div>;
}

export function FormalOperationsReportPage(){
  const read=useV3ReadModels();
  const open=read.orders.filter(order=>order.fulfillmentLabel!=='已完成'&&order.fulfillmentLabel!=='已取消');
  const ready=open.filter(order=>order.fulfillmentLabel.includes('可取')).length;
  const cancelled=read.orders.filter(order=>order.fulfillmentLabel==='已取消').length;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="營運" description="只顯示目前有正式 projection 支持嘅營運指標；未接 dedicated metrics 嘅欄位保持未知。" aside={<button type="button" onClick={()=>void read.refresh()}>重新讀取</button>}/>
    <section className="v3-whole-kpi-grid">
      <article><span>進行中訂單</span><strong>{read.ordersPending?'—':open.length}</strong><small>SMT Order Projection</small></article>
      <article><span>可取餐</span><strong>{read.ordersPending?'—':ready}</strong><small>目前狀態</small></article>
      <article><span>已取消</span><strong>{read.ordersPending?'—':cancelled}</strong><small>Projection 內可見</small></article>
      <article><span>退款事件</span><strong>{read.refundsPending?'—':read.refunds.length}</strong><small>正式 Refund evidence</small></article>
    </section>
    <section className="v3-functional-section">
      <header><div><h3>未有 verified read seam 嘅營運指標</h3><p>平均出餐時間、打印異常數、渠道異常數唔會由 V3 自己推算。</p></div><StatusBadge tone="warning">READ MODEL GAP</StatusBadge></header>
      <div className="v3-mobile-form-note">需要 SMT / Print / Provider 分別提供 authoritative metrics/readback，之後先會喺呢頁顯示。</div>
    </section>
  </div>;
}

export function FormalExportPage(){
  const read=useV3ReadModels();
  const [kind,setKind]=useState<'ORDERS'|'DAYS'|'REFUNDS'>('ORDERS');
  const [message,setMessage]=useState('');
  const exportData=()=>{
    if(kind==='ORDERS'){
      downloadCsv('mfk-orders-projection.csv',[
        ['orderId','display','businessDate','source','payment','fulfillment','totalMinor','createdAt','updatedAt','staffName'],
        ...read.orders.map(order=>[order.orderId,order.display,order.businessDate,order.sourceLabel,order.paymentLabel,order.fulfillmentLabel,order.totalMinor,order.createdAt,order.updatedAt,order.staffName??'']),
      ]);
    }else if(kind==='DAYS'){
      downloadCsv('mfk-sales-days-projection.csv',[
        ['date','grossMinor','adjustmentMinor','refundMinor','netMinor','orders','cashSalesMinor','cashRefundMinor'],
        ...read.days.map(day=>[day.date,day.grossMinor,day.adjustmentMinor,day.refundMinor??0,day.netMinor,day.orders,day.cashSalesMinor,day.cashRefundMinor??0]),
      ]);
    }else{
      downloadCsv('mfk-refunds-evidence.csv',[
        ['refundId','orderId','display','amountMinor','method','originalBusinessDate','executionBusinessDate','executionAt','addendumVersionLabel'],
        ...read.refunds.map(refund=>[refund.refundId,refund.orderId,refund.display,refund.amountMinor,refund.method,refund.originalBusinessDate,refund.executionBusinessDate,refund.executionAt,refund.addendumVersionLabel]),
      ]);
    }
    setMessage('已由目前正式 Projection / evidence 產生 CSV。');
  };
  const count=kind==='ORDERS'?read.orders.length:kind==='DAYS'?read.days.length:read.refunds.length;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="報表" title="匯出" description="只匯出目前已讀到嘅正式 Projection / evidence；唔會輸出 Preview fixture。" />
    <section className="v3-functional-section">
      <div className="v3-functional-grid">
        <label><span>資料集</span><select value={kind} onChange={event=>setKind(event.target.value as typeof kind)}><option value="ORDERS">訂單 Projection</option><option value="DAYS">銷售日 Projection</option><option value="REFUNDS">退款 Evidence</option></select></label>
        <label><span>目前筆數</span><input value={String(count)} disabled/></label>
      </div>
      <button className="v3-primary" type="button" disabled={count===0} onClick={exportData}>產生 CSV</button>
      {message?<div className="v3-preview-notice">{message}</div>:null}
      <div className="v3-mobile-form-note">匯出由 browser 對已授權 read model 產生；唔改寫任何 Order / Sales / Refund authority。</div>
    </section>
  </div>;
}
