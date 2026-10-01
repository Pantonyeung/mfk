import {useEffect,useState} from 'react';
import {CUSTOMER_V3_ASSETS as A} from './assets';
import {PREVIEW_HOME as vm} from './preview-fixture';
import type {QuickCardId} from './home-model';

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
    offer:<><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M12 7v5l3 2"/><circle fill="currentColor" cx="18.5" cy="5.5" r="2.5"/><path {...common} d="m7 19 10-14"/></>,
    pickup:<><path {...common} d="M6 8h12l-1 12H7L6 8Z"/><path {...common} d="M9 8a3 3 0 0 1 6 0M3 12h2m-3 4h3m14-4h2m-2 4h3"/><path fill="currentColor" d="M12 17.5c-2.4-1.4-3.3-2.4-3.3-3.7 0-1 .7-1.6 1.7-1.6.7 0 1.3.4 1.6 1 .3-.6.9-1 1.6-1 1 0 1.7.6 1.7 1.6 0 1.3-.9 2.3-3.3 3.7Z"/></>,
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

function Header({showPreviewNotice}:Readonly<{showPreviewNotice:(label:string)=>void}>){
  return <header className="header">
    <button className="logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="返回首頁頂部">
      <img className="logo" src={A.logo} alt="磨飯 More Fun"/>
    </button>
    <button className="pill location" type="button" onClick={()=>showPreviewNotice('門市選擇')}>
      <Icon name="pin"/><b>{vm.locationLabel}</b><Icon name="chevron"/>
    </button>
    <button className="round bell" type="button" onClick={()=>showPreviewNotice('通知')} aria-label="通知">
      <Icon name="bell"/><i/>
    </button>
    <button className="pill search" type="button" onClick={()=>showPreviewNotice('搜尋')}>
      <Icon name="search"/><b>{vm.searchPlaceholder}</b>
    </button>
  </header>;
}

function Hero({showPreviewNotice}:Readonly<{showPreviewNotice:(label:string)=>void}>){
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-world" aria-hidden="true">
      <img className="hero-world-bg" src={A.heroBackgroundR2} alt=""/>
      <span className="hero-world-vignette"/>
    </div>
    <div className="hero-copy">
      <em>More Fun!</em>
      <h1 id="hero-title">同磨飯，<br/>食得更開心！</h1>
      <p>用手作的溫度<br/>讓每一餐都更美好</p>
      <button type="button" onClick={()=>showPreviewNotice('開始點餐')}>開始點餐 <Arrow/></button>
      <small>好食・好人・更開心</small>
    </div>
    <div className="hero-visual" aria-hidden="true">
      <img className="male" src={A.maleHeroR2} alt=""/>
      <img className="female" src={A.femaleHeroR2} alt=""/>
      <img className="doodle doodle-more" src={A.moreFunDoodleR2} alt=""/>
      <img className="doodle doodle-taste" src={A.goodTasteDoodleR2} alt=""/>
    </div>
  </section>;
}

function Quick({showPreviewNotice}:Readonly<{showPreviewNotice:(label:string)=>void}>){
  return <section id="menu-discovery" className="quick" aria-label="快捷入口">
    {vm.quickCards.map(card=><button
      type="button"
      key={card.id}
      className={'quick-card '+card.tone}
      onClick={()=>showPreviewNotice(card.title)}
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

function Recent({showPreviewNotice}:Readonly<{showPreviewNotice:(label:string)=>void}>){
  return <section id="recent-order" className="recent-section">
    <div className="recent-title">
      <h2><Icon name="history"/>最近訂單</h2>
      <button type="button" onClick={()=>showPreviewNotice('全部訂單')}>查看全部 <Arrow/></button>
    </div>
    {vm.recentOrder?<button className="recent-card" type="button" onClick={()=>showPreviewNotice('再來一單')}>
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

function BottomNav({showPreviewNotice}:Readonly<{showPreviewNotice:(label:string)=>void}>){
  return <nav aria-label="主要導覽">
    <button className="active" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>
      <Icon name="home"/><b>首頁</b>
    </button>
    <button type="button" onClick={()=>scrollToId('menu-discovery')}>
      <Icon name="menu"/><b>菜單</b>
    </button>
    <button type="button" onClick={()=>showPreviewNotice('記憶罐')}>
      <Icon name="jar"/><b>記憶罐</b>
    </button>
    <button type="button" onClick={()=>scrollToId('recent-order')}>
      <Icon name="orders"/><b>訂單</b><i/>
    </button>
    <button type="button" onClick={()=>showPreviewNotice('我的')}>
      <Icon name="user"/><b>我的</b>
    </button>
  </nav>;
}

export function CustomerV3App(){
  const [previewNotice,setPreviewNotice]=useState('');
  const showPreviewNotice=(label:string)=>setPreviewNotice(`${label}：預覽版未接駁`);

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
  },[]);

  return <div className="shell">
    <Header showPreviewNotice={showPreviewNotice}/>
    <main>
      <Hero showPreviewNotice={showPreviewNotice}/>
      <Quick showPreviewNotice={showPreviewNotice}/>
      <Lifestyle/>
      <Recent showPreviewNotice={showPreviewNotice}/>
    </main>
    {previewNotice&&<button className="preview-notice" type="button" role="status" onClick={()=>setPreviewNotice('')}>
      {previewNotice}<span aria-hidden="true">×</span>
    </button>}
    <BottomNav showPreviewNotice={showPreviewNotice}/>
  </div>;
}
