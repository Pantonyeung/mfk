import {useEffect,useState} from 'react';
import {CUSTOMER_V3_ASSETS as A,CUSTOMER_V3_HERO_SLIDES as HERO_SLIDES} from './assets';
import {CheckoutScreen,JarScreen,MenuScreen,ProductScreen} from './ordering-screens';
import type {SubmittedOrder} from './ordering-screens';
import {FeaturedCampaignDialog,NotificationsScreen,OffersScreen,OrderDetailScreen,OrdersScreen,PickupGuideScreen,PopularCombosScreen,ProfileScreen,ReorderScreen,SearchScreen,StoreStatusSheet} from './customer-screens';
import {PREVIEW_HOME as vm} from './preview-fixture';
import type {QuickCardId} from './home-model';
import {PREVIEW_PICKUP_CODE,PREVIEW_PRODUCTS} from './preview-data';
import type {CustomerRoute,JarItem,PaymentMethod} from './preview-data';

type IconName=QuickCardId|'pin'|'chevron'|'bell'|'search'|'history'|'home'|'menu'|'jar'|'orders'|'user';

function Icon({name}:Readonly<{name:IconName}>){
  const common={fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  const paths:Record<IconName,React.ReactNode>={
    pin:<><path {...common} d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle {...common} cx="12" cy="10" r="2.2"/></>,
    chevron:<path {...common} d="m8 10 4 4 4-4"/>,
    bell:<><path {...common} d="M6 17h12l-1.4-2.2V10a4.6 4.6 0 0 0-9.2 0v4.8L6 17Z"/><path {...common} d="M10 20h4"/></>,
    search:<><circle {...common} cx="10.5" cy="10.5" r="6"/><path {...common} d="m15 15 4.5 4.5"/></>,
    featured:<><path fill="currentColor" d="m12 4 2.2 4.1 4.6-1.6-.7 7.8H5.9l-.7-7.8 4.6 1.6L12 4Z"/><path {...common} d="M7 18h10"/></>,
    popular:<><path {...common} d="M5 9h14l-1 11H6L5 9Z"/><path {...common} d="M9 9a3 3 0 0 1 6 0"/><path fill="currentColor" d="M12 17.5c-3-1.8-4.2-3-4.2-4.6 0-1.2.9-2 2.1-2 .9 0 1.7.5 2.1 1.2.4-.7 1.2-1.2 2.1-1.2 1.2 0 2.1.8 2.1 2 0 1.6-1.2 2.8-4.2 4.6Z"/></>,
    offer:<><path {...common} d="M19 5C11 5 6 9.2 6 15c0 2.1 1.6 4 4 4 5.8 0 9-6 9-14Z"/><path {...common} d="M5 20c2.1-3.9 5.6-7.1 10-9"/></>,
    pickup:<><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M12 7v5l3 2M4 8H2m3-3L3.5 3.5M20 8h2m-3-3 1.5-1.5"/></>,
    history:<><path {...common} d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path {...common} d="M4 4v4.6h4.6M12 8v4l3 2"/></>,
    home:<><path {...common} d="m4 11 8-7 8 7"/><path fill="currentColor" d="M6.5 10.5V20h11v-9.5L12 6l-5.5 4.5Z"/></>,
    menu:<><path {...common} d="M7 3v8m-2-8v5a2 2 0 0 0 4 0V3M7 11v10M16 3v18M16 3c3 2 3 7 0 9"/></>,
    jar:<><path {...common} d="M8 3h8v3H8zM7 7h10l1 3v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l1-3Z"/><path {...common} d="M9 12h6m-5 4h4"/></>,
    orders:<><path {...common} d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4"/></>,
    user:<><circle fill="currentColor" cx="12" cy="8" r="4"/><path fill="currentColor" d="M4.5 21a7.5 7.5 0 0 1 15 0H4.5Z"/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

const Arrow=()=> <span aria-hidden="true">›</span>;
const scrollToId=(id:string)=>{
  document.getElementById(id)?.scrollIntoView({
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
    block:'start'
  });
};

function Header({onOpenStore,onNavigate}:Readonly<{onOpenStore:()=>void;onNavigate:(route:CustomerRoute)=>void}>){
  return <header className="header">
    <button className="logo-button" type="button" onClick={()=>onNavigate('home')} aria-label="返回首頁">
      <img className="logo" src={A.logo} alt="磨飯 More Fun"/>
    </button>
    <button
      className="pill store-status"
      type="button"
      data-state={vm.storeStatus}
      onClick={onOpenStore}
      aria-label={`店舖狀態：${vm.storeStatusLabel}`}
    >
      <span className="status-dot"/><b>{vm.storeStatusLabel}</b><Icon name="chevron"/>
    </button>
    <button className="round bell" type="button" onClick={()=>onNavigate('notifications')} aria-label="通知">
      <Icon name="bell"/><i/>
    </button>
    <button className="pill search" type="button" onClick={()=>onNavigate('search')}>
      <Icon name="search"/><b>{vm.searchPlaceholder}</b>
    </button>
  </header>;
}

function Hero({onStart}:Readonly<{onStart:()=>void}>){
  const [activeSlide,setActiveSlide]=useState(0);
  const [loadedSlides,setLoadedSlides]=useState<ReadonlySet<number>>(()=>new Set());

  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=window.setTimeout(()=>setActiveSlide(index=>(index+1)%HERO_SLIDES.length),5200);
    return ()=>window.clearTimeout(timer);
  },[activeSlide]);

  const markLoaded=(index:number)=>setLoadedSlides(current=>{
    if(current.has(index))return current;
    const next=new Set(current);
    next.add(index);
    return next;
  });

  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-world" aria-hidden="true">
      <img className="hero-world-bg" src={A.heroBackgroundR2} alt=""/>
      <span className="hero-world-vignette"/>
    </div>
    <div className="hero-copy">
      <em>More Fun!</em>
      <h1 id="hero-title">同磨飯，<br/>食得更開心！</h1>
      <p>用手作的溫度<br/>讓每一餐都更美好</p>
      <button type="button" onClick={onStart}>開始點餐 <Arrow/></button>
      <small>好食・好人・更開心</small>
    </div>
    <div className="hero-visual" aria-hidden="true">
      <span className="hero-art-loader" data-visible={loadedSlides.has(activeSlide)?'false':'true'}/>
      {HERO_SLIDES.map((slide,index)=><img
        key={slide.id}
        className={'hero-slide '+(index===activeSlide?'is-active':'')}
        src={slide.src}
        alt=""
        width="720"
        height="900"
        loading="eager"
        fetchPriority={index===0?'high':'low'}
        decoding="async"
        onLoad={()=>markLoaded(index)}
        onError={()=>markLoaded(index)}
      />)}
      <img className="doodle doodle-more" src={A.moreFunDoodleR2} alt=""/>
      <img className="doodle doodle-taste" src={A.goodTasteDoodleR2} alt=""/>
      <span className="hero-trail trail-one"/>
      <span className="hero-trail trail-two"/>
      <span className="hero-trail trail-three"/>
    </div>
    <div className="hero-dots" role="group" aria-label="主視覺輪播">
      {HERO_SLIDES.map((slide,index)=><button
        key={slide.id}
        type="button"
        aria-label={`顯示${slide.label}`}
        aria-pressed={index===activeSlide}
        onClick={()=>setActiveSlide(index)}
      />)}
    </div>
  </section>;
}

function Quick({onSelect}:Readonly<{onSelect:(destination:QuickCardId)=>void}>){
  return <section id="menu-discovery" className="quick" aria-label="快捷入口">
    {vm.quickCards.map(card=><button
      type="button"
      key={card.id}
      className={'quick-card '+card.tone}
      onClick={()=>onSelect(card.id)}
    >
      <span className="quick-copy">
        <strong>{card.title}</strong>
        <small>{card.subtitle}</small>
      </span>
      <span className="quick-arrow"><Arrow/></span>
      <span className="quick-icon" aria-hidden="true"><Icon name={card.id}/></span>
    </button>)}
  </section>;
}

function Lifestyle(){
  return <section className="lifestyle" aria-labelledby="lifestyle-title">
    <div className="lifestyle-note">好的食物<br/>讓日常發光 ♡</div>
    <img src={A.femaleHeroR2} alt=""/>
    <div className="lifestyle-copy">
      <h2 id="lifestyle-title">手作輕食<br/>陪你過更好的<br/>每一天 ♡</h2>
      <small>More Good Food<br/>More Fun!</small>
    </div>
  </section>;
}

function Recent({onViewAll,onReorder}:Readonly<{onViewAll:()=>void;onReorder:()=>void}>){
  return <section id="recent-order" className="recent-section">
    <div className="recent-title">
      <h2><Icon name="history"/>最近訂單</h2>
      <button type="button" onClick={onViewAll}>查看全部 <Arrow/></button>
    </div>
    {vm.recentOrder?<button className="recent-card" type="button" onClick={onReorder}>
      <span className="recent-avatar"><img src={A.maleHeroR2} alt=""/></span>
      <span>
        <strong>{vm.recentOrder.itemSummary}</strong>
        <small>{vm.recentOrder.orderedAtLabel}</small>
      </span>
      <b>再來一單</b>
    </button>:<div className="recent-empty">
      <strong>未有最近訂單</strong>
      <button type="button" onClick={()=>scrollToId('menu-discovery')}>瀏覽菜單</button>
    </div>}
  </section>;
}

function BottomNav({route,jarFilled,onNavigate}:Readonly<{route:CustomerRoute;jarFilled:boolean;onNavigate:(route:CustomerRoute)=>void}>){
  const active=route==='home'||route==='popular'||route==='offers'||route==='pickup-guide'?'home':route==='menu'||route==='product'?'menu':route==='jar'||route==='checkout'?'jar':route==='orders'||route==='order-detail'||route==='reorder'?'orders':route==='profile'?'profile':'';
  return <nav aria-label="主要導覽">
    <button className={active==='home'?'active':''} type="button" onClick={()=>onNavigate('home')}>
      <Icon name="home"/><b>首頁</b>
    </button>
    <button className={active==='menu'?'active':''} type="button" onClick={()=>onNavigate('menu')}>
      <Icon name="menu"/><b>菜單</b>
    </button>
    <button className={active==='jar'?'active':''} type="button" onClick={()=>onNavigate('jar')}>
      <img className="nav-jar-icon" src={jarFilled?A.memoryJarPartial:A.memoryJarEmpty} alt=""/><b>記憶罐</b>
    </button>
    <button className={active==='orders'?'active':''} type="button" onClick={()=>onNavigate('orders')}>
      <Icon name="orders"/><b>訂單</b><i/>
    </button>
    <button className={active==='profile'?'active':''} type="button" onClick={()=>onNavigate('profile')}>
      <Icon name="user"/><b>我的</b>
    </button>
  </nav>;
}

export function CustomerV3App(){
  const knownRoutes:readonly CustomerRoute[]=['home','search','notifications','menu','popular','offers','pickup-guide','product','jar','checkout','orders','order-detail','reorder','profile'];
  const readRoute=():CustomerRoute=>{
    const hash=window.location.hash.slice(1) as CustomerRoute;
    return knownRoutes.includes(hash)?hash:'home';
  };
  const [route,setRoute]=useState<CustomerRoute>(readRoute);
  const [selectedProductId,setSelectedProductId]=useState(PREVIEW_PRODUCTS[0].id);
  const [productReturnRoute,setProductReturnRoute]=useState<CustomerRoute>('menu');
  const [jarItems,setJarItems]=useState<JarItem[]>([]);
  const [showStore,setShowStore]=useState(false);
  const [showFeatured,setShowFeatured]=useState(false);
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [submittedOrder,setSubmittedOrder]=useState<SubmittedOrder>({pickupCode:PREVIEW_PICKUP_CODE,payment:'electronic' as PaymentMethod,proofSubmitted:true});

  const navigate=(next:CustomerRoute)=>{
    const nextHash=`#${next}`;
    if(window.location.hash===nextHash)setRoute(next);
    else window.location.hash=next;
  };
  const openMenu=()=>navigate('menu');
  const openProduct=(id:string,returnRoute:CustomerRoute='menu')=>{setSelectedProductId(id);setProductReturnRoute(returnRoute);navigate('product');};
  const addToJar=(item:JarItem)=>{setJarItems(current=>[...current,item]);navigate('jar');};
  const openQuick=(destination:QuickCardId)=>{
    if(destination==='featured'){setShowFeatured(true);return;}
    navigate(destination==='popular'?'popular':destination==='offer'?'offers':'pickup-guide');
  };
  const updateJarQuantity=(index:number,quantity:number)=>setJarItems(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,quantity}:item));
  const removeJarItem=(index:number)=>setJarItems(current=>current.filter((_,itemIndex)=>itemIndex!==index));
  const selectedProduct=PREVIEW_PRODUCTS.find(product=>product.id===selectedProductId)??PREVIEW_PRODUCTS[0];

  useEffect(()=>{
    const onHashChange=()=>setRoute(readRoute());
    const onOnline=()=>setOnline(true);
    const onOffline=()=>setOnline(false);
    window.addEventListener('hashchange',onHashChange);
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    return ()=>{
      window.removeEventListener('hashchange',onHashChange);
      window.removeEventListener('online',onOnline);
      window.removeEventListener('offline',onOffline);
    };
  },[]);

  useEffect(()=>{
    window.scrollTo({top:0,behavior:'auto'});
  },[route]);

  useEffect(()=>{
    const hero=document.querySelector<HTMLElement>('.hero');
    if(!hero||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

    let frame=0;
    const update=()=>{
      frame=0;
      const progress=Math.min(window.scrollY/260,1);
      hero.style.setProperty('--hero-progress',progress.toFixed(3));
      hero.style.setProperty('--hero-visual-scale',(1-progress*.18).toFixed(3));
      hero.style.setProperty('--hero-bg-scale',(1.025-progress*.025).toFixed(3));
    };
    const onScroll=()=>{if(!frame)frame=window.requestAnimationFrame(update);};

    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    return ()=>{
      window.removeEventListener('scroll',onScroll);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[route]);

  const screen=route==='home'?<>
      <Hero onStart={openMenu}/>
      <Quick onSelect={openQuick}/>
      <Lifestyle/>
      <Recent onViewAll={()=>navigate('orders')} onReorder={()=>navigate('reorder')}/>
    </>:route==='search'?<SearchScreen onBack={()=>navigate('home')} onOpenProduct={id=>openProduct(id,'search')}/>
      :route==='notifications'?<NotificationsScreen onBack={()=>navigate('home')}/>
      :route==='menu'?<MenuScreen onOpenProduct={id=>openProduct(id,'menu')} onBack={()=>navigate('home')}/>
      :route==='popular'?<PopularCombosScreen onBack={()=>navigate('home')} onOpenProduct={id=>openProduct(id,'popular')}/>
      :route==='offers'?<OffersScreen onBack={()=>navigate('home')} onOpenProduct={id=>openProduct(id,'offers')}/>
      :route==='pickup-guide'?<PickupGuideScreen onBack={()=>navigate('home')} onStart={openMenu}/>
      :route==='product'?<ProductScreen key={selectedProduct.id} product={selectedProduct} onBack={()=>navigate(productReturnRoute)} onAdd={addToJar}/>
      :route==='jar'?<JarScreen items={jarItems} onBack={()=>navigate('menu')} onBrowse={openMenu} onQuantity={updateJarQuantity} onRemove={removeJarItem} onCheckout={()=>jarItems.length&&navigate('checkout')}/>
      :route==='checkout'&&jarItems.length?<CheckoutScreen items={jarItems} onBack={()=>navigate('jar')} onHome={()=>navigate('home')} onOrder={order=>{setSubmittedOrder(order);navigate('order-detail');}}/>
      :route==='orders'?<OrdersScreen onBack={()=>navigate('home')} onDetail={()=>navigate('order-detail')} onReorder={()=>navigate('reorder')}/>
      :route==='order-detail'?<OrderDetailScreen onBack={()=>navigate('orders')} onReorder={()=>navigate('reorder')} pickupCode={submittedOrder.pickupCode} payment={submittedOrder.payment}/>
      :route==='reorder'?<ReorderScreen onBack={()=>navigate('orders')} onAdd={addToJar}/>
      :route==='profile'?<ProfileScreen onBack={()=>navigate('home')}/>
      :<JarScreen items={jarItems} onBack={()=>navigate('menu')} onBrowse={openMenu} onQuantity={updateJarQuantity} onRemove={removeJarItem} onCheckout={()=>jarItems.length&&navigate('checkout')}/>;

  return <div className="shell">
    <Header onOpenStore={()=>setShowStore(true)} onNavigate={navigate}/>
    {!online&&<div className="network-banner" role="status">暫時離線・部分資料可能未更新</div>}
    <main className={route==='home'?'':'destination-main'}>{screen}</main>
    {showStore&&<StoreStatusSheet onClose={()=>setShowStore(false)}/>}
    {showFeatured&&<FeaturedCampaignDialog onClose={()=>setShowFeatured(false)} onOpenProduct={id=>{setShowFeatured(false);openProduct(id,'home');}}/>}
    <BottomNav route={route} jarFilled={jarItems.length>0} onNavigate={navigate}/>
  </div>;
}
