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
type Ui8CharacterVariant='male'|'female';

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
  :'總額確認中';

function StateBanner({state}:{state:Ui8PageState}){
  if(state==='READY')return null;
  const label:Record<Exclude<Ui8PageState,'READY'>,string>={
    LOADING:'更新中',
    EMPTY:'暫時未有訂單',
    ERROR:'更新失敗',
    OFFLINE:'目前離線',
    STALE:'資料需要更新',
    UNKNOWN:'確認中',
  };
  const detail:Record<Exclude<Ui8PageState,'READY'>,string>={
    LOADING:'正在更新訂單紀錄。',
    EMPTY:'呢個分類暫時未有訂單。',
    ERROR:'訂單資料暫時未能更新；歷史訂單會保持原樣。',
    OFFLINE:'目前離線；可以先查看已載入嘅訂單紀錄。',
    STALE:'顯示最近一次已知訂單資料；再次下單前會重新確認。',
    UNKNOWN:'訂單狀態仍在確認；請稍後再試。',
  };
  return <section className={"ui8-state state-"+state.toLowerCase()} role="status"><strong>{label[state]}</strong><p>{detail[state]}</p></section>;
}

function IdentityPair({displayCode,pickupCode}:{displayCode:string;pickupCode?:string}){
  return <div className="ui8-identity-pair">
    <div><span>流水號</span><strong>{displayCode}</strong><small>店舖取餐流水號</small></div>
    <div><span>取餐碼</span><strong>{pickupCode??'----'}</strong><small>取餐核對短碼</small></div>
    <p>流水號同取餐碼用途不同；取餐時跟畫面提示出示即可。</p>
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
  reorderFresh,
  onBack,
  onReorder,
  onRefresh,
}:{
  order:CustomerHistoryProjection;
  reorderFresh:boolean;
  onBack:()=>void;
  onReorder:(order:CustomerHistoryProjection)=>void;
  onRefresh:()=>void;
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
    <section className="ui8-history-warning"><strong>歷史訂單</strong><p>再次下單會按目前餐單、價格、供應同優惠重新確認；舊訂單唔會被改動。</p></section>
    <div className="ui8-detail-actions">
      <ActionButton wide disabled={!order.reorderEligible||!reorderFresh} onClick={()=>onReorder(order)}>{!order.reorderEligible?'呢張舊訂單暫時未支援再來一單':reorderFresh?'再來一單':'需要更新目前餐單'}</ActionButton>
      {!reorderFresh&&order.reorderEligible?<section className="ui8-reorder-unavailable" role="status"><strong>暫時未能開始再來一單</strong><p>歷史訂單仍可查看；更新目前餐單後就可以再來一單。</p><button type="button" onClick={onRefresh}>重新整理</button></section>:null}
      <button className="ui8-template-unavailable" disabled aria-disabled="true">設為常用訂單</button>
      <small>常用訂單功能尚未開放</small>
    </div>
  </section>;
}

function CopyIntent({
  order,
  cart,
  issueCount,
  onContinue,
  onBack,
  variant,
}:{
  order:CustomerHistoryProjection;
  cart:readonly CustomerCartLine[];
  issueCount:number;
  onContinue:()=>void;
  onBack:()=>void;
  variant:Ui8CharacterVariant;
}){
  return <section className="ui8-copy-intent">
    <button className="ui8-back" onClick={onBack}>返回歷史訂單</button>
    <header className="ui8-copy-hero">
      <div className="ui8-brand-art-slot" data-final-art-pending="true" data-character-slot={variant} role="img" aria-label="磨飯品牌角色插圖位置"/>
      <span>再來一單</span><h1>正在建立新購物車</h1>
      <p>會按你上次嘅選擇建立一個新記憶罐，舊訂單保持不變。</p>
    </header>
    <ol className="ui8-copy-checks">
      <li className="done"><b>上次選擇</b><span>保留上次揀過嘅餐點同選項</span></li>
      <li className="done"><b>目前價格</b><span>會用今日餐單價格重新確認</span></li>
      <li className="done"><b>目前供應</b><span>會檢查餐點同選項而家仲有冇供應</span></li>
      <li className={issueCount?'attention':'done'}><b>需要你確認</b><span>{issueCount?issueCount+' 項餐點需要局部修正':'目前選擇可以繼續'}</span></li>
    </ol>
    <section className="ui8-copy-summary"><span>新記憶罐</span><strong>{cart.length} 項餐點</strong><small>只帶返餐點選擇；付款、取餐進度同舊優惠狀態都唔會複製。</small></section>
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
    <header className="ui8-section-hero"><span>需要你確認</span><h1>需要修正 {affected.size} 項</h1><p>只會改受影響餐點；其他 {retained.length} 項會原樣保留。</p></header>
    {retained.length?<section className="ui8-retained-lines"><span>保留</span>{retained.map(line=><b key={line.lineId}>{line.productName} ×{line.quantity}</b>)}</section>:null}
    <div className="ui8-repair-list">{cart.filter(line=>affected.has(line.lineId)).map(line=>{
      const repairItem=repairs.find(item=>item.lineId===line.lineId);
      const product=menu?.products.find(item=>item.productId===line.productId);
      const canAcceptCurrent=Boolean(repairItem?.canAcceptCurrentPrice||(!repairItem&&line.attention&&line.publishedUnitPriceMinor!==undefined));
      return <article key={line.lineId}>
        {product?.imageUrl?<img src={product.imageUrl} alt={product.imageAlt??product.name}/>:<i aria-hidden="true"/>}
        <div><strong>{line.productName}</strong><p>{line.attention??repairItem?.detail??'目前資料需要重新確認'}</p>{repairItem?.previousUnitPriceMinor!==undefined&&repairItem.currentUnitPriceMinor!==undefined?<small>{'上次 HK$'+(repairItem.previousUnitPriceMinor/100).toFixed(0)+' → 而家 HK$'+(repairItem.currentUnitPriceMinor/100).toFixed(0)}</small>:null}</div>
        <div className="ui8-line-actions">
          {canAcceptCurrent?<button onClick={()=>onAccept(line.lineId)}>接受目前資料</button>:null}
          {product?.available?<button onClick={()=>onEdit(line)}>修正呢一項</button>:null}
          <button onClick={()=>onRemove(line.lineId)}>移除</button>
        </div>
      </article>;
    })}</div>
    <section className="ui8-repair-note"><strong>價錢有變會重新確認</strong><span>會用目前價格、供應同優惠狀態。</span></section>
    <ActionButton wide disabled={affected.size>0} onClick={onContinue}>完成局部修正</ActionButton>
  </section>;
}

function FinalReview({
  cart,
  quote,
  fresh,
  onCart,
  onRepair,
}:{
  cart:readonly CustomerCartLine[];
  quote:CustomerQuoteSnapshot|null;
  fresh:boolean;
  onCart:()=>void;
  onRepair:()=>void;
}){
  const ready=Boolean(fresh&&cart.length&&quote?.freshness==='CURRENT'&&!cart.some(line=>line.attention));
  return <section className="ui8-final-review">
    <header className="ui8-section-hero"><span>最後確認</span><h1>新記憶罐已準備好</h1><p>以下係今日餐單同最新價格；舊訂單保持不變。</p></header>
    <section className="ui8-review-lines">{cart.map(line=><article key={line.lineId}><div><strong>{line.productName} ×{line.quantity}</strong><small>{line.selections.map(item=>item.optionName).join('、')||'標準設定'}</small></div><b>{line.publishedUnitPriceMinor!==undefined?'HK$'+(line.publishedUnitPriceMinor/100).toFixed(0):'待修正'}</b></article>)}</section>
    <section className={"ui8-current-quote "+(quote?.freshness.toLowerCase()??'unknown')}><span>目前總額</span><AnimatedValue as="strong">{moneyLabel(quote)}</AnimatedValue><small>{quote?.freshness==='CURRENT'?'已更新':quote?.freshness==='MATERIAL_CHANGE'?'需要重新確認':quote?.freshness==='STALE'?'資料需要更新':'確認中'}</small></section>
    {!ready?<section className="ui8-review-block"><strong>仲有資料需要確認</strong><p>{fresh?'總額未更新完成，或者仲有受影響餐點。':'需要重新更新目前餐單；已揀好嘅餐點會保留。'}</p><ActionButton variant="secondary" wide onClick={onRepair}>返回修正餐點</ActionButton></section>:null}
    <ActionButton wide disabled={!ready} onClick={onCart}>前往記憶罐</ActionButton>
    <small className="ui8-checkout-lock">下一步會返到正常結帳流程，確認好先正式送出訂單。</small>
  </section>;
}

export function HistoryReorderUi8View({
  segment,setSegment,phase,setPhase,
  active,history,selectedHistory,
  cart,repairs,quote,menu,connection,browserOnline,
  onOpenCurrent,onOpenHistory,onStartReorder,onAcceptRepair,onEditRepair,onRemoveLine,onGoCart,onBrowse,onRefresh,
  characterVariant='male',
}:{
  segment:Ui8OrderSegment;setSegment:(value:Ui8OrderSegment)=>void;
  phase:Ui8Phase;setPhase:(value:Ui8Phase)=>void;
  active:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];selectedHistory:CustomerHistoryProjection|null;
  cart:readonly CustomerCartLine[];repairs:readonly CustomerCartRepair[];quote:CustomerQuoteSnapshot|null;menu:CustomerMenuSnapshot|null|undefined;
  connection:CustomerConnectionState;browserOnline:boolean;
  onOpenCurrent:(order:CustomerOrderProjection)=>void;onOpenHistory:(order:CustomerHistoryProjection)=>void;
  onStartReorder:(order:CustomerHistoryProjection)=>void;onAcceptRepair:(lineId:string)=>void;onEditRepair:(line:CustomerCartLine)=>void;onRemoveLine:(lineId:string)=>void;
  onGoCart:()=>void;onBrowse:()=>void;onRefresh:()=>void;
  characterVariant?:Ui8CharacterVariant;
}){
  const reorderFresh=browserOnline&&connection==='READY'&&Boolean(menu);
  if(phase!=='LIST'&&selectedHistory){
    if(phase==='DETAIL')return <section className="page ui8-page"><HistoryDetail order={selectedHistory} reorderFresh={reorderFresh} onBack={()=>setPhase('LIST')} onReorder={onStartReorder} onRefresh={onRefresh}/></section>;
    if(!reorderFresh)return <section className="page ui8-page ui8-freshness-block" data-ui8-reorder-freshness="BLOCKED">
      <StateBanner state={pageState(connection,browserOnline,false)}/>
      <header className="ui8-section-hero"><span>再來一單暫停</span><h1>需要更新目前餐單</h1><p>已揀好嘅餐點會保留；更新完成後再繼續確認。</p></header>
      <section className="ui8-copy-summary"><span>已保留記憶罐</span><strong>{cart.length} 項餐點</strong><small>更新完成後會再確認目前餐單同價格。</small></section>
      <ActionButton wide onClick={onRefresh}>重新整理</ActionButton>
      <ActionButton variant="secondary" wide onClick={()=>setPhase('DETAIL')}>返回歷史訂單</ActionButton>
    </section>;
    if(phase==='COPY')return <section className="page ui8-page"><CopyIntent order={selectedHistory} cart={cart} issueCount={new Set([...repairs.map(item=>item.lineId),...cart.filter(line=>line.attention).map(line=>line.lineId)]).size} onContinue={()=>setPhase(repairs.length||cart.some(line=>line.attention)?'REPAIR':'REVIEW')} onBack={()=>setPhase('DETAIL')} variant={characterVariant}/></section>;
    if(phase==='REPAIR')return <section className="page ui8-page"><Repair cart={cart} repairs={repairs} menu={menu} onAccept={onAcceptRepair} onEdit={onEditRepair} onRemove={onRemoveLine} onContinue={()=>setPhase('REVIEW')}/></section>;
    if(phase==='REVIEW')return <section className="page ui8-page"><FinalReview cart={cart} quote={quote} fresh={reorderFresh} onCart={onGoCart} onRepair={()=>setPhase('REPAIR')}/></section>;
  }

  const rows=segment==='current'?active:segment==='completed'?history:[...active,...history];
  const state=pageState(connection,browserOnline,rows.length>0);
  return <section className="page ui8-page" data-ui8-state={state}>
    <header className="ui8-list-hero"><span>我的訂單</span><h1>訂單紀錄</h1><p>可以查看進行中同已完成訂單；「再來一單」會重新確認今日餐單。</p></header>
    <StateBanner state={state}/>
    <div className="ui8-filters" role="tablist" aria-label="訂單篩選">
      <button role="tab" aria-selected={segment==='current'} className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button>
      <button role="tab" aria-selected={segment==='completed'} className={segment==='completed'?'active':''} onClick={()=>setSegment('completed')}>已完成</button>
      <button role="tab" aria-selected={segment==='all'} className={segment==='all'?'active':''} onClick={()=>setSegment('all')}>全部</button>
    </div>
    {rows.length?<div className="ui8-order-list">
      {(segment==='current'||segment==='all')?active.map(order=><CurrentCard key={'current-'+order.orderId} order={order} onOpen={onOpenCurrent}/>):null}
      {(segment==='completed'||segment==='all')?history.map(order=><HistoryCard key={'history-'+order.orderId} order={order} onOpen={onOpenHistory}/>):null}
    </div>:state==='EMPTY'?<EmptyState title="呢個分類暫時冇訂單" detail="有新訂單或完成訂單後，就會喺呢度見到。"><ActionButton onClick={onBrowse}>開始點餐</ActionButton></EmptyState>:null}
  </section>;
}
