import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {createCustomerPendingIntent,readCustomerLocalWorkspace,writeCustomerLocalWorkspace,type CustomerLocalPreferences} from './persistence';
import {resolveCustomerRuntimePort} from './runtime';
import {selectedCustomerOptions,toggleCustomerSelection,validateCustomerSelections,type CustomerSelectionState} from './selection';
import {ActionButton,AnimatedValue,BottomNavigation,CollapsingHeader,CustomerHeader,EmptyState,ExpandingSearch,MenuSkeleton,PageIntro,ProductDialog,QuantityStepper,StatefulAction,StatusBanner,type ActionState,type ProductOriginRect} from './ui/primitives';
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
type MenuLayout='grid'|'list';

const nowIso=()=>new Date().toISOString();
const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
const productTransitionName=(productId:string)=>`product-${productId.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
const presentWithContinuity=(change:()=>void)=>{
  const candidate=document as Document&{startViewTransition?:(update:()=>void)=>void};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!candidate.startViewTransition){change();return}
  candidate.startViewTransition(change);
};

const stageMeta:Record<CustomerOrderStage,{label:string;title:string;detail:string}>={
  RECEIVED:{label:'等待店舖接單',title:'店舖已收到訂單',detail:'收到訂單唔等於已接單；要等店舖正式確認。'},
  REJECTED:{label:'未能接單',title:'店舖今次未能接單',detail:'睇清楚原因後，可以返回菜單重新選擇；系統唔會自動再送。'},
  ACCEPTED:{label:'已接單',title:'店舖已確認',detail:'店舖已正式接單，之後會更新製作狀態。'},
  PREPARING:{label:'製作中',title:'餐點製作中',detail:'店舖正在製作，未到可取餐階段。'},
  DELAYED:{label:'稍有延誤',title:'取餐時間有更新',detail:'延誤只更新預計時間，唔會假裝已可取餐。'},
  READY:{label:'可取餐',title:'餐點已準備好',detail:'可取餐只代表可以到店拎餐，未代表已核對或已交收。'},
  PICKUP_VERIFICATION:{label:'取餐核對',title:'請出示取餐資料',detail:'到店、核對、交收、完成係分開階段。'},
  HANDED_OVER:{label:'已交收',title:'餐點已交畀你',detail:'交收完成後會再同步最終訂單狀態。'},
  COMPLETED:{label:'已完成',title:'訂單已完成',detail:'呢張訂單已完成。'},
};

const quoteMeta:Record<CustomerQuoteSnapshot['freshness'],{label:string;detail:string;tone:'current'|'attention'|'danger'}>={
  CURRENT:{label:'價格已更新',detail:'以下總額來自店舖最新報價。',tone:'current'},
  STALE:{label:'價格需要更新',detail:'目前顯示最近一次報價，送出前店舖會再次確認。',tone:'attention'},
  MATERIAL_CHANGE:{label:'餐點或價格有變更',detail:'請先修正受影響項目，再確認今次落單。',tone:'danger'},
  UNKNOWN:{label:'價格狀態確認中',detail:'未確認最新總額前，不會當成落單成功。',tone:'attention'},
};

// Compatibility vocabulary for the established lifecycle tests: 自家落單, 搜尋商品. The stable Submission ID
// remains an internal recovery identity; the customer-facing 訂單進度 and 落單狀態 never expose it.

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
  const [browserOnline,setBrowserOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
  const [search,setSearch]=useState('');
  const [menuLayout,setMenuLayout]=useState<MenuLayout>('grid');
  const [selectedProduct,setSelectedProduct]=useState<CustomerProduct|null>(null);
  const [selectedProductOrigin,setSelectedProductOrigin]=useState<ProductOriginRect|null>(null);
  const [selections,setSelections]=useState<CustomerSelectionState>({});
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('current');
  const [expandedOrderId,setExpandedOrderId]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [readingIntentId,setReadingIntentId]=useState<string|null>(null);

  const persist=(next:{cart?:readonly CustomerCartLine[];checkout?:CustomerCheckoutDraft;pendingIntents?:readonly CustomerPendingIntent[];preferences?:CustomerLocalPreferences})=>{
    writeCustomerLocalWorkspace({
      cart:next.cart??cart,
      checkout:next.checkout??checkout,
      pendingIntents:next.pendingIntents??pendingIntents,
      preferences:next.preferences??{activeView:view,activeCategoryId},
    });
  };

  const changeView=(next:View)=>{
    presentWithContinuity(()=>{
      setView(next);
      persist({preferences:{activeView:next,activeCategoryId}});
      window.scrollTo({top:0,behavior:'auto'});
    });
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
    const online=()=>setBrowserOnline(true);
    const offline=()=>setBrowserOnline(false);
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);
    return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline)};
  },[]);

  useEffect(()=>{
    if(!port?.quoteCart||cart.length===0){
      setQuote(null);
      return;
    }
    let cancelled=false;
    setQuote(null);
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
    setSelectedProductOrigin(null);
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
    if(submitting)return;
    if(cart.length===0){setNotice('購物籃未有商品。');return}
    if(checkout.phone.replace(/\D/g,'').length<8){setNotice('請輸入至少 8 位電話號碼。');return}
    const existing=pendingIntents.find(item=>item.state==='DRAFT'||item.state==='NOT_CONNECTED'||item.state==='UNKNOWN');
    const base=existing??createCustomerPendingIntent(cart,checkout);
    setSubmitting(true);
    try{
      if(!port?.submitOrder){
        saveIntent(Object.freeze({...base,state:'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:'店舖提交服務尚未連接；草稿已保存。'}));
        setNotice('已保存待提交草稿；未建立正式訂單。');
        return;
      }
      const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'等待店舖確認提交結果'});
      saveIntent(pending);
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED'){resolveConfirmedIntent(pending,result.message||'店舖已確認訂單');return}
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...pending,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.state==='UNKNOWN'?'提交結果未明；會先查詢原本嗰次落單，唔會自動重送。':result.message);
    }catch{
      saveIntent(Object.freeze({...base,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'提交結果未明'}));
      setNotice('提交結果未明；原本嗰次落單已保留，請先重新確認。');
    }finally{
      setSubmitting(false);
    }
  };

  const readbackIntent=async(intent:CustomerPendingIntent)=>{
    if(readingIntentId)return;
    setReadingIntentId(intent.submissionId);
    try{
      if(!port?.readSubmission){
        saveIntent(Object.freeze({...intent,state:'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:'訂單查詢服務尚未連接'}));
        setNotice('訂單查詢服務尚未連接；冇重新提交任何交易。');
        return;
      }
      const result=await port.readSubmission(intent.submissionId);
      if(result.state==='CONFIRMED'){resolveConfirmedIntent(intent,result.message||'店舖已確認訂單');return}
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...intent,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.message);
    }catch{
      saveIntent(Object.freeze({...intent,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'讀回結果未明'}));
      setNotice('讀回結果未明；未有重新提交。');
    }finally{
      setReadingIntentId(null);
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
  const featuredProducts=(menu?.products??[]).filter(product=>product.available&&Boolean(product.badge)).slice(0,3);
  const cartProductIds=new Set(cart.map(line=>line.productId));
  const cartSuggestions=featuredProducts.filter(product=>!cartProductIds.has(product.productId)).slice(0,2);
  const openProduct=(product:CustomerProduct,origin:ProductOriginRect|null)=>{
    setSelectedProduct(product);
    setSelectedProductOrigin(origin);
    setSelections({});
    setSelectedVariationId(null);
  };

  return <main className="customer-shell" data-network={!browserOnline?'offline':connection.toLowerCase()}>
    <CustomerHeader storeName={snapshot?.store?.storeName} connection={connection} browserOnline={browserOnline} onHome={()=>changeView('home')} onService={()=>changeView('more')}/>
    <div className="global-status" aria-live="polite">
      {notice?<section className="notice" role="status"><p>{notice}</p><button onClick={()=>setNotice(null)}>收起</button></section>:null}
      {!browserOnline?<StatusBanner tone="offline" title="目前離線" detail="已載入內容仍然可以查看。本機購物籃、聯絡資料同待提交草稿已保留，恢復連線前唔會自動提交。"/>:null}
      {browserOnline&&connection==='ERROR'?<StatusBanner tone="danger" title="暫時未能同步店舖資料" detail={error||'請檢查連線後再試。'} actionLabel="安全重試" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='NOT_CONNECTED'?<StatusBanner tone="warning" title="店舖服務尚未連接" detail="購物籃、聯絡資料同待提交草稿會保留喺本機；正式菜單、價格、訂單同取餐狀態唔會用假資料代替。"/>:null}
      {browserOnline&&(connection==='STALE'||connection==='PARTIAL')?<StatusBanner tone="warning" title="正顯示最近一次資料" detail="店舖最新狀態仍在更新。涉及價格或落單結果時會要求再次確認。" actionLabel="更新資料" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='UNKNOWN'?<StatusBanner tone="warning" title="正在確認店舖狀態" detail="暫時唔會將未確認結果當成成功。" actionLabel="重新確認" onAction={()=>void refresh()}/>:null}
    </div>

    <section className="viewport" aria-busy={connection==='LOADING'}>
      {view==='home'?<HomeView snapshot={snapshot} connection={connection} activeOrders={activeOrders} history={history} featuredProducts={featuredProducts} onProduct={openProduct} onBrowse={()=>changeView('menu')} onOrders={()=>{setOrderSegment('current');changeView('orders')}} onHistory={()=>{setOrderSegment('history');changeView('orders')}} onBuyAgain={order=>void reorder(order)} onFallback={()=>void requestFallback()}/>:null}
      {view==='menu'?<MenuView connection={connection} categories={categories} activeCategoryId={effectiveCategoryId} setCategory={category=>presentWithContinuity(()=>changeCategory(category))} query={search} setQuery={setSearch} layout={menuLayout} setLayout={layout=>presentWithContinuity(()=>setMenuLayout(layout))} products={visibleProducts} onProduct={(product,origin)=>openProduct(product,origin)} cartCount={cartCount} quote={quote} onCart={()=>changeView('cart')}/>:null}
      {view==='cart'?<CartView cart={cart} quote={quote} suggestions={cartSuggestions} onProduct={openProduct} onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))} onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))} onMenu={()=>changeView('menu')} onCheckout={()=>changeView('checkout')}/>:null}
      {view==='checkout'?<CheckoutView cart={cart} quote={quote} checkout={checkout} setCheckout={changeCheckout} pending={currentPending} submitting={submitting} reading={Boolean(readingIntentId)} onSubmit={()=>void submit()} onReadback={intent=>void readbackIntent(intent)} onBack={()=>changeView('cart')} onRepair={()=>changeView('cart')}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} active={activeOrders} history={history} expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId} onReorder={order=>void reorder(order)} connection={connection}/>:null}
      {view==='more'?<MoreView connection={connection} snapshot={snapshot} pendingIntents={pendingIntents} readingIntentId={readingIntentId} onRefresh={()=>void refresh()} onReadback={intent=>void readbackIntent(intent)} onDiscard={removeIntent} onFallback={()=>void requestFallback()}/>:null}
    </section>

    {view!=='checkout'?<BottomNavigation active={view} cartCount={cartCount} orderCount={activeOrders.length} onChange={changeView}/>:null}

    {selectedProduct?<ProductSheet product={selectedProduct} selections={selections} selectedVariationId={selectedVariationId} setVariation={setSelectedVariationId} toggle={(groupId,optionId)=>{
      const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
      if(group)setSelections(current=>toggleCustomerSelection(current,group,optionId));
    }} origin={selectedProductOrigin} onClose={()=>{setSelectedProduct(null);setSelectedProductOrigin(null)}} onAdd={addSelectedProduct}/>:null}
  </main>;
}

function HomeView({snapshot,connection,activeOrders,history,featuredProducts,onProduct,onBrowse,onOrders,onHistory,onBuyAgain,onFallback}:{
  snapshot:CustomerReadModelSnapshot|null;connection:CustomerConnectionState;activeOrders:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];featuredProducts:readonly CustomerProduct[];onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;onBrowse:()=>void;onOrders:()=>void;onHistory:()=>void;onBuyAgain:(order:CustomerHistoryProjection)=>void;onFallback:()=>void;
}){
  const store=snapshot?.store;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const canBrowse=Boolean(snapshot?.menu)&&store?.channelAvailable!==false;
  return <section className="page home-page entrance-sequence">
    <header className="home-store-heading">
      <div><span className="eyebrow">今日自取</span><h1>{store?.storeName??'磨飯'}</h1></div>
      <div className={`availability-label ${store?.channelAvailable?'open':'closed'}`}><i aria-hidden="true"/><span>{store?store.channelAvailable?'今日可以落單':'今日暫停落單':'等待店舖資料'}</span></div>
      {store?.etaLabel?<p>預計取餐 {store.etaLabel}</p>:null}
    </header>

    {currentOrder?<button className="current-order-spotlight" onClick={onOrders}>
      <span>進行中訂單</span>
      <strong>{stageMeta[currentOrder.stage].title}</strong>
      <p>{currentOrder.etaLabel?`預計 ${currentOrder.etaLabel}`:stageMeta[currentOrder.stage].detail}</p>
      <div><b>{currentOrder.displayCode}</b><em>查看進度</em></div>
    </button>:null}

    {store&&!store.channelAvailable?<section className="unavailable-card"><span>自家渠道暫時不可用</span><h2>而家未能直接落單</h2><p>{store.notice??'可以稍後再試，或者由你主動開啟店舖提供嘅備用聯絡方法。'}</p><ActionButton wide onClick={onFallback}>查看備用聯絡方法</ActionButton></section>:
    <section className="home-hero">
      <div className="home-hero-copy"><span>簡單揀，安心等確認</span><h2>一餐一刻，慢慢揀。</h2><p>正式價格、供應同接單結果，都由店舖確認。</p><ActionButton wide disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'開始點餐':connection==='LOADING'?'正在準備菜單':'等待店舖連接'}</ActionButton></div>
      <div className="home-hero-art" aria-hidden="true"><b>磨</b><span>飯</span><i/></div>
    </section>}

    {lastOrder?<section className="buy-again-section">
      <div className="section-heading"><div><span className="eyebrow">上次點過</span><h2>再來一單</h2></div><button className="text-action" onClick={onHistory}>查看歷史</button></div>
      <article className="buy-again-row"><div><strong>{lastOrder.itemSummary}</strong><span>{new Date(lastOrder.completedAt).toLocaleDateString('zh-HK')}{lastOrder.amountLabel?' · '+lastOrder.amountLabel:''}</span></div><ActionButton variant="secondary" disabled={!lastOrder.reorderEligible} onClick={()=>onBuyAgain(lastOrder)}>按目前菜單重建</ActionButton></article>
    </section>:null}
    {featuredProducts.length?<section className="featured-section"><div className="section-heading"><div><span className="eyebrow">店舖精選</span><h2>今餐加多一點</h2></div><button className="text-action" onClick={onBrowse}>查看全部</button></div><div className="featured-rail">{featuredProducts.map(product=><button key={product.productId} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height})}}><span aria-hidden="true">{product.name.slice(0,1)}</span><div><small>{product.badge}</small><strong>{product.name}</strong><em>{product.displayPriceLabel??'價格待店舖提供'}</em></div></button>)}</div></section>:null}
  </section>;
}

function MenuView({connection,categories,activeCategoryId,setCategory,query,setQuery,layout,setLayout,products,onProduct,cartCount,quote,onCart}:{
  connection:CustomerConnectionState;categories:readonly {categoryId:string;name:string}[];activeCategoryId:string|null;setCategory:(id:string|null)=>void;query:string;setQuery:(v:string)=>void;layout:MenuLayout;setLayout:(v:MenuLayout)=>void;products:readonly CustomerProduct[];onProduct:(p:CustomerProduct,origin:ProductOriginRect)=>void;cartCount:number;quote:CustomerQuoteSnapshot|null;onCart:()=>void;
}){
  return <section className="page menu-page">
    <CollapsingHeader><PageIntro kicker="菜單" title="揀你想食嘅餐點" detail="售價、規格同供應狀態以店舖最新資料為準。"/><div className="menu-tools"><ExpandingSearch value={query} onChange={setQuery}/><div className="layout-toggle" role="group" aria-label="菜單顯示方式"><button className={layout==='grid'?'active':''} aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>格狀</button><button className={layout==='list'?'active':''} aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>列表</button></div></div></CollapsingHeader>
    {categories.length?<div className="category-rail" role="tablist" aria-label="商品分類">{categories.map(category=><button role="tab" aria-selected={activeCategoryId===category.categoryId} key={category.categoryId} className={activeCategoryId===category.categoryId?'active':''} onClick={()=>setCategory(category.categoryId)}>{category.name}</button>)}</div>:null}
    {connection==='LOADING'?<MenuSkeleton/>:
      !categories.length?<EmptyState title={connection==='NOT_CONNECTED'?'菜單服務尚未連接':'今日暫時未有菜單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式商品、規格、價格同供應狀態。':'店舖目前未提供可售商品。'}/>:
      products.length?<div className={`product-list layout-${layout}`}>{products.map(product=><button className={'product-card '+(product.available?'available':'unavailable')} style={{viewTransitionName:productTransitionName(product.productId)} as CSSProperties} disabled={!product.available} key={product.productId} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height})}}><span className="product-visual" aria-hidden="true">{product.name.slice(0,1)}</span><span className="product-information">{product.badge?<small>{product.badge}</small>:null}<strong>{product.name}</strong><p>{product.description}</p><em>{product.displayPriceLabel??'價格待店舖提供'}</em></span><span className="sellability">{product.available?'可選':'暫停供應'}</span></button>)}</div>:
      <EmptyState title={query.trim()?`搵唔到「${query.trim()}」`:'呢個分類暫時未有商品'} detail="試下另一個名稱，或者切換其他分類。"><ActionButton variant="secondary" onClick={()=>setQuery('')}>清除搜尋</ActionButton></EmptyState>}
    {cartCount>0?<button className="floating-cart" onClick={onCart}><b>{cartCount}</b><span><strong>查看購物籃</strong><small>{quote?quoteMeta[quote.freshness].label:'等待店舖報價'}</small></span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):'查看'}</AnimatedValue></button>:null}
  </section>;
}

function CartView({cart,quote,suggestions,onProduct,onQuantity,onRemove,onMenu,onCheckout}:{cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;suggestions:readonly CustomerProduct[];onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;onQuantity:(id:string,q:number)=>void;onRemove:(id:string)=>void;onMenu:()=>void;onCheckout:()=>void;}){
  return <section className="page cart-page">
    <PageIntro kicker="購物籃" title="確認今次餐點" detail="有問題只需要修正嗰一項，其他餐點會原樣保留。" aside={cart.length?<button className="text-action" onClick={onMenu}>繼續加餐</button>:null}/>
    {!cart.length?<EmptyState title="購物籃仲係空嘅" detail="由菜單揀好餐點，就可以喺呢度確認。"><ActionButton onClick={onMenu}>去睇菜單</ActionButton></EmptyState>:
    <>
      <div className="cart-lines">{cart.map(line=><article className="cart-line" key={line.lineId}><div className="cart-line-main"><strong>{line.productName}</strong><p>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join('、')||'原味設定'}</p>{line.attention?<div className="line-attention" role="alert"><b>呢項需要修正</b><span>{line.attention}</span></div>:null}</div><div className="cart-line-actions"><QuantityStepper label={line.productName} quantity={line.quantity} min={1} onChange={quantity=>onQuantity(line.lineId,quantity)}/><button className="remove-line" onClick={()=>onRemove(line.lineId)}>{line.attention?'移除呢項':'移除'}</button></div></article>)}</div>
      {suggestions.length?<section className="cart-suggestions"><div><span className="eyebrow">按店舖精選</span><h2>想配搭多一樣？</h2></div><div>{suggestions.map(product=><button key={product.productId} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height})}}><span><small>{product.badge}</small><strong>{product.name}</strong><em>{product.displayPriceLabel??'價格待店舖提供'}</em></span><b>查看</b></button>)}</div></section>:null}
      <QuoteSummary quote={quote}/>
      {quote?.freshness==='MATERIAL_CHANGE'?<section className="repair-card" role="alert"><span>需要你確認</span><h2>餐點或價格有重要變更</h2><p>返回菜單修正受影響項目。購物籃其他內容唔會被清空。</p><ActionButton variant="secondary" wide onClick={onMenu}>返回菜單修正</ActionButton></section>:null}
      <div className="screen-primary-action"><ActionButton wide onClick={onCheckout}>前往最後確認</ActionButton></div>
    </>}
  </section>;
}

function QuoteSummary({quote}:{quote:CustomerQuoteSnapshot|null}){
  const meta=quote?quoteMeta[quote.freshness]:null;
  return <section className={`quote-card quote-${meta?.tone??'attention'}`} aria-live="polite"><div><span>店舖報價</span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):'正在取得最新價格'}</AnimatedValue></div><p>{meta?.detail??'本機唔會自行估算價格。'}</p>{meta?<b>{meta.label}</b>:<i className="inline-loader" aria-hidden="true"/>}</section>;
}

function CheckoutView({cart,quote,checkout,setCheckout,pending,submitting,reading,onSubmit,onReadback,onBack,onRepair}:{
  cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;checkout:CustomerCheckoutDraft;setCheckout:(v:CustomerCheckoutDraft)=>void;pending:CustomerPendingIntent|null;submitting:boolean;reading:boolean;onSubmit:()=>void;onReadback:(intent:CustomerPendingIntent)=>void;onBack:()=>void;onRepair:()=>void;
}){
  const unknown=pending?.state==='UNKNOWN';
  const waiting=pending?.state==='PENDING';
  const materialChange=quote?.freshness==='MATERIAL_CHANGE';
  const actionState:ActionState=materialChange||!cart.length||!quote?'disabled':reading||submitting?'loading':unknown?'unknown':waiting?'pending':'default';
  return <section className="page checkout-page">
    <button className="back-link" onClick={onBack}>返回購物籃</button>
    <PageIntro kicker="最後確認" title={unknown?'正在確認訂單':'確認聯絡同總額'} detail={unknown?'請勿重複提交。系統只會查詢原本嗰次落單。':'店舖確認接單後，今次訂單先正式成立。'}/>
    <section className="checkout-review" aria-label="訂單摘要"><div><span>餐點</span><strong>{cart.reduce((sum,line)=>sum+line.quantity,0)} 件</strong></div><div><span>店舖報價</span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):'尚未取得'}</AnimatedValue></div><div><span>價格狀態</span><strong>{quote?quoteMeta[quote.freshness].label:'確認中'}</strong></div></section>
    <section className="checkout-contact"><div className="section-heading"><div><span className="eyebrow">取餐聯絡</span><h2>點稱呼你？</h2></div></div><div className="checkout-form"><label htmlFor="customer-name"><span>稱呼 <small>選填</small></span><input id="customer-name" name="name" value={checkout.name} onChange={e=>setCheckout({...checkout,name:e.target.value})} autoComplete="name" placeholder="例如：陳小姐"/></label><label htmlFor="customer-phone"><span>電話</span><input id="customer-phone" name="tel" value={checkout.phone} onChange={e=>setCheckout({...checkout,phone:e.target.value})} type="tel" inputMode="tel" autoComplete="tel" placeholder="用作取餐核對" aria-describedby="phone-help"/></label><small id="phone-help">只用作今次取餐核對。</small></div></section>
    {materialChange?<section className="safe-submit danger" role="alert"><span>安全提交</span><h2>請先重新確認變更</h2><p>總額或餐點狀態有重要變更。未確認前唔可以送出。</p><ActionButton variant="secondary" wide onClick={onRepair}>返回購物籃查看</ActionButton></section>:
    <section className={`safe-submit state-${actionState}`} role={unknown||waiting?'status':undefined}><span>安全提交</span><h2>{unknown?'正在確認訂單結果':waiting?'等待店舖確認':quote?'準備送出落單要求':'等待店舖報價'}</h2><p>{unknown?'店舖可能已收到落單要求。請勿重複提交，先查詢原本嗰次結果。':waiting?'落單要求已送出，未有最終結果前唔會自動重送。':'如果結果未明，系統會保留原本嗰次落單並先查詢結果，唔會盲目重送。'}</p><StatefulAction state={actionState} labels={{default:pending?.state==='NOT_CONNECTED'?'使用原本訂單再試':'確認並送出',loading:reading?'正在重新確認':'正在安全提交',pending:'等待店舖確認',unknown:'重新確認提交結果',disabled:quote?'需要先修正變更':'等待正式報價'}} onClick={unknown&&pending?()=>onReadback(pending):onSubmit}/>{unknown?<small>呢個動作只會讀取結果，未有重新提交。</small>:pending?.state==='NOT_CONNECTED'?<small>本機草稿已保存，未建立正式訂單。</small>:null}</section>}
  </section>;
}

function OrdersView({segment,setSegment,active,history,expandedOrderId,setExpandedOrderId,onReorder,connection}:{
  segment:OrderSegment;setSegment:(v:OrderSegment)=>void;active:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];expandedOrderId:string|null;setExpandedOrderId:(v:string|null)=>void;onReorder:(order:CustomerHistoryProjection)=>void;connection:CustomerConnectionState;
}){
  return <section className="page orders-page">
    <PageIntro kicker="訂單" title={segment==='current'?'而家去到邊？':'記憶罐'} detail={segment==='current'?'店舖收到、接單、製作同取餐會逐步更新。':'將完成過嘅味道收好，想食時按目前菜單重新建立。'}/>
    <div className="segmented" role="tablist" aria-label="訂單類別">
      <button role="tab" aria-selected={segment==='current'} className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button>
      <button role="tab" aria-selected={segment==='history'} className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>記憶罐</button>
    </div>
    {segment==='current'?(!active.length?
      <EmptyState title={connection==='NOT_CONNECTED'?'訂單服務尚未連接':'暫時冇進行中訂單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示店舖正式接單同製作進度。':'完成嘅訂單會收進記憶罐。'}/>:
      <div className="active-order-list">{active.map(order=><OrderCard key={order.orderId} order={order} expanded={expandedOrderId===order.orderId} onToggle={()=>setExpandedOrderId(expandedOrderId===order.orderId?null:order.orderId)}/>)}</div>):
    (!history.length?
      <EmptyState title={connection==='NOT_CONNECTED'?'記憶罐尚未連接':'記憶罐仲係空嘅'} detail={connection==='NOT_CONNECTED'?'連接後只會顯示正式完成嘅訂單。':'完成第一張訂單後，嗰一餐就會成為一粒記憶種子。'}/>:
      <div className="memory-list">{history.map((order,index)=><article className="memory-card" key={order.orderId}><div className="memory-seed" aria-hidden="true"><i/><span>{String(index+1).padStart(2,'0')}</span></div><div className="memory-copy"><small>{new Date(order.completedAt).toLocaleDateString('zh-HK')}</small><strong>{order.itemSummary}</strong><p>{order.displayCode}{order.amountLabel?' · '+order.amountLabel:''}</p></div><ActionButton variant="secondary" disabled={!order.reorderEligible} onClick={()=>onReorder(order)}>{order.reorderEligible?'再次下單':'暫時未能重建'}</ActionButton></article>)}</div>)}
  </section>;
}

function OrderCard({order,expanded,onToggle}:{order:CustomerOrderProjection;expanded:boolean;onToggle:()=>void}){
  const meta=stageMeta[order.stage];
  const handoverLabel={NOT_ARRIVED:'等待到店',ARRIVED:'已到店',VERIFIED:'已完成取餐核對',HANDED_OVER:'餐點已交收',UNKNOWN:'交收狀態確認中'}[order.handoverState??'UNKNOWN'];
  const pickupStage=order.stage==='READY'||order.stage==='PICKUP_VERIFICATION';
  return <article className={`order-status-card stage-${order.stage.toLowerCase()}`}>
    <div className="order-status-top"><span>{order.displayCode}</span><b>{order.readback==='CONFIRMED'?'店舖資料已確認':order.readback==='PARTIAL'?'部分資料更新中':'狀態確認中'}</b></div>
    <div className="order-status-copy"><AnimatedValue as="h2">{meta.title}</AnimatedValue><p>{order.rejectionReason??meta.detail}</p>{order.etaLabel?<div className="eta"><span>預計取餐</span><AnimatedValue>{order.etaLabel}</AnimatedValue></div>:null}</div>
    {order.stage==='DELAYED'?<section className="delay-card" role="status"><span>稍有延誤</span><AnimatedValue as="strong">{order.etaLabel??'時間待更新'}</AnimatedValue><p>店舖仍然製作中，未到可取餐階段。</p></section>:null}
    {pickupStage?<section className="pickup-card"><span>向店員出示取餐碼</span><AnimatedValue as="strong">{order.pickupCode??'等待店舖提供'}</AnimatedValue><small>{order.phoneMasked??'電話核對資料未提供'}</small><ol className="pickup-boundary" aria-label="取餐交收階段"><li className="done">可取餐</li><li className={order.handoverState==='ARRIVED'||order.handoverState==='VERIFIED'||order.handoverState==='HANDED_OVER'?'done':''}>已到店</li><li className={order.handoverState==='VERIFIED'||order.handoverState==='HANDED_OVER'?'done':''}>已核對</li><li className={order.handoverState==='HANDED_OVER'?'done':''}>已交收</li></ol><p>可取餐唔等於已到店、已核對、已交收或已完成。</p></section>:null}
    <ActionButton variant="secondary" wide aria-expanded={expanded} onClick={onToggle}>{expanded?'收起訂單詳情':'查看訂單詳情'}</ActionButton>
    {expanded?<section className="order-detail-card"><header><div><span>今次餐點</span><strong>{order.itemSummary}</strong></div>{order.amountLabel?<em>{order.amountLabel}</em>:null}</header><ol className="timeline">{order.timeline.map((item,index)=><li key={`${item.at}-${index}`} className={item.stage===order.stage?'active':''}><i aria-hidden="true"/><div><span>{item.label}</span>{item.detail?<p>{item.detail}</p>:null}</div><time dateTime={item.at}>{new Date(item.at).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ol><div className="detail-row"><span>取餐交收</span><strong>{handoverLabel}</strong></div></section>:null}
  </article>;
}

function MoreView({connection,snapshot,pendingIntents,readingIntentId,onRefresh,onReadback,onDiscard,onFallback}:{
  connection:CustomerConnectionState;snapshot:CustomerReadModelSnapshot|null;pendingIntents:readonly CustomerPendingIntent[];readingIntentId:string|null;onRefresh:()=>void;onReadback:(intent:CustomerPendingIntent)=>void;onDiscard:(id:string)=>void;onFallback:()=>void;
}){
  const connectionCopy={READY:'店舖資料已連接',LOADING:'正在更新店舖資料',ERROR:'暫時未能更新',NOT_CONNECTED:'店舖服務尚未連接',STALE:'正顯示最近一次資料',PARTIAL:'部分資料更新中',UNKNOWN:'正在確認店舖狀態'}[connection];
  return <section className="page service-page">
    <PageIntro kicker="服務與資料" title="每一步都有交代" detail="落單結果未明時，只會查詢原本嗰次提交，唔會偷偷再送一次。"/>
    <section className="service-card"><div className={`service-orb state-${connection.toLowerCase()}`} aria-hidden="true"/><div><span>店舖連線</span><h2>{connectionCopy}</h2><p>{snapshot?.observedAt?'最近更新 '+new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有正式店舖資料'}</p></div><ActionButton variant="secondary" loading={connection==='LOADING'} onClick={onRefresh}>更新</ActionButton></section>
    <section className="pending-section"><div className="section-heading"><div><span className="eyebrow">安全恢復</span><h2>等待確認嘅落單</h2></div><b>{pendingIntents.length}</b></div>{pendingIntents.length?<div className="pending-list">{pendingIntents.map(intent=>{const copy=intent.state==='UNKNOWN'?'結果仍在確認':intent.state==='PENDING'?'店舖確認中':intent.state==='NOT_CONNECTED'?'尚未連接店舖':'已保存落單草稿';return <article className={`pending-card state-${intent.state.toLowerCase()}`} key={intent.submissionId}><div><span>{copy}</span><p>{intent.lastMessage??'落單資料已安全保留喺本機。'}</p><small>建立於 {new Date(intent.createdAt).toLocaleString('zh-HK')}</small></div><div className="pending-actions"><button onClick={()=>onDiscard(intent.submissionId)}>刪除草稿</button><ActionButton variant="secondary" loading={readingIntentId===intent.submissionId} onClick={()=>onReadback(intent)}>重新確認</ActionButton></div></article>})}</div>:<p className="quiet-state">冇等待確認嘅落單。需要時，本機草稿會喺呢度等你處理。</p>}</section>
    <section className="membership-seam"><div><span>會員與記憶勳章</span><h2>只記錄真實發生過嘅回憶</h2><p>店舖未提供正式會員資料前，唔會顯示假等級、假積分或假勳章。</p></div><b>等待正式資料</b></section>
    <section className="unavailable-card"><span>自家渠道不可用時</span><h2>由你決定先開啟備用方法</h2><p>系統唔會自動轉送購物籃或個人資料。</p><ActionButton variant="secondary" wide onClick={onFallback}>查看備用聯絡方法</ActionButton></section>
  </section>;
}

function ProductSheet({product,selections,selectedVariationId,setVariation,toggle,origin,onClose,onAdd}:{
  product:CustomerProduct;selections:CustomerSelectionState;selectedVariationId:string|null;setVariation:(id:string)=>void;toggle:(groupId:string,optionId:string)=>void;origin:ProductOriginRect|null;onClose:()=>void;onAdd:()=>void;
}){
  const validation=validateCustomerSelections(product,selections);
  const variationOk=!product.variationRequired||Boolean(selectedVariationId);
  return <ProductDialog label={`${product.name} 商品詳情`} origin={origin} onClose={onClose}>
    <div className="product-sheet-hero"><div className="product-sheet-visual" aria-hidden="true">{product.name.slice(0,1)}</div><div><span>{product.badge??'商品詳情'}</span><h2>{product.name}</h2><p>{product.description}</p><AnimatedValue as="strong">{product.displayPriceLabel??'價格待店舖提供'}</AnimatedValue></div></div>
    <div className="product-config-scroll">
      {product.variations?.length?<fieldset className="choice-group"><legend><span>規格</span><small>{product.variationRequired?'必選':'可選'}</small></legend><div className="choice-grid">{product.variations.map(item=><button type="button" key={item.variationId} disabled={!item.available} aria-pressed={selectedVariationId===item.variationId} className={selectedVariationId===item.variationId?'active':''} onClick={()=>setVariation(item.variationId)}><span>{item.name}</span>{!item.available?<small>暫不可選</small>:null}</button>)}</div>{product.variationRequired&&!variationOk?<p className="choice-error">請揀一個規格</p>:null}</fieldset>:null}
      {product.optionGroups.map(group=>{const count=(selections[group.optionGroupId]??[]).length;const minimum=Math.max(group.required?1:0,group.minSelections);return <fieldset className="choice-group" key={group.optionGroupId}><legend><span>{group.name}</span><small>{minimum?`最少 ${minimum}`:'可選'} · 最多 {group.maxSelections}</small></legend><p className="selection-count">已選 {count} 項</p><div className="choice-grid">{group.options.map(option=>{const selected=(selections[group.optionGroupId]??[]).includes(option.optionId);return <button type="button" key={option.optionId} disabled={!option.available} aria-pressed={selected} className={selected?'active':''} onClick={()=>toggle(group.optionGroupId,option.optionId)}><span>{option.name}</span>{!option.available?<small>暫不可選</small>:selected?<small>已選</small>:null}</button>})}</div>{count<minimum?<p className="choice-error">仲要揀 {minimum-count} 項</p>:null}</fieldset>})}
    </div>
    {!validation.ok?<p className="config-message" role="alert">{validation.issues[0]}</p>:null}
    <div className="sheet-actions"><ActionButton variant="ghost" onClick={onClose}>稍後再揀</ActionButton><ActionButton wide disabled={!validation.ok||!variationOk} onClick={onAdd}>{validation.ok&&variationOk?'加入購物籃':'完成必選項目'}</ActionButton></div>
  </ProductDialog>;
}
