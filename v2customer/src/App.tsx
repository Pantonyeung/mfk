import {useEffect,useMemo,useState} from 'react';
import {createCustomerPendingIntent,readCustomerLocalWorkspace,writeCustomerLocalWorkspace,type CustomerLocalPreferences} from './persistence';
import {resolveCustomerRuntimePort} from './runtime';
import {selectedCustomerOptions,toggleCustomerSelection,validateCustomerSelections,type CustomerSelectionState} from './selection';
import type {
  CustomerCartLine,
  CustomerCheckoutDraft,
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerPendingIntent,
  CustomerProduct,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
  CustomerRuntimePort,
} from './product-types';

type View='home'|'menu'|'cart'|'checkout'|'orders'|'more';
type OrderSegment='current'|'history';

const nowIso=()=>new Date().toISOString();
const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);

const stageMeta:Record<CustomerOrderStage,{label:string;title:string;detail:string}>={
  RECEIVED:{label:'等待店舖接單',title:'店舖已收到訂單',detail:'收到訂單唔等於已接單；要等店舖正式確認。'},
  REJECTED:{label:'未能接單',title:'店舖未能承諾',detail:'請按原因修正後重新建立新意圖；唔會自動重送。'},
  ACCEPTED:{label:'已接單',title:'店舖已確認',detail:'店舖已正式接單，之後會更新製作狀態。'},
  PREPARING:{label:'製作中',title:'餐點製作中',detail:'店舖正在製作，未到可取餐階段。'},
  DELAYED:{label:'稍有延誤',title:'取餐時間有更新',detail:'延誤只更新預計時間，唔會假裝已可取餐。'},
  READY:{label:'可取餐',title:'餐點已準備好',detail:'Ready 只代表可以到店取餐，未代表已核對或已交收。'},
  PICKUP_VERIFICATION:{label:'取餐核對',title:'請出示取餐資料',detail:'到店、核對、交收、完成係分開階段。'},
  HANDED_OVER:{label:'已交收',title:'餐點已交畀你',detail:'交收完成後會再同步最終訂單狀態。'},
  COMPLETED:{label:'已完成',title:'訂單已完成',detail:'呢張訂單已完成。'},
};

export function App(){
  const initial=useMemo(()=>readCustomerLocalWorkspace(),[]);
  const [view,setView]=useState<View>(initial.preferences.activeView);
  const [activeCategoryId,setActiveCategoryId]=useState<string|null>(initial.preferences.activeCategoryId);
  const [cart,setCart]=useState<readonly CustomerCartLine[]>(initial.cart);
  const [checkout,setCheckout]=useState<CustomerCheckoutDraft>(initial.checkout);
  const [pendingIntents,setPendingIntents]=useState<readonly CustomerPendingIntent[]>(initial.pendingIntents);
  const [port]=useState<CustomerRuntimePort|null>(()=>resolveCustomerRuntimePort());
  const [connection,setConnection]=useState<CustomerConnectionState>(port?'LOADING':'NOT_CONNECTED');
  const [snapshot,setSnapshot]=useState<CustomerReadModelSnapshot|null>(null);
  const [quote,setQuote]=useState<CustomerQuoteSnapshot|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [selectedProduct,setSelectedProduct]=useState<CustomerProduct|null>(null);
  const [selections,setSelections]=useState<CustomerSelectionState>({});
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('current');
  const [expandedOrderId,setExpandedOrderId]=useState<string|null>(null);

  const persist=(next:{cart?:readonly CustomerCartLine[];checkout?:CustomerCheckoutDraft;pendingIntents?:readonly CustomerPendingIntent[];preferences?:CustomerLocalPreferences})=>{
    writeCustomerLocalWorkspace({
      cart:next.cart??cart,
      checkout:next.checkout??checkout,
      pendingIntents:next.pendingIntents??pendingIntents,
      preferences:next.preferences??{activeView:view,activeCategoryId},
    });
  };

  const changeView=(next:View)=>{
    setView(next);
    persist({preferences:{activeView:next,activeCategoryId}});
  };

  const changeCategory=(next:string|null)=>{
    setActiveCategoryId(next);
    persist({preferences:{activeView:view,activeCategoryId:next}});
  };

  const changeCheckout=(next:CustomerCheckoutDraft)=>{
    setCheckout(next);
    persist({checkout:next});
  };

  const refresh=async()=>{
    if(!port){
      setConnection('NOT_CONNECTED');
      setSnapshot(null);
      return;
    }
    setConnection('LOADING');
    setError(null);
    try{
      const next=await port.readSnapshot();
      setSnapshot(next);
      setConnection('READY');
    }catch(reason){
      setConnection('ERROR');
      setError(reason instanceof Error?reason.message:'暫時未能同步門店資料');
    }
  };

  useEffect(()=>{void refresh();},[]);

  useEffect(()=>{
    if(!port?.quoteCart||cart.length===0){
      setQuote(null);
      return;
    }
    let cancelled=false;
    void port.quoteCart(cart).then(result=>{
      if(!cancelled)setQuote(result);
    }).catch(()=>{
      if(!cancelled)setQuote(null);
    });
    return()=>{cancelled=true};
  },[port,cart]);

  const menu=snapshot?.menu;
  const categories=menu?.categories??[];
  const effectiveCategoryId=activeCategoryId&&categories.some(item=>item.categoryId===activeCategoryId)?activeCategoryId:(categories[0]?.categoryId??null);
  const visibleProducts=(menu?.products??[]).filter(product=>{
    const categoryOk=!effectiveCategoryId||product.categoryId===effectiveCategoryId;
    const query=search.trim().toLowerCase();
    const searchOk=!query||[product.name,product.description,product.badge??''].join(' ').toLowerCase().includes(query);
    return categoryOk&&searchOk;
  });

  const updateCart=(next:readonly CustomerCartLine[])=>{
    setCart(next);
    persist({cart:next});
  };

  const addSelectedProduct=()=>{
    if(!selectedProduct)return;
    const validation=validateCustomerSelections(selectedProduct,selections);
    if(!validation.ok){setNotice(validation.issues[0]??'請完成商品設定');return}
    if(selectedProduct.variationRequired&&!selectedVariationId){setNotice('請先揀必選規格');return}
    const variation=selectedProduct.variations?.find(item=>item.variationId===selectedVariationId);
    const line:CustomerCartLine=Object.freeze({
      lineId:crypto.randomUUID(),
      productId:selectedProduct.productId,
      productName:selectedProduct.name,
      quantity:1,
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:{}),
      selections:selectedCustomerOptions(selectedProduct,selections),
      createdAt:nowIso(),
    });
    updateCart([...cart,line]);
    setSelectedProduct(null);
    setSelections({});
    setSelectedVariationId(null);
    setNotice('已加入購物籃草稿；未建立正式訂單。');
  };

  const saveIntent=(intent:CustomerPendingIntent)=>{
    const next=[intent,...pendingIntents.filter(item=>item.submissionId!==intent.submissionId)].slice(0,12);
    setPendingIntents(next);
    persist({pendingIntents:next});
  };

  const removeIntent=(submissionId:string)=>{
    const next=pendingIntents.filter(item=>item.submissionId!==submissionId);
    setPendingIntents(next);
    persist({pendingIntents:next});
  };

  const resolveConfirmedIntent=(intent:CustomerPendingIntent,message:string)=>{
    const nextPending=pendingIntents.filter(item=>item.submissionId!==intent.submissionId);
    setPendingIntents(nextPending);
    setCart([]);
    persist({cart:[],pendingIntents:nextPending});
    setNotice(message);
    setOrderSegment('current');
    changeView('orders');
    void refresh();
  };

  const submit=async()=>{
    if(cart.length===0){setNotice('購物籃未有商品。');return}
    if(checkout.phone.replace(/\D/g,'').length<8){setNotice('請輸入至少 8 位電話號碼。');return}
    const existing=pendingIntents.find(item=>item.state==='DRAFT'||item.state==='NOT_CONNECTED'||item.state==='UNKNOWN');
    const base=existing??createCustomerPendingIntent(cart,checkout);
    if(!port?.submitOrder){
      saveIntent(Object.freeze({...base,state:'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:'店舖提交服務尚未連接；草稿已保存。'}));
      setNotice('已保存待提交草稿；未建立正式訂單。');
      return;
    }
    const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'等待店舖確認提交結果'});
    saveIntent(pending);
    try{
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED'){resolveConfirmedIntent(pending,result.message||'店舖已確認訂單');return}
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...pending,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.state==='UNKNOWN'?'提交結果未明；會先查詢同一提交身份，唔會自動重送。':result.message);
    }catch{
      saveIntent(Object.freeze({...pending,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'提交結果未明'}));
      setNotice('提交結果未明；已保留同一提交身份，請先重新確認。');
    }
  };

  const readbackIntent=async(intent:CustomerPendingIntent)=>{
    if(!port?.readSubmission){
      saveIntent(Object.freeze({...intent,state:'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:'訂單查詢服務尚未連接'}));
      setNotice('訂單查詢服務尚未連接；冇重新提交任何交易。');
      return;
    }
    try{
      const result=await port.readSubmission(intent.submissionId);
      if(result.state==='CONFIRMED'){resolveConfirmedIntent(intent,result.message||'店舖已確認訂單');return}
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...intent,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.message);
    }catch{
      saveIntent(Object.freeze({...intent,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'讀回結果未明'}));
      setNotice('讀回結果未明；未有重新提交。');
    }
  };

  const reorder=async(order:CustomerHistoryProjection)=>{
    if(!port?.buildReorderCart){setNotice('再次下單服務尚未連接；冇複製舊價格或者舊供應狀態。');return}
    try{
      const result=await port.buildReorderCart(order.orderId);
      if(result.state!=='CONFIRMED'||!result.cart){setNotice(result.message);return}
      updateCart(result.cart);
      setNotice(result.attention?.length?'已重建購物籃；需要修正：'+result.attention.join('、'):'已按目前商品狀態重建購物籃。');
      changeView('cart');
    }catch{
      setNotice('暫時未能重新驗證舊訂單；冇建立新訂單。');
    }
  };

  const requestFallback=async()=>{
    if(!port?.requestFallback){setNotice('備用聯絡入口尚未連接；系統唔會自行轉送你嘅訂單資料。');return}
    try{setNotice((await port.requestFallback()).message)}catch{setNotice('暫時未能開啟備用聯絡入口。')}
  };

  const activeOrders=snapshot?.activeOrders??[];
  const history=snapshot?.history??[];
  const currentPending=pendingIntents[0]??null;
  const cartCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  const connectionLabel=connection==='READY'?'已連接':connection==='LOADING'?'同步中':connection==='ERROR'?'同步失敗':'未連接';

  return <main className="customer-shell" data-network={connection==='READY'?'online':'offline'}>
    <header className="topbar">
      <button className="brand" onClick={()=>changeView('home')} aria-label="返回首頁"><b>磨</b><span><strong>磨飯</strong><small>{snapshot?.store?.storeName??'自家落單'}</small></span></button>
      <button className="network-chip" onClick={()=>void refresh()} aria-label="重新同步"><i/>{connectionLabel}</button>
    </header>
    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    {error?<section className="recovery-banner failure"><div><strong>暫時未能同步店舖資料</strong><span>{error}</span></div><button onClick={()=>void refresh()}>再試一次</button></section>:null}
    {connection==='NOT_CONNECTED'?<section className="recovery-banner offline"><div><strong>店舖服務尚未連接</strong><span>購物籃、聯絡資料同待提交草稿會保留喺本機；正式菜單、價格、訂單同取餐狀態唔會用假資料代替。</span></div></section>:null}

    <section className="viewport">
      {view==='home'?<HomeView snapshot={snapshot} connection={connection} activeOrders={activeOrders} history={history} onBrowse={()=>changeView('menu')} onOrders={()=>{setOrderSegment('current');changeView('orders')}} onHistory={()=>{setOrderSegment('history');changeView('orders')}} onBuyAgain={order=>void reorder(order)} onFallback={()=>void requestFallback()}/>:null}
      {view==='menu'?<MenuView connection={connection} categories={categories} activeCategoryId={effectiveCategoryId} setCategory={changeCategory} query={search} setQuery={setSearch} products={visibleProducts} onProduct={product=>{setSelectedProduct(product);setSelections({});setSelectedVariationId(null)}} cartCount={cartCount} quote={quote} onCart={()=>changeView('cart')}/>:null}
      {view==='cart'?<CartView cart={cart} quote={quote} onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))} onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))} onMenu={()=>changeView('menu')} onCheckout={()=>changeView('checkout')}/>:null}
      {view==='checkout'?<CheckoutView cart={cart} quote={quote} checkout={checkout} setCheckout={changeCheckout} pending={currentPending} onSubmit={()=>void submit()} onReadback={intent=>void readbackIntent(intent)} onBack={()=>changeView('cart')}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} active={activeOrders} history={history} expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId} onReorder={order=>void reorder(order)} connection={connection}/>:null}
      {view==='more'?<MoreView connection={connection} snapshot={snapshot} pendingIntents={pendingIntents} onReadback={intent=>void readbackIntent(intent)} onDiscard={removeIntent} onFallback={()=>void requestFallback()}/>:null}
    </section>

    {view!=='checkout'?<nav className="bottom-nav" aria-label="主要導覽">
      <Nav active={view==='home'} icon="⌂" label="首頁" onClick={()=>changeView('home')}/>
      <Nav active={view==='menu'} icon="▦" label="菜單" onClick={()=>changeView('menu')}/>
      <Nav active={view==='cart'} icon="□" label="購物籃" badge={cartCount?String(cartCount):undefined} onClick={()=>changeView('cart')}/>
      <Nav active={view==='orders'} icon="◎" label="訂單" badge={activeOrders.length?String(activeOrders.length):undefined} onClick={()=>changeView('orders')}/>
      <Nav active={view==='more'} icon="•••" label="更多" badge={pendingIntents.length?String(pendingIntents.length):undefined} onClick={()=>changeView('more')}/>
    </nav>:null}

    {selectedProduct?<ProductSheet product={selectedProduct} selections={selections} selectedVariationId={selectedVariationId} setVariation={setSelectedVariationId} toggle={(groupId,optionId)=>{
      const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
      if(group)setSelections(current=>toggleCustomerSelection(current,group,optionId));
    }} onClose={()=>setSelectedProduct(null)} onAdd={addSelectedProduct}/>:null}
  </main>;
}

function HomeView({snapshot,connection,activeOrders,history,onBrowse,onOrders,onHistory,onBuyAgain,onFallback}:{
  snapshot:CustomerReadModelSnapshot|null;connection:CustomerConnectionState;activeOrders:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];onBrowse:()=>void;onOrders:()=>void;onHistory:()=>void;onBuyAgain:(order:CustomerHistoryProjection)=>void;onFallback:()=>void;
}){
  const store=snapshot?.store;
  const lastOrder=history[0];
  return <section className="page">
    <section className="store-card"><span className="eyebrow">自家落單</span><h1>{store?.storeName??'磨飯'}</h1><p>{store?store.channelAvailable?'接受自家落單':'自家落單暫停':'店舖資料尚未連接'}</p>{store?.etaLabel?<small>預計取餐：{store.etaLabel}</small>:null}</section>
    {store&&!store.channelAvailable?<section className="unavailable-card"><b>自家渠道暫時不可用</b><p>{store.notice??'可以稍後再試，或者使用店舖提供嘅備用聯絡方式。'}</p><button onClick={onFallback}>查看備用聯絡方法</button></section>:
    <section className="hero-card"><span>快速自取</span><h2>揀好餐點，等店舖確認</h2><p>正式價格、接單結果同取餐狀態都由店舖讀回；未確認之前唔會當成成功。</p><button className="primary" onClick={onBrowse} disabled={connection!=='READY'}>{connection==='READY'?'開始點餐':'等待店舖連接'}</button></section>}
    {activeOrders[0]?<button className="current-order-card" onClick={onOrders}><div><span>進行中</span><strong>{activeOrders[0].displayCode}</strong><small>{stageMeta[activeOrders[0].stage].label+(activeOrders[0].etaLabel?' · '+activeOrders[0].etaLabel:'')}</small></div><em>查看</em></button>:null}
    <div className="quick-grid"><button onClick={onBrowse}><b>菜單</b><span>瀏覽商品</span></button><button onClick={onOrders}><b>訂單</b><span>查看進度</span></button><button onClick={onHistory}><b>歷史</b><span>過往訂單</span></button></div>
    {lastOrder?<section className="demo-panel"><h2>再來一單</h2><p>{lastOrder.itemSummary}</p><button className="secondary wide" disabled={!lastOrder.reorderEligible} onClick={()=>onBuyAgain(lastOrder)}>按目前菜單重新驗證</button></section>:null}
  </section>;
}

function MenuView({connection,categories,activeCategoryId,setCategory,query,setQuery,products,onProduct,cartCount,quote,onCart}:{
  connection:CustomerConnectionState;categories:readonly {categoryId:string;name:string}[];activeCategoryId:string|null;setCategory:(id:string|null)=>void;query:string;setQuery:(v:string)=>void;products:readonly CustomerProduct[];onProduct:(p:CustomerProduct)=>void;cartCount:number;quote:CustomerQuoteSnapshot|null;onCart:()=>void;
}){
  return <section className="page">
    <header className="page-title"><span>菜單</span><h1>今日想食咩？</h1><p>售價同供應狀態只顯示店舖正式讀回。</p></header>
    <label className="menu-search"><span>搜尋</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋商品"/></label>
    {categories.length?<div className="category-rail">{categories.map(category=><button key={category.categoryId} className={activeCategoryId===category.categoryId?'active':''} onClick={()=>setCategory(category.categoryId)}>{category.name}</button>)}</div>:null}
    {connection==='LOADING'?<Empty title="正在同步菜單" detail="請稍候。"/>:
      !categories.length?<Empty title={connection==='NOT_CONNECTED'?'菜單服務尚未連接':'暫時未有菜單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式商品、規格、價格同供應狀態。':'店舖目前未提供可售商品。'}/>:
      products.length?<div className="product-list">{products.map(product=><button className={'product-card '+(product.available?'':'unavailable')} disabled={!product.available} key={product.productId} onClick={()=>onProduct(product)}><span className="product-visual">{product.name.slice(0,1)}</span><div>{product.badge?<small>{product.badge}</small>:null}<strong>{product.name}</strong><p>{product.description}</p></div><em>{product.displayPriceLabel??'價格待讀取'}</em></button>)}</div>:
      <Empty title="搵唔到符合條件嘅商品" detail="試下清除搜尋或者切換其他分類。"><button className="secondary" onClick={()=>setQuery('')}>清除搜尋</button></Empty>}
    {cartCount>0?<button className="floating-cart" onClick={onCart}><b>{cartCount}</b><span>{quote?money(quote.currency,quote.totalMinor):'購物籃'}</span><em>{quote?'報價 '+quote.freshness:'等待店舖報價'}</em></button>:null}
  </section>;
}

function CartView({cart,quote,onQuantity,onRemove,onMenu,onCheckout}:{cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;onQuantity:(id:string,q:number)=>void;onRemove:(id:string)=>void;onMenu:()=>void;onCheckout:()=>void;}){
  return <section className="page">
    <header className="page-title"><span>購物籃</span><h1>確認餐點</h1><p>可以修改數量或者移除有問題嘅項目。</p></header>
    {!cart.length?<Empty title="購物籃係空嘅" detail="去菜單揀啲餐點先。"><button className="primary" onClick={onMenu}>瀏覽菜單</button></Empty>:
    <>
      <div className="cart-lines">{cart.map(line=><article key={line.lineId}><div><strong>{line.productName}</strong><small>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join(' · ')||'無額外設定'}</small>{line.attention?<p className="line-attention">{line.attention}</p>:null}</div><div className="cart-line-actions"><div className="qty-stepper"><button onClick={()=>onQuantity(line.lineId,line.quantity-1)}>−</button><b>{line.quantity}</b><button onClick={()=>onQuantity(line.lineId,line.quantity+1)}>＋</button></div><button onClick={()=>onRemove(line.lineId)}>移除</button></div></article>)}</div>
      <section className="quote-card"><span>店舖報價</span><strong>{quote?money(quote.currency,quote.totalMinor):'等待正式報價'}</strong><p>{quote?'版本 '+quote.revision+' · '+quote.freshness:'本機唔會自行估算價格。'}</p></section>
      {quote?.freshness==='MATERIAL_CHANGE'?<section className="repair-card"><b>價格或供應狀態有重要變更</b><p>請先返回菜單修正受影響項目，再繼續結帳。</p></section>:null}
      <button className="primary wide" onClick={onCheckout}>前往結帳</button>
    </>}
  </section>;
}

function CheckoutView({cart,quote,checkout,setCheckout,pending,onSubmit,onReadback,onBack}:{
  cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;checkout:CustomerCheckoutDraft;setCheckout:(v:CustomerCheckoutDraft)=>void;pending:CustomerPendingIntent|null;onSubmit:()=>void;onReadback:(intent:CustomerPendingIntent)=>void;onBack:()=>void;
}){
  const unknown=pending?.state==='UNKNOWN';
  return <section className="page">
    <button className="back-link" onClick={onBack}>← 返回購物籃</button>
    <header className="page-title"><span>結帳</span><h1>最後確認</h1><p>提交只代表送出落單意圖；收到店舖確認先算成立。</p></header>
    <div className="checkout-review"><div><span>商品</span><strong>{cart.reduce((sum,line)=>sum+line.quantity,0)} 件</strong></div><div><span>正式報價</span><strong>{quote?money(quote.currency,quote.totalMinor):'尚未取得'}</strong></div><div><span>報價狀態</span><strong>{quote?.freshness??'UNKNOWN'}</strong></div></div>
    <div className="checkout-form"><label>稱呼<input value={checkout.name} onChange={e=>setCheckout({...checkout,name:e.target.value})} autoComplete="name" placeholder="可選"/></label><label>電話<input value={checkout.phone} onChange={e=>setCheckout({...checkout,phone:e.target.value})} inputMode="tel" autoComplete="tel" placeholder="用作取餐核對"/></label></div>
    <section className="safe-submit"><span>安全提交</span><strong>{quote?'準備送出落單意圖':'等待店舖報價'}</strong><p>同一提交會保留固定 Submission ID；Timeout / UNKNOWN 會先查詢讀回，唔會盲目重送。</p>{unknown&&pending?<button className="primary wide" onClick={()=>onReadback(pending)}>重新確認提交結果</button>:<button className="primary wide" disabled={!cart.length||!quote||quote.freshness==='MATERIAL_CHANGE'} onClick={onSubmit}>{quote?'提交落單意圖':'等待正式報價'}</button>}</section>
    {pending?<section className="pending-card"><b>{pending.state}</b><h2>{pending.state==='UNKNOWN'?'提交結果未明':pending.state==='NOT_CONNECTED'?'尚未連接店舖':'待店舖確認'}</h2><p>{pending.lastMessage??'本機已保存提交意圖。'}</p><div><span>Submission ID</span><strong>{pending.submissionId}</strong></div></section>:null}
  </section>;
}

function OrdersView({segment,setSegment,active,history,expandedOrderId,setExpandedOrderId,onReorder,connection}:{
  segment:OrderSegment;setSegment:(v:OrderSegment)=>void;active:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];expandedOrderId:string|null;setExpandedOrderId:(v:string|null)=>void;onReorder:(order:CustomerHistoryProjection)=>void;connection:CustomerConnectionState;
}){
  return <section className="page">
    <header className="page-title"><span>訂單</span><h1>訂單進度</h1><p>Ready、到店、核對、交收、完成會分開顯示。</p></header>
    <div className="segmented"><button className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button><button className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>歷史</button></div>
    {segment==='current'?(!active.length?<Empty title={connection==='NOT_CONNECTED'?'訂單服務尚未連接':'暫時冇進行中訂單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示店舖正式接單同製作進度。':'完成嘅訂單可以喺歷史查看。'}/>:<div>{active.map(order=><OrderCard key={order.orderId} order={order} expanded={expandedOrderId===order.orderId} onToggle={()=>setExpandedOrderId(expandedOrderId===order.orderId?null:order.orderId)}/>)}</div>):
    (!history.length?<Empty title={connection==='NOT_CONNECTED'?'訂單歷史尚未連接':'暫時冇歷史訂單'} detail="完成訂單後會顯示喺呢度。"/>:<div className="history-list">{history.map(order=><article key={order.orderId}><div><small>{new Date(order.completedAt).toLocaleDateString('zh-HK')}</small><strong>{order.displayCode}</strong><p>{order.itemSummary}</p><em>{order.amountLabel??''}</em></div><button disabled={!order.reorderEligible} onClick={()=>onReorder(order)}>再次下單</button></article>)}</div>)}
  </section>;
}

function OrderCard({order,expanded,onToggle}:{order:CustomerOrderProjection;expanded:boolean;onToggle:()=>void}){
  const meta=stageMeta[order.stage];
  return <article className="order-status-card"><div className="order-id"><span>{order.displayCode}</span><b>{order.readback==='CONFIRMED'?'已確認':order.readback==='PARTIAL'?'部分資料':'結果未明'}</b></div><h2>{meta.title}</h2><p>{order.rejectionReason??meta.detail}</p>{order.etaLabel?<small>預計：{order.etaLabel}</small>:null}
    {order.stage==='DELAYED'?<section className="delay-card"><b>稍有延誤</b><strong>{order.etaLabel??'時間待更新'}</strong><p>店舖仍然製作中，未到 Ready 階段。</p></section>:null}
    {order.stage==='READY'||order.stage==='PICKUP_VERIFICATION'?<section className="pickup-card"><span>取餐碼</span><strong>{order.pickupCode??'—'}</strong><small>{order.phoneMasked??'電話核對資料未提供'}</small><div className="pickup-boundary"><span>Ready</span><span>Arrived</span><span>Verified</span><span>Handed Over</span></div><p>可取餐 ≠ 已到店 ≠ 已核對 ≠ 已交收 ≠ 已完成。</p></section>:null}
    <button className="secondary wide" onClick={onToggle}>{expanded?'收起詳情':'查看詳情'}</button>
    {expanded?<section className="order-detail-card"><header><div><span>訂單內容</span><strong>{order.itemSummary}</strong></div>{order.amountLabel?<em>{order.amountLabel}</em>:null}</header><div className="timeline">{order.timeline.map((item,index)=><button key={index} className={item.stage===order.stage?'active':''}><i/><span>{item.label}</span><small>{new Date(item.at).toLocaleTimeString('zh-HK')}</small></button>)}</div><div className="detail-row"><span>交收狀態</span><strong>{order.handoverState??'UNKNOWN'}</strong></div></section>:null}
  </article>;
}

function MoreView({connection,snapshot,pendingIntents,onReadback,onDiscard,onFallback}:{
  connection:CustomerConnectionState;snapshot:CustomerReadModelSnapshot|null;pendingIntents:readonly CustomerPendingIntent[];onReadback:(intent:CustomerPendingIntent)=>void;onDiscard:(id:string)=>void;onFallback:()=>void;
}){
  return <section className="page">
    <header className="page-title"><span>更多</span><h1>落單狀態</h1><p>呢度只顯示連線、草稿同安全恢復資料。</p></header>
    <section className="demo-panel"><h2>店舖連線</h2><p>{connection==='READY'?'已連接店舖資料服務。':connection==='LOADING'?'正在同步。':connection==='ERROR'?'同步失敗。':'尚未連接店舖服務。'}</p><small>{snapshot?.observedAt?'最後讀取：'+new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有正式讀回'}</small></section>
    <section className="demo-panel"><h2>待提交草稿</h2>{pendingIntents.length?pendingIntents.map(intent=><div className="pending-card" key={intent.submissionId}><b>{intent.state}</b><p>{intent.lastMessage??'本機草稿'}</p><div><span>Submission ID</span><strong>{intent.submissionId}</strong></div><div className="pending-actions"><button onClick={()=>onDiscard(intent.submissionId)}>刪除草稿</button><button onClick={()=>onReadback(intent)}>重新確認</button></div></div>):<p>冇待提交草稿。</p>}</section>
    <section className="unavailable-card"><b>自家渠道不可用時</b><p>備用聯絡只會喺你主動操作時開啟，唔會自動轉送購物籃或者個人資料。</p><button onClick={onFallback}>查看備用聯絡方法</button></section>
  </section>;
}

function ProductSheet({product,selections,selectedVariationId,setVariation,toggle,onClose,onAdd}:{
  product:CustomerProduct;selections:CustomerSelectionState;selectedVariationId:string|null;setVariation:(id:string)=>void;toggle:(groupId:string,optionId:string)=>void;onClose:()=>void;onAdd:()=>void;
}){
  const validation=validateCustomerSelections(product,selections);
  const variationOk=!product.variationRequired||Boolean(selectedVariationId);
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><div className="sheet-grabber"/><header><div><span>商品詳情</span><h2>{product.name}</h2><p>{product.description}</p><small>{product.displayPriceLabel??'價格待讀取'}</small></div><button onClick={onClose}>✕</button></header>
    {product.variations?.length?<section className="choice-group"><div><strong>規格</strong><span>{product.variationRequired?'必選':'可選'}</span></div><div className="choice-grid">{product.variations.map(item=><button key={item.variationId} disabled={!item.available} className={selectedVariationId===item.variationId?'active':''} onClick={()=>setVariation(item.variationId)}>{item.name}</button>)}</div></section>:null}
    {product.optionGroups.map(group=><section className="choice-group" key={group.optionGroupId}><div><strong>{group.name}</strong><span>最少 {Math.max(group.required?1:0,group.minSelections)} · 最多 {group.maxSelections}</span></div><div className="choice-grid">{group.options.map(option=><button key={option.optionId} disabled={!option.available} className={(selections[group.optionGroupId]??[]).includes(option.optionId)?'active':''} onClick={()=>toggle(group.optionGroupId,option.optionId)}>{option.name}</button>)}</div></section>)}
    {!validation.ok?<p className="plain-note">{validation.issues[0]}</p>:null}
    <div className="sheet-actions"><button onClick={onClose}>取消</button><button className="primary" disabled={!validation.ok||!variationOk} onClick={onAdd}>加入購物籃</button></div>
  </section></div>;
}

function Empty({title,detail,children}:{title:string;detail:string;children?:React.ReactNode}){return <section className="empty-card"><strong>{title}</strong><p>{detail}</p>{children}</section>}
function Nav({active,icon,label,badge,onClick}:{active:boolean;icon:string;label:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}><span>{icon}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>}
