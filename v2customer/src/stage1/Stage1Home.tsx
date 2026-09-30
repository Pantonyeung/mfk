import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerProduct,
  CustomerReadModelSnapshot,
} from '../product-types';
import type {ProductOriginRect} from '../ui/primitives';
import {CUSTOMER_FINAL_SOURCE} from '../source-assets';
import './stage1.css';

const OFFICIAL_LOGO_URL=CUSTOMER_FINAL_SOURCE.logo.url;
const HOME_MALE='/brand/stage0-male.webp';
const HOME_FEMALE='/brand/stage0-female.webp';

const statusLabel=(value:boolean|undefined)=>{
  if(value===true)return '營業中';
  if(value===false)return '休息中';
  return '更新中';
};

const operatingHoursLabel=(snapshot:CustomerReadModelSnapshot|null)=>{
  const raw=(snapshot?.store as unknown as {todayHoursLabel?:string;hoursLabel?:string})?.todayHoursLabel
    ??(snapshot?.store as unknown as {hoursLabel?:string})?.hoursLabel;
  return String(raw||'').trim();
};

const orderStateLabel=(stage:CustomerOrderStage)=>{
  const labels:Record<CustomerOrderStage,string>={
    RECEIVED:'等店舖確認',
    REJECTED:'未能接單',
    CANCELED:'已取消',
    ACCEPTED:'已接單',
    PREPARING:'製作中',
    DELAYED:'稍有延誤',
    READY:'可以取餐',
    ARRIVED:'已到店',
    VERIFIED:'已核對',
    PICKUP_VERIFICATION:'核對中',
    PICKUP_EXCEPTION:'需要協助',
    HANDED_OVER:'已交收',
    COMPLETED:'已完成',
    UNKNOWN:'確認中',
  };
  return labels[stage];
};

function SearchIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.8"/><path d="m15 15 4.2 4.2"/></svg>;
}
function PinIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>;
}
function HeartIcon({filled=false}:{filled?:boolean}){
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled?'is-filled':''}><path d="M12 20S4 15.2 4 9.2C4 6.3 5.9 4.5 8.2 4.5c1.6 0 3 .9 3.8 2.2.8-1.3 2.2-2.2 3.8-2.2 2.3 0 4.2 1.8 4.2 4.7C20 15.2 12 20 12 20Z"/></svg>;
}
function TicketIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4v-3Z"/><path d="M9 8.5v7"/></svg>;
}
function GiftIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7C9 7 7 6 7 4.5S9 3 10 4c1 .8 2 3 2 3Zm0 0c3 0 5-1 5-2.5S15 3 14 4c-1 .8-2 3-2 3Z"/></svg>;
}

function Stage1StatePanel({connection,browserOnline,onRetry}:{connection:CustomerConnectionState;browserOnline:boolean;onRetry:()=>void}){
  if(!browserOnline)return <section className="stage1-state-chip" role="status"><strong>離線</strong><span>顯示已載入資料</span></section>;
  if(connection==='ERROR')return <section className="stage1-state-chip state-error" role="alert"><strong>暫時未能更新</strong><button type="button" onClick={onRetry}>重試</button></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage1-state-chip" role="status"><strong>更新中</strong><span>顯示最近資料</span></section>;
  if(connection==='NOT_CONNECTED')return <section className="stage1-state-chip" role="status"><strong>暫未連接</strong></section>;
  if(connection==='LOADING')return <section className="stage1-state-chip" role="status" aria-busy="true"><strong>更新中</strong></section>;
  if(connection==='UNKNOWN')return <section className="stage1-state-chip" role="status"><strong>確認中</strong></section>;
  return null;
}

function ProductMedia({product}:{product:CustomerProduct}){
  return <span className="stage1-product-media">
    {product.imageUrl
      ?<img src={product.imageUrl} alt={product.imageAlt??product.name} loading="lazy" decoding="async"/>
      :<span className="stage1-product-image-empty" aria-hidden="true"><i/></span>}
  </span>;
}

function SkeletonProducts(){
  return <div className="stage1-top6-grid" aria-hidden="true">
    {[0,1,2,3].map(index=><article className="stage1-product-card stage1-product-skeleton" key={index}>
      <span className="stage1-product-media"><i/></span>
      <span className="stage1-product-info"><i/><i className="short"/></span>
    </article>)}
  </div>;
}

export function Stage1Home({
  snapshot,connection,browserOnline,activeOrders,history,recommendations,
  favoriteProductIds,onToggleFavorite,
  onRetry,onProduct,onBrowse,onFavorites,onLimited,onOrders,onMember,onBuyAgain,
}:{
  snapshot:CustomerReadModelSnapshot|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  activeOrders:readonly CustomerOrderProjection[];
  history:readonly CustomerHistoryProjection[];
  recommendations:readonly CustomerRecommendation[];
  favoriteProductIds:ReadonlySet<string>;
  onToggleFavorite:(productId:string)=>void;
  cartCount:number;
  onRetry:()=>void;
  onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;
  onBrowse:()=>void;
  onFavorites:()=>void;
  onLimited:()=>void;
  onJar:()=>void;
  onOrders:()=>void;
  onHistory:()=>void;
  onMember:()=>void;
  onBuyAgain:(order:CustomerHistoryProjection)=>void;
}){
  const store=snapshot?.store;
  const todayHours=operatingHoursLabel(snapshot);
  const member=snapshot?.member;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const canBrowse=Boolean(snapshot?.menu);
  const topRecommendations=recommendations.filter(item=>item.product.available).slice(0,6);
  const availableCouponCount=member?.state==='READY'&&member.coupons
    ?member.coupons.filter(item=>item.state==='AVAILABLE').length
    :0;
  const homeMode=currentOrder?'ORDER_ACTIVE':store?.channelAvailable===false?'CLOSED':availableCouponCount?'CAMPAIGN':history.length?'RETURNING':'NORMAL';
  const headline=homeMode==='ORDER_ACTIVE'
    ?'辛苦了，美味準備緊。'
    :homeMode==='CLOSED'
      ?'今日先揀定，下次開店再食。'
      :homeMode==='RETURNING'
        ?'歡迎返嚟，今日都要好好食飯。'
        :homeMode==='CAMPAIGN'
          ?'今日有好嘢，記得帶走。'
          :'早安，今天想食咩？';
  const subline=homeMode==='ORDER_ACTIVE'
    ?'一碗好飯，補充生活嘅能量。'
    :homeMode==='CLOSED'
      ?'好味道，總係值得期待。'
      :homeMode==='RETURNING'
        ?'熟悉嘅味道，隨時再嚟一餐。'
        :homeMode==='CAMPAIGN'
          ?'好食嘅飯，總會帶嚟好心情。'
          :'一碗好飯，讓日常更有味。';
  const loadingProducts=!snapshot?.menu&&(connection==='LOADING'||connection==='STALE'||connection==='PARTIAL'||connection==='NOT_CONNECTED');

  return <div className="stage1-home" data-home-mode={homeMode}>
    <header className="stage1-premium-header">
      <button className="stage1-logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})} aria-label="首頁">
        <img src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      </button>
      <div className="stage1-store-pill" aria-label="目前店舖">
        <PinIcon/>
        <span><strong>{store?.storeName??'磨飯'}</strong><small>{statusLabel(store?.channelAvailable)}{todayHours?' · '+todayHours:''}</small></span>
      </div>
    </header>

    <main className="stage1-content">
      <Stage1StatePanel connection={connection} browserOnline={browserOnline} onRetry={onRetry}/>

      {currentOrder?<button className="stage1-live-order" type="button" onClick={onOrders}>
        <span className="stage1-live-copy">
          <small>訂單</small>
          <strong>{orderStateLabel(currentOrder.stage)}</strong>
          <em>{currentOrder.displayCode}</em>
        </span>
        <span className="stage1-live-right">
          {currentOrder.stage==='READY'&&currentOrder.pickupCode?<strong>取餐碼 {currentOrder.pickupCode}</strong>:null}
          {currentOrder.etaLabel?<b>{currentOrder.etaLabel}</b>:null}
          <i aria-hidden="true">›</i>
        </span>
      </button>:null}

      <section className="stage1-welcome">
        <div className="stage1-welcome-copy">
          <h1>{headline}</h1>
          <p>{subline}</p>
        </div>
        <div className="stage1-welcome-art" aria-hidden="true">
          <img className="male" src={HOME_MALE} alt=""/>
          <img className="female" src={HOME_FEMALE} alt=""/>
        </div>
      </section>

      <button className="stage1-search-entry" type="button" onClick={onBrowse}>
        <SearchIcon/>
        <strong>搜尋喜歡的餐點</strong>
      </button>

      <button className="stage1-brand-banner" type="button" onClick={onBrowse}>
        <span className="stage1-banner-copy">
          <small>More Fun · 好飯好日常</small>
          <strong>好好吃飯，<br/>就是一件開心的事。</strong>
          <em>開始點單</em>
        </span>
        <span className="stage1-banner-art" aria-hidden="true">
          <img className="male" src={HOME_MALE} alt=""/>
          <img className="female" src={HOME_FEMALE} alt=""/>
        </span>
        <span className="stage1-banner-dots" aria-hidden="true"><i/><i/><i/></span>
      </button>

      {store?.notice?<section className="stage1-announcement-strip" role="status">
        <span aria-hidden="true">✦</span><p>{store.notice}</p>
      </section>:null}

      <section className="stage1-quick-entry-section" aria-label="快捷入口">
        <button type="button" onClick={onFavorites}>
          <span className="stage1-shortcut-icon heart"><HeartIcon filled/></span>
          <span className="stage1-shortcut-copy"><strong>我的收藏</strong><small>喜愛的美味</small></span>
          <i aria-hidden="true">›</i>
        </button>
        <button type="button" onClick={onMember}>
          <span className="stage1-shortcut-icon ticket"><TicketIcon/></span>
          <span className="stage1-shortcut-copy"><strong>回憶券</strong><small>{availableCouponCount?availableCouponCount+' 張可用':'專屬好禮'}</small></span>
          <i aria-hidden="true">›</i>
        </button>
        <button type="button" onClick={onLimited}>
          <span className="stage1-shortcut-icon gift"><GiftIcon/></span>
          <span className="stage1-shortcut-copy"><strong>期間限定</strong><small>不容錯過</small></span>
          <i aria-hidden="true">›</i>
        </button>
      </section>

      {lastOrder?<button className="stage1-reorder-chip" type="button" onClick={()=>onBuyAgain(lastOrder)}>
        <span>上次食過</span><strong>{lastOrder.itemSummary}</strong><em>再來一單 ›</em>
      </button>:null}

      <section className="stage1-top6" aria-labelledby="stage1-recommend-title">
        <div className="stage1-section-title">
          <h2 id="stage1-recommend-title">今日精選</h2>
          <button type="button" onClick={onBrowse}>查看全部 <span aria-hidden="true">›</span></button>
        </div>

        {topRecommendations.length?<div className="stage1-top6-grid">
          {topRecommendations.map(item=>{
            const favorite=favoriteProductIds.has(item.product.productId);
            return <article className="stage1-product-card" key={item.product.productId}>
              <button
                className="stage1-product-hit"
                type="button"
                data-product-id={item.product.productId}
                onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}
              >
                <ProductMedia product={item.product}/>
                <span className="stage1-product-info">
                  {item.product.badge?<small>{item.product.badge}</small>:null}
                  <strong>{item.product.name}</strong>
                  <em>{item.product.displayPriceLabel??'價格更新中'}</em>
                </span>
              </button>
              <button className={"stage1-favorite"+(favorite?' is-active':'')} type="button" aria-pressed={favorite} aria-label={favorite?'取消收藏':'收藏'} onClick={()=>onToggleFavorite(item.product.productId)}>
                <HeartIcon filled={favorite}/>
              </button>
            </article>;
          })}
        </div>:loadingProducts?<SkeletonProducts/>:<section className="stage1-products-empty">
          <strong>今日餐牌準備中</strong>
          <button type="button" onClick={onBrowse} disabled={!canBrowse}>查看餐牌</button>
        </section>}
      </section>
    </main>
  </div>;
}
