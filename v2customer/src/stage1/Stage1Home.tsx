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
const HERO_IP_PAIR='https://cdn.creativeclaw.co/u/6ad84d58/images/c40034d5-c340-4af5-8819-68c52b236c09.png';

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
function JarIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8M7 7h10l-1 13H8L7 7Z"/><path d="M9.5 11.5c1.6 1.7 3.4 1.7 5 0"/></svg>;
}
function HeartIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S4 15.2 4 9.2C4 6.3 5.9 4.5 8.2 4.5c1.6 0 3 .9 3.8 2.2.8-1.3 2.2-2.2 3.8-2.2 2.3 0 4.2 1.8 4.2 4.7C20 15.2 12 20 12 20Z"/></svg>;
}
function TicketIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4v-3Z"/><path d="M9 8.5v7"/></svg>;
}
function GiftIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7C9 7 7 6 7 4.5S9 3 10 4c1 .8 2 3 2 3Zm0 0c3 0 5-1 5-2.5S15 3 14 4c-1 .8-2 3-2 3Z"/></svg>;
}

function ProductMedia({product}:{product:CustomerProduct}){
  return <span className="stage1-food-media">
    {product.imageUrl
      ?<img src={product.imageUrl} alt={product.imageAlt??product.name} loading="lazy" decoding="async"/>
      :<span className="stage1-food-placeholder" aria-hidden="true"/>}
  </span>;
}

export function Stage1Home({
  snapshot,connection,browserOnline,activeOrders,history,recommendations,
  favoriteProductIds,onToggleFavorite,
  cartCount,onRetry,onProduct,onBrowse,onCategory,onFavorites,onLimited,onJar,onOrders,onMember,onBuyAgain,
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
  onCategory:(categoryId:string)=>void;
  onFavorites:()=>void;
  onLimited:()=>void;
  onJar:()=>void;
  onOrders:()=>void;
  onHistory:()=>void;
  onMember:()=>void;
  onBuyAgain:(order:CustomerHistoryProjection)=>void;
}){
  const store=snapshot?.store;
  const menu=snapshot?.menu;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const categories=menu?.categories??[];
  const topProducts=recommendations.map(item=>item.product).filter(product=>product.available).slice(0,8);
  const member=snapshot?.member;
  const availableCouponCount=member?.state==='READY'&&member.coupons
    ?member.coupons.filter(item=>item.state==='AVAILABLE').length
    :0;
  const isUpdating=connection==='LOADING'||connection==='STALE'||connection==='PARTIAL'||connection==='UNKNOWN';

  return <div className="stage1-home stage1-mobile-home">
    <header className="stage1-mobile-header">
      <img className="stage1-mobile-logo" src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      <button className="stage1-store-chip" type="button" onClick={onBrowse}>
        <PinIcon/>
        <span>
          <strong>{store?.storeName??'磨飯'}</strong>
          <small>{store?.channelAvailable===false?'休息中':store?.channelAvailable===true?'營業中':isUpdating?'更新中':'店舖'}</small>
        </span>
        <i aria-hidden="true">⌄</i>
      </button>
      <button className="stage1-jar-button" type="button" onClick={onJar} aria-label="記憶罐">
        <JarIcon/>
        {cartCount?<b>{cartCount}</b>:null}
      </button>
    </header>

    <main className="stage1-mobile-content">
      {!browserOnline?<button className="stage1-compact-state" type="button" onClick={onRetry}>離線 · 顯示已載入資料</button>:null}
      {browserOnline&&connection==='ERROR'?<button className="stage1-compact-state is-error" type="button" onClick={onRetry}>暫時未能更新 · 重試</button>:null}

      {currentOrder?<button className="stage1-active-order" type="button" onClick={onOrders}>
        <span><small>訂單</small><strong>{orderStateLabel(currentOrder.stage)}</strong><em>{currentOrder.displayCode}</em></span>
        <span className="stage1-active-order-right">
          {currentOrder.stage==='READY'&&currentOrder.pickupCode?<b>取餐碼 {currentOrder.pickupCode}</b>:null}
          {currentOrder.etaLabel?<small>{currentOrder.etaLabel}</small>:null}
          <i aria-hidden="true">›</i>
        </span>
      </button>:null}

      <button className="stage1-search" type="button" onClick={onBrowse}>
        <SearchIcon/>
        <span>搜尋餐點、關鍵字…</span>
      </button>

      <section className="stage1-big-hero" aria-label="磨飯品牌主視覺">
        <div className="stage1-big-hero-copy">
          <small>MORE FUN · 好飯好日常</small>
          <h1>好好吃飯，<br/>讓日常更有趣！</h1>
          <p>手作 · 輕食 · 每一餐都值得期待。</p>
          <button type="button" onClick={onBrowse}>開始點單</button>
        </div>
        <img className="stage1-big-hero-ip" src={HERO_IP_PAIR} alt="" aria-hidden="true"/>
        <span className="stage1-leaf leaf-a" aria-hidden="true">◆</span>
        <span className="stage1-leaf leaf-b" aria-hidden="true">◆</span>
      </section>

      <section className="stage1-quick-row" aria-label="快捷入口">
        <button type="button" onClick={onFavorites}>
          <span className="stage1-quick-icon heart"><HeartIcon/></span>
          <strong>我的收藏</strong>
          <small>喜歡的味道</small>
        </button>
        <button type="button" onClick={onMember}>
          <span className="stage1-quick-icon ticket"><TicketIcon/></span>
          <strong>回憶券</strong>
          <small>{availableCouponCount?availableCouponCount+' 張可用':'專屬好禮'}</small>
        </button>
        <button type="button" onClick={onLimited}>
          <span className="stage1-quick-icon gift"><GiftIcon/></span>
          <strong>期間限定</strong>
          <small>季節驚喜</small>
        </button>
      </section>

      <section className="stage1-category-section" aria-label="餐點分類">
        <div className="stage1-category-rail">
          <button type="button" className="is-active" onClick={onBrowse}>推薦</button>
          {categories.slice(0,6).map(category=><button type="button" key={category.categoryId} onClick={()=>onCategory(category.categoryId)}>{category.name}</button>)}
        </div>
      </section>

      {store?.notice?<section className="stage1-campaign-strip">
        <div><small>MORE FUN</small><strong>{store.notice}</strong></div>
        <button type="button" onClick={onBrowse}>看看餐牌 ›</button>
      </section>:null}

      {lastOrder?<button className="stage1-reorder-strip" type="button" onClick={()=>onBuyAgain(lastOrder)}>
        <small>上次食過</small><strong>{lastOrder.itemSummary}</strong><span>再來一單 ›</span>
      </button>:null}

      <section className="stage1-product-section">
        <div className="stage1-section-heading">
          <h2>精選推薦</h2>
          <button type="button" onClick={onBrowse}>查看全部 ›</button>
        </div>

        {topProducts.length?<div className="stage1-product-scroll">
          {topProducts.map(product=>{
            const favorite=favoriteProductIds.has(product.productId);
            return <article className="stage1-product-tile" key={product.productId}>
              <button className="stage1-product-main" type="button" onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}>
                <ProductMedia product={product}/>
                <span className="stage1-product-copy">
                  {product.badge?<small>{product.badge}</small>:null}
                  <strong>{product.name}</strong>
                  <em>{product.displayPriceLabel??'價格更新中'}</em>
                </span>
              </button>
              <button className={"stage1-product-favorite"+(favorite?' is-active':'')} type="button" aria-label={favorite?'取消收藏':'收藏'} onClick={()=>onToggleFavorite(product.productId)}>
                <HeartIcon/>
              </button>
            </article>;
          })}
        </div>:<div className="stage1-product-loading" aria-busy="true">
          {[0,1,2].map(index=><i key={index}/>)}
        </div>}
      </section>
    </main>
  </div>;
}
