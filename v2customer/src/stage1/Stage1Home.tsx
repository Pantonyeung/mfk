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
const STAGE1_FINAL_SOURCE=CUSTOMER_FINAL_SOURCE.stage1Final.url;

const statusLabel=(storeAvailable:boolean|undefined)=>{
  if(storeAvailable===true)return '營業中';
  if(storeAvailable===false)return '休息中';
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

function Stage1StatePanel({connection,browserOnline,onRetry}:{connection:CustomerConnectionState;browserOnline:boolean;onRetry:()=>void}){
  if(!browserOnline)return <section className="stage1-state-panel" role="status"><strong>離線 · 顯示已載入資料</strong></section>;
  if(connection==='ERROR')return <section className="stage1-state-panel state-error" role="alert"><strong>暫時未能更新</strong><button type="button" onClick={onRetry}>重試</button></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage1-state-panel" role="status"><strong>更新中 · 顯示最近資料</strong></section>;
  if(connection==='NOT_CONNECTED')return <section className="stage1-state-panel" role="status"><strong>店舖資料暫未連接</strong></section>;
  if(connection==='LOADING')return <section className="stage1-state-panel" role="status" aria-busy="true"><strong>更新中</strong></section>;
  if(connection==='UNKNOWN')return <section className="stage1-state-panel" role="status"><strong>確認中</strong></section>;
  return null;
}

function ProductMedia({product}:{product:CustomerProduct}){
  return <span className="stage1-product-media">
    {product.imageUrl
      ?<img src={product.imageUrl} alt={product.imageAlt??product.name} loading="lazy" decoding="async"/>
      :<span className="stage1-product-image-empty" aria-hidden="true"/>}
  </span>;
}

export function Stage1Home({
  snapshot,connection,browserOnline,activeOrders,history,recommendations,
  onRetry,onProduct,onBrowse,onOrders,onHistory,onMember,onBuyAgain,
}:{
  snapshot:CustomerReadModelSnapshot|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  activeOrders:readonly CustomerOrderProjection[];
  history:readonly CustomerHistoryProjection[];
  recommendations:readonly CustomerRecommendation[];
  cartCount:number;
  onRetry:()=>void;
  onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;
  onBrowse:()=>void;
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
    ?'辛苦了！美味正在為你準備中'
    :homeMode==='CLOSED'
      ?'辛苦了，先來揀進吧！'
      :homeMode==='RETURNING'
        ?'歡迎回來，今天也要好好吃飯！'
        :homeMode==='CAMPAIGN'
          ?'發現更多美味，也收集更多回憶！'
          :'早安，今天想食咩？';
  const subline=homeMode==='ORDER_ACTIVE'
    ?'好好吃飯，補充生活的能量！'
    :homeMode==='CLOSED'
      ?'好味道，總是值得期待。'
      :homeMode==='RETURNING'
        ?'有美食相伴的日子，總是特別好。'
        :homeMode==='CAMPAIGN'
          ?'好吃的飯，總能帶來好心情。'
          :'一碗好飯，讓日常更有味。';

  return <div className="stage1-home" data-home-mode={homeMode}>
    <header className="stage1-fixed-header">
      <button className="stage1-logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})} aria-label="首頁">
        <img src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      </button>
      <div className="stage1-store-context">
        <strong>{store?.storeName??'磨飯'}</strong>
        <span>{statusLabel(store?.channelAvailable)}{todayHours?' · '+todayHours:''}</span>
      </div>
    </header>

    <div className="stage1-content">
      <Stage1StatePanel connection={connection} browserOnline={browserOnline} onRetry={onRetry}/>

      <section className="stage1-welcome" data-home-mode={homeMode}>
        <h1>{headline}</h1>
        <p>{subline}</p>
      </section>

      {currentOrder?<button className="stage1-live-order" type="button" onClick={onOrders}>
        <span className="stage1-live-main">
          <strong>{orderStateLabel(currentOrder.stage)}</strong>
          {currentOrder.etaLabel?<b>{currentOrder.etaLabel}</b>:null}
        </span>
        <span className="stage1-live-meta">
          <small>{currentOrder.displayCode}</small>
          {currentOrder.stage==='READY'&&currentOrder.pickupCode?<em>取餐碼 {currentOrder.pickupCode}</em>:null}
        </span>
        <i aria-hidden="true">›</i>
      </button>:null}

      <button className="stage1-search-entry" type="button" onClick={onBrowse} disabled={!canBrowse}>
        <span aria-hidden="true">⌕</span>
        <strong>{canBrowse?'搜尋餐點':'餐牌更新中'}</strong>
      </button>

      <button className="stage1-hero-banner" type="button" data-source-file="磨飯_stage_1_首頁品牌展示.png" disabled={!canBrowse} onClick={onBrowse} aria-label={canBrowse?'點單':'餐牌更新中'}>
        <span className="stage1-source-crop stage1-source-hero" aria-hidden="true"><img src={STAGE1_FINAL_SOURCE} alt=""/></span>
      </button>

      {store?.notice?<section className="stage1-announcement-strip" role="status">
        <span aria-hidden="true">✦</span>
        <p>{store.notice}</p>
      </section>:null}

      <section className="stage1-quick-entry-section" aria-label="快捷入口">
        <div className="stage1-quick-entry-grid">
          <button type="button" onClick={onHistory}>
            <span className="stage1-shortcut-source stage1-shortcut-heart" aria-hidden="true"><img src={STAGE1_FINAL_SOURCE} alt=""/></span>
            <strong>我的收藏</strong>
            {lastOrder?<small>{lastOrder.itemSummary}</small>:<small>常用餐點</small>}
          </button>
          <button type="button" onClick={onMember}>
            <span className="stage1-shortcut-source stage1-shortcut-ticket" aria-hidden="true"><img src={STAGE1_FINAL_SOURCE} alt=""/></span>
            <strong>回憶券</strong>
            {availableCouponCount?<small>{availableCouponCount} 張可用</small>:<small>會員專區</small>}
          </button>
          <button type="button" onClick={onBrowse}>
            <span className="stage1-shortcut-source stage1-shortcut-order" aria-hidden="true"><img src={STAGE1_FINAL_SOURCE} alt=""/></span>
            <strong>期間限定</strong>
            <small>今期新品</small>
          </button>
        </div>
      </section>

      {topRecommendations.length?<section className="stage1-top6" aria-labelledby="stage1-recommend-title">
        <div className="stage1-section-title">
          <h2 id="stage1-recommend-title">推薦</h2>
          <button type="button" onClick={onBrowse}>全部</button>
        </div>
        <div className="stage1-top6-grid">
          {topRecommendations.map(item=><button
            className="stage1-product-card" type="button" key={item.product.productId} data-product-id={item.product.productId}
            onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}
          >
            <ProductMedia product={item.product}/>
            <span className="stage1-product-info">
              {item.product.badge?<small>{item.product.badge}</small>:null}
              <strong>{item.product.name}</strong>
              <em>{item.product.displayPriceLabel??'價格更新中'}</em>
            </span>
          </button>)}
        </div>
      </section>:null}
    </div>
  </div>;
}
