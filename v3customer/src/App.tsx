import {CUSTOMER_V3_ASSETS as A} from './assets';
import {PREVIEW_HOME as vm} from './preview-fixture';

const Arrow=()=> <span aria-hidden="true">›</span>;
const scrollToId=(id:string)=>{
  document.getElementById(id)?.scrollIntoView({
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
    block:'start'
  });
};

function Header(){
  return <header className="header">
    <button className="logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="返回首頁頂部">
      <img className="logo" src={A.logo} alt="磨飯 More Fun"/>
    </button>
    <button className="pill location" type="button">● {vm.locationLabel}⌄</button>
    <button className="round bell" type="button" aria-label="通知">♢<i/></button>
    <button className="pill search" type="button" onClick={()=>scrollToId('menu-discovery')}>
      ⌕ <b>{vm.searchPlaceholder}</b>
    </button>
  </header>;
}

function Hero(){
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-world" aria-hidden="true">
      <img className="hero-world-bg" src={A.heroBackgroundR2} alt=""/>
      <span className="hero-world-vignette"/>
    </div>

    <div className="hero-copy">
      <em>More Fun!</em>
      <h1 id="hero-title">同磨飯，<br/>一齊開飯！</h1>
      <strong>好食・好心情・更多樂趣</strong>
      <p>用手作的溫度<br/>讓每一餐都更美好！</p>
      <button type="button" onClick={()=>scrollToId('menu-discovery')}>開始點餐 <Arrow/></button>
      <small>新鮮手作　｜　營養輕食　｜　美味日常</small>
    </div>

    <div className="hero-visual" aria-hidden="true">
      <img className="male" src={A.maleHeroR2} alt=""/>
      <img className="female" src={A.femaleHeroR2} alt=""/>
      <img className="doodle doodle-more" src={A.moreFunDoodleR2} alt=""/>
      <img className="doodle doodle-taste" src={A.goodTasteDoodleR2} alt=""/>
    </div>
  </section>;
}

function Quick(){
  return <section className="quick" aria-label="快捷入口">
    {vm.quickCards.map(card=>
      <button
        type="button"
        key={card.id}
        className={'quick-card '+card.tone}
        onClick={()=>scrollToId('menu-discovery')}
      >
        <span className="quick-icon" aria-hidden="true">{card.icon}</span>
        <span className="quick-copy">
          <strong>{card.title}</strong>
          <small>{card.subtitle.split('\n')[0]}</small>
        </span>
        <span className="quick-arrow"><Arrow/></span>
      </button>
    )}
  </section>;
}

function Featured(){
  const products=vm.products.slice(0,2);
  return <section id="menu-discovery" className="featured-section">
    <div className="section-heading">
      <div>
        <h2>今日推薦</h2>
        <p>睇啱就點，簡單直接</p>
      </div>
      <button type="button">查看全部 <Arrow/></button>
    </div>

    <div className="featured-grid">
      {products.map(product=>
        <article className="featured-card" key={product.id}>
          <button className="featured-main" type="button" aria-label={'查看 '+product.name}>
            <div className="featured-media">
              <img src={product.imageUrl} alt=""/>
            </div>
            <span className="featured-copy">
              <strong>{product.name}</strong>
              <small>{product.description}</small>
            </span>
          </button>
          <footer>
            <b>{product.price}</b>
            <button type="button" aria-label={'加入 '+product.name}>＋</button>
          </footer>
        </article>
      )}
    </div>
  </section>;
}

function Recent(){
  if(!vm.recentOrder)return null;
  return <section id="recent-order" className="recent-section">
    <div className="recent-title">
      <div>
        <h2>最近訂單</h2>
        <p>想食返上次嗰份？</p>
      </div>
      <button type="button">查看全部 <Arrow/></button>
    </div>
    <button className="recent-card" type="button" onClick={()=>scrollToId('menu-discovery')}>
      <img src={A.chefProduct01} alt=""/>
      <span>
        <strong>{vm.recentOrder.itemSummary}</strong>
        <small>{vm.recentOrder.orderedAtLabel}</small>
      </span>
      <b>再來一份</b>
    </button>
  </section>;
}

function BottomNav(){
  return <nav aria-label="主要導覽">
    <button className="active" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>
      <span>⌂</span><b>首頁</b>
    </button>
    <button type="button" onClick={()=>scrollToId('menu-discovery')}>
      <span>▦</span><b>菜單</b>
    </button>
    <button type="button" onClick={()=>scrollToId('recent-order')}>
      <span>▤</span><b>訂單</b>
    </button>
    <button type="button">
      <span>○</span><b>我的</b>
    </button>
  </nav>;
}

export function CustomerV3App(){
  return <div className="shell">
    <Header/>
    <main>
      <Hero/>
      <Quick/>
      <Featured/>
      <Recent/>
    </main>
    <BottomNav/>
  </div>;
}
