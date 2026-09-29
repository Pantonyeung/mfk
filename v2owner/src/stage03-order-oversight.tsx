import {useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import type {OwnerConnectionState,OwnerOrderProjection} from './product-types';
import {
  buildOwnerOrderDetailViewModel,
  buildOwnerOrderListViewModel,
  DEFAULT_OWNER_ORDER_FILTERS,
  getOwnerOrderFulfillmentStateLabel,
  type OwnerOrderFilters,
  type OwnerOrderScope,
} from './stage03-view-model';

export function OrderOversightPage({
  connection,
  orders,
  scope,
  onScopeReset,
}:{
  connection:OwnerConnectionState;
  orders:readonly OwnerOrderProjection[];
  scope:OwnerOrderScope;
  onScopeReset:()=>void;
}){
  const [filters,setFilters]=useState<OwnerOrderFilters>(DEFAULT_OWNER_ORDER_FILTERS);
  const [selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
  const [filtersOpen,setFiltersOpen]=useState(false);

  useEffect(()=>{
    if(scope==='ACTIVE'||scope==='DINE_IN_OPEN'){
      setFilters(DEFAULT_OWNER_ORDER_FILTERS);
      setSelectedOrderId(null);
    }
  },[scope]);

  const vm=useMemo(()=>buildOwnerOrderListViewModel(orders,filters,scope),[orders,filters,scope]);
  const selected=selectedOrderId?orders.find(order=>order.orderId===selectedOrderId)??null:null;

  return <section className="page order-oversight-page">
    <header className="page-head order-oversight-head">
      <div>
        <span>訂單監察</span>
        <h1>訂單</h1>
        <small>一眼查看訂單進度、付款、打印同處理記錄；此頁只供監察。</small>
      </div>
      <b className="hero-number">{vm.rows.length}</b>
    </header>

    {scope!=='DEFAULT'?<section className="order-scope-banner">
      <div>
        <strong>{scope==='ACTIVE'?'進行中訂單':'堂食未結帳'}</strong>
        <span>{scope==='ACTIVE'?'由今日頁查看正在處理嘅訂單。':'由今日頁查看堂食未結帳訂單。'}</span>
      </div>
      <button onClick={()=>{
        setFilters(DEFAULT_OWNER_ORDER_FILTERS);
        setSelectedOrderId(null);
        onScopeReset();
      }}>查看全部訂單</button>
    </section>:null}

    {scope==='DEFAULT'?<div className="segmented order-segmented" role="group" aria-label="訂單範圍">
      {(['ACTIVE','COMPLETED'] as const).map(segment=><button
        key={segment}
        className={filters.segment===segment?'active':''}
        onClick={()=>setFilters(value=>({...value,segment}))}
      >{segment==='ACTIVE'?'進行中':'已完成 / 歷史'}</button>)}
    </div>:<div className="segmented order-segmented scoped-segment" aria-label="目前訂單範圍">
      <button className="active" disabled>進行中</button>
    </div>}

    <label className="search order-search">
      <span>搜尋</span>
      <input
        value={filters.query}
        onChange={event=>setFilters(value=>({...value,query:event.target.value}))}
        placeholder="訂單編號／客戶／電話／外部訂單編號"
      />
    </label>

    {scope==='DEFAULT'?<section className="order-filter-summary" aria-label="訂單篩選摘要">
      <div>
        <span>{filters.businessDate==='ALL'?'全部日期':filters.businessDate}</span>
        <span>{filters.source==='ALL'?'全部來源':filters.source}</span>
        {filters.paymentState!=='ALL'?<span>{formatFilterValue(filters.paymentState)}</span>:null}
        {filters.fulfillmentState!=='ALL'?<span>{filters.fulfillmentState}</span>:null}
      </div>
      <button onClick={()=>setFiltersOpen(true)}>篩選</button>
    </section>:null}

    {!vm.rows.length?<OrderEmpty connection={connection}/>:<div className="cards order-oversight-list">
      {vm.rows.map(order=><OrderOversightCard key={order.orderId} order={order} onOpen={()=>setSelectedOrderId(order.orderId)}/>)}
    </div>}

    {filtersOpen?<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setFiltersOpen(false)}}>
      <section className="drawer order-filter-drawer" role="dialog" aria-modal="true" aria-label="篩選條件">
        <header className="drawer-head"><div><small>訂單</small><h2>篩選條件</h2></div><button onClick={()=>setFiltersOpen(false)} aria-label="關閉">×</button></header>
        <section className="order-filter-grid" aria-label="訂單篩選">
          <OrderFilter label="營業日" value={filters.businessDate} values={vm.businessDates} onChange={businessDate=>setFilters(value=>({...value,businessDate}))}/>
          <OrderFilter label="來源" value={filters.source} values={vm.sources} onChange={source=>setFilters(value=>({...value,source}))}/>
          <OrderFilter label="付款" value={filters.paymentState} values={vm.paymentStates} onChange={paymentState=>setFilters(value=>({...value,paymentState}))}/>
          <OrderFilter label="交收狀態" value={filters.fulfillmentState} values={vm.fulfillmentStates} onChange={fulfillmentState=>setFilters(value=>({...value,fulfillmentState:fulfillmentState as OwnerOrderFilters['fulfillmentState']}))}/>
        </section>
        <div className="sheet-actions"><button onClick={()=>setFilters(DEFAULT_OWNER_ORDER_FILTERS)}>重設</button><button className="primary" onClick={()=>setFiltersOpen(false)}>套用篩選</button></div>
      </section>
    </div>:null}

    {selected?<OrderOversightDrawer order={selected} onClose={()=>setSelectedOrderId(null)}/>:null}
  </section>;
}

function OrderFilter({
  label,
  value,
  values,
  onChange,
}:{
  label:string;
  value:string;
  values:readonly string[];
  onChange:(value:string)=>void;
}){
  return <label className="order-filter">
    <span>{label}</span>
    <select value={value} onChange={event=>onChange(event.target.value)}>
      {values.map(item=><option key={item} value={item}>{formatFilterValue(item)}</option>)}
    </select>
  </label>;
}

function OrderOversightCard({order,onOpen}:{order:OwnerOrderProjection;onOpen:()=>void}){
  const effective=order.currentEffectiveAmountLabel??order.amountLabel??'—';
  const tender=order.currentTenderLabel??order.tenderLabel??'未有付款摘要';
  const workflow=order.workflowStatusLabel??order.lifecycle;
  return <button className="order-oversight-card compact-order-row" onClick={onOpen}>
    <span className="order-source-mark" aria-hidden="true">{order.source.slice(0,1)}</span>
    <div className="order-list-copy">
      <div className="order-list-title"><strong>{order.displayCode}</strong><span>{order.source}</span></div>
      <b>{order.customerName??order.itemSummary}</b>
      <small>{order.elapsedLabel??'—'} · {effective} · {order.itemSummary}</small>
      {order.exceptionBadges?.length?<div className="order-exception-row">{order.exceptionBadges.slice(0,2).map(label=><span key={label}>{label}</span>)}</div>:null}
    </div>
    <div className="order-list-side">
      <span className="order-workflow-chip">{workflow}</span>
      <strong>{effective}</strong>
      <small>{tender}</small>
      <small>{getOwnerOrderFulfillmentStateLabel(order)}</small>
      <small>{order.promisedTimeLabel??'—'}</small>
    </div>
  </button>;
}

function OrderOversightDrawer({order,onClose}:{order:OwnerOrderProjection;onClose:()=>void}){
  const detail=buildOwnerOrderDetailViewModel(order);
  return <div className="overlay">
    <section className="drawer order-oversight-drawer" role="dialog" aria-modal="true" aria-label="訂單詳情">
      <header className="drawer-head">
        <div><small>{detail.identity.source}</small><h2>訂單 {detail.identity.displayCode}</h2></div>
        <button onClick={onClose}>✕</button>
      </header>

      <DetailSection title="1｜訂單資料">
        <div className="order-detail-grid">
          <Detail label="訂單編號" value={detail.identity.displayCode}/>
          <Detail label="營業日" value={detail.identity.businessDate}/>
          <Detail label="客戶" value={detail.identity.customerName}/>
          <Detail label="電話" value={detail.identity.customerPhone}/>
        </div>
      </DetailSection>

      <DetailSection title="2｜訂單內容">
        {order.itemLines?.length?<div className="order-item-lines">{order.itemLines.map(line=><article key={line.lineId}>
          <div><strong>{line.quantity} × {line.name}</strong>{line.amountLabel?<b>{line.amountLabel}</b>:null}</div>
          {line.optionLabels?.length?<small>選項：{line.optionLabels.join('、')}</small>:null}
          {line.modifierLabels?.length?<small>加配：{line.modifierLabels.join('、')}</small>:null}
          {line.remark?<small>備註：{line.remark}</small>:null}
        </article>)}</div>:<p>{order.itemSummary||'未有商品摘要'}</p>}
        {order.orderRemark?<p className="order-remark">訂單備註：{order.orderRemark}</p>:null}
      </DetailSection>

      <DetailSection title="3｜金額與付款">
        <div className="order-detail-grid">
          <Detail label="原始金額" value={detail.money.original}/>
          <Detail label="調整" value={detail.money.adjustments}/>
          <Detail label="目前有效金額" value={detail.money.effective}/>
          {order.referenceValueLabel?<Detail label="Admin 標準價值" value={order.referenceValueLabel}/>:null}
          {order.effectiveTransactionLabel?<Detail label="實際成交" value={order.effectiveTransactionLabel}/>:null}
          {order.pricingAuthority?<Detail label="成交定價權" value={order.pricingAuthority}/>:null}
          <Detail label="付款方式" value={detail.money.tender}/>
        </div>
        {order.adjustments?.length?<div className="adjustment-list">{order.adjustments.map((item,index)=><div key={item.label+'-'+index}><span>{item.label}</span><strong>{item.amountLabel}</strong></div>)}</div>:null}
      </DetailSection>

      <DetailSection title="4｜交收進度">
        <div className="order-detail-grid">
          <Detail label="狀態" value={detail.fulfillment.state}/>
          <Detail label="方式" value={detail.fulfillment.mode}/>
          <Detail label="已進行" value={detail.timing.elapsed}/>
          <Detail label="預計時間" value={detail.timing.promised}/>
        </div>
        {order.fulfillmentHistory?.length?<div className="order-safe-timeline">{order.fulfillmentHistory.map((event,index)=><article key={event.label+'-'+index}><strong>{event.label}</strong><span>{event.state??''}</span><small>{event.atLabel??''}</small></article>)}</div>:<p className="muted-copy">暫時未有交收進度記錄。</p>}
      </DetailSection>

      <DetailSection title="5｜來源資料">
        <div className="order-detail-grid">
          <Detail label="平台" value={order.externalProvider??(order.externalRef?'外部平台':'門店')}/>
          <Detail label="外部訂單編號" value={order.externalRef??'—'}/>
          <Detail label="取消要求" value={order.externalCancelRequestLabel??'未有取消要求'}/>
          <Detail label="來源" value={order.source}/>
        </div>
      </DetailSection>

      <DetailSection title="6｜打印狀況">
        <div className="order-detail-grid">
          <Detail label="小票" value={order.sideEffects?.receipt??'未有資料'}/>
          <Detail label="製作單" value={order.sideEffects?.production??'未有資料'}/>
          <Detail label="打包單" value={order.sideEffects?.packing??'未有資料'}/>
          <Detail label="標籤" value={order.sideEffects?.label??'未有資料'}/>
          {order.printState?<Detail label="首次打印" value={order.printState==='DONE'?'已完成':order.printState==='PENDING'?'待打印':'待確認'}/>:null}
        </div>
      </DetailSection>

      <DetailSection title="7｜處理記錄">
        {order.auditTrail?.length?<div className="order-safe-timeline">{order.auditTrail.map((event,index)=><article key={event.title+'-'+event.atLabel+'-'+index}>
          <strong>{event.title}</strong>
          <span>{event.actorLabel??''}{event.resultLabel?' · '+event.resultLabel:''}</span>
          <small>{event.atLabel}</small>
        </article>)}</div>:<p className="muted-copy">暫時未有可顯示嘅處理記錄。</p>}
      </DetailSection>

      <div className="boundary-box">此頁只供查看。取消、退款、付款修正等操作請到相應營運流程處理。</div>
    </section>
  </div>;
}

function DetailSection({title,children}:{title:string;children:ReactNode}){
  return <section className="detail-section"><h3>{title}</h3>{children}</section>;
}

function Detail({label,value}:{label:string;value:string}){
  return <div className="detail"><span>{label}</span><strong>{value}</strong></div>;
}

function OrderEmpty({connection}:{connection:OwnerConnectionState}){
  return <section className="card empty-state" data-visual-asset="AI_ASSET_PENDING">
    <h2>{connection==='OFFLINE_READONLY'?'訂單資料尚未連接':'暫時冇符合條件嘅訂單'}</h2>
    <p>可以調整日期、來源、付款、交收或搜尋條件。</p>
  </section>;
}

function formatFilterValue(value:string){
  if(value==='ALL')return '全部';
  if(value==='OPEN')return '未結帳';
  if(value==='PARTIAL')return '部分付款';
  if(value==='SETTLED')return '已結清';
  return value;
}

function certaintyLabel(value:OwnerOrderProjection['readback']){
  return value==='CONFIRMED'?'已確認':value==='PARTIAL'?'部分確認':'未明';
}
