import type {OwnerDineInSummary,OwnerLiveOrdersSummary} from './product-types';

export function TodayLiveOrdersCard({value,onOpen}:{value:OwnerLiveOrdersSummary|null;onOpen:()=>void}){
  return <section className="card live-ops-card">
    <div className="section-head"><div><span className="eyebrow">即時訂單</span><h2>而家有幾多張單？</h2></div><button className="link-btn" onClick={onOpen}>查看訂單</button></div>
    {!value?<p className="muted-copy">未有即時訂單讀回；唔會用推算數字代替。</p>:<>
      <div className="live-count-grid">
        <div><strong>{value.activeCount}</strong><span>進行中</span></div>
        <div><strong>{value.attentionCount}</strong><span>需留意</span></div>
        <div><strong>{value.readyCount}</strong><span>可取餐</span></div>
      </div>
      {value.recentOrders.length?<div className="live-order-list">{value.recentOrders.slice(0,3).map(order=><article key={order.orderId}>
        <div><strong>{order.displayCode}</strong><small>{order.source} · {order.fulfillmentLabel}</small></div>
        <div><b>{order.amountLabel??'—'}</b><small>{order.elapsedLabel??order.promisedTimeLabel??''}</small></div>
      </article>)}</div>:<p className="muted-copy">目前冇即時訂單摘要。</p>}
    </>}
  </section>;
}

export function DineInOpenChecksCard({value,onOpen}:{value:OwnerDineInSummary|null;onOpen:()=>void}){
  return <section className="card dinein-card">
    <div className="section-head"><div><span className="eyebrow orange">堂食</span><h2>進行中 / 未結帳</h2></div><button className="link-btn" onClick={onOpen}>查看堂食</button></div>
    {!value?<p className="muted-copy">未有堂食未結帳讀回。</p>:<>
      <div className="dinein-money">
        <div><span>堂食進行中</span><strong>{value.activeCheckCount}</strong><small>張</small></div>
        <div><span>未結帳</span><strong>{value.unpaidCheckCount}</strong><small>張</small></div>
        <div className="money"><span>預計未結帳</span><strong>{value.estimatedOpenAmountLabel}</strong><small>未計入有效營業額</small></div>
      </div>
      {value.oldestOpenAgeLabel?<p className="oldest-check">最舊未結帳：{value.oldestOpenAgeLabel}</p>:null}
      {value.openChecks.length?<div className="open-check-list">{value.openChecks.slice(0,3).map(check=><article key={check.checkId}>
        <div><strong>{check.tableLabel}</strong><small>{check.displayCode??'堂食單'} · {check.paymentState==='PARTIAL'?'部分付款':check.paymentState==='SETTLED'?'已結清':'未結清'}</small></div>
        <div><b>{check.outstandingLabel}</b><small>未收款</small></div>
      </article>)}</div>:null}
      <div className="money-boundary">Order Value、已收款、未收款分開；Open Check 全額唔會靜默當已收營業額。</div>
    </>}
  </section>;
}
