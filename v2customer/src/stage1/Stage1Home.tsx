import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerProduct,
  CustomerReadModelSnapshot,
} from '../product-types';
import type {ProductOriginRect} from '../ui/primitives';
import './stage1.css';

const OFFICIAL_LOGO_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/402357b6-d757-4238-99f7-3d20607da6f2.png';
const HERO_IP='/brand/stage0-male.webp';
const HERO_FOOD='/brand/p0-riceball.webp';

const statusLabel=(storeAvailable:boolean|undefined)=>{
  if(storeAvailable===true)return '營業中';
  if(storeAvailable===false)return '休息中';
  return '更新中';
};

function mediaFor(product:CustomerProduct){
  if(product.imageUrl)return product.imageUrl;
  if(/飯團|紫米/.test(product.name))return '/brand/p0-riceball.webp';
  if(/沙律|蔬菜|輕食/.test(product.name))return '/brand/mf-home-hero-salad.webp';
  return '/brand/mf-home-hero-bowl.webp';
}

function Stage1StatePanel({connection,browserOnline,onRetry}:{connection:CustomerConnectionState;browserOnline:boolean;onRetry:()=>void}){
  if(!browserOnline)return <section className="stage1-state-panel state-offline" role="status"><strong>目前離線</strong><p>你仍然可以查看已載入內容。</p></section>;
  if(connection==='ERROR')return <section className="stage1-state-panel state-error" role="alert"><strong>暫時未能更新店舖資料</strong><p>請稍後再試。</p><button onClick={onRetry}>重新整理</button></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage1-state-panel state-stale" role="status"><strong>正顯示最近一次資料</strong><p>最新內容仍在更新中。</p><button onClick={onRetry}>更新資料</button></section>;
  if(connection==='NOT_CONNECTED')return <section className="stage1-state-panel state-empty" role="status"><strong>店舖資料暫未連接</strong><p>稍後再試，或者先看看已有內容。</p></section>;
  if(connection==='LOADING')return <section className="stage1-state-panel state-loading" role="status" aria-busy="true"><strong>正在準備首頁</strong><p>店舖狀態、公告同推薦會逐項出現。</p></section>;
  return null;
}

export function Stage1Home({
  snapshot,connection,browserOnline,activeOrders,history,recommendations,cartCount,
  onRetry,onProduct,onBrowse,onJar,onOrders,onHistory,onMember,onBuyAgain,
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
  const member=snapshot?.member;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const canBrowse=Boolean(snapshot?.menu);
  const topRecommendations=recommendations.filter(item=>item.product.available).slice(0,6);
  const availableCouponCount=member?.state==='READY'&&member.coupons
    ?member.coupons.filter(item=>item.state==='AVAILABLE').length
    :0;

  const headline=currentOrder
    ?'辛苦了！美味正在為你準備中'
    :history.length
      ?'歡迎回來，今天也要好好吃飯！'
      :store?.channelAvailable===false
        ?'今日休息，先來揀定想食嘅'
        :'今天想食咩？';
  const subline=currentOrder
    ?'訂單有新進度會喺呢度睇到。'
    :history.length
      ?'有熟悉嘅味道，也可以發現新選擇。'
      :store?.channelAvailable===false
        ?'未開始營業都可以慢慢睇餐牌。'
        :'一餐好飯，讓日常更有味。';

  return <div className="stage1-home">
    <header className="stage1-fixed-header">
      <button className="stage1-logo-button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})} aria-label="返回首頁頂部">
        <img src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      </button>
      <div className="stage1-store-context">
        <strong>{store?.storeName??'磨飯'}</strong>
        <span>{statusLabel(store?.channelAvailable)}</span>
      </div>
      <span className="stage1-bell" aria-hidden="true">♢</span>
    </header>

    <div className="stage1-content">
      <Stage1StatePanel connection={connection} browserOnline={browserOnline} onRetry={onRetry}/>

      <section className="stage1-welcome">
        <h1>{headline}</h1>
        <p>{subline}</p>
      </section>

      <button className="stage1-search-entry" onClick={onBrowse} disabled={!canBrowse}>
        <span aria-hidden="true">⌕</span>
        <strong>{canBrowse?'搜尋想食嘅餐點…':'餐牌更新中…'}</strong>
      </button>

      {currentOrder?<button className="stage1-live-order" onClick={onOrders}>
        <span className="stage1-live-label">訂單進行中</span>
        <strong>{currentOrder.stage==='READY'?'可以取餐啦':currentOrder.stage==='PREPARING'?'製作中':currentOrder.stage==='ACCEPTED'?'店舖已接單':'查看最新進度'}</strong>
        <div className="stage1-order-steps" aria-hidden="true"><i className="done"/><i className="active"/><i/><i/></div>
        <small>{currentOrder.displayCode}{currentOrder.etaLabel?' · '+currentOrder.etaLabel:''}</small>
      </button>:null}

      {store?.channelAvailable===false?<section className="stage1-closed-panel">
        <img src={HERO_IP} alt="" aria-hidden="true"/>
        <div><span>今日已打烊</span><strong>明日再見</strong><button disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'查看餐牌':'餐牌更新中'}</button></div>
      </section>:null}

      <section className="stage1-hero-banner">
        <div className="stage1-hero-copy">
          <span>好好吃飯</span>
          <h2>就是一件<br/>開心的事。</h2>
          <em>More Fun · More Good Days!</em>
        </div>
        <img className="stage1-hero-ip" src={HERO_IP} alt="" aria-hidden="true"/>
        <img className="stage1-hero-food" src={HERO_FOOD} alt="" aria-hidden="true"/>
      </section>

      {store?.notice?<section className="stage1-announcement-strip" role="status">
        <span aria-hidden="true">✦</span>
        <div><strong>店舖公告</strong><p>{store.notice}</p></div>
      </section>:null}

      {availableCouponCount?<button className="stage1-promo-banner" onClick={onMember}>
        <div><span>收集回憶</span><strong>{availableCouponCount} 張回憶券等緊你</strong><small>立即查看</small></div>
        <img src={HERO_IP} alt="" aria-hidden="true"/>
      </button>:null}

      <section className="stage1-quick-entry-section">
        <div className="stage1-quick-entry-grid">
          <button onClick={onOrders}><i aria-hidden="true">▣</i><strong>我的訂單</strong></button>
          <button onClick={onHistory}><i aria-hidden="true">♡</i><strong>我的收藏</strong></button>
          <button onClick={onMember}><i aria-hidden="true">⌑</i><strong>回憶券</strong></button>
        </div>
      </section>

      <section className="stage1-top6">
        <div className="stage1-section-title">
          <div><h2>為你推薦 <small>Top 6</small></h2></div>
          <button onClick={onBrowse}>查看全部 ›</button>
        </div>

        {topRecommendations.length?<div className="stage1-top6-grid">
          {topRecommendations.map(item=><button
            className="stage1-product-card" key={item.product.productId} data-product-id={item.product.productId}
            onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}
          >
            <span className="stage1-product-media"><img src={mediaFor(item.product)} alt={item.product.imageAlt??item.product.name}/><i aria-hidden="true">♡</i></span>
            <span className="stage1-product-info">
              {item.product.badge?<small>{item.product.badge}</small>:null}
              <strong>{item.product.name}</strong>
              <em>{item.product.displayPriceLabel??'價格稍後顯示'}</em>
            </span>
          </button>)}
        </div>:<div className="stage1-top6-empty">
          <strong>今日推薦整理中</strong><span>可以先看看完整餐牌。</span>
          <button onClick={onBrowse} disabled={!canBrowse}>查看餐牌</button>
        </div>}
      </section>

      <section className="stage1-memory-strip">
        <button onClick={onJar}><span>記憶罐</span><strong>{cartCount?cartCount+' 件餐點':'今餐未開始'}</strong></button>
        {lastOrder?<button onClick={()=>onBuyAgain(lastOrder)}><span>上次食過</span><strong>{lastOrder.itemSummary}</strong></button>:<button onClick={onHistory}><span>我的回憶</span><strong>完成第一張訂單後會出現</strong></button>}
      </section>
    </div>
  </div>;
}
