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
        <small>只讀正式投影；V1 唔建立、修改、取消、退款或更改付款方式。</small>
      </div>
      <b className="hero-number">{vm.rows.length}</b>
    </header>

    {scope!=='DEFAULT'?<section className="order-scope-banner">
      <div>
        <strong>{scope==='ACTIVE'?'進行中訂單':'堂食未結帳'}</strong>
        <span>{scope==='ACTIVE'?'由今日頁進入 active order scope。':'由今日頁進入 dine-in + open-payment scope。'}</span>
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
    </div>:<div className="segmented order-segmented scoped-segment" aria-label="Scoped orders">
      <button className="active" disabled>進行中</button>
    </div>}

    <label className="search order-search">
      <span>搜尋</span>
      <input
        value={filters.query}
        onChange={event=>setFilters(value=>({...value,query:event.target.value}))}
        placeholder="Display Number／客戶／電話／外部編號"
      />
    </label>

    <section className="order-filter-grid" aria-label="訂單篩選">
      <OrderFilter label="Business Day" value={filters.businessDate} values={vm.businessDates} onChange={businessDate=>setFilters(value=>({...value,businessDate}))}/>
      <OrderFilter label="來源" value={filters.source} values={vm.sources} onChange={source=>setFilters(value=>({...value,source}))}/>
      <OrderFilter label="付款" value={filters.paymentState} values={vm.paymentStates} onChange={paymentState=>setFilters(value=>({...value,paymentState}))}/>
      <OrderFilter label="交收狀態" value={filters.fulfillmentState} values={vm.fulfillmentStates} onChange={fulfillmentState=>setFilters(value=>({...value,fulfillmentState:fulfillmentState as OwnerOrderFilters['fulfillmentState']}))}/>
    </section>

    {!vm.rows.length?<OrderEmpty connection={connection}/>:<div className="cards order-oversight-list">
      {vm.rows.map(order=><OrderOversightCard key={order.orderId} order={order} onOpen={()=>setSelectedOrderId(order.orderId)}/>)}
    </div>}

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
  return <button className="order-oversight-card" onClick={onOpen}>
    <div className="order-oversight-top">
      <div>
        <small>{order.source}</small>
        <h2>{order.displayCode}</h2>
      </div>
      <span className={'certainty '+order.readback.toLowerCase()}>{certaintyLabel(order.readback)}</span>
    </div>

    <div className="order-workflow-row">
      <strong>{workflow}</strong>
      <b>{effective}</b>
    </div>

    <div className="order-time-row">
      <span>已進行：{order.elapsedLabel??'—'}</span>
      <span>預計：{order.promisedTimeLabel??'—'}</span>
    </div>

    <div className="order-meta-grid">
      <div><span>付款</span><strong>{tender}</strong></div>
      <div><span>交收狀態</span><strong>{getOwnerOrderFulfillmentStateLabel(order)}</strong></div>
    </div>

    {order.exceptionBadges?.length?<div className="order-exception-row">{order.exceptionBadges.slice(0,4).map(label=><span key={label}>{label}</span>)}</div>:null}

    <div className="order-card-footer"><span>查看訂單詳情</span><small>Read-only oversight</small></div>
  </button>;
}

function OrderOversightDrawer({order,onClose}:{order:OwnerOrderProjection;onClose:()=>void}){
  const detail=buildOwnerOrderDetailViewModel(order);
  return <div className="overlay">
    <section className="drawer order-oversight-drawer" role="dialog" aria-modal="true" aria-label="Order Oversight Detail">
      <header className="drawer-head">
        <div><small>{detail.identity.source}</small><h2>訂單 {detail.identity.displayCode}</h2></div>
        <button onClick={onClose}>✕</button>
      </header>

      <DetailSection title="1｜Identity">
        <div className="order-detail-grid">
          <Detail label="Display Number" value={detail.identity.displayCode}/>
          <Detail label="Business Day" value={detail.identity.businessDate}/>
          <Detail label="客戶" value={detail.identity.customerName}/>
          <Detail label="電話" value={detail.identity.customerPhone}/>
        </div>
      </DetailSection>

      <DetailSection title="2｜Items / Option / Modifier / Remark">
        {order.itemLines?.length?<div className="order-item-lines">{order.itemLines.map(line=><article key={line.lineId}>
          <div><strong>{line.quantity} × {line.name}</strong>{line.amountLabel?<b>{line.amountLabel}</b>:null}</div>
          {line.optionLabels?.length?<small>選項：{line.optionLabels.join('、')}</small>:null}
          {line.modifierLabels?.length?<small>加配：{line.modifierLabels.join('、')}</small>:null}
          {line.remark?<small>備註：{line.remark}</small>:null}
        </article>)}</div>:<p>{order.itemSummary||'未有商品摘要'}</p>}
        {order.orderRemark?<p className="order-remark">訂單備註：{order.orderRemark}</p>:null}
      </DetailSection>

      <DetailSection title="3｜Money">
        <div className="order-detail-grid">
          <Detail label="Original" value={detail.money.original}/>
          <Detail label="Adjustments" value={detail.money.adjustments}/>
          <Detail label="Current Effective" value={detail.money.effective}/>
          <Detail label="Current Tender" value={detail.money.tender}/>
        </div>
        {order.adjustments?.length?<div className="adjustment-list">{order.adjustments.map((item,index)=><div key={item.label+'-'+index}><span>{item.label}</span><strong>{item.amountLabel}</strong></div>)}</div>:null}
      </DetailSection>

      <DetailSection title="4｜Fulfillment">
        <div className="order-detail-grid">
          <Detail label="State" value={detail.fulfillment.state}/>
          <Detail label="Mode" value={detail.fulfillment.mode}/>
          <Detail label="Elapsed" value={detail.timing.elapsed}/>
          <Detail label="Promised" value={detail.timing.promised}/>
        </div>
        {order.fulfillmentHistory?.length?<div className="order-safe-timeline">{order.fulfillmentHistory.map((event,index)=><article key={event.label+'-'+index}><strong>{event.label}</strong><span>{event.state??''}</span><small>{event.atLabel??''}</small></article>)}</div>:<p className="muted-copy">未有 Fulfillment history projection。</p>}
      </DetailSection>

      <DetailSection title="5｜External">
        <div className="order-detail-grid">
          <Detail label="Provider" value={order.externalProvider??(order.externalRef?'外部平台':'門店')}/>
          <Detail label="External Ref" value={order.externalRef??'—'}/>
          <Detail label="Cancel Request" value={order.externalCancelRequestLabel??'未有取消請求'}/>
          <Detail label="Source" value={order.source}/>
        </div>
      </DetailSection>

      <DetailSection title="6｜Side-effects">
        <div className="order-detail-grid">
          <Detail label="Receipt" value={order.sideEffects?.receipt??'未有讀回'}/>
          <Detail label="Production" value={order.sideEffects?.production??'未有讀回'}/>
          <Detail label="Packing" value={order.sideEffects?.packing??'未有讀回'}/>
          <Detail label="Label" value={order.sideEffects?.label??'未有讀回'}/>
        </div>
      </DetailSection>

      <DetailSection title="7｜Timeline / Audit">
        {order.auditTrail?.length?<div className="order-safe-timeline">{order.auditTrail.map((event,index)=><article key={event.title+'-'+event.atLabel+'-'+index}>
          <strong>{event.title}</strong>
          <span>{event.actorLabel??''}{event.resultLabel?' · '+event.resultLabel:''}</span>
          <small>{event.atLabel}</small>
        </article>)}</div>:<p className="muted-copy">未有已整理嘅 Audit projection；唔會直接顯示 raw engineering timeline。</p>}
      </DetailSection>

      <div className="boundary-box">V1 只讀監察｜本頁冇建立、編輯、取消、退款、Tender Correction、重印或其他交易 mutation。</div>
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
