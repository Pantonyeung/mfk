import {useMemo,useState} from 'react';
import capabilities from './capabilities.json';
import {activeOrderFixture,categories,historyFixtures,products,storeFixture,type Product} from './fixtures';

type View='home'|'menu'|'cart'|'checkout'|'orders'|'more';
type NetworkMode='ONLINE'|'OFFLINE'|'FAILURE'|'STALE';
type OrderStage='ACCEPTANCE'|'REJECTED'|'PREPARING'|'DELAYED'|'READY'|'PICKUP'|'COMPLETED';
type SubmissionState='IDLE'|'PENDING'|'UNKNOWN';
type CartLine={id:number;productId:string;name:string;config:string[];priceLabel:string;quantity:number;attention?:string};

const commandCapabilities=capabilities.filter(item=>item.kind==='COMMAND_SHAPE');

const stageMeta:Record<OrderStage,{label:string;title:string;detail:string}>={
  ACCEPTANCE:{label:'等待店舖接單',title:'已收到訂單（展示狀態）',detail:'等待店舖確認。Created / Received 唔等於 Accepted。'},
  REJECTED:{label:'未能接單',title:'店舖未能承諾（展示狀態）',detail:'Rejected 必須有結構化原因同修復入口；唔會永久停留 Pending。'},
  PREPARING:{label:'製作中',title:'店舖已接單（展示狀態）',detail:'Accepted → Preparing。只展示客戶需要嘅階段，同內部製作細節分開。'},
  DELAYED:{label:'稍有延誤',title:'製作時間已更新（展示狀態）',detail:'Delay 只更新 ETA；仍然係 Preparing，唔會假裝 Ready。'},
  READY:{label:'可取餐',title:'可以取餐（展示狀態）',detail:'Ready 只代表真正可取；唔等於 Arrived / Verified / Handed Over / Completed。'},
  PICKUP:{label:'取餐核對',title:'到店取餐（展示狀態）',detail:'顯示短取餐碼／電話尾碼 shape；真正核對 authority 今輪未接線。'},
  COMPLETED:{label:'已完成',title:'取餐完成（展示狀態）',detail:'Completed 只係 fixture projection，唔由 Customer Port 自行寫正式交易狀態。'},
};

export function App(){
  const [view,setView]=useState<View>('home');
  const [network,setNetwork]=useState<NetworkMode>('ONLINE');
  const [channelUnavailable,setChannelUnavailable]=useState(false);
  const [category,setCategory]=useState<string>('人氣');
  const [searchQuery,setSearchQuery]=useState('');
  const [selected,setSelected]=useState<Product|null>(null);
  const [selections,setSelections]=useState<Record<string,string[]>>({});
  const [cart,setCart]=useState<CartLine[]>([]);
  const [notice,setNotice]=useState<string|null>(null);
  const [phone,setPhone]=useState('');
  const [name,setName]=useState('');
  const [submissionState,setSubmissionState]=useState<SubmissionState>('IDLE');
  const [orderStage,setOrderStage]=useState<OrderStage>('ACCEPTANCE');
  const [orderSegment,setOrderSegment]=useState<'current'|'history'>('current');
  const [registryOpen,setRegistryOpen]=useState(false);
  const [nextLineId,setNextLineId]=useState(1);

  const visibleProducts=useMemo(()=>{
    const query=searchQuery.trim().toLowerCase();
    return products.filter(product=>{
      const categoryMatch=category==='人氣'?(product.badge==='人氣'||product.id==='c-p2'):product.category===category;
      const searchMatch=!query||[product.name,product.description,product.category,product.badge??''].some(value=>value.toLowerCase().includes(query));
      return categoryMatch&&searchMatch;
    });
  },[category,searchQuery]);

  const showNotWired=(label:string)=>{
    setNotice(`${label}：NOT_WIRED｜MIGRATION_ONLY。今輪唔會建立正式 Order、派 Display Number、執行付款、寫入 Store Kernel、送出訊息或連接 SMT。`);
  };

  const openProduct=(product:Product)=>{
    setSelected(product);
    setSelections({});
  };

  const addLocalCartLine=()=>{
    if(!selected)return;
    const groups=[...(selected.choiceGroups??[]),...(selected.comboGroups??[])];
    for(const group of groups){
      const values=selections[group.label]??[];
      const min=group.min??(group.required?1:0);
      const max=group.max??1;
      if(values.length<min){setNotice(`請完成 ${group.label}：最少揀 ${min} 項。`);return;}
      if(values.length>max){setNotice(`${group.label}：最多揀 ${max} 項。`);return;}
    }
    const config=Object.entries(selections).filter(([,values])=>values.length).map(([key,values])=>`${key}：${values.join('、')}`);
    setCart(current=>[...current,{id:nextLineId,productId:selected.id,name:selected.name,config,priceLabel:selected.priceLabel,quantity:1}]);
    setNextLineId(value=>value+1);
    setSelected(null);
    setSelections({});
    setNotice('已加入 session-only Cart。只係 migration fixture，未計正式價錢、未建立正式 Order。');
  };

  const submitPresentation=()=>{
    const digits=phone.replace(/\D/g,'');
    if(cart.length===0){setNotice('購物籃未有項目。');return;}
    if(digits.length<8){setNotice('請輸入至少 8 位電話，作 Checkout Form shape 驗證。');return;}
    setSubmissionState('PENDING');
    setNotice('Safe Submit Presentation：PENDING_INTENT。結果 certainty 只可以係 PENDING / UNKNOWN，未有 authoritative readback 前唔會假裝 Order Created。');
  };

  const rebuildLocalCart=(summary:string)=>{
    setCart([{id:nextLineId,productId:'history-fixture',name:'再次下單預覽',config:[summary,'Historical intent copy'],priceLabel:'等待 Current Quote',quantity:1,attention:'NEEDS_REVALIDATION：Price / Availability / Config 必須按 current state 重驗；只修有問題嗰項。'}]);
    setNextLineId(value=>value+1);
    setView('cart');
    setNotice('Reorder Shape：只重建本機 Cart 預覽。正式 Reorder Command 仍然 NOT_WIRED。');
  };

  return <main className="customer-shell" data-network={network.toLowerCase()}>
    <header className="topbar">
      <button className="brand" onClick={()=>setView('home')} aria-label="返回首頁"><b>磨</b><span><strong>磨飯</strong><small>Customer Migration</small></span></button>
      <button className="network-chip" onClick={()=>setView('more')}><i/>{network==='ONLINE'?'展示：Online':network==='OFFLINE'?'展示：Offline':network==='FAILURE'?'展示：Failure':'展示：Stale'}</button>
    </header>

    <section className="migration-strip" role="status">
      <strong>MIGRATION_ONLY</strong><span>UI / Page / Form / Workflow Shape</span><em>所有正式 Command：NOT_WIRED</em>
    </section>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}

    {network!=='ONLINE'?<RecoveryBanner mode={network} onRetry={()=>showNotWired('重試／重新確認')}/>:null}

    <section className="viewport">
      {view==='home'?<HomeView unavailable={channelUnavailable} onBrowse={()=>setView('menu')} onOrders={()=>{setOrderSegment('current');setView('orders')}} onHistory={()=>{setOrderSegment('history');setView('orders')}} onFallback={()=>showNotWired('WhatsApp 備用入口')}/>:null}
      {view==='menu'?<MenuView category={category} setCategory={setCategory} query={searchQuery} setQuery={setSearchQuery} products={visibleProducts} onProduct={openProduct} cartCount={cart.reduce((sum,line)=>sum+line.quantity,0)} onCart={()=>setView('cart')}/>:null}
      {view==='cart'?<CartView cart={cart} onRemove={id=>setCart(current=>current.filter(line=>line.id!==id))} onQuantity={(id,quantity)=>setCart(current=>current.map(line=>line.id===id?{...line,quantity:Math.max(1,quantity)}:line))} onMenu={()=>setView('menu')} onCheckout={()=>setView('checkout')}/>:null}
      {view==='checkout'?<CheckoutView cart={cart} name={name} setName={setName} phone={phone} setPhone={setPhone} submissionState={submissionState} setSubmissionState={setSubmissionState} onSubmit={submitPresentation} onBack={()=>setView('cart')} onAction={showNotWired}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} stage={orderStage} setStage={setOrderStage} onReorder={rebuildLocalCart} onAction={showNotWired}/>:null}
      {view==='more'?<MoreView network={network} setNetwork={setNetwork} unavailable={channelUnavailable} setUnavailable={setChannelUnavailable} registryOpen={registryOpen} setRegistryOpen={setRegistryOpen} onAction={showNotWired}/>:null}
    </section>

    {view!=='checkout'?<nav className="bottom-nav" aria-label="主要導覽">
      <Nav active={view==='home'} icon="⌂" label="首頁" onClick={()=>setView('home')}/>
      <Nav active={view==='menu'} icon="▦" label="菜單" onClick={()=>setView('menu')}/>
      <Nav active={view==='cart'} icon="□" label="購物籃" badge={cart.length?String(cart.reduce((sum,line)=>sum+line.quantity,0)):undefined} onClick={()=>setView('cart')}/>
      <Nav active={view==='orders'} icon="◎" label="訂單" onClick={()=>setView('orders')}/>
      <Nav active={view==='more'} icon="•••" label="更多" onClick={()=>setView('more')}/>
    </nav>:null}

    {selected?<ProductSheet product={selected} values={selections} setValue={(group,value,max)=>setSelections(current=>{const selectedValues=current[group]??[];const exists=selectedValues.includes(value);const next=exists?selectedValues.filter(item=>item!==value):max===1?[value]:selectedValues.length<max?[...selectedValues,value]:selectedValues;return {...current,[group]:next};})} onClose={()=>setSelected(null)} onAdd={addLocalCartLine}/>:null}
  </main>;
}

function RecoveryBanner({mode,onRetry}:{mode:NetworkMode;onRetry:()=>void}){
  const copy={
    OFFLINE:['離線展示','不會建立離線 queue，不會背景重送；畫面只展示最近 fixture。'],
    FAILURE:['提交／讀取失敗展示','Failure Presentation 只提供安全下一步；Retry 目前 NOT_WIRED。'],
    STALE:['資料可能過期','STALE Presentation 必須指出資料唔新鮮，唔會扮成 live truth。'],
    ONLINE:['',''],
  }[mode];
  return <section className={`recovery-banner ${mode.toLowerCase()}`}><div><strong>{copy[0]}</strong><span>{copy[1]}</span></div><button onClick={onRetry}>重試（NOT_WIRED）</button></section>;
}

function HomeView({unavailable,onBrowse,onOrders,onHistory,onFallback}:{unavailable:boolean;onBrowse:()=>void;onOrders:()=>void;onHistory:()=>void;onFallback:()=>void}){
  return <section className="page home-page">
    <div className="store-card">
      <span className="eyebrow">自取 · migration fixture</span>
      <h1>{storeFixture.name}</h1>
      <p>{storeFixture.status} · {storeFixture.eta}</p>
      <small>{storeFixture.notice}</small>
    </div>

    {unavailable?<section className="unavailable-card">
      <b>自家渠道暫時不可用（展示狀態）</b>
      <p>Own-channel unavailable。唔會離線排隊，唔會延遲自動送出。</p>
      <button onClick={onFallback}>WhatsApp 備用入口（NOT_WIRED）</button>
      <small>Fallback 只係 presentation shape；按下去唔會自動發任何訂單。</small>
    </section>:<section className="hero-card">
      <span>最快由想食開始</span>
      <h2>紫米能量餐，揀好就取。</h2>
      <p>Browse → Configure → Cart → Checkout → Safe Submit。</p>
      <button className="primary" onClick={onBrowse}>開始睇菜單</button>
    </section>}

    <button className="current-order-card" onClick={onOrders}>
      <div><span>進行中訂單 · fixture</span><strong>{activeOrderFixture.orderRef}</strong><small>Created / Received ≠ Accepted</small></div>
      <em>查看訂單狀態</em>
    </button>

    <section className="quick-grid">
      <button onClick={onBrowse}><b>人氣</b><span>快速睇熱門</span></button>
      <button onClick={onHistory}><b>再來一單</b><span>History → current revalidation</span></button>
      <button onClick={onOrders}><b>取餐碼</b><span>{activeOrderFixture.pickupCode} · 示意</span></button>
    </section>
  </section>;
}
function MenuView({category,setCategory,query,setQuery,products,onProduct,cartCount,onCart}:{category:string;setCategory:(value:string)=>void;query:string;setQuery:(value:string)=>void;products:Product[];onProduct:(product:Product)=>void;cartCount:number;onCart:()=>void}){
  return <section className="page menu-page">
    <header className="page-title"><span>Menu / Search / Category</span><h1>今日想食咩？</h1><p>搜尋只做基本 name / description / category match；零結果會安全回退。</p></header>
    <label className="menu-search"><span>搜尋</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋飯團、便當、飲品…"/></label>
    <div className="category-rail">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    {products.length?<div className="product-list">{products.map(product=><button key={product.id} className={`product-card ${product.unavailable?'unavailable':''}`} disabled={product.unavailable} onClick={()=>onProduct(product)}>
      <span className="product-visual">{product.name.slice(0,1)}</span>
      <div><small>{product.badge??product.category}</small><strong>{product.name}</strong><p>{product.description}</p><em>{product.unavailable?'暫停供應 · 不可選':product.priceLabel}</em></div>
    </button>)}</div>:<section className="empty-card"><strong>搵唔到符合條件嘅商品</strong><p>可以清除搜尋，或者返回「人氣」繼續揀；唔會白屏。</p><button className="primary" onClick={()=>{setQuery('');setCategory('人氣')}}>返回人氣</button></section>}
    {cartCount?<button className="floating-cart" onClick={onCart}><b>{cartCount}</b><span>查看購物籃</span><em>Quote 尚未接線</em></button>:null}
  </section>;
}
function CartView({cart,onRemove,onQuantity,onMenu,onCheckout}:{cart:CartLine[];onRemove:(id:number)=>void;onQuantity:(id:number,quantity:number)=>void;onMenu:()=>void;onCheckout:()=>void}){
  const totalItems=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <section className="page cart-page">
    <header className="page-title"><span>Cart Intent</span><h1>購物籃</h1><p>可編輯購買意圖；Cart ≠ Formal Order。Session-only state。</p></header>
    {!cart.length?<section className="empty-card"><strong>購物籃未有嘢</strong><p>先去菜單揀商品。</p><button className="primary" onClick={onMenu}>去菜單</button></section>:<>
      <div className="cart-lines">{cart.map(line=><article key={line.id}>
        <div><strong>{line.name}</strong><small>{line.config.length?line.config.join(' · '):'無額外設定'}</small><em>{line.priceLabel}</em>{line.attention?<p className="line-attention">{line.attention}</p>:null}</div>
        <div className="cart-line-actions"><div className="qty-stepper"><button aria-label="減少數量" disabled={line.quantity<=1} onClick={()=>onQuantity(line.id,line.quantity-1)}>−</button><b>{line.quantity}</b><button aria-label="增加數量" onClick={()=>onQuantity(line.id,line.quantity+1)}>＋</button></div><button onClick={()=>onRemove(line.id)}>移除</button></div>
      </article>)}</div>
      <section className="quote-card"><span>Current Quote Presentation</span><strong>等待正式 Pricing Readback</strong><p>{totalItems} 件商品 · Quote freshness = UNKNOWN。今輪不自行計算正式總額。</p></section>
      <section className="repair-card"><b>局部修復原則</b><p>將來如一項 Price / Availability / Config 有問題，只修嗰一項；唔無必要清空成個 Cart。</p></section>
      <button className="primary wide" onClick={onCheckout}>前往結帳</button>
    </>}
  </section>;
}
function CheckoutView({cart,name,setName,phone,setPhone,submissionState,setSubmissionState,onSubmit,onBack,onAction}:{cart:CartLine[];name:string;setName:(v:string)=>void;phone:string;setPhone:(v:string)=>void;submissionState:SubmissionState;setSubmissionState:(v:SubmissionState)=>void;onSubmit:()=>void;onBack:()=>void;onAction:(label:string)=>void}){
  const digits=phone.replace(/\D/g,'');
  const contactReady=digits.length>=8;
  const hasAttention=cart.some(line=>Boolean(line.attention));
  return <section className="page checkout-page">
    <button className="back-link" onClick={onBack}>← 返回購物籃</button>
    <header className="page-title"><span>Checkout Preview / Final Review</span><h1>確認自取資料</h1><p>Checkout 只收斂 Intent；Price / Availability / Promo / Fulfillment context 要喺真正 Commit 前重新驗證。</p></header>
    <section className="checkout-form">
      <label><span>姓名（選填）</span><input value={name} onChange={event=>setName(event.target.value)} placeholder="例如 Panton"/></label>
      <label><span>電話</span><input type="tel" inputMode="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="例如 9123 4567"/></label>
      <label><span>取餐時間</span><select defaultValue="asap"><option value="asap">盡快（展示）</option><option value="later">稍後時間（展示）</option></select></label>
    </section>

    <section className="checkout-review">
      <div><span>商品</span><strong>{cart.reduce((sum,line)=>sum+line.quantity,0)} 件</strong></div>
      <div><span>Contact</span><strong>{contactReady?'READY':'NEEDS_ATTENTION'}</strong></div>
      <div><span>Quote freshness</span><strong>UNKNOWN / NOT_WIRED</strong></div>
      <div><span>Availability</span><strong>REVALIDATION REQUIRED</strong></div>
      <div><span>付款</span><strong>未接線</strong></div>
    </section>

    {hasAttention?<section className="repair-card"><b>需要局部修復</b><p>Reorder / Cart 有項目需要 current validation。返回 Cart 只修有問題嗰項；唔由頭重做。</p><button onClick={onBack}>返回 Cart 修復</button></section>:null}

    <section className="safe-submit">
      <span>Safe Submit / Result Certainty</span>
      <strong>同一 submission 只可以確認同一個結果</strong>
      <p>真正接線後只接受 KNOWN_CREATED / KNOWN_NOT_CREATED / UNKNOWN；Timeout 唔可以直接當 Failed，更唔可以新建第二次提交。</p>
      <button className="primary wide" disabled={!cart.length||!contactReady||hasAttention} onClick={onSubmit}>提交訂單（NOT_WIRED）</button>
    </section>

    {submissionState!=='IDLE'?<section className="pending-card" role="status">
      <b>{submissionState==='PENDING'?'PENDING_INTENT':'RESULT_CERTAINTY_UNKNOWN'} · NOT_WIRED</b>
      <h2>{submissionState==='PENDING'?'正在確認原提交（展示）':'結果未能確認（展示）'}</h2>
      <p>未建立正式 Order。禁止背景自動重送；只可以用同一 submission identity 做 readback / same-key retry。</p>
      <div><span>Order / Pickup identity</span><strong>等待 authoritative readback；唔預派正式號碼</strong></div>
      <div className="pending-actions"><button onClick={()=>setSubmissionState('UNKNOWN')}>展示 UNKNOWN</button><button onClick={()=>onAction('重新確認同一 submission')}>重新確認原提交（NOT_WIRED）</button></div>
    </section>:null}
  </section>;
}
function OrdersView({segment,setSegment,stage,setStage,onReorder,onAction}:{segment:'current'|'history';setSegment:(v:'current'|'history')=>void;stage:OrderStage;setStage:(v:OrderStage)=>void;onReorder:(summary:string)=>void;onAction:(label:string)=>void}){
  return <section className="page orders-page">
    <header className="page-title"><span>Order Status / History</span><h1>我的訂單</h1><p>所有訂單資料係 fixture；只展示 Customer workflow shape。</p></header>
    <div className="segmented"><button className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button><button className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>歷史</button></div>
    {segment==='current'?<CurrentOrder stage={stage} setStage={setStage} onAction={onAction}/>:<HistoryView onReorder={onReorder}/>}
  </section>;
}

function CurrentOrder({stage,setStage,onAction}:{stage:OrderStage;setStage:(v:OrderStage)=>void;onAction:(label:string)=>void}){
  const meta=stageMeta[stage];
  const stages=Object.keys(stageMeta) as OrderStage[];
  return <>
    <section className="fixture-warning">Migration fixture · Customer-facing status 只投影可證明狀態；唔代表 Checkout 產生咗正式訂單。</section>
    <article className="order-status-card">
      <div className="order-id"><span>{activeOrderFixture.orderRef}</span><b>{meta.label}</b></div>
      <h2>{meta.title}</h2><p>{meta.detail}</p>
      <div className="timeline">{stages.map(item=><button key={item} className={item===stage?'active':''} onClick={()=>setStage(item)}><i/>{stageMeta[item].label}</button>)}</div>
      <small>按鈕只切換本機展示 fixture。Created / Accepted / Preparing / Ready / Handover / Completed 保持分開。</small>
    </article>

    {stage==='DELAYED'?<article className="delay-card"><b>Updated ETA</b><strong>展示：21:00</strong><p>Delay 只更新承諾時間；唔會將狀態跳去 Ready。</p></article>:null}
    {stage==='REJECTED'?<article className="repair-card"><b>未能接單</b><p>示意原因：TOO_BUSY。Future live flow 要提供重新選時間／商品／取消等明確修復，不可永久 Pending。</p></article>:null}

    <article className="pickup-card">
      <span>Pickup Code Presentation</span><strong>{activeOrderFixture.pickupCode}</strong><small>電話：{activeOrderFixture.phoneMasked} · 全部係 fixture</small>
      {stage==='PICKUP'?<>
        <div className="pickup-boundary"><span>ARRIVED</span><span>VERIFIED</span><span>HANDED_OVER</span><span>COMPLETED</span></div>
        <p>Ready ≠ Arrived ≠ Verified ≠ Handed Over ≠ Completed。低風險餐飲用短碼／號碼 shape，保留 fallback。</p>
        <button onClick={()=>onAction('取餐核對／實體交收')}>取餐核對／交收（NOT_WIRED）</button>
      </>:null}
    </article>

    <article className="order-detail-card">
      <header><div><span>Order Detail</span><strong>訂單詳情</strong></div><em>{activeOrderFixture.amountLabel}</em></header>
      <ul>{activeOrderFixture.items.map(item=><li key={item}>{item}</li>)}</ul>
      <div className="detail-row"><span>Promised ready</span><b>{stage==='DELAYED'?'展示：21:00（updated）':activeOrderFixture.promised}</b></div>
      <div className="detail-row"><span>資料 freshness</span><b>DEMO / fixture</b></div>
    </article>
  </>;
}
function HistoryView({onReorder}:{onReorder:(summary:string)=>void}){
  return <div className="history-list">{historyFixtures.map(order=><article key={order.id}><div><small>{order.date}</small><strong>{order.code}</strong><p>{order.summary}</p><em>{order.amountLabel}</em></div><button onClick={()=>onReorder(order.summary)}>再次下單預覽</button></article>)}</div>;
}

function MoreView({network,setNetwork,unavailable,setUnavailable,registryOpen,setRegistryOpen,onAction}:{network:NetworkMode;setNetwork:(v:NetworkMode)=>void;unavailable:boolean;setUnavailable:(v:boolean)=>void;registryOpen:boolean;setRegistryOpen:(v:boolean)=>void;onAction:(label:string)=>void}){
  return <section className="page more-page">
    <header className="page-title"><span>Migration Controls</span><h1>狀態與能力帳</h1><p>以下開關只切換本機 presentation fixture。</p></header>
    <section className="demo-panel">
      <h2>Failure / Offline / UNKNOWN / STALE</h2>
      <div className="mode-grid">{(['ONLINE','OFFLINE','FAILURE','STALE'] as NetworkMode[]).map(mode=><button key={mode} className={network===mode?'active':''} onClick={()=>setNetwork(mode)}>{mode}</button>)}</div>
      <button className="secondary wide" onClick={()=>onAction('Retry Presentation')}>Retry Presentation（NOT_WIRED）</button>
      <p>無 offline queue、無 background replay、無 delayed auto-submit。</p>
    </section>

    <section className="demo-panel">
      <h2>Own-channel unavailable</h2>
      <p>用嚟驗 Home fallback Presentation；唔會改任何真實渠道。</p>
      <button className="secondary wide" onClick={()=>setUnavailable(!unavailable)}>{unavailable?'展示：恢復可用':'展示：渠道不可用'}</button>
    </section>

    <section className="cap-summary">
      <div><span>Customer capabilities</span><strong>{capabilities.length}</strong></div>
      <div><span>COMMAND_SHAPE</span><strong>{commandCapabilities.length}</strong></div>
      <div><span>Command status</span><strong>NOT_WIRED</strong></div>
    </section>
    <button className="primary wide" onClick={()=>setRegistryOpen(!registryOpen)}>{registryOpen?'收起 Capability Registry':'查看 Capability Registry'}</button>
    {registryOpen?<CapabilityRegistry/>:null}
  </section>;
}

function CapabilityRegistry(){
  const groups=[...new Set(capabilities.map(item=>item.group))];
  return <section className="registry">{groups.map(group=><div key={group}><h3>{group}</h3>{capabilities.filter(item=>item.group===group).map(item=><article key={item.id}><div><strong>{item.label}</strong><small>{item.id}</small></div><div><span>{item.kind}</span><em className={item.status==='NOT_WIRED'?'red':''}>{item.status}</em></div></article>)}</div>)}</section>;
}

function ProductSheet({product,values,setValue,onClose,onAdd}:{product:Product;values:Record<string,string[]>;setValue:(group:string,value:string,max:number)=>void;onClose:()=>void;onAdd:()=>void}){
  const groups=[...(product.choiceGroups??[]),...(product.comboGroups??[])];
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true">
    <div className="sheet-grabber"/>
    <header><div><span>Product Detail / Product Config</span><h2>{product.name}</h2><p>{product.description}</p><small>{product.priceLabel}</small></div><button onClick={onClose}>✕</button></header>
    {groups.length?groups.map(group=>{
      const min=group.min??(group.required?1:0);
      const max=group.max??1;
      const selectedValues=values[group.label]??[];
      const valid=selectedValues.length>=min&&selectedValues.length<=max;
      return <section className="choice-group" key={group.label}>
        <div><strong>{group.label}</strong><span>{min===max&&max===1?'揀 1 項':`最少 ${min} · 最多 ${max}`}</span></div>
        <div className="choice-grid">{group.options.map(option=><button key={option} className={selectedValues.includes(option)?'active':''} onClick={()=>setValue(group.label,option,max)}>{option}</button>)}</div>
        <small>{product.comboGroups?.includes(group)?'Combo Selection Shape':'Modifier / Option Selection Shape'} · {valid?'目前選擇有效':'需要完成選擇'} · session-only</small>
      </section>;
    }):<p className="plain-note">呢件商品冇額外設定。</p>}
    <div className="sheet-actions"><button onClick={onClose}>返回</button><button className="primary" onClick={onAdd}>加入購物籃預覽</button></div>
  </section></div>;
}
function Nav({active,icon,label,badge,onClick}:{active:boolean;icon:string;label:string;badge?:string;onClick:()=>void}){
  return <button className={active?'active':''} onClick={onClick}><span>{icon}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>;
}
