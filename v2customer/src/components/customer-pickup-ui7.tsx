import {ActionButton} from '../ui/primitives';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerPendingIntent,
  CustomerPickupExceptionKind,
} from '../product-types';

export const CUSTOMER_UI7_ARRIVAL_SEAM_CLASSIFICATION=
  'SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN' as const;

type CharacterVariant='male'|'female';
type Ui7CanonicalStage='READY'|'ARRIVED'|'VERIFIED'|'HANDED_OVER'|'COMPLETED'|'PICKUP_EXCEPTION';
type Ui7Freshness='CURRENT'|'LOADING'|'ERROR'|'OFFLINE'|'STALE'|'UNKNOWN';
type Ui7EmptyState='LOADING'|'EMPTY'|'ERROR'|'OFFLINE'|'STALE'|'UNKNOWN';

const isUi7Stage=(stage:CustomerOrderStage):stage is Ui7CanonicalStage=>
  ['READY','ARRIVED','VERIFIED','HANDED_OVER','COMPLETED','PICKUP_EXCEPTION'].includes(stage);

const freshnessFrom=(connection:CustomerConnectionState,browserOnline:boolean):Ui7Freshness=>{
  if(!browserOnline||connection==='NOT_CONNECTED')return 'OFFLINE';
  if(connection==='LOADING')return 'LOADING';
  if(connection==='ERROR')return 'ERROR';
  if(connection==='STALE'||connection==='PARTIAL')return 'STALE';
  if(connection==='UNKNOWN')return 'UNKNOWN';
  return 'CURRENT';
};
const emptyStateFrom=(freshness:Ui7Freshness):Ui7EmptyState=>freshness==='CURRENT'?'EMPTY':freshness;
const isKnownPreUi7Stage=(stage:CustomerOrderStage)=>
  ['RECEIVED','REJECTED','CANCELED','ACCEPTED','PREPARING','DELAYED','PICKUP_VERIFICATION'].includes(stage);

const digits=(value:string)=>value.replace(/\D/g,'');
const pickupCodeFromPhone=(phone:string)=>{
  const value=digits(phone);
  return value.length>=4?value.slice(-4):null;
};
const formatTime=(value:string|undefined)=>{
  if(!value)return '完成時間待讀回';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '完成時間待讀回';
  return new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
};

function Mascot({variant}:{variant:CharacterVariant}){
  return <div className="ui7-mascot ui7-brand-art-slot" data-final-art-pending="true" data-character-slot={variant} role="img" aria-label="磨飯品牌角色插圖位置"/>;
}

function IdentityPanel({
  order,
  historyOrder,
  intent,
}:{
  order:CustomerOrderProjection|null;
  historyOrder:CustomerHistoryProjection|null;
  intent:CustomerPendingIntent|null;
}){
  const pickupCode=order?.pickupCode??historyOrder?.pickupCode??pickupCodeFromPhone(intent?.checkout.phone??'')??'----';
  const displayCode=order?.displayCode??historyOrder?.displayCode??intent?.canonicalDisplay??'同步中';
  return <section className="ui7-identity-panel" aria-label="取餐資料">
    <article><span>取餐碼</span><strong>{pickupCode}</strong><small>電話最後四位</small></article>
    <article><span>流水號</span><strong>{displayCode}</strong><small>店舖取餐流水號</small></article>
    <p>取餐碼同流水號用途不同；取餐時跟畫面提示出示即可。</p>
  </section>;
}

function FreshnessBanner({freshness}:{freshness:Ui7Freshness}){
  if(freshness==='CURRENT')return null;
  const detail=freshness==='OFFLINE'
    ?'目前離線；以下保留最近一次已知狀態，恢復連線後會再更新。'
    :freshness==='STALE'
      ?'以下係最近一次已知狀態；最新取餐進度仍在更新。'
      :freshness==='ERROR'
        ?'更新暫時出錯；唔會因此將訂單顯示成已交付或已完成。'
        :freshness==='LOADING'
          ?'正在更新；以下先顯示最近一次已知狀態。'
          :'最新狀態未明；未確認前唔會顯示已核對、已交付或已完成。';
  return <section className={"ui7-freshness state-"+freshness.toLowerCase()} role="status"><strong>{freshness}</strong><p>{detail}</p></section>;
}

function ReadyView({
  order,
  historyOrder,
  intent,
  variant,
}:{
  order:CustomerOrderProjection;
  historyOrder:CustomerHistoryProjection|null;
  intent:CustomerPendingIntent|null;
  variant:CharacterVariant;
}){
  const summary=order.itemSummary||intent?.cart.map(line=>line.productName+' ×'+line.quantity).join('、')||'訂單內容等待讀回';
  return <>
    <header className="ui7-hero ui7-ready-hero">
      <div className="ui7-title-row"><h1>可取餐</h1><span className="ui7-state-pill ready">餐點準備好</span></div>
      <Mascot variant={variant}/>
      <h2>餐點已準備好</h2>
      <p>請到店出示取餐碼；真正交畀你之後先會顯示完成。</p>
    </header>
    <IdentityPanel order={order} historyOrder={historyOrder} intent={intent}/>
    <section className="ui7-order-summary"><span>餐點</span><strong>{summary}</strong>{order.amountLabel?<em>{order.amountLabel}</em>:null}</section>
    <section className="ui7-arrival-unavailable">
      <button type="button" disabled aria-disabled="true">我到了</button>
      <strong>到店通知暫未連接</strong>
      <p>「我到了」功能稍後開放；暫時直接到店出示取餐碼即可。</p>
    </section>
  </>;
}

function ArrivedView({
  order,
  historyOrder,
  intent,
}:{
  order:CustomerOrderProjection;
  historyOrder:CustomerHistoryProjection|null;
  intent:CustomerPendingIntent|null;
}){
  const code=order.pickupCode??pickupCodeFromPhone(intent?.checkout.phone??'')??'----';
  const name=order.customerDisplayName??historyOrder?.customerDisplayName??intent?.checkout.name??'姓名待讀回';
  return <>
    <header className="ui7-hero ui7-arrived-hero">
      <div className="ui7-title-row"><h1>到店取餐</h1><span className="ui7-state-pill arrived">已到店</span></div>
      <p>請向店員出示</p>
      <div className="ui7-code-lockup"><span>取餐碼</span><strong>{code}</strong><small>電話最後四位</small></div>
    </header>
    <section className="ui7-arrived-meta">
      <div><span>流水號</span><strong>{order.displayCode}</strong></div>
      <div><span>姓名</span><strong>{name}</strong></div>
    </section>
    <section className="ui7-checklist">
      <span>店員核對：</span>
      <ul><li>取餐碼／姓名</li><li>袋數／餐點</li><li>必要時其他資料</li></ul>
    </section>
    <div className="ui7-status-cta">等待店員核對</div>
  </>;
}

function VerificationView({
  order,
  intent,
  variant,
}:{
  order:CustomerOrderProjection;
  intent:CustomerPendingIntent|null;
  variant:CharacterVariant;
}){
  const code=order.pickupCode??pickupCodeFromPhone(intent?.checkout.phone??'')??'----';
  const handed=order.stage==='HANDED_OVER';
  return <>
    <header className="ui7-hero ui7-verification-hero">
      <div className="ui7-title-row"><h1>{handed?'交付中':'核對中'}</h1><span className="ui7-state-pill verified">{handed?'已交付':'已核對'}</span></div>
      <Mascot variant={variant}/>
      <h2>{handed?'交付已確認':'核對完成'}</h2>
      <p>{handed?'餐點已交到你手上，正在更新完成狀態。':'店員正將餐點交畀你。'}</p>
    </header>
    <section className="ui7-verification-card">
      <div><span>袋數確認</span><strong>{order.pickupBagCount!==undefined?order.pickupBagCount+' 袋':'待店員讀回'}</strong></div>
      <div><span>餐點</span><strong>{order.pickupMealCount!==undefined?order.pickupMealCount+' 件':'待店員讀回'}</strong></div>
      <p>取餐碼 {code} {order.stage==='VERIFIED'?'已核對':'已完成店員核對流程'}</p>
    </section>
    <div className="ui7-status-cta success">正在交付，請稍候</div>
    <p className="ui7-not-completed">真正交付完成後，訂單先會顯示「已完成」。</p>
  </>;
}

const exceptionLabel=(kind:CustomerPickupExceptionKind)=>kind==='CODE_MISMATCH'?'取餐碼不符'
  :kind==='MISSING_BAG'?'袋數不足'
    :kind==='SAME_NAME'?'同名／其他'
      :kind==='NO_SHOW'?'暫時未能交付'
        :'同名／其他';

function ExceptionView({
  order,
  variant,
  onHelp,
  onOrders,
}:{
  order:CustomerOrderProjection;
  variant:CharacterVariant;
  onHelp:()=>void;
  onOrders:()=>void;
}){
  const exception=order.pickupException;
  const current=exception?.kind??'OTHER';
  const cards:CustomerPickupExceptionKind[]=['CODE_MISMATCH','MISSING_BAG','SAME_NAME'];
  return <>
    <header className="ui7-hero ui7-exception-hero">
      <div className="ui7-title-row"><h1>取餐核對</h1><span className="ui7-state-pill exception">需協助</span></div>
      <Mascot variant={variant}/>
      <h2>暫時未能完成取餐</h2>
      <p>先解決問題，再由店員完成交付。問題解決前，訂單唔會顯示「已完成」。</p>
    </header>
    <section className="ui7-exception-list">
      {cards.map(kind=><article key={kind} className={current===kind?'active':''}>
        <strong>{exceptionLabel(kind)}</strong>
        <span>{kind==='CODE_MISMATCH'?'重新核對姓名／電話':kind==='MISSING_BAG'?'店員檢查少袋數':'使用人工核對流程'}</span>
      </article>)}
      {current==='NO_SHOW'||current==='OTHER'?<article className="active"><strong>{exceptionLabel(current)}</strong><span>{exception?.detail||'請店員以人工流程處理'}</span></article>:null}
    </section>
    <div className="ui7-exception-actions">
      <ActionButton wide onClick={onHelp}>請店員協助</ActionButton>
      <ActionButton wide variant="secondary" onClick={onOrders}>返回訂單詳情</ActionButton>
    </div>
  </>;
}

function CompletedView({
  order,
  historyOrder,
  variant,
  onOrders,
  onHome,
}:{
  order:CustomerOrderProjection|null;
  historyOrder:CustomerHistoryProjection|null;
  variant:CharacterVariant;
  onOrders:()=>void;
  onHome:()=>void;
}){
  const display=order?.displayCode??historyOrder?.displayCode??'同步中';
  const completedAt=order?.completedAt??historyOrder?.completedAt;
  return <>
    <header className="ui7-hero ui7-completed-hero">
      <div className="ui7-title-row"><h1>已取餐</h1><span className="ui7-state-pill completed">已完成</span></div>
      <Mascot variant={variant}/>
      <h2>取餐完成</h2>
      <p>多謝你今日幫襯磨飯。</p>
    </header>
    <section className="ui7-completion-card">
      <div><span>完成時間</span><strong>{formatTime(completedAt)}</strong></div>
      <div><span>流水號</span><strong>{display}</strong></div>
      {!completedAt?<p>完成時間暫未提供；畫面唔會自行估算。</p>:null}
    </section>
    <div className="ui7-completed-actions">
      <ActionButton wide onClick={onOrders}>查看完成訂單</ActionButton>
      <ActionButton wide variant="secondary" onClick={onHome}>返回首頁</ActionButton>
    </div>
  </>;
}

export function PickupCompleteUi7View({
  order,
  historyOrder,
  intent,
  connection,
  browserOnline,
  characterVariant='male',
  onRefresh,
  onOrders,
  onHome,
  onHelp,
}:{
  order:CustomerOrderProjection|null;
  historyOrder:CustomerHistoryProjection|null;
  intent:CustomerPendingIntent|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  characterVariant?:CharacterVariant;
  onRefresh:()=>void;
  onOrders:()=>void;
  onHome:()=>void;
  onHelp:()=>void;
}){
  const freshness=freshnessFrom(connection,browserOnline);
  const canonicalStage=order&&isUi7Stage(order.stage)?order.stage:historyOrder?'COMPLETED':null;
  const unresolvedException=Boolean(order?.pickupException&&order.pickupException.resolved!==true);
  const stage:Ui7CanonicalStage|null=unresolvedException?'PICKUP_EXCEPTION':canonicalStage;
  const unsupported=Boolean(order&&!canonicalStage&&!isKnownPreUi7Stage(order.stage));
  const emptyState:Ui7EmptyState=unsupported?'UNKNOWN':emptyStateFrom(freshness);

  if(!stage){
    return <section className="page ui7-shell ui7-pending" data-ui7-state={emptyState}>
      <FreshnessBanner freshness={freshness}/>
      <header className="ui7-hero">
        <span>{emptyState==='OFFLINE'?'目前離線':emptyState==='ERROR'?'更新失敗':emptyState==='STALE'?'需要更新':emptyState==='LOADING'?'更新中':'確認中'}</span>
        <h1>{emptyState==='EMPTY'?'暫時未有取餐狀態':'取餐狀態等待讀回'}</h1>
        <p>{emptyState==='EMPTY'
          ?'暫時未進入取餐階段；店舖真正準備好後先會顯示「可取餐」。'
           :'取餐進度仍在確認；未確認前唔會顯示已核對、已交付或已完成。'}</p>
      </header>
      <IdentityPanel order={order} historyOrder={historyOrder} intent={intent}/>
      <div className="ui7-pending-actions"><ActionButton onClick={onRefresh}>重新整理</ActionButton><ActionButton variant="secondary" onClick={onOrders}>返回訂單</ActionButton></div>
    </section>;
  }

  return <section className="page ui7-shell" data-ui7-stage={stage} data-ui7-freshness={freshness}>
    <FreshnessBanner freshness={freshness}/>
    {stage==='READY'&&order?<ReadyView order={order} historyOrder={historyOrder} intent={intent} variant={characterVariant}/>:null}
    {stage==='ARRIVED'&&order?<ArrivedView order={order} historyOrder={historyOrder} intent={intent}/>:null}
    {(stage==='VERIFIED'||stage==='HANDED_OVER')&&order?<VerificationView order={order} intent={intent} variant={characterVariant}/>:null}
    {stage==='PICKUP_EXCEPTION'&&order?<ExceptionView order={order} variant={characterVariant} onHelp={onHelp} onOrders={onOrders}/>:null}
    {stage==='COMPLETED'?<CompletedView order={order} historyOrder={historyOrder} variant={characterVariant} onOrders={onOrders} onHome={onHome}/>:null}
    {stage!=='COMPLETED'?<section className="ui7-readonly-refresh"><button type="button" onClick={onRefresh}>重新整理</button><small>只會更新取餐進度，唔會自行改成已核對、已交付或已完成。</small></section>:null}
  </section>;
}
