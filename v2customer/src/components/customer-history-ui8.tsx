import {ActionButton,AnimatedValue,EmptyState} from '../ui/primitives';
import type {
  CustomerCartLine,
  CustomerCartRepair,
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerMenuSnapshot,
  CustomerOrderProjection,
  CustomerQuoteSnapshot,
} from '../product-types';

export type Ui8OrderSegment='current'|'completed'|'all';
export type Ui8Phase='LIST'|'DETAIL'|'COPY'|'REPAIR'|'REVIEW';

export const CUSTOMER_UI8_SAVED_TEMPLATE_SEAM_CLASSIFICATION=
  'SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_SAVED_ORDER_TEMPLATE_MUTATION_SEAM_MISSING_IN_CURRENT_MAIN' as const;

type Ui8PageState='LOADING'|'READY'|'EMPTY'|'ERROR'|'OFFLINE'|'STALE'|'UNKNOWN';

const pageState=(connection:CustomerConnectionState,browserOnline:boolean,hasRows:boolean):Ui8PageState=>{
  if(!browserOnline||connection==='NOT_CONNECTED')return 'OFFLINE';
  if(connection==='LOADING')return 'LOADING';
  if(connection==='ERROR')return 'ERROR';
  if(connection==='STALE'||connection==='PARTIAL')return 'STALE';
  if(connection==='UNKNOWN')return 'UNKNOWN';
  return hasRows?'READY':'EMPTY';
};
const timeLabel=(value:string)=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '時間待讀回';
  return new Intl.DateTimeFormat('zh-HK',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
};
const moneyLabel=(quote:CustomerQuoteSnapshot|null)=>quote
  ?new Intl.NumberFormat('zh-HK',{style:'currency',currency:quote.currency}).format(quote.totalMinor/100)
  :'Current Quote 待讀回';

function StateBanner({state}:{state:Ui8PageState}){
  if(state==='READY')return null;
  const detail:Record<Exclude<Ui8PageState,'READY'>,string>={
    LOADING:'正在讀取 canonical Order projection。',
    EMPTY:'呢個分類暫時冇訂單；EMPTY 唔等於連線錯誤。',
    ERROR:'訂單資料同步失敗；歷史 Order 唔會因此被改寫。',
    OFFLINE:'目前離線；只可查看已讀回資料，唔會開始未確認 Reorder。',
    STALE:'顯示最近一次 canonical projection；新交易前仍會重新驗證 current truth。',
    UNKNOWN:'訂單狀態未明；禁止由 Stage 8 直接建立或提交新 Order。',
  };
  return <section className={"ui8-state state-"+state.toLowerCase()} role="status"><strong>{state}</strong><p>{detail[state]}</p></section>;
}

function IdentityPair({displayCode,pickupCode}:{displayCode:string;pickupCode?:string}){
  return <div className="ui8-identity-pair">
    <div><span>流水號</span><strong>{displayCode}</strong><small>Display Number</small></div>
    <div><span>取餐碼</span><strong>{pickupCode??'----'}</strong><small>Pickup Code</small></div>
    <p>Pickup Code ≠ Display Number；唔會顯示 UUID 或 internal Order ID。</p>
  </div>;
}

function CurrentCard({order,onOpen}:{order:CustomerOrderProjection;onOpen:(order:CustomerOrderProjection)=>void}){
  return <article className="ui8-order-card current">
    <header><span>{order.stage==='READY'?'可取餐':order.stage==='DELAYED'?'稍有延誤':'進行中'}</span><time>{timeLabel(order.observedAt)}</time></header>
    <h2>{order.itemSummary||'餐點資料待讀回'}</h2>
    <div className="ui8-card-meta"><b>{order.amountLabel??'金額待讀回'}</b><span>流水號 {order.displayCode}</span><span>取餐碼 {order.pickupCode??'----'}</span></div>
    <ActionButton variant="secondary" wide onClick={()=>onOpen(order)}>訂單詳情</ActionButton>
  </article>;
}

function HistoryCard({order,onOpen}:{order:CustomerHistoryProjection;onOpen:(order:CustomerHistoryProjection)=>void}){
  return <article className="ui8-order-card completed">
    <header><span>已完成</span><time>{timeLabel(order.completedAt)}</time></header>
    <h2>{order.itemSummary||'歷史餐點'}</h2>
    <div className="ui8-card-meta"><b>{order.amountLabel??'歷史金額未提供'}</b><span>流水號 {order.displayCode}</span><span>取餐碼 {order.pickupCode??'----'}</span></div>
    <ActionButton variant="secondary" wide onClick={()=>onOpen(order)}>訂單詳情</ActionButton>
  </article>;
}

function HistoryDetail({
  order,
  onBack,
  onReorder,
}:{
  order:CustomerHistoryProjection;
  onBack:()=>void;
  onReorder:(order:CustomerHistoryProjection)=>void;
}){
  return <section className="ui8-history-detail">
    <button className="ui8-back" onClick={onBack}>返回訂單列表</button>
    <header className="ui8-detail-hero"><span>歷史訂單詳情</span><h1>已完成</h1><time>{timeLabel(order.completedAt)}</time></header>
    <IdentityPair displayCode={order.displayCode} pickupCode={order.pickupCode}/>
    <section className="ui8-history-lines">
      <header><span>歷史快照</span><b>{order.amountLabel??'歷史總額未提供'}</b></header>
      {order.historicalLines.length?order.historicalLines.map((line,index)=><article key={index}>
        <div><strong>{line.name} ×{line.quantity}</strong>{line.detail?<small>{line.detail}</small>:null}</div>
        <div><span>{line.historicalUnitLabel}</span><b>{line.historicalLineTotalLabel}</b></div>
      </article>):<p>{order.itemSummary}</p>}
    </section>
    <section className="ui8-history-warning"><strong>歷史快照｜只讀</strong><p>舊 Price / Sellability / Coupon eligibility 或 redemption 不可直接帶去新交易。舊 Order 唔會被重新開啟或修改。</p></section>
    <div className="ui8-detail-actions">
      <ActionButton wide disabled={!order.reorderEligible} onClick={()=>onReorder(order)}>{order.reorderEligible?'再來一單':'舊訂單未有可安全複製嘅 Intent'}</ActionButton>
      <button className="ui8-template-unavailable" disabled aria-disabled="true">設為常用訂單</button>
      <small>{CUSTOMER_UI8_SAVED_TEMPLATE_SEAM_CLASSIFICATION}</small>
    </div>
  </section>;
}

function CopyIntent({
  order,
  cart,
  issueCount,
  onContinue,
  onBack,
}:{
  order:CustomerHistoryProjection;
  cart:readonly CustomerCartLine[];
  issueCount:number;
  onContinue:()=>void;
  onBack:()=>void;
}){
  return <section className="ui8-copy-intent">
    <button className="ui8-back" onClick={onBack}>返回歷史訂單</button>
    <header className="ui8-copy-hero">
      <img src="/brand/stage7-pickup-male.svg" alt="磨飯品牌角色"/>
      <span>再來一單</span><h1>正在建立新購物車</h1>
      <p>Past Order → Copy Intent → New Cart。唔會重開舊 Order。</p>
    </header>
    <ol className="ui8-copy-checks">
      <li className="done"><b>Copy Intent</b><span>只複製 Product / Option / Modifier / Combo 意圖</span></li>
      <li className="done"><b>Current Price</b><span>舊價唔會成為 current transaction truth</span></li>
      <li className="done"><b>Sellability</b><span>按目前餐牌重新驗證</span></li>
      <li className={issueCount?'attention':'done'}><b>Required / Combo</b><span>{issueCount?issueCount+' 個受影響 Line 需要局部修正':'目前設定已通過 current validation'}</span></li>
    </ol>
    <section className="ui8-copy-summary"><span>新購物車</span><strong>{cart.length} 個 Line</strong><small>舊 Formal Order identity / payment evidence / fulfillment / coupon redemption 全部冇複製。</small></section>
    <ActionButton wide onClick={onContinue}>繼續驗證</ActionButton>
  </section>;
}

function Repair({
  cart,
  repairs,
  menu,
  onAccept,
  onEdit,
  onRemove,
  onContinue,
}:{
  cart:readonly CustomerCartLine[];
  repairs:readonly CustomerCartRepair[];
  menu:CustomerMenuSnapshot|null|undefined;
  onAccept:(lineId:string)=>void;
  onEdit:(line:CustomerCartLine)=>void;
  onRemove:(lineId:string)=>void;
  onContinue:()=>void;
}){
  const affected=new Set([...repairs.map(item=>item.lineId),...cart.filter(line=>line.attention).map(line=>line.lineId)]);
  const retained=cart.filter(line=>!affected.has(line.lineId));
  return <section className="ui8-repair">
    <header className="ui8-section-hero"><span>局部 Repair</span><h1>需要修正 {affected.size} 項</h1><p>只改受影響 Line；其他 {retained.length} 項保持新購物車目前狀態。</p></header>
    {retained.length?<section className="ui8-retained-lines"><span>保留</span>{retained.map(line=><b key={line.lineId}>{line.productName} ×{line.quantity}</b>)}</section>:null}
    <div className="ui8-repair-list">{cart.filter(line=>affected.has(line.lineId)).map(line=>{
      const repairItem=repairs.find(item=>item.lineId===line.lineId);
      const product=menu?.products.find(item=>item.productId===line.productId);
      return <article key={line.lineId}>
        {product?.imageUrl?<img src={product.imageUrl} alt={product.imageAlt??product.name}/>:<i aria-hidden="true"/>}
        <div><strong>{line.productName}</strong><p>{line.attention??repairItem?.detail??'目前資料需要重新確認'}</p>{repairItem?.previousUnitPriceMinor!==undefined&&repairItem.currentUnitPriceMinor!==undefined?<small>{'舊 Cart fact HK$'+(repairItem.previousUnitPriceMinor/100).toFixed(0)+' → Current HK$'+(repairItem.currentUnitPriceMinor/100).toFixed(0)}</small>:null}</div>
        <div className="ui8-line-actions">
          {repairItem?.canAcceptCurrentPrice||line.attention&&line.publishedUnitPriceMinor!==undefined?<button onClick={()=>onAccept(line.lineId)}>接受目前資料</button>:null}
          {product?<button onClick={()=>onEdit(line)}>修正呢一項</button>:null}
          <button onClick={()=>onRemove(line.lineId)}>移除</button>
        </div>
      </article>;
    })}</div>
    <section className="ui8-repair-note"><strong>價錢有變會重新 Quote</strong><span>舊 Price / Sellability / Coupon 唔會沿用。</span></section>
    <ActionButton wide disabled={affected.size>0} onClick={onContinue}>完成局部修正</ActionButton>
  </section>;
}

function FinalReview({
  cart,
  quote,
  onCart,
  onRepair,
}:{
  cart:readonly CustomerCartLine[];
  quote:CustomerQuoteSnapshot|null;
  onCart:()=>void;
  onRepair:()=>void;
}){
  const ready=Boolean(cart.length&&quote?.freshness==='CURRENT'&&!cart.some(line=>line.attention));
  return <section className="ui8-final-review">
    <header className="ui8-section-hero"><span>Final Review</span><h1>新購物車已準備好</h1><p>以下全部係 current catalog / current quote；歷史 Order 保持不變。</p></header>
    <section className="ui8-review-lines">{cart.map(line=><article key={line.lineId}><div><strong>{line.productName} ×{line.quantity}</strong><small>{line.selections.map(item=>item.optionName).join('、')||'標準設定'}</small></div><b>{line.publishedUnitPriceMinor!==undefined?'HK$'+(line.publishedUnitPriceMinor/100).toFixed(0):'待修正'}</b></article>)}</section>
    <section className={"ui8-current-quote "+(quote?.freshness.toLowerCase()??'unknown')}><span>Current Quote</span><AnimatedValue as="strong">{moneyLabel(quote)}</AnimatedValue><small>{quote?.freshness??'UNKNOWN'} · revision {quote?.revision??'待讀回'}</small></section>
    {!ready?<section className="ui8-review-block"><strong>未可以離開 Repair</strong><p>Current Quote 未係 CURRENT，或者仍有受影響 Line。</p><ActionButton variant="secondary" wide onClick={onRepair}>返回局部 Repair</ActionButton></section>:null}
    <ActionButton wide disabled={!ready} onClick={onCart}>前往記憶罐</ActionButton>
    <small className="ui8-checkout-lock">之後只可經正常 UI4 Checkout → UI5 Submit；Stage 8 本身唔會 commit Order。</small>
  </section>;
}

export function HistoryReorderUi8View({
  segment,setSegment,phase,setPhase,
  active,history,selectedHistory,
  cart,repairs,quote,menu,connection,browserOnline,
  onOpenCurrent,onOpenHistory,onStartReorder,onAcceptRepair,onEditRepair,onRemoveLine,onGoCart,onBrowse,
}:{
  segment:Ui8OrderSegment;setSegment:(value:Ui8OrderSegment)=>void;
  phase:Ui8Phase;setPhase:(value:Ui8Phase)=>void;
  active:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];selectedHistory:CustomerHistoryProjection|null;
  cart:readonly CustomerCartLine[];repairs:readonly CustomerCartRepair[];quote:CustomerQuoteSnapshot|null;menu:CustomerMenuSnapshot|null|undefined;
  connection:CustomerConnectionState;browserOnline:boolean;
  onOpenCurrent:(order:CustomerOrderProjection)=>void;onOpenHistory:(order:CustomerHistoryProjection)=>void;
  onStartReorder:(order:CustomerHistoryProjection)=>void;onAcceptRepair:(lineId:string)=>void;onEditRepair:(line:CustomerCartLine)=>void;onRemoveLine:(lineId:string)=>void;
  onGoCart:()=>void;onBrowse:()=>void;
}){
  if(phase!=='LIST'&&selectedHistory){
    if(phase==='DETAIL')return <section className="page ui8-page"><HistoryDetail order={selectedHistory} onBack={()=>setPhase('LIST')} onReorder={onStartReorder}/></section>;
    if(phase==='COPY')return <section className="page ui8-page"><CopyIntent order={selectedHistory} cart={cart} issueCount={new Set([...repairs.map(item=>item.lineId),...cart.filter(line=>line.attention).map(line=>line.lineId)]).size} onContinue={()=>setPhase(repairs.length||cart.some(line=>line.attention)?'REPAIR':'REVIEW')} onBack={()=>setPhase('DETAIL')}/></section>;
    if(phase==='REPAIR')return <section className="page ui8-page"><Repair cart={cart} repairs={repairs} menu={menu} onAccept={onAcceptRepair} onEdit={onEditRepair} onRemove={onRemoveLine} onContinue={()=>setPhase('REVIEW')}/></section>;
    if(phase==='REVIEW')return <section className="page ui8-page"><FinalReview cart={cart} quote={quote} onCart={onGoCart} onRepair={()=>setPhase('REPAIR')}/></section>;
  }

  const rows=segment==='current'?active:segment==='completed'?history:[...active,...history];
  const state=pageState(connection,browserOnline,rows.length>0);
  return <section className="page ui8-page" data-ui8-state={state}>
    <header className="ui8-list-hero"><span>我的訂單</span><h1>訂單紀錄</h1><p>Historical Order 只讀；「再來一單」只會建立 New Cart。</p></header>
    <StateBanner state={state}/>
    <div className="ui8-filters" role="tablist" aria-label="訂單篩選">
      <button role="tab" aria-selected={segment==='current'} className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button>
      <button role="tab" aria-selected={segment==='completed'} className={segment==='completed'?'active':''} onClick={()=>setSegment('completed')}>已完成</button>
      <button role="tab" aria-selected={segment==='all'} className={segment==='all'?'active':''} onClick={()=>setSegment('all')}>全部</button>
    </div>
    {rows.length?<div className="ui8-order-list">
      {(segment==='current'||segment==='all')?active.map(order=><CurrentCard key={'current-'+order.orderId} order={order} onOpen={onOpenCurrent}/>):null}
      {(segment==='completed'||segment==='all')?history.map(order=><HistoryCard key={'history-'+order.orderId} order={order} onOpen={onOpenHistory}/>):null}
    </div>:state==='EMPTY'?<EmptyState title="呢個分類暫時冇訂單" detail="完成或建立訂單後會按 canonical projection 出現。"><ActionButton onClick={onBrowse}>開始點餐</ActionButton></EmptyState>:null}
  </section>;
}
