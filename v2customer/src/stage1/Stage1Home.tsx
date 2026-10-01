import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
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

type HeroSlide=Readonly<{
  id:string;
  eyebrow:string;
  title:string;
  subtitle:string;
  cta:string;
  tone:'brand'|'ip'|'food'|'season';
}>;

const HERO_SLIDES:readonly HeroSlide[]=Object.freeze([
  {id:'brand',eyebrow:'MORE FUN · 好飯好日常',title:'好好吃飯，\n讓日常更有趣！',subtitle:'手作 · 輕食 · 每一餐都值得期待。',cta:'開始點單',tone:'brand'},
  {id:'ip',eyebrow:'MORE FUN · 一起吃飯',title:'一齊食飯，\n開心加倍！',subtitle:'熟悉嘅味道，加一點磨飯嘅人情味。',cta:'探索餐牌',tone:'ip'},
  {id:'food',eyebrow:'新鮮 · 手作 · 輕食',title:'每一口，\n都係好好食飯。',subtitle:'餐牌、價錢同供應狀態以店舖最新資料為準。',cta:'睇今日餐牌',tone:'food'},
  {id:'season',eyebrow:'MORE FUN · 季節靈感',title:'今季好味，\n慢慢發現。',subtitle:'有正式期間限定內容時，會喺呢度第一時間出現。',cta:'睇期間限定',tone:'season'},
]);

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

function HeroVisual({slide,className=''}:{slide:HeroSlide;className?:string}){
  return <div className={"stage1-hero-visual "+className} data-hero-tone={slide.tone}>
    <span className="stage1-hero-glow glow-a" aria-hidden="true"/>
    <span className="stage1-hero-glow glow-b" aria-hidden="true"/>
    <img className="stage1-hero-ip" src={HERO_IP_PAIR} alt="" aria-hidden="true"/>
    <span className="stage1-hero-mark mark-a" aria-hidden="true">✦</span>
    <span className="stage1-hero-mark mark-b" aria-hidden="true">✧</span>
  </div>;
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

  const [heroIndex,setHeroIndex]=useState(0);
  const [heroOpen,setHeroOpen]=useState(false);
  const [heroProgress,setHeroProgress]=useState(0);
  const touchStartX=useRef<number|null>(null);
  const activeHero=HERO_SLIDES[heroIndex]??HERO_SLIDES[0];

  const relatedProducts=useMemo(()=>topProducts.slice(0,4),[topProducts]);

  useEffect(()=>{
    let raf=0;
    const update=()=>{
      raf=0;
      const raw=(window.scrollY-18)/190;
      setHeroProgress(Math.max(0,Math.min(1,raw)));
    };
    const onScroll=()=>{
      if(raf)return;
      raf=window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>{window.removeEventListener('scroll',onScroll);if(raf)window.cancelAnimationFrame(raf);};
  },[]);

  useEffect(()=>{
    if(heroOpen||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const id=window.setInterval(()=>setHeroIndex(index=>(index+1)%HERO_SLIDES.length),5200);
    return()=>window.clearInterval(id);
  },[heroOpen]);

  useEffect(()=>{
    document.body.classList.toggle('stage1-hero-modal-open',heroOpen);
    return()=>document.body.classList.remove('stage1-hero-modal-open');
  },[heroOpen]);

  const heroHeight=Math.round(318-(132*heroProgress));
  const showScrollBanner=heroProgress>=.52;

  const activateHero=()=>{
    if(activeHero.id==='season')onLimited();
    else onBrowse();
  };

  const changeHero=(next:number)=>{
    const count=HERO_SLIDES.length;
    setHeroIndex(((next%count)+count)%count);
  };

  const onHeroTouchEnd=(event:React.TouchEvent<HTMLDivElement>)=>{
    if(touchStartX.current===null)return;
    const end=event.changedTouches[0]?.clientX??touchStartX.current;
    const delta=end-touchStartX.current;
    touchStartX.current=null;
    if(Math.abs(delta)<36)return;
    changeHero(heroIndex+(delta<0?1:-1));
  };

  const heroStyle={
    '--stage1-hero-height':heroHeight+'px',
    '--stage1-hero-progress':String(heroProgress),
  } as CSSProperties;

  return <div className="stage1-home stage1-mobile-home" data-hero-collapsed={heroProgress>.5||undefined}>
    <header className="stage1-mobile-header">
      <img className="stage1-mobile-logo" src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      <button className="stage1-store-chip" type="button" onClick={onBrowse}>
        <PinIcon/>
        <span>
          <strong>{store?.storeName??'磨飯'}</strong>
          <small>{store?.channelAvailable===false?'休息中':store?.channelAvailable===true?'營業中':connection==='ERROR'?'未能更新':'更新中'}</small>
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

      <section
        className="stage1-hero-shell"
        style={heroStyle}
        onTouchStart={event=>{touchStartX.current=event.touches[0]?.clientX??null;}}
        onTouchEnd={onHeroTouchEnd}
      >
        <button className="stage1-big-hero" type="button" onClick={()=>setHeroOpen(true)} aria-label={"放大查看："+activeHero.title.replace(/\n/g,' ')}>
          <HeroVisual slide={activeHero}/>
          <span className="stage1-big-hero-copy">
            <small>{activeHero.eyebrow}</small>
            <strong>{activeHero.title.split('\n').map((line,index)=><span key={line}>{line}{index===0?<br/>:null}</span>)}</strong>
            <em>{activeHero.subtitle}</em>
          </span>
        </button>

        <div className="stage1-hero-dots" aria-label="主視覺輪播">
          {HERO_SLIDES.map((slide,index)=><button key={slide.id} type="button" className={index===heroIndex?'is-active':''} aria-label={"第 "+(index+1)+" 張"} onClick={()=>changeHero(index)}/>)}
        </div>
      </section>

      <button className="stage1-search" type="button" onClick={onBrowse}>
        <SearchIcon/>
        <span>搜尋餐點、關鍵字…</span>
      </button>

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

      {showScrollBanner?<section className="stage1-scroll-banner" aria-label="磨飯推廣資訊">
        <div className="stage1-scroll-banner-art" aria-hidden="true"><HeroVisual slide={HERO_SLIDES[(heroIndex+1)%HERO_SLIDES.length]}/></div>
        <div className="stage1-scroll-banner-copy">
          <small>{store?.notice?'店舖最新消息':'MORE FUN · 好飯好日常'}</small>
          <strong>{store?.notice??'手作輕食，繼續向下發現更多。'}</strong>
        </div>
        <button type="button" onClick={onBrowse}>探索 ›</button>
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

      <div className="stage1-end-marker" role="status">已經到底啦 · More Fun</div>
    </main>

    {heroOpen?<div className="stage1-hero-modal" role="dialog" aria-modal="true" aria-label={activeHero.title.replace(/\n/g,' ')}>
      <button className="stage1-hero-modal-close" type="button" onClick={()=>setHeroOpen(false)} aria-label="關閉">×</button>
      <span className="stage1-hero-modal-count">{heroIndex+1}/{HERO_SLIDES.length}</span>

      <section className="stage1-hero-modal-visual">
        <HeroVisual slide={activeHero} className="is-full"/>
        <div className="stage1-hero-modal-title">
          <small>{activeHero.eyebrow}</small>
          <h2>{activeHero.title.split('\n').map((line,index)=><span key={line}>{line}{index===0?<br/>:null}</span>)}</h2>
          <p>{activeHero.subtitle}</p>
        </div>
      </section>

      <section className="stage1-hero-modal-info">
        <div className="stage1-hero-modal-cta">
          <div><small>今次主題</small><strong>{activeHero.title.replace(/\n/g,' ')}</strong></div>
          <button type="button" onClick={()=>{setHeroOpen(false);activateHero();}}>{activeHero.cta}</button>
        </div>

        <div className="stage1-hero-modal-recommend">
          <div className="stage1-section-heading"><h3>相關推薦</h3><button type="button" onClick={()=>{setHeroOpen(false);onBrowse();}}>查看全部 ›</button></div>
          {relatedProducts.length?<div className="stage1-modal-products">
            {relatedProducts.map(product=><button key={product.productId} type="button" onClick={()=>{setHeroOpen(false);onProduct(product,null);}}>
              <ProductMedia product={product}/>
              <span><strong>{product.name}</strong><em>{product.displayPriceLabel??'價格更新中'}</em></span>
            </button>)}
          </div>:<div className="stage1-modal-empty">餐牌更新後，呢度會即時顯示相關餐點。</div>}
        </div>
      </section>
    </div>:null}
  </div>;
}
