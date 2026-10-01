import {useMemo,useState} from 'react';
import {PREVIEW_NOTIFICATIONS,PREVIEW_ORDERS,PREVIEW_PRODUCTS} from './preview-data';
import type {JarItem} from './preview-data';

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
    <div className="segmented" role="group" aria-label="訂單篩選"><button className={filter==='active'?'selected':''} type="button" onClick={()=>setFilter('active')}>進行中</button><button className={filter==='completed'?'selected':''} type="button" onClick={()=>setFilter('completed')}>已完成</button><button className={filter==='all'?'selected':''} type="button" onClick={()=>setFilter('all')}>全部</button></div>
    <h2 id="orders-title" className="sr-only">訂單列表</h2>
    <div className="order-list">{orders.map(order=><article key={order.id}>
      <div className="order-meta"><span className={order.active?'active':'complete'}>{order.status}</span><time>{order.orderedAt}</time></div>
      <div className="order-food"><img src={PREVIEW_PRODUCTS[order.active?0:2].image} alt=""/><span><b>{order.summary}</b><small>共 {order.active?3:2} 項</small></span><strong>${order.total}</strong></div>
      <div className="order-code"><small>取餐編號</small><b>{order.id}</b></div>
      <div className="order-actions"><button type="button" onClick={onDetail}>查看詳情</button>{!order.active&&<button className="primary" type="button" onClick={onReorder}>再來一單</button>}</div>
    </article>)}</div>
    {!orders.length&&<div className="empty-state"><span>▤</span><h2>未有相關訂單</h2><p>完成落單後，進度會喺呢度顯示。</p></div>}
  </section>;
}

export function OrderDetailScreen({onBack,onReorder}:Readonly<{onBack:()=>void;onReorder:()=>void}>){
  const steps=['已送出','舖頭已接單','準備中','可以取餐','已完成'];
  return <section className="app-screen order-detail-screen" aria-labelledby="order-detail-title">
    <BackTitle title="訂單詳情" onBack={onBack}/>
    <div className="pickup-code large"><small>取餐編號</small><b id="order-detail-title">A128</b><span>最後更新 12:38</span></div>
    <div className="timeline">{steps.map((step,index)=><div className={index<2?'done':index===2?'current':''} key={step}><i>{index<2?'✓':index+1}</i><span><b>{step}</b>{index===2&&<small>餐點正在為你準備</small>}</span>{index<3&&<time>{['12:30','12:32','12:38'][index]}</time>}</div>)}</div>
    <button className="refresh-status" type="button">↻ 更新狀態 <small>只會重新讀取進度</small></button>
    <article className="detail-food"><img src={PREVIEW_PRODUCTS[0].image} alt=""/><span><b>香草烤雞腿飯</b><small>原味・加蛋 × 1</small></span><strong>$190</strong></article>
    <div className="status-note"><b>付款證明已提交</b><span>仍待舖頭核對及確認收款。</span></div>
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
  const [section,setSection]=useState<'home'|'saved'|'settings'>('home');
  return <section className="app-screen profile-screen" aria-labelledby="profile-title">
    <BackTitle title={section==='home'?'我的':section==='saved'?'我的收藏':'設定'} onBack={()=>section==='home'?onBack():setSection('home')}/>
    {section==='home'&&<>
      <div className="profile-card"><span><img src="/media/customer/hero/hero-male-main.png" alt=""/></span><div><h2 id="profile-title">磨飯好友</h2><p>好食・好人・更開心</p></div><b>›</b></div>
      <div className="profile-stats"><div><small>取餐編號</small><b>A128</b></div><div><small>種子餘額</small><b>320</b></div></div>
      <div className="profile-grid"><button type="button"><span>◇</span><b>獎勵與優惠券</b><small>查看你嘅獎賞</small></button><button type="button" onClick={()=>setSection('saved')}><span>♡</span><b>收藏餐點</b><small>儲低喜愛嘅美味</small></button><button type="button" onClick={()=>setSection('saved')}><span>▤</span><b>常叫訂單</b><small>快速再點整張訂單</small></button><button type="button" onClick={()=>setSection('settings')}><span>♧</span><b>飲食偏好</b><small>設定個人口味喜好</small></button><button type="button"><span>★</span><b>我的徽章</b><small>記錄每段美食旅程</small></button><button type="button" onClick={()=>setSection('settings')}><span>⚙</span><b>設定</b><small>通知及私隱</small></button></div>
    </>}
    {section==='saved'&&<SavedSection/>}
    {section==='settings'&&<SettingsSection/>}
  </section>;
}

function SavedSection(){
  const [tab,setTab]=useState<'food'|'orders'>('food');
  return <><div className="segmented"><button type="button" className={tab==='food'?'selected':''} onClick={()=>setTab('food')}>收藏餐點</button><button type="button" className={tab==='orders'?'selected':''} onClick={()=>setTab('orders')}>常叫訂單</button></div>{tab==='food'?<div className="saved-list">{PREVIEW_PRODUCTS.map(product=><article key={product.id}><img src={product.image} alt=""/><span><b>{product.name}</b><small>${product.price}</small></span><button type="button" aria-label={`取消收藏${product.name}`}>♥</button></article>)}</div>:<div className="saved-list"><article><img src={PREVIEW_PRODUCTS[0].image} alt=""/><span><b>平日開心午餐</b><small>主餐＋飲品・$190</small></span><button type="button">›</button></article></div>}<div className="seed-card"><span>♧</span><div><b>美味種子</b><small>每次用餐都更接近驚喜</small><progress value="320" max="500"/></div><strong>320 / 500</strong></div></>;
}

function SettingsSection(){
  return <div className="settings-list"><button type="button"><span>♧</span><b>飲食偏好<small>過敏、忌口、口味選擇</small></b><i>›</i></button><label><span>♢</span><b>通知設定<small>訂單、優惠、最新消息</small></b><input type="checkbox" defaultChecked/></label><button type="button"><span>▣</span><b>加入主畫面<small>更快打開磨飯</small></b><i>›</i></button><button type="button"><span>◇</span><b>私隱與資料<small>管理資料與私隱選項</small></b><i>›</i></button><p>我哋重視你嘅私隱，只會使用提供服務所需嘅資料。你可以隨時調整設定。</p></div>;
}
