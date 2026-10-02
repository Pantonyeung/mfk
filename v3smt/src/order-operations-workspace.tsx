import {useMemo,useState} from 'react';

import {parseMfpMoneyInput,type MfpTenderConfig} from './checkout-domain.ts';
import {
  MFP_DINING_TABLE_IDS,
  createMfpRefundOperation,
  createMfpRiceGroupAvailabilityOperation,
  createMfpSplitCheckoutPart,
  createMfpSplitCheckoutPlan,
  filterMfpAvailabilityItems,
  filterMfpOrders,
  isMfpDiningWarning,
  mfpOrderLane,
  type MfpCanonicalOrder,
  type MfpFormalOrderCheckoutPart,
  type MfpOrderLane,
  type MfpOrderOperation,
  type MfpOrderOperationsReadModel,
} from './order-operations-domain.ts';
import type {MfpNormalizedOrderingIntent,MfpOrderingSurface} from './ordering-domain.ts';

const money=new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'});
const formatMoney=(minor:number|null|undefined)=>minor===null||minor===undefined?'—':money.format(minor/100);
const laneLabels:Record<MfpOrderLane,string>={DIRECT:'現場 / 直接',OWN_PLATFORM:'自家平台',THIRD_PARTY:'第三方'};
const fulfillmentLabels={IN_PROGRESS:'未完成',READY:'可取餐',PICKED_UP:'已取餐',CANCELLED:'已取消'} as const;
const sourceLabels:Readonly<Record<string,string>>={WALK_IN:'現場',PHONE:'電話',WHATSAPP:'WhatsApp',MORE_FUN_APP:'More Fun App',KEETA:'Keeta',FOODPANDA:'foodpanda'};
const sourceLabel=(source:string)=>sourceLabels[source]??source;

export type MfpOperationalPage='ORDERS'|'DINING'|'AVAILABILITY'|'MORE';
export type MfpAppPage='ORDERING'|MfpOperationalPage;

export function MfpOperationsNavigation({surface,active,onNavigate}:{surface:MfpOrderingSurface;active:MfpAppPage;onNavigate:(page:MfpAppPage)=>void}){
  const labels:ReadonlyArray<readonly [MfpAppPage,string]>=[
    ['ORDERING','Ordering'],['ORDERS','Orders'],['DINING','Dining'],['AVAILABILITY','Sold-out / Capacity'],
  ];
  return <div className={`mfp-operations-nav-shell ${surface==='MFP_MOBILE'?'mobile':''}`}>
    <button type="button" className={`mfp-more-tools-button ${active==='MORE'?'active':''}`} aria-current={active==='MORE'?'page':undefined} onClick={()=>onNavigate('MORE')}><span aria-hidden="true">☰</span> More / Tools</button>
    <nav className="mfp-operations-nav" aria-label="MFP high-frequency operations navigation">
      {labels.map(([page,label])=><button type="button" key={page} className={active===page?'active':''} aria-current={active===page?'page':undefined} onClick={()=>onNavigate(page)}>{label}</button>)}
    </nav>
  </div>;
}

function OrderCard({order,selected,onSelect}:{order:MfpCanonicalOrder;selected:boolean;onSelect:()=>void}){
  const itemCount=order.items.reduce((sum,item)=>sum+item.quantity,0);
  return <button type="button" className={`mfp-order-card ${selected?'selected':''}`} aria-pressed={selected} onClick={onSelect}>
    <header><small>{sourceLabel(order.source)}</small><b>#{order.displayNumber}</b><span>{fulfillmentLabels[order.fulfillmentState]}</span></header>
    {order.customerDisplayName?<strong>{order.customerDisplayName}</strong>:null}
    {order.source==='MORE_FUN_APP'&&order.pickupCode?<em>取餐碼 {order.pickupCode}</em>:null}
    {order.externalOrderNumber?<small>外部單號 {order.externalOrderNumber}</small>:null}
    <footer><span>{order.effectiveTenderId} · {itemCount} 件</span><b>{formatMoney(order.recognizedAmountMinor+order.outstandingAmountMinor)}</b></footer>
  </button>;
}

type OrderForm='MODIFY'|'PAYMENT'|'FULL_REFUND'|'PARTIAL_REFUND'|'CANCEL'|null;

function OrderActionForm({order,form,tenders,onSubmit,onClose}:{
  order:MfpCanonicalOrder;form:Exclude<OrderForm,null>;tenders:readonly MfpTenderConfig[];
  onSubmit:(operation:MfpOrderOperation)=>void;onClose:()=>void;
}){
  const [reason,setReason]=useState('');
  const [tenderId,setTenderId]=useState(tenders.find(tender=>tender.enabled)?.id??order.effectiveTenderId);
  const [amount,setAmount]=useState(String((form==='FULL_REFUND'?(order.refundableAmountMinor??0):0)/100));
  const [refundLineId,setRefundLineId]=useState(order.items[0]?.lineId??'');
  const [refundQuantity,setRefundQuantity]=useState(1);
  const [error,setError]=useState('');
  const titles={MODIFY:'修改訂單',PAYMENT:'更正付款方式',FULL_REFUND:'全額退款',PARTIAL_REFUND:'部分退款',CANCEL:'取消訂單'} as const;
  const submit=()=>{
    try{
      if(form==='MODIFY')onSubmit({kind:'REQUEST_MODIFICATION',orderId:order.orderId,expectedRevision:order.revision,reason});
      if(form==='PAYMENT')onSubmit({kind:'CORRECT_PAYMENT',orderId:order.orderId,expectedRevision:order.revision,toTenderId:tenderId});
      if(form==='CANCEL')onSubmit({kind:'CANCEL',orderId:order.orderId,expectedRevision:order.revision,reason});
      if(form==='FULL_REFUND'||form==='PARTIAL_REFUND')onSubmit(createMfpRefundOperation(order,{
        scope:form==='FULL_REFUND'?'FULL':'PARTIAL',amountMinor:parseMfpMoneyInput(amount),refundTenderId:tenderId,
        ...(form==='PARTIAL_REFUND'?{lineUnits:[{lineId:refundLineId,quantity:refundQuantity}]}:{}),
      }));
      onClose();
    }catch{setError('請檢查退款金額及必填資料。');}
  };
  return <div className="mfp-operation-layer"><section className="mfp-operation-form" role="dialog" aria-modal="true" aria-labelledby="mfp-operation-form-title">
    <header><div><small>正式訂單 · #{order.displayNumber}</small><h2 id="mfp-operation-form-title">{titles[form]}</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header>
    <div>
      {form==='MODIFY'||form==='CANCEL'?<label>{form==='CANCEL'?'取消原因':'改單要求'}<textarea autoFocus value={reason} maxLength={200} onChange={event=>setReason(event.target.value)}/></label>:null}
      {form==='PAYMENT'||form.includes('REFUND')?<label>{form==='PAYMENT'?'新付款方式':'退款方式'}<select value={tenderId} onChange={event=>setTenderId(event.target.value)}>{tenders.filter(tender=>tender.enabled).map(tender=><option key={tender.id} value={tender.id}>{tender.label}</option>)}</select></label>:null}
      {form.includes('REFUND')?<label>退款金額<input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label>:null}
      {form==='PARTIAL_REFUND'?<><label>退款商品<select value={refundLineId} onChange={event=>{setRefundLineId(event.target.value);setRefundQuantity(1);}}>{order.items.map(item=><option key={item.lineId} value={item.lineId}>{item.name}</option>)}</select></label><label>數量<input type="number" inputMode="numeric" min="1" max={order.items.find(item=>item.lineId===refundLineId)?.quantity??1} value={refundQuantity} onChange={event=>setRefundQuantity(Math.max(1,Math.min(order.items.find(item=>item.lineId===refundLineId)?.quantity??1,Number.parseInt(event.target.value||'1',10))))}/></label></>:null}
      {form==='MODIFY'&&order.source==='MORE_FUN_APP'?<p>自家平台改單會進入「等候客人確認」，客人確認後才生效。</p>:null}
      {error?<output aria-live="polite">{error}</output>:null}
    </div>
    <footer><button type="button" onClick={onClose}>返回</button><button type="button" className={form==='CANCEL'?'danger':''} disabled={(form==='MODIFY'||form==='CANCEL')&&!reason.trim()} onClick={submit}>提交正式操作</button></footer>
  </section></div>;
}

function OrderDetail({order,tenders,onOperation,onSplit}:{
  order:MfpCanonicalOrder;tenders:readonly MfpTenderConfig[];onOperation:(operation:MfpOrderOperation)=>void;onSplit:(order:MfpCanonicalOrder)=>void;
}){
  const [form,setForm]=useState<OrderForm>(null);
  const fulfillment=(target:'IN_PROGRESS'|'READY'|'PICKED_UP')=>onOperation({kind:'SET_FULFILLMENT',orderId:order.orderId,expectedRevision:order.revision,target});
  return <aside className="mfp-order-detail" data-order-id={order.orderId} aria-label={`訂單 ${order.displayNumber} 詳情`}>
    <header><div><small>{sourceLabel(order.source)} · 正式訂單</small><h2>#{order.displayNumber}</h2></div><span>{fulfillmentLabels[order.fulfillmentState]}</span></header>
    <dl><div><dt>用餐方式</dt><dd>{order.serviceMode==='DINE_IN'?'堂食':'外賣'}</dd></div><div><dt>付款</dt><dd>{order.effectiveTenderId}</dd></div><div><dt>已確認</dt><dd>{formatMoney(order.recognizedAmountMinor)}</dd></div><div><dt>未收</dt><dd>{formatMoney(order.outstandingAmountMinor)}</dd></div>{order.eta?<div><dt>預計完成</dt><dd>{order.eta.minutes} 分鐘 · {new Date(order.eta.readyAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</dd></div>:null}</dl>
    <section className="mfp-order-items"><h3>商品</h3>{order.items.map(item=><article key={item.lineId}><div><b>{item.name}</b>{item.options?.map(option=><small key={option}>{option}</small>)}{item.note?<small>{item.note}</small>:null}</div><span>×{item.quantity}</span><strong>{formatMoney(item.unitMinor*item.quantity)}</strong></article>)}</section>
    {order.modificationState==='CUSTOMER_CONFIRMATION_REQUIRED'?<p className="mfp-operation-warning">等候客人確認改單</p>:null}
    {order.cancelNoticeIntent==='CANCEL_NOTICE_REQUIRED'?<p className="mfp-operation-warning">需要取消通知單 · 實體列印未接駁</p>:null}
    {order.humanCommunicationRequired?<p className="mfp-operation-warning">需要人手通知製作區；不會自動補印更正單</p>:null}
    <div className="mfp-fulfillment-actions">
      {order.fulfillmentState!=='READY'?<button type="button" onClick={()=>fulfillment('READY')}>標記可取餐</button>:<button type="button" onClick={()=>fulfillment('IN_PROGRESS')}>返回未完成</button>}
      {order.fulfillmentState==='READY'?<button type="button" onClick={()=>fulfillment('PICKED_UP')}>完成取餐</button>:null}
    </div>
    <div className="mfp-order-secondary-actions">
      <button type="button" onClick={()=>setForm('MODIFY')}>修改訂單</button><button type="button" onClick={()=>setForm('PAYMENT')}>更正付款</button>
      <button type="button" onClick={()=>setForm('FULL_REFUND')}>全額退款</button><button type="button" onClick={()=>setForm('PARTIAL_REFUND')}>部分退款</button>
      {order.serviceMode==='DINE_IN'?<button type="button" onClick={()=>onSplit(order)}>分單付款</button>:null}
      <button type="button" disabled title="實體列印未接駁">重印（未接駁）</button><button type="button" className="danger" onClick={()=>setForm('CANCEL')}>取消訂單</button>
    </div>
    {form?<OrderActionForm order={order} form={form} tenders={tenders} onSubmit={onOperation} onClose={()=>setForm(null)}/>:null}
  </aside>;
}

function OrdersWorkspace({surface,model,tenders,onOperation,onSplit}:{
  surface:MfpOrderingSurface;model:MfpOrderOperationsReadModel;tenders:readonly MfpTenderConfig[];
  onOperation:(operation:MfpOrderOperation)=>void;onSplit:(order:MfpCanonicalOrder)=>void;
}){
  const [lane,setLane]=useState<MfpOrderLane>('DIRECT');
  const [source,setSource]=useState('');
  const [tender,setTender]=useState('');
  const filtered=filterMfpOrders(model.orders,{...(source?{source}:{}),...(tender?{tenderId:tender}:{})});
  const [selectedId,setSelectedId]=useState(model.orders[0]?.orderId??'');
  const selected=model.orders.find(order=>order.orderId===selectedId)??model.orders[0]??null;
  const sources=[...new Set(model.orders.map(order=>order.source))];
  const tenderIds=[...new Set(model.orders.map(order=>order.effectiveTenderId))];
  const lanes=surface==='MFP_MOBILE'?[lane]:(['DIRECT','OWN_PLATFORM','THIRD_PARTY'] as const);
  return <section className={`mfp-orders-workspace ${surface==='MFP_MOBILE'?'mobile':''}`} data-order-operations-surface={surface}>
    <header><div><small>訂單工作台</small><h1>Orders</h1></div><p>更新時間 {new Date(model.readAt).toLocaleTimeString('zh-HK')}</p></header>
    <div className="mfp-order-filters"><label>Source / Channel<select value={source} onChange={event=>setSource(event.target.value)}><option value="">全部</option>{sources.map(value=><option key={value}>{value}</option>)}</select></label><span>→</span><label>Payment Method<select value={tender} onChange={event=>setTender(event.target.value)}><option value="">全部</option>{tenderIds.map(value=><option key={value}>{value}</option>)}</select></label></div>
    {surface==='MFP_MOBILE'?<div className="mfp-mobile-lane-tabs" role="tablist">{(['DIRECT','OWN_PLATFORM','THIRD_PARTY'] as const).map(value=><button type="button" role="tab" key={value} aria-selected={lane===value} onClick={()=>setLane(value)}>{laneLabels[value]}</button>)}</div>:null}
    <div className="mfp-orders-layout">{selected?<OrderDetail order={selected} tenders={tenders.length?tenders:tenderConfigs(tenderIds)} onOperation={onOperation} onSplit={onSplit}/>:<p>未有訂單</p>}<div className="mfp-order-lanes">{lanes.map(value=><section key={value} className="mfp-order-lane"><header><h2>{laneLabels[value]}</h2><span>{filtered.filter(order=>mfpOrderLane(order.source)===value).length}</span></header><div>{filtered.filter(order=>mfpOrderLane(order.source)===value).map(order=><OrderCard key={order.orderId} order={order} selected={selected?.orderId===order.orderId} onSelect={()=>setSelectedId(order.orderId)}/>)}</div></section>)}</div></div>
  </section>;
}

function tenderConfigs(ids:readonly string[]):MfpTenderConfig[]{return ids.map(id=>({id,label:id,enabled:true}));}

function SplitCheckoutPanel({order,onSubmit,onClose}:{order:MfpCanonicalOrder;onSubmit:(part:MfpFormalOrderCheckoutPart)=>void;onClose:()=>void}){
  const plan=useMemo(()=>createMfpSplitCheckoutPlan(order),[order]);
  const [selected,setSelected]=useState<string[]>([]);
  const toggle=(unitId:string)=>setSelected(current=>current.includes(unitId)?current.filter(id=>id!==unitId):[...current,unitId]);
  return <div className="mfp-operation-layer"><section className="mfp-split-checkout" role="dialog" aria-modal="true" aria-labelledby="mfp-split-title">
    <header><div><small>正式訂單 #{order.displayNumber} · 使用現有 Checkout</small><h2 id="mfp-split-title">分單付款</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header>
    <div><p>{plan.units.length} 件未付款商品 · 最多分開付款 {plan.maxParts} 次 · 不受人數限制</p>{plan.units.map(unit=><label key={unit.unitId}><input type="checkbox" checked={selected.includes(unit.unitId)} onChange={()=>toggle(unit.unitId)}/><span>{unit.name}</span><small>第 {unit.unitIndex} 件</small></label>)}</div>
    <footer><button type="button" onClick={onClose}>返回</button><button type="button" disabled={!selected.length} onClick={()=>{onSubmit(createMfpSplitCheckoutPart(plan,`PART-${crypto.randomUUID()}`,selected));onClose();}}>進入 A5 Checkout</button></footer>
  </section></div>;
}

function DiningWorkspace({surface,model,pendingIntent,onOperation,onSplit,onReturnToOrdering}:{surface:MfpOrderingSurface;model:MfpOrderOperationsReadModel;pendingIntent:MfpNormalizedOrderingIntent|null;onOperation:(operation:MfpOrderOperation)=>void;onSplit:(order:MfpCanonicalOrder)=>void;onReturnToOrdering:()=>void}){
  const [selectedTable,setSelectedTable]=useState(pendingIntent?model.dining.tables.find(row=>row.state==='AVAILABLE')?.tableId??'T01':'T01');
  const [partySize,setPartySize]=useState(2);
  const [customer,setCustomer]=useState('');
  const [additionProductId,setAdditionProductId]=useState(model.availability.items[0]?.productId??'');
  const [transferTarget,setTransferTarget]=useState('');
  const table=model.dining.tables.find(row=>row.tableId===selectedTable)??model.dining.tables[0];
  const order=model.orders.find(row=>row.orderId===table?.orderId)??null;
  const available=model.dining.tables.filter(row=>row.state==='AVAILABLE');
  const openWaiting=model.dining.waiting.filter(row=>!row.orderId);
  const selectedAvailable=table?.state==='AVAILABLE'?table:null;
  const assign=(wait:typeof model.dining.waiting[number])=>{
    const target=selectedAvailable;if(!target)return;
    onOperation({kind:'ASSIGN_TABLE',expectedRevision:model.dining.revision,waitingId:wait.waitingId,tableId:target.tableId,expectedTableRevision:target.revision,...(wait.orderId?{orderId:wait.orderId}:{})});
  };
  return <section className={`mfp-dining-workspace ${surface==='MFP_MOBILE'?'mobile':''}`} data-dining-surface={surface}>
    <header><div><small>堂食訂單及真實入座時間</small><h1>Dining</h1></div><span>3 × 3 枱位</span></header>
    <div className="mfp-dining-layout"><aside className="mfp-waiting-lane"><h2>Waiting</h2>{model.dining.waiting.map(wait=><article key={wait.waitingId}><div><b>{wait.displayNumber}</b><small>{wait.customerDisplayName??'輪候'} · {wait.partySize} 位</small><span>{wait.orderId?'已落單':'未落單'}</span></div><button type="button" disabled={!selectedAvailable} onClick={()=>assign(wait)}>安排到 {selectedAvailable?.label??'所選枱位'}</button></article>)}<form onSubmit={event=>{event.preventDefault();onOperation({kind:'CREATE_WAITING',expectedRevision:model.dining.revision,partySize,customerDisplayName:customer});}}><h3>新增輪候</h3><label>客人<input value={customer} onChange={event=>setCustomer(event.target.value)}/></label><label>人數<input type="number" min="1" inputMode="numeric" value={partySize} onChange={event=>setPartySize(Math.max(1,Number(event.target.value)))}/></label><button type="submit">加入 Waiting</button><small>未落單唔會製造 Formal Order</small></form></aside>
      <main><div className="mfp-table-grid">{model.dining.tables.map(row=><button type="button" key={row.tableId} className={`${row.state.toLowerCase()} ${isMfpDiningWarning(row,model.etaPolicy)?'warning':''}`} aria-pressed={selectedTable===row.tableId} onClick={()=>setSelectedTable(row.tableId)}><b>{row.label}</b><span>{row.state==='AVAILABLE'?'可用':`#${row.displayNumber}`}</span>{row.seatedAt?<small>{new Date(row.seatedAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small>:null}</button>)}</div></main>
      <aside className="mfp-table-detail"><h2>{table?.label??'Table'}</h2>{pendingIntent?<section className="mfp-dining-admission"><b>待安排堂食草稿</b><span>{pendingIntent.lines.reduce((sum,line)=>sum+line.quantity,0)} 件商品</span>{table?.state==='AVAILABLE'?<button type="button" onClick={()=>onOperation({kind:'ADMIT_DINING_ORDER',expectedRevision:model.dining.revision,intent:pendingIntent,target:{kind:'TABLE',tableId:table.tableId,partySize}})}>正式開單到 {table.label}</button>:<small>請選擇可用枱位</small>}{openWaiting.map(wait=><button type="button" key={wait.waitingId} onClick={()=>onOperation({kind:'ADMIT_DINING_ORDER',expectedRevision:model.dining.revision,intent:pendingIntent,target:{kind:'WAITING',waitingId:wait.waitingId,partySize:wait.partySize}})}>落單到 Waiting {wait.displayNumber}</button>)}<button type="button" onClick={onReturnToOrdering}>返回修改草稿</button></section>:<button type="button" onClick={onReturnToOrdering}>由 Ordering 開堂食單</button>}{order?<><p>#{order.displayNumber} · {order.dining?.partySize} 位</p><p>入座 {order.dining?.seatedAt?new Date(order.dining.seatedAt).toLocaleString('zh-HK'):'—'}</p><p>{order.items.reduce((sum,item)=>sum+item.quantity,0)} 件 · 未收 {formatMoney(order.outstandingAmountMinor)}</p><label>轉枱<select value={transferTarget} onChange={event=>setTransferTarget(event.target.value)}><option value="">選擇可用枱</option>{available.map(row=><option key={row.tableId} value={row.tableId}>{row.label}</option>)}</select></label><button type="button" disabled={!transferTarget} onClick={()=>{const target=model.dining.tables.find(row=>row.tableId===transferTarget)!;onOperation({kind:'TRANSFER_TABLE',orderId:order.orderId,expectedRevision:order.revision,fromTableId:table!.tableId,toTableId:target.tableId,expectedTableRevision:target.revision});}}>確認轉枱</button><label>加單商品<select value={additionProductId} onChange={event=>setAdditionProductId(event.target.value)}>{model.availability.items.filter(item=>item.status==='AVAILABLE').map(item=><option key={item.productId} value={item.productId}>{item.name}</option>)}</select></label><button type="button" disabled={!additionProductId} onClick={()=>onOperation({kind:'ADD_DINING_ITEMS',orderId:order.orderId,expectedRevision:order.revision,items:[{productId:additionProductId,quantity:1}]})}>正式加單</button><button type="button" onClick={()=>onSplit(order)}>分單付款</button></>:<p>{table?.state==='AVAILABLE'?'可直接安排堂食訂單':'未有正式訂單'}</p>}</aside>
    </div>
  </section>;
}

function AvailabilityWorkspace({surface,model,onOperation}:{surface:MfpOrderingSurface;model:MfpOrderOperationsReadModel;onOperation:(operation:MfpOrderOperation)=>void}){
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [selected,setSelected]=useState<string[]>([]);
  const [correction,setCorrection]=useState<Record<string,string>>({});
  const [overrideQty,setOverrideQty]=useState<Record<string,string>>({});
  const [correctionReason,setCorrectionReason]=useState<Record<string,string>>({});
  const [overrideReason,setOverrideReason]=useState<Record<string,string>>({});
  const filtered=filterMfpAvailabilityItems(model.availability.items,{search,...(status?{status:status as 'AVAILABLE'|'SOLD_OUT'|'PAUSED'}:{})});
  const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const setAvailability=(next:'AVAILABLE'|'SOLD_OUT'|'PAUSED')=>onOperation({kind:'SET_AVAILABILITY',expectedRevision:model.availability.revision,productIds:selected,status:next});
  const riceGroups=[...new Set(model.availability.items.map(item=>item.riceGroupId).filter((value):value is string=>Boolean(value)))];
  return <section className={`mfp-availability-workspace ${surface==='MFP_MOBILE'?'mobile':''}`} data-availability-surface={surface}>
    <header><div><small>商品供應及產能</small><h1>Sold-out / Capacity</h1></div></header>
    <div className="mfp-availability-layout"><section><h2>商品供應</h2><div className="mfp-availability-filters"><label>搜尋<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label><label>狀態<select value={status} onChange={event=>setStatus(event.target.value)}><option value="">全部</option><option value="AVAILABLE">供應中</option><option value="SOLD_OUT">售罄</option><option value="PAUSED">暫停</option></select></label></div><div className="mfp-batch-actions"><button type="button" disabled={!selected.length} onClick={()=>setAvailability('SOLD_OUT')}>批次售罄</button><button type="button" disabled={!selected.length} onClick={()=>setAvailability('PAUSED')}>批次暫停</button><button type="button" disabled={!selected.length} onClick={()=>setAvailability('AVAILABLE')}>批次恢復</button>{riceGroups.map(group=><button type="button" key={group} onClick={()=>onOperation(createMfpRiceGroupAvailabilityOperation(model,group,'SOLD_OUT'))}>{group} 快速售罄</button>)}</div><div className="mfp-availability-list">{filtered.map(item=><label key={item.productId}><input type="checkbox" checked={selected.includes(item.productId)} onChange={()=>toggle(item.productId)}/><span><b>{item.name}</b><small>{item.categoryId}</small></span><em className={item.status.toLowerCase()}>{item.status}</em></label>)}</div></section>
      <section className="mfp-capacity-list"><h2>Capacity Pool</h2>{model.capacity.pools.map(pool=><article key={pool.poolId}><header><div><b>{pool.name}</b><small>{pool.businessDayId} · reset {new Date(pool.resetAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small></div><strong>{pool.remainingQuantity} / {pool.initialQuantity}</strong></header><div className="mfp-capacity-meter"><i style={{width:`${pool.initialQuantity?Math.min(100,pool.remainingQuantity/pool.initialQuantity*100):0}%`}}/></div><dl><div><dt>Third Party</dt><dd>{pool.thirdPartyAccepting?'接單中':`停止 · ${pool.thirdPartyThreshold}`}</dd></div><div><dt>Own Platform</dt><dd>{pool.ownPlatformAccepting?'接單中':`停止 · ${pool.ownPlatformThreshold}`}</dd></div><div><dt>Override</dt><dd>{pool.overrideRemaining}</dd></div><div><dt>Audit</dt><dd>{pool.audit.length}</dd></div></dl><form onSubmit={event=>{event.preventDefault();onOperation({kind:'CORRECT_CAPACITY',expectedRevision:pool.revision,poolId:pool.poolId,remainingQuantity:Number(correction[pool.poolId]??pool.remainingQuantity),reason:correctionReason[pool.poolId]??''});}}><label>現有份數<input type="number" min="0" inputMode="numeric" value={correction[pool.poolId]??pool.remainingQuantity} onChange={event=>setCorrection(values=>({...values,[pool.poolId]:event.target.value}))}/></label><label>更正原因<input required value={correctionReason[pool.poolId]??''} onChange={event=>setCorrectionReason(values=>({...values,[pool.poolId]:event.target.value}))}/></label><button type="submit">記錄盤點更正</button></form><form onSubmit={event=>{event.preventDefault();onOperation({kind:'CREATE_CAPACITY_OVERRIDE',expectedRevision:pool.revision,poolId:pool.poolId,scope:'BOUND_REMOTE_CHANNELS',quantity:Number(overrideQty[pool.poolId]),reason:overrideReason[pool.poolId]??''});}}><label>有限 Override<input type="number" min="1" inputMode="numeric" required value={overrideQty[pool.poolId]??''} onChange={event=>setOverrideQty(values=>({...values,[pool.poolId]:event.target.value}))}/></label><label>Override 原因<input required value={overrideReason[pool.poolId]??''} onChange={event=>setOverrideReason(values=>({...values,[pool.poolId]:event.target.value}))}/></label><small>適用範圍：已綁定遠端渠道；用完會再次停止。</small><button type="submit">提交有限加量</button></form></article>)}</section></div>
  </section>;
}

function MoreWorkspace({model,onTool}:{model:MfpOrderOperationsReadModel;onTool:(tool:string)=>void}){
  const tools=[
    ['Day Close','A5'],['Reports','A5'],['Devices','A7 / A9'],['Print Devices','A7'],['Check Center','A9'],['Backup / Restore','A9'],['Diagnostics','A9'],['Admin Sync','A9'],
  ] as const;
  return <section className="mfp-more-workspace" data-more-tools-shell="A6"><header><div><small>店務工具</small><h1>More / Tools</h1></div></header><article className="mfp-today-summary"><h2>Today</h2><strong>{model.todaySummary?.orderCount??'—'} Orders</strong><b>{formatMoney(model.todaySummary?.recognizedAmountMinor)}</b><small>{model.todaySummary?'已連接今日正式數據':'今日數據未接駁'}</small></article><div className="mfp-tools-grid">{tools.map(([label,stage])=><button type="button" key={label} onClick={()=>onTool(label)}><b>{label}</b><small>{stage==='A5'?'使用現有 Money / Reporting':'未接駁'}</small></button>)}</div></section>;
}

export function MfpOrderOperationsWorkspace({surface,page,model,tenders,operationStatus,pendingDiningIntent=null,onOperation,onSplitCheckout,onTool,onReturnToOrdering=()=>{}}:{
  surface:MfpOrderingSurface;page:MfpOperationalPage;model:MfpOrderOperationsReadModel;tenders:readonly MfpTenderConfig[];
  operationStatus?:string;pendingDiningIntent?:MfpNormalizedOrderingIntent|null;onOperation:(operation:MfpOrderOperation)=>void;onSplitCheckout:(part:MfpFormalOrderCheckoutPart)=>void;onTool:(tool:string)=>void;onReturnToOrdering?:()=>void;
}){
  const [splitOrder,setSplitOrder]=useState<MfpCanonicalOrder|null>(null);
  return <><section className="mfp-order-operations" data-order-operations-contract="SHARED_PAD_MOBILE">
    {page==='ORDERS'?<OrdersWorkspace surface={surface} model={model} tenders={tenders} onOperation={onOperation} onSplit={setSplitOrder}/>:null}
    {page==='DINING'?<DiningWorkspace surface={surface} model={model} pendingIntent={pendingDiningIntent} onOperation={onOperation} onSplit={setSplitOrder} onReturnToOrdering={onReturnToOrdering}/>:null}
    {page==='AVAILABILITY'?<AvailabilityWorkspace surface={surface} model={model} onOperation={onOperation}/>:null}
    {page==='MORE'?<MoreWorkspace model={model} onTool={onTool}/>:null}
    {operationStatus?<output className="mfp-operation-status" aria-live="polite">{operationStatus}</output>:null}
  </section>{splitOrder?<SplitCheckoutPanel order={splitOrder} onSubmit={onSplitCheckout} onClose={()=>setSplitOrder(null)}/>:null}</>;
}
