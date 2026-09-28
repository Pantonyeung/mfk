import type {OwnerConnectionState,OwnerDineInSummary,OwnerLiveOrdersSummary} from './product-types';
import type {
  OwnerTodayActionSummary,
  OwnerTodayHealthSummary,
  OwnerTodayInsightViewModel,
  OwnerTodayStaffSummary,
} from './today-view-model';

function humanFreshness(value:string|null|undefined){
  const key=String(value??'').toUpperCase();
  if(key==='CURRENT'||key==='FRESH')return '已更新';
  if(key==='STALE')return '資料稍舊';
  if(key==='PARTIAL')return '部分資料';
  return '未有資料';
}

function humanBusinessState(value:string|null|undefined){
  const raw=String(value??'').trim();
  if(!raw||raw.toUpperCase()==='UNKNOWN'||raw.toUpperCase()==='UNAVAILABLE')return '未有資料';
  return raw;
}

function humanHealthValue(value:string|undefined){
  const key=String(value??'').trim().toUpperCase();
  if(!key||key==='UNKNOWN'||key==='UNAVAILABLE')return '未有資料';
  if(['HEALTHY','GOOD','ONLINE','READY','OK'].includes(key))return '正常';
  if(['DEGRADED','WARN','WARNING','PARTIAL'].includes(key))return '需留意';
  if(['OFFLINE','CRITICAL','FAILED','ERROR'].includes(key))return '異常';
  return value!;
}

function humanHealthTone(tone:string|undefined){
  const key=String(tone??'').toUpperCase();
  if(key==='GOOD')return '正常';
  if(key==='WARN')return '需留意';
  if(key==='CRITICAL')return '異常';
  return '未有資料';
}

function humanSeverity(value:string|undefined){
  return value==='URGENT'?'緊急':value==='ATTENTION'?'注意':value==='INFO'?'資訊':'未有資料';
}

export function TodayContextHeader({
  storeName,
  businessDate,
  operatingStatus,
  freshness,
  observedAt,
}:{
  storeName:string;
  businessDate:string;
  operatingStatus:string|null;
  freshness:string|null;
  observedAt?:string;
}){
  return <header className="page-head today-context">
    <div>
      <span>今日</span>
      <h1>而家間舖點？</h1>
      <small>即時掌握今日生意、訂單同營運狀況。</small>
    </div>
    <div className="today-context-grid">
      <div><span>門店</span><strong>{storeName}</strong></div>
      <div><span>營業日</span><strong>{businessDate}</strong></div>
      <div><span>營業狀態</span><strong>{humanBusinessState(operatingStatus)}</strong></div>
      <div><span>資料更新</span><strong>{humanFreshness(freshness)}</strong><small>{observedAt?new Date(observedAt).toLocaleString('zh-HK'):'未有更新時間'}</small></div>
    </div>
  </header>;
}

export function TodayLiveOrdersCard({value,onOpenActive}:{value:OwnerLiveOrdersSummary|null;onOpenActive:()=>void}){
  return <section className="card live-ops-card">
    <div className="section-head">
      <div><span className="eyebrow">即時訂單</span><h2>而家有幾多張單？</h2></div>
      <button className="link-btn" onClick={onOpenActive}>查看進行中訂單</button>
    </div>
    {!value?<p className="muted-copy">即時訂單資料未有更新；唔會用推算數字代替。</p>:<>
      <div className="live-count-grid">
        <div><strong>{value.activeCount}</strong><span>進行中</span></div>
        <div><strong>{value.attentionCount??'—'}</strong><span>需留意</span></div>
        <div><strong>{value.readyCount}</strong><span>可取餐</span></div>
      </div>
      {value.recentOrders.length?<div className="live-order-list">{value.recentOrders.slice(0,3).map(order=><article key={order.orderId}>
        <div className="live-order-main">
          <strong>{order.displayCode}</strong>
          <small>{order.source}</small>
          <span>{order.fulfillmentLabel}</span>
          {order.exceptionBadge?<em className="exception-badge">{order.exceptionBadge}</em>:null}
        </div>
        <div className="live-order-side">
          <b>{order.amountLabel??'—'}</b>
          <small>已進行：{order.elapsedLabel??'—'}</small>
          <small>預計：{order.promisedTimeLabel??'—'}</small>
        </div>
      </article>)}</div>:<p className="muted-copy">目前冇即時訂單摘要。</p>}
    </>}
  </section>;
}

export function DineInOpenChecksCard({value,onOpenDineIn}:{value:OwnerDineInSummary|null;onOpenDineIn:()=>void}){
  return <section className="card dinein-card">
    <div className="section-head">
      <div><span className="eyebrow orange">堂食</span><h2>進行中 / 未結帳</h2></div>
      <button className="link-btn" onClick={onOpenDineIn}>查看堂食未結帳</button>
    </div>
    {!value?<p className="muted-copy">堂食未結帳資料未有更新。</p>:<>
      <div className="dinein-money">
        <div><span>堂食進行中</span><strong>{value.activeCheckCount}</strong><small>張</small></div>
        <div><span>未結帳</span><strong>{value.unpaidCheckCount}</strong><small>張</small></div>
        <div className="money"><span>預計未結帳</span><strong>{value.estimatedOpenAmountLabel}</strong><small>未計入有效營業額</small></div>
      </div>
      {value.oldestOpenAgeLabel?<p className="oldest-check">最舊未結帳：{value.oldestOpenAgeLabel}</p>:null}
      {value.openChecks.length?<div className="open-check-list">{value.openChecks.slice(0,3).map(check=><article key={check.checkId}>
        <div className="open-check-title">
          <strong>{check.tableLabel}</strong>
          <small>{check.displayCode??'堂食單'}</small>
          <span className="payment-state">{check.paymentState==='PARTIAL'?'部分付款':check.paymentState==='SETTLED'?'已結清':'未結清'}</span>
        </div>
        <div className="open-check-money">
          <span><small>總額</small><b>{check.currentOrderTotalLabel}</b></span>
          <span><small>已收款</small><b>{check.confirmedPaidLabel}</b></span>
          <span><small>未收款</small><b>{check.outstandingLabel}</b></span>
        </div>
      </article>)}</div>:null}
      <div className="money-boundary">總額、已收款、未收款分開；未收款未計入有效營業額。</div>
    </>}
  </section>;
}

export function TodayActionSummaryCard({value,onOpen}:{value:OwnerTodayActionSummary;onOpen:()=>void}){
  const top=value.topSeverity;
  const oldest=value.oldestUnresolved;
  return <section className="card attention-card">
    <div className="section-head">
      <div><span className="eyebrow danger">需要處理</span><h2>待處理事項</h2></div>
      <b className="count-badge">{value.openCount}</b>
    </div>
    <div className="today-summary-rows">
      <div><span>最高優先</span><strong>{top?top.title:'暫時冇待處理事項'}</strong><small>{top?humanSeverity(top.severity):'—'}</small></div>
      <div><span>最舊未處理</span><strong>{oldest?oldest.title:'—'}</strong><small>{oldest?new Date(oldest.observedAt).toLocaleString('zh-HK'):'—'}</small></div>
    </div>
    <p>只顯示真係需要你介入嘅營運事項。</p>
    <button className="primary wide" onClick={onOpen}>查看待處理</button>
  </section>;
}

export function TodayHealthSummaryCard({
  value,
  onChannels,
  onDevices,
}:{
  value:OwnerTodayHealthSummary;
  onChannels:()=>void;
  onDevices:()=>void;
}){
  const rows=[
    {id:'internet',label:'網絡',item:value.internet,onOpen:onDevices},
    {id:'keeta',label:'Keeta',item:value.keeta,onOpen:onChannels},
    {id:'own',label:'自家平台',item:value.ownPlatform,onOpen:onChannels},
    {id:'smt',label:'SMT',item:value.smt,onOpen:onDevices},
    {id:'printer',label:'打印機',item:value.printer,onOpen:onDevices},
  ];
  return <section className="card">
    <div className="section-head"><div><span className="eyebrow">營運健康</span><h2>渠道與設備</h2></div></div>
    <div className="health-summary-list">{rows.map(row=><button key={row.id} onClick={row.onOpen}>
      <span>{row.label}</span>
      <strong>{humanHealthValue(row.item?.value)}</strong>
      <small>{humanHealthTone(row.item?.tone)}</small>
    </button>)}</div>
    <p className="muted-copy">各渠道同設備分開顯示；有異常可進入相關頁查看。</p>
  </section>;
}

export function TodayStaffSummaryCard({value,onOpen}:{value:OwnerTodayStaffSummary;onOpen:()=>void}){
  return <section className="card compact-card">
    <div className="section-head"><div><span className="eyebrow orange">現場</span><h2>員工狀態</h2></div><button className="link-btn" onClick={onOpen}>查看員工</button></div>
    <div className="staff-summary-grid">
      <div><strong>{value.workingNow??'—'}</strong><span>目前返工</span></div>
      <div><strong>{value.scheduledNow??'—'}</strong><span>預定返工</span></div>
      <div><strong>{value.onBreak??'—'}</strong><span>休息中</span></div>
      <div><strong>{value.abnormal??'—'}</strong><span>異常</span></div>
    </div>
  </section>;
}

export function TodayInsightCard({value}:{value:OwnerTodayInsightViewModel}){
  const empty=!value.topProductLabel&&!value.currentHourTrendLabel;
  return <section className="card">
    <div className="section-head"><div><span className="eyebrow purple">營運觀察</span><h2>商品／時段</h2></div></div>
    {empty?<div className="insight-empty"><strong>未有資料</strong><span>熱賣商品同目前時段走勢暫未更新。</span></div>:
      <div className="insight-grid">
        <div><span>熱賣商品</span><strong>{value.topProductLabel??'未有資料'}</strong></div>
        <div><span>目前時段</span><strong>{value.currentHourTrendLabel??'未有資料'}</strong></div>
      </div>}
    <div className="fresh-row"><span>{humanFreshness(value.freshness)}</span><span>{value.observedAt?new Date(value.observedAt).toLocaleString('zh-HK'):'未有更新時間'}</span></div>
  </section>;
}

export function GlobalStateBanner({state,onRetry}:{state:OwnerConnectionState;onRetry:()=>void}){
  if(state==='FRESH')return null;
  const copy:Record<Exclude<OwnerConnectionState,'FRESH'>,{title:string;detail:string}>={
    LOADING:{title:'同步中',detail:'正在更新最新營運資料。'},
    EMPTY:{title:'暫時冇資料',detail:'資料未更新完成前，呢度唔會用推算數字補位。'},
    STALE:{title:'資料稍舊',detail:'畫面會保留最後一次資料，並清楚標示更新時間。'},
    PARTIAL:{title:'部分資料',detail:'只顯示已確認部分；唔會將部分當完整。'},
    OFFLINE_READONLY:{title:'離線唯讀',detail:'可以查看已保留資料，但遠端操作暫時停用。'},
    PERMISSION_DENIED:{title:'權限不足',detail:'目前身份無權讀取呢部分資料。'},
    ERROR:{title:'暫時未能同步',detail:'請稍後再試；詳細技術資料會留喺診斷工具。'},
    UNKNOWN:{title:'狀態未明',detail:'未確認結果前，畫面唔會當成已完成或失敗。'},
  };
  const value=copy[state];
  return <section className="recovery-banner"><div><strong>{value.title}</strong><span>{value.detail}</span></div>{state==='PERMISSION_DENIED'?null:<button onClick={onRetry}>重新確認</button>}</section>;
}
