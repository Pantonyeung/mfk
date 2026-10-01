import {CUSTOMER_V3_ASSETS as A} from './assets';
import {PREVIEW_HOME as vm} from './preview-fixture';

const Arrow=()=> <span aria-hidden="true">›</span>;
const scrollToId=(id:string)=>{
  document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
};

function Header(){
  return <header className="header">
    <button className="logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="返回首頁頂部">
      <img className="logo" src={A.logo} alt="磨飯 More Fun"/>
    </button>
    <button className="pill location" type="button">● {vm.locationLabel}⌄</button>
    <button className="round bell" type="button" aria-label="通知">♢<i/></button>
    <button className="pill search" type="button" onClick={()=>scrollToId('menu-discovery')}>⌕ <b>{vm.searchPlaceholder}</b></button>
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
      <button type="button" onClick={()=>scrollToId('menu-discovery')}>開始點餐　→</button>
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
  return <section className="quick" aria-label="快捷入口">{vm.quickCards.map(card=><button type="button" key={card.id} className={'card '+card.tone} onClick={()=>scrollToId('menu-discovery')}>
    <div><strong>{card.title}</strong>{card.subtitle.split('\n').map(line=><small key={line}>{line}</small>)}</div>
    <b className="quick-icon">{card.icon}</b><Arrow/>
  </button>)}</section>;
}

function Categories(){
  return <section id="menu-discovery" className="categories" aria-label="餐點分類">{vm.categories.map(category=><button type="button" key={category.id} className={'cat '+category.tone}>
    <b>{category.icon}</b><strong>{category.title}</strong><small>{category.subtitle}</small>
  </button>)}</section>;
}

function Products(){
  return <section id="chef-picks" className="section">
    <div className="heading"><div><h2>主廚推薦</h2><p>用新鮮食材，做讓人開心的味道</p></div><button type="button">查看全部 <Arrow/></button></div>
    <div className="products">{vm.products.map(product=><article key={product.id}>
      <div className="media"><img src={product.imageUrl} alt=""/><button type="button" aria-label="收藏">♡</button></div>
      <strong>{product.name}</strong><small>{product.description}</small>
      <footer><b>{product.price}</b><button type="button" aria-label={'加入 '+product.name}>＋</button></footer>
    </article>)}</div>
  </section>;
}

function BrandBanner(){
  return <section className="brand-banner">
    <div><h2>輕食讓每一天<br/>更開心！♡</h2><i>Good Food<br/>Brighter Days</i></div>
    <img src={A.femaleHeroR2} alt="" aria-hidden="true"/>
    <p>好食物<br/>好心情<br/>好生活 ☺</p>
  </section>;
}

function Member(){
  return <section className="member">
    <button type="button"><b>♛</b><div><strong>磨飯會員</strong><small>美味累積・驚喜更多</small><em>{vm.pointsLabel} →</em></div><span>▣</span></button>
    <button type="button"><b>＋</b><div><strong>邀請好友</strong><small>一起享受美味時光</small><em>{vm.inviteRewardLabel} →</em></div><span className="faces"><img src={A.maleHeroR2} alt=""/><img src={A.femaleHeroR2} alt=""/></span></button>
  </section>;
}

function Recent(){
  if(!vm.recentOrder)return null;
  return <section id="recent-order" className="section recent">
    <div className="heading"><h2>最近訂單</h2><button type="button">查看全部 <Arrow/></button></div>
    <div className="recent-row"><img src={A.bowl} alt=""/><div><strong>{vm.recentOrder.itemSummary}</strong><small>{vm.recentOrder.orderedAtLabel}</small></div><button type="button" onClick={()=>scrollToId('menu-discovery')}>再來一份</button></div>
  </section>;
}

function Services(){
  const items=[['◉','外送到府','美味直達你手中'],['▣','到店取餐','30分鐘快速取餐'],['●','尋找門市','查詢附近磨飯']];
  return <section className="section">
    <div className="heading"><h2>多元取餐・美味更輕鬆</h2></div>
    <div className="services">{items.map(([icon,title,sub])=><button key={title} type="button"><b>{icon}</b><span><strong>{title}</strong><small>{sub}</small></span><Arrow/></button>)}</div>
  </section>;
}

function Lifestyle(){
  return <section className="lifestyle">
    <div><h2>手作輕食<br/>陪你過更好的每一天</h2><p>嚴選食材・用心手作・營養美味<br/>讓健康與快樂，成為生活日常。</p><button type="button">認識磨飯 →</button></div>
    <span><img src={A.maleHeroR2} alt=""/><img src={A.femaleHeroR2} alt=""/></span>
  </section>;
}

function BottomNav(){
  return <nav aria-label="主要導覽">
    <button className="active" type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>⌂<b>首頁</b></button>
    <button type="button" onClick={()=>scrollToId('menu-discovery')}>♜<b>菜單</b></button>
    <button type="button" onClick={()=>scrollToId('recent-order')}>▤<b>訂單</b></button>
    <button type="button">○<b>我的</b></button>
  </nav>;
}

export function CustomerV3App(){
  return <div className="shell">
    <Header/>
    <main><Hero/><Quick/><Categories/><Products/><BrandBanner/><Member/><Recent/><Services/><Lifestyle/></main>
    <BottomNav/>
  </div>;
}
