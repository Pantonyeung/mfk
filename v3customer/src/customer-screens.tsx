import {useMemo,useState} from 'react';
import {CUSTOMER_V3_ASSETS as A} from './assets';
import {AppDialog} from './dialog';
import {DEFAULT_PAYMENT_METHOD_ID,PREVIEW_FEATURED_CAMPAIGN,PREVIEW_NOTIFICATIONS,PREVIEW_ORDERS,PREVIEW_PICKUP_CODE,PREVIEW_PRODUCTS,previewPaymentMethod} from './preview-data';
import type {JarItem,PaymentMethodId} from './preview-data';

const BackTitle=({title,onBack}:Readonly<{title:string;onBack:()=>void}>)=><div className="screen-title">
  <button type="button" onClick={onBack} aria-label="返回">‹</button><span><h1>{title}</h1></span>
</div>;

export function StoreStatusSheet({onClose}:Readonly<{onClose:()=>void}>){
  return <div className="sheet-backdrop" role="presentation" onClick={onClose}>
    <section className="store-sheet" role="dialog" aria-modal="true" aria-labelledby="store-sheet-title" onClick={event=>event.stopPropagation()}>
      <button className="sheet-close" type="button" onClick={onClose} aria-label="關閉">×</button>
      <div className="store-art" aria-hidden="true">OPEN</div>
      <span className="live-status"><i/>舖頭營業中</span>
      <h2 id="store-sheet-title">今日營業時間</h2><strong>11:30–20:30</strong>
      <div className="pickup-estimate">◷ 目前約 30 分鐘可取</div>
      <address>中環皇后大道中 100 號</address>
      <button className="primary-button" type="button" onClick={onClose}>知道了</button>
    </section>
  </div>;
}

export function FeaturedCampaignDialog({onClose,onOpenProduct}:Readonly<{onClose:()=>void;onOpenProduct:(id:string)=>void}>){
  return <AppDialog labelledBy="featured-dialog-title" onClose={onClose} className="featured-dialog">
    <button className="dialog-close" type="button" onClick={onClose} aria-label="關閉">×</button>
    <img src={PREVIEW_FEATURED_CAMPAIGN.image} alt=""/>
    <small>{PREVIEW_FEATURED_CAMPAIGN.eyebrow}</small>
    <h2 id="featured-dialog-title">{PREVIEW_FEATURED_CAMPAIGN.title}</h2>
    <p>{PREVIEW_FEATURED_CAMPAIGN.description}</p>
    <span>每日內容由舖頭更新</span>
    <button className="primary-button" type="button" onClick={()=>onOpenProduct(PREVIEW_FEATURED_CAMPAIGN.productId)}>{PREVIEW_FEATURED_CAMPAIGN.ctaLabel}</button>
  </AppDialog>;
}

function DestinationProduct({product,onOpen,label}:Readonly<{product:(typeof PREVIEW_PRODUCTS)[number];onOpen:(id:string)=>void;label:string}>){
  return <button className="destination-product" type="button" onClick={()=>onOpen(product.id)}>
    <img src={product.image} alt=""/>
    <span><small>{label}</small><b>{product.name}</b><em>{product.description}</em><strong>${product.price}</strong></span>
    <i aria-hidden="true">›</i>
  </button>;
}

export function PopularCombosScreen({onBack,onOpenProduct}:Readonly<{onBack:()=>void;onOpenProduct:(id:string)=>void}>){
  const products=PREVIEW_PRODUCTS.filter(product=>product.tags.includes('popular'));
  return <section className="app-screen destination-screen popular-screen" aria-labelledby="popular-title">
    <BackTitle title="人氣組合" onBack={onBack}/>
    <div className="destination-hero popular"><small>大家最近都鍾意</small><h2 id="popular-title">熱門配搭，一次揀好</h2><p>組合內容由舖頭設定，餐點同飲品會按供應情況更新。</p></div>
    <div className="destination-list">{products.map((product,index)=><DestinationProduct key={product.id} product={product} onOpen={onOpenProduct} label={index?'人氣輕食組合':'最多人揀'}/>)}</div>
  </section>;
}

export function OffersScreen({onBack,onOpenProduct}:Readonly<{onBack:()=>void;onOpenProduct:(id:string)=>void}>){
  const products=PREVIEW_PRODUCTS.filter(product=>product.tags.includes('offer'));
  return <section className="app-screen destination-screen offers-screen" aria-labelledby="offers-title">
    <BackTitle title="期間限定" onBack={onBack}/>
    <div className="destination-hero offer"><small>今期限定</small><h2 id="offers-title">限定登場，食好一餐</h2><p>期間、供應數量同餐點內容由舖頭設定；結帳前會再次確認價錢。</p></div>
    <div className="offer-note"><b>今期登場</b><span>指定餐點期間限定供應，售完即止。</span></div>
    <div className="destination-list">{products.map(product=><DestinationProduct key={product.id} product={product} onOpen={onOpenProduct} label="期間限定"/>)}</div>
  </section>;
}

export function PickupGuideScreen({onBack,onStart}:Readonly<{onBack:()=>void;onStart:()=>void}>){
  const steps=[
    ['1','揀選餐點','一次過將想食嘅餐點放入記憶罐'],
    ['2','確認記憶罐','調整數量及備註，再一次過結帳'],
    ['3','選擇付款','整張訂單只揀一次付款方法'],
    ['4','等候取餐','實際時間以結帳頁同舖頭確認為準']
  ];
  return <section className="app-screen destination-screen pickup-guide-screen" aria-labelledby="pickup-guide-title">
    <BackTitle title="30分鐘內可取" onBack={onBack}/>
    <div className="destination-hero pickup"><small>點餐介紹</small><h2 id="pickup-guide-title">由揀餐到取餐，一眼睇明</h2><p>「30分鐘」係目前預計時間，唔係保證；繁忙時會喺結帳前更新。</p></div>
    <div className="order-guide">{steps.map(([number,title,body])=><article key={number}><i>{number}</i><span><b>{title}</b><small>{body}</small></span></article>)}</div>
    <button className="guide-cta" type="button" onClick={onStart}>開始點餐</button>
  </section>;
}

export function NotificationsScreen({onBack}:Readonly<{onBack:()=>void}>){
  return <section className="app-screen notifications-screen" aria-labelledby="notifications-title">
    <BackTitle title="通知" onBack={onBack}/>
    <div className="screen-heading"><h2 id="notifications-title">最新消息</h2><button type="button">全部已讀</button></div>
    <div className="notification-list">
      {PREVIEW_NOTIFICATIONS.map((item,index)=><article className={item.tone} key={item.id}>
        <span aria-hidden="true">{index===0?'✓':index===1?'◒':index===2?'▣':'◇'}</span>
        <div><h3>{item.title}</h3><p>{item.body}</p></div><time>{item.time}</time>{index<3&&<i/>}
      </article>)}
    </div>
  </section>;
}

export function SearchScreen({onBack,onOpenProduct}:Readonly<{onBack:()=>void;onOpenProduct:(id:string)=>void}>){
  const [query,setQuery]=useState('');
  const results=useMemo(()=>PREVIEW_PRODUCTS.filter(product=>(product.name+product.description).includes(query.trim())),[query]);
  return <section className="app-screen search-screen" aria-labelledby="search-title">
    <BackTitle title="搜尋餐點" onBack={onBack}/>
    <label className="large-search"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋餐點、食材或口味"/><button type="button" onClick={()=>setQuery('')} aria-label="清除搜尋">×</button></label>
    {!query&&<>
      <div className="search-section"><div><h2 id="search-title">最近搜尋</h2><button type="button">清除</button></div><div className="search-tags"><button type="button" onClick={()=>setQuery('雞')}>雞腿飯</button><button type="button" onClick={()=>setQuery('沙律')}>沙律</button></div></div>
      <div className="search-section"><div><h2>熱門關鍵字</h2></div><div className="search-tags"><button type="button" onClick={()=>setQuery('飯')}>飯類</button><button type="button" onClick={()=>setQuery('雞')}>雞肉</button><button type="button" onClick={()=>setQuery('紫薯')}>期間限定</button></div></div>
    </>}
    {query&&<div className="search-results" aria-live="polite"><div className="screen-heading"><h2>搜尋結果</h2><span>{results.length} 款餐點</span></div>{results.map(product=><button type="button" key={product.id} onClick={()=>onOpenProduct(product.id)}><img src={product.image} alt=""/><span><b>{product.name}</b><small>約 {product.pickupMinutes} 分鐘可取</small><strong>${product.price}</strong></span><i>›</i></button>)}</div>}
    {query&&!results.length&&<div className="empty-state" role="status"><span>⌕</span><h2>找不到餐點</h2><p>試下搜尋其他名稱或食材。</p><button type="button" onClick={()=>setQuery('')}>清除搜尋</button></div>}
  </section>;
}

export function OrdersScreen({onBack,onDetail,onReorder}:Readonly<{onBack:()=>void;onDetail:()=>void;onReorder:()=>void}>){
  const [filter,setFilter]=useState<'active'|'completed'|'all'>('active');
  const orders=PREVIEW_ORDERS.filter(order=>filter==='all'||(filter==='active'?order.active:!order.active));
  return <section className="app-screen orders-screen" aria-labelledby="orders-title">
    <BackTitle title="訂單" onBack={onBack}/>
    <div className="orders-brand-card"><div><small>每一餐都記得</small><h2>好味旅程</h2><p>進度、取餐碼同過往訂單，整齊放埋一齊。</p></div><img src={A.femaleHeroR2} alt=""/></div>
    <div className="segmented" role="group" aria-label="訂單篩選"><button className={filter==='active'?'selected':''} type="button" onClick={()=>setFilter('active')}>進行中</button><button className={filter==='completed'?'selected':''} type="button" onClick={()=>setFilter('completed')}>已完成</button><button className={filter==='all'?'selected':''} type="button" onClick={()=>setFilter('all')}>全部</button></div>
    <h2 id="orders-title" className="sr-only">訂單列表</h2>
    <div className="order-list">{orders.map(order=><article key={order.key}>
      <div className="order-meta"><span className={order.active?'active':'complete'}>{order.status}</span><time>{order.orderedAt}</time></div>
      <div className="order-food"><img src={PREVIEW_PRODUCTS[order.active?0:2].image} alt=""/><span><b>{order.summary}</b><small>共 {order.active?3:2} 項</small></span><strong>${order.total}</strong></div>
      <div className="order-identifiers"><div><small>取餐碼・電話尾四位</small><b>{order.pickupCode}</b></div><div><small>訂單顯示編號</small><b>{order.displayNumber}</b></div></div>
      <div className="order-actions"><button type="button" onClick={onDetail}>查看詳情</button>{!order.active&&<button className="primary" type="button" onClick={onReorder}>再來一單</button>}</div>
    </article>)}</div>
    {!orders.length&&<div className="empty-state"><span>▤</span><h2>未有相關訂單</h2><p>完成落單後，進度會喺呢度顯示。</p></div>}
  </section>;
}

export function OrderDetailScreen({onBack,onReorder,pickupCode=PREVIEW_PICKUP_CODE,payment=DEFAULT_PAYMENT_METHOD_ID}:Readonly<{onBack:()=>void;onReorder:()=>void;pickupCode?:string;payment?:PaymentMethodId}>){
  const [refreshed,setRefreshed]=useState(false);
  const selectedPayment=previewPaymentMethod(payment);
  const steps=['已送出','舖頭已接單','準備中','可以取餐','已完成'];
  return <section className="app-screen order-detail-screen" aria-labelledby="order-detail-title">
    <BackTitle title="訂單詳情" onBack={onBack}/>
    <div className="pickup-code large"><small>取餐碼・電話尾四位</small><b id="order-detail-title">{pickupCode}</b><span>訂單顯示編號 MF-0128・{refreshed?'啱啱更新':'最後更新 12:38'}</span></div>
    <div className="timeline">{steps.map((step,index)=><div className={index<2?'done':index===2?'current':''} key={step}><i>{index<2?'✓':index+1}</i><span><b>{step}</b>{index===2&&<small>餐點正在為你準備</small>}</span>{index<3&&<time>{['12:30','12:32','12:38'][index]}</time>}</div>)}</div>
    <button className="refresh-status" type="button" onClick={()=>setRefreshed(true)}>↻ 更新狀態 <small>只會重新讀取進度，不會再次送出訂單</small></button>
    {refreshed&&<p className="inline-message" role="status">已讀取最新進度，冇重複送出訂單。</p>}
    <article className="detail-food"><img src={PREVIEW_PRODUCTS[0].image} alt=""/><span><b>香草烤雞腿飯</b><small>原味・加蛋 × 1</small></span><strong>$190</strong></article>
    <div className="status-note"><b>{selectedPayment.requiresProof?`${selectedPayment.label}付款憑證已提交`:`${selectedPayment.label}付款`}</b><span>{selectedPayment.requiresProof?'付款憑證唔等於已確認收款，仍待舖頭核對。':'取餐時先付款，冇付款憑證流程。'}</span></div>
    <button className="wide-secondary" type="button" onClick={onReorder}>再來一單</button>
  </section>;
}

export function ReorderScreen({onBack,onAdd}:Readonly<{onBack:()=>void;onAdd:(item:JarItem)=>void}>){
  const [acknowledged,setAcknowledged]=useState(false);
  const product=PREVIEW_PRODUCTS[0];
  return <section className="app-screen reorder-screen" aria-labelledby="reorder-title">
    <BackTitle title="再來一單" onBack={onBack}/>
    <div className="screen-intro"><h2 id="reorder-title">建立一個新記憶罐</h2><p>會按而家嘅餐點、價格同供應情況重新確認。</p></div>
    <article className="reorder-item available"><img src={product.image} alt=""/><span><b>{product.name}</b><small>仍然供應</small></span><input type="checkbox" defaultChecked aria-label={`加入${product.name}`}/></article>
    <article className="reorder-item changed"><img src={PREVIEW_PRODUCTS[1].image} alt=""/><span><b>凍奶茶</b><small>價格由 $28 更新為 $32</small></span><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)} aria-label="接受凍奶茶新價格"/></article>
    <article className="reorder-item sold-out"><img src={PREVIEW_PRODUCTS[2].image} alt=""/><span><b>紫薯球</b><small>餐點已售罄</small></span><button type="button">重新選擇</button></article>
    <div className="sticky-action"><span><small>新記憶罐</small><b>$192</b></span><button type="button" disabled={!acknowledged} onClick={()=>onAdd({product,combo:'單點',options:Object.freeze(['原味']),quantity:1})}>放入新記憶罐</button></div>
  </section>;
}

export function ProfileScreen({onBack}:Readonly<{onBack:()=>void}>){
  const [section,setSection]=useState<'home'|'saved'|'settings'|'member'|'recovery'|'rewards'>('home');
  const titles={home:'我的',saved:'我的收藏',settings:'設定',member:'會員登入',recovery:'帳戶恢復',rewards:'種子與獎賞'} as const;
  return <section className="app-screen profile-screen" aria-labelledby="profile-title">
    <BackTitle title={titles[section]} onBack={()=>section==='home'?onBack():section==='recovery'?setSection('member'):setSection('home')}/>
    {section==='home'&&<>
      <button className="profile-card" type="button" onClick={()=>setSection('member')}><span><img src="/media/customer/hero/hero-male-main.png" alt=""/></span><div><h2 id="profile-title">登入／啟用會員</h2><p>用電話及密碼管理個人資料</p></div><b>›</b></button>
      <div className="profile-stats"><div><small>今次取餐碼</small><b>{PREVIEW_PICKUP_CODE}</b></div><div><small>終身累計種子</small><b>320</b></div></div>
      <div className="profile-grid"><button type="button" onClick={()=>setSection('rewards')}><span>◇</span><b>種子與獎賞</b><small>查看里程碑及優惠券</small></button><button type="button" onClick={()=>setSection('saved')}><span>♡</span><b>收藏餐點</b><small>儲低喜愛嘅美味</small></button><button type="button" onClick={()=>setSection('saved')}><span>▤</span><b>常叫訂單</b><small>快速建立新記憶罐</small></button><button type="button" onClick={()=>setSection('settings')}><span>♧</span><b>飲食偏好</b><small>設定個人口味喜好</small></button><button type="button" onClick={()=>setSection('rewards')}><span>★</span><b>我的徽章</b><small>記錄每段美食旅程</small></button><button type="button" onClick={()=>setSection('settings')}><span>⚙</span><b>設定</b><small>通知、同意及私隱</small></button></div>
    </>}
    {section==='saved'&&<SavedSection/>}
    {section==='settings'&&<SettingsSection/>}
    {section === 'member' && (
      <MemberSection onRecovery={() => setSection('recovery')} />
    )}
    {section==='recovery'&&<RecoverySection/>}
    {section==='rewards'&&<RewardsSection/>}
  </section>;
}

function SavedSection(){
  const [tab,setTab]=useState<'food'|'orders'>('food');
  return <><div className="segmented"><button type="button" className={tab==='food'?'selected':''} onClick={()=>setTab('food')}>收藏餐點</button><button type="button" className={tab==='orders'?'selected':''} onClick={()=>setTab('orders')}>常叫訂單</button></div>{tab==='food'?<div className="saved-list">{PREVIEW_PRODUCTS.map(product=><article key={product.id}><img src={product.image} alt=""/><span><b>{product.name}</b><small>${product.price}</small></span><button type="button" aria-label={`取消收藏${product.name}`}>♥</button></article>)}</div>:<div className="saved-list"><article><img src={PREVIEW_PRODUCTS[0].image} alt=""/><span><b>平日開心午餐</b><small>會建立新記憶罐，唔會重開舊訂單</small></span><button type="button">›</button></article></div>}<div className="seed-card"><span>♧</span><div><b>終身累計種子</b><small>日結後按合資格已完成訂單更新，永不扣減</small><progress value="320" max="500"/></div><strong>320 / 500</strong></div></>;
}

function SettingsSection(){
  return <div className="settings-list"><button type="button"><span>♧</span><b>飲食偏好<small>過敏、忌口、口味選擇</small></b><i>›</i></button><label><span>▤</span><b>訂單通知<small>接單、製作及取餐進度</small></b><input type="checkbox" defaultChecked/></label><label><span>♢</span><b>優惠消息<small>獨立自願選擇；加入會員唔會自動訂閱</small></b><input type="checkbox"/></label><button type="button"><span>▣</span><b>加入主畫面<small>更快打開磨飯</small></b><i>›</i></button><button type="button"><span>◇</span><b>私隱與資料<small>管理資料與私隱選項</small></b><i>›</i></button><p>會員身份同優惠消息同意係兩件事。你可以獨立開關優惠消息，而唔影響會員或訂單服務。</p></div>;
}

function MemberSection({onRecovery}:Readonly<{onRecovery:()=>void}>){
  const [message,setMessage]=useState('');
  return <div className="member-section">
    <div className="member-intro"><span>♙</span><h2>正式會員登入</h2><p>用電話及你自己設定嘅密碼登入。</p></div>
    <label>電話<input name="member-phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue="9123 4567"/></label>
    <label>密碼<input name="member-password" type="password" autoComplete="current-password"/></label>
    <p className="security-note">密碼只交由安全登入服務核對；店員同 Admin 都睇唔到原密碼。</p>
    <button className="primary-button" type="button" onClick={()=>setMessage('預覽模式：會員登入服務尚未接駁，冇傳送或儲存資料。')}>登入會員</button>
    {message&&<p className="inline-message" role="status">{message}</p>}
    <button className="text-action" type="button" onClick={onRecovery}>忘記密碼／更改電話</button>
    <div className="first-order-note"><b>第一次落單？</b><span>只需要稱呼同電話，唔使先註冊或收 OTP。</span></div>
  </div>;
}

function RecoverySection(){
  const [message,setMessage]=useState('');
  return <div className="recovery-section">
    <div className="screen-intro"><h2>經 WhatsApp 人工核對</h2><p>換手機、忘記密碼或更改電話，都唔會用自動 OTP。</p></div>
    <ol className="recovery-steps"><li><b>聯絡店員</b><span>提供舊電話及已登記資料。</span></li><li><b>人工核對</b><span>可核對稱呼、最近訂單或常買內容。</span></li><li><b>保留原有帳戶</b><span>種子、優惠券、收藏、偏好及訂單記錄會跟返同一會員。</span></li><li><b>一次性臨時密碼</b><span>每次獨立產生，首次登入必須改密碼，用後或過期即失效。</span></li></ol>
    <button className="primary-button" type="button" onClick={()=>setMessage('預覽模式：尚未接駁正式 WhatsApp 聯絡入口。')}>經 WhatsApp 聯絡店員</button>
    {message&&<p className="inline-message" role="status">{message}</p>}
    <p className="audit-note">正式處理會保留同一會員身份並留下操作記錄；客戶畫面唔會顯示內部 ID。</p>
  </div>;
}

function RewardsSection(){
  return <div className="rewards-section">
    <div className="lifetime-seeds"><small>終身累計種子</small><strong>320</strong><p>種子永不扣減，只會喺日結後按合資格已完成訂單批次更新。</p></div>
    <div className="milestone-card"><span><b>下一個里程碑</b><small>再累計 180 粒種子</small></span><strong>320 / 500</strong><progress value="320" max="500"/></div>
    <div className="reward-rule"><b>獎賞點樣派？</b><p>里程碑、獎賞、適用對象同有效期由舖頭設定；同一里程碑只會派一次。</p></div>
    <div className="coupon-empty"><span>◇</span><div><b>目前未有可用優惠券</b><small>新獎賞會喺完成日結計算後顯示。</small></div></div>
  </div>;
}
