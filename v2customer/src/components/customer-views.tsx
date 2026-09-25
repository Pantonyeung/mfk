import {useRef,useState,type CSSProperties} from 'react';
import {validateCustomerSelections,type CustomerSelectionState} from '../selection';
import {ActionButton,AnimatedValue,CollapsingHeader,EmptyState,ExpandingSearch,MenuSkeleton,PageIntro,ProductDialog,PullRefreshSurface,QuantityStepper,StatefulAction,type ActionState,type ProductOriginRect} from '../ui/primitives';
import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerCartLine,
  CustomerCheckoutDraft,
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerMemberProjection,
  CustomerMemoryBadgeProjection,
  CustomerMemoryCouponProjection,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerPendingIntent,
  CustomerProduct,
  CustomerProjectionState,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
} from '../product-types';

export type OrderSegment='current'|'history';
export type MenuLayout='grid'|'list';

const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
const productTransitionName=(productId:string)=>`product-${productId.replace(/[^a-zA-Z0-9_-]/g,'-')}`;

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

function ProductMedia({product,compact=false}:{product:CustomerProduct;compact?:boolean}){
  return <span className={`product-media${compact?' compact':''}`} aria-hidden={!product.imageUrl}>
    {product.imageUrl?<img src={product.imageUrl} alt={product.imageAlt??product.name}/>:<span className="product-media-fallback"><i/>{product.name.slice(0,1)}</span>}
    {!product.available?<b>暫停供應</b>:null}
  </span>;
}

function SectionHeading({eyebrow,title,action}:{eyebrow:string;title:string;action?:React.ReactNode}){
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

const orderingJourney=['揀餐','設定','記憶罐','確認'] as const;
function JourneyCoach({active}:{active:1|2|3|4}){
  return <ol className="journey-coach" aria-label="點餐進度">
    {orderingJourney.map((label,index)=>{
      const step=index+1;
      const state=step<active?'done':step===active?'active':'upcoming';
      return <li key={label} className={state}><i>{step<active?'✓':step}</i><span>{label}</span></li>;
    })}
  </ol>;
}

function RecommendationRail({eyebrow,title,recommendations,onProduct,compact=false}:{
  eyebrow:string;title:string;recommendations:readonly CustomerRecommendation[];onProduct:(product:CustomerProduct,origin:ProductOriginRect)=>void;compact?:boolean;
}){
  if(!recommendations.length)return null;
  return <section className={`recommendation-section${compact?' compact':''}`}><SectionHeading eyebrow={eyebrow} title={title}/><div className="recommendation-rail">{recommendations.map(item=><button key={item.product.productId} data-product-id={item.product.productId} data-recommendation-source={item.reason} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height})}}>
    <ProductMedia product={item.product} compact/>
    <span><small>{item.reasonLabel}</small><strong>{item.product.name}</strong><p>{item.reasonDetail}</p><em>{item.product.displayPriceLabel??'價格待店舖提供'}</em></span>
    <b aria-hidden="true">＋</b>
  </button>)}</div><p className="recommendation-disclosure">推薦只整理目前已載入嘅正式菜單、歷史訂單同店舖標記；唔會自己改價、套優惠或者建立訂單。</p></section>;
}

function HeroCarousel(){
  const railRef=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState(0);
  const slides=[
    {image:'/brand/mf-home-hero-bowl.webp',eyebrow:'MORE FUN MOMENT',title:'今日，食一餐真正想食嘅。'},
    {image:'/brand/mf-home-hero-f4.webp',eyebrow:'FRESHLY PREPARED',title:'由揀選，到取餐，每一步都有交代。'},
    {image:'/brand/mf-home-hero-salad.webp',eyebrow:'YOUR TASTE, REMEMBERED',title:'將鍾意嘅味道，慢慢儲成記憶。'},
  ];
  const go=(index:number)=>{
    railRef.current?.children[index]?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest',inline:'start'});
    setActive(index);
  };
  return <section className="hero-carousel" aria-roledescription="carousel" aria-label="磨飯品牌精選">
    <div ref={railRef} className="hero-rail" onScroll={event=>{
      const node=event.currentTarget;
      if(node.clientWidth)setActive(Math.round(node.scrollLeft/node.clientWidth));
    }}>
      {slides.map((slide,index)=><article className={`hero-slide${active===index?' is-active':''}`} key={slide.image} aria-label={`${index+1} / ${slides.length}`}>
        <img src={slide.image} alt="磨飯新鮮餐點"/>
        <div className="hero-scrim"/>
        <div className="hero-brand-chip" aria-hidden="true"><span>磨飯</span><b>MORE FUN</b><em>{String(index+1).padStart(2,'0')}</em></div>
        <div className="hero-message"><span>{slide.eyebrow}</span><h2>{slide.title}</h2><em>向左滑動，繼續探索</em></div>
      </article>)}
    </div>
    <div className="carousel-dots" role="group" aria-label="選擇品牌精選">
      {slides.map((_,index)=><button key={index} className={active===index?'active':''} aria-label={`顯示第 ${index+1} 張`} aria-pressed={active===index} onClick={()=>go(index)}/>) }
    </div>
  </section>;
}

export function HomeView({snapshot,connection,activeOrders,history,recommendations,cartCount,onRefresh,onProduct,onBrowse,onJar,onOrders,onHistory,onMember,onBuyAgain,onFallback}:{
  snapshot:CustomerReadModelSnapshot|null;connection:CustomerConnectionState;activeOrders:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];recommendations:readonly CustomerRecommendation[];cartCount:number;onRefresh:()=>void;onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;onBrowse:()=>void;onJar:()=>void;onOrders:()=>void;onHistory:()=>void;onMember:()=>void;onBuyAgain:(order:CustomerHistoryProjection)=>void;onFallback:()=>void;
}){
  const store=snapshot?.store;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const member=snapshot?.member;
  const canBrowse=Boolean(snapshot?.menu)&&store?.channelAvailable!==false;
  const seeds=member?.state==='READY'&&member.seeds?.state==='READY'?member.seeds.valueLabel:'待連接';
  return <PullRefreshSurface refreshing={connection==='LOADING'} onRefresh={onRefresh}><section className="page home-page entrance-sequence">
    <header className="home-store-heading">
      <div><span className="eyebrow">今日自取 · {store?.etaLabel??'時間待店舖確認'}</span><h1>{store?.storeName??'磨飯'}</h1></div>
      <div className={`availability-label ${store?.channelAvailable?'open':'closed'}`}><i aria-hidden="true"/><span>{store?store.channelAvailable?'今日可以落單':'今日暫停落單':'等待店舖資料'}</span></div>
    </header>
    {store?.notice?<section className="home-notice" role="status"><span>店舖消息</span><p>{store.notice}</p></section>:null}

    {currentOrder?<button className={`current-order-spotlight stage-${currentOrder.stage.toLowerCase()}`} onClick={onOrders}>
      <span>進行中訂單 · {currentOrder.displayCode}</span>
      <strong>{stageMeta[currentOrder.stage].title}</strong>
      <p>{currentOrder.etaLabel?`預計 ${currentOrder.etaLabel}`:stageMeta[currentOrder.stage].detail}</p>
      <em>查看最新進度</em>
    </button>:null}

    <HeroCarousel/>

    {store&&!store.channelAvailable?<section className="unavailable-card"><span>自家渠道暫時不可用</span><h2>而家未能直接落單</h2><p>{store.notice??'可以稍後再試，或者由你主動開啟店舖提供嘅備用聯絡方法。'}</p><ActionButton wide onClick={onFallback}>查看備用聯絡方法</ActionButton></section>:
    <section className="home-primary-action">
      <div><span>{canBrowse?'菜單已經準備好':'等待正式菜單'}</span><strong>想食咩，由呢度開始。</strong></div>
      <ActionButton wide disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'開始點餐':connection==='LOADING'?'正在準備菜單':'等待店舖連接'}</ActionButton>
    </section>}

    <RecommendationRail eyebrow="為你揀快一步" title="有理由嘅推薦，唔靠估" recommendations={recommendations} onProduct={(product,origin)=>onProduct(product,origin)}/>

    {lastOrder?<section className="buy-again-section"><SectionHeading eyebrow="因你上次食過" title="一撳再來一單" action={<button className="text-action" onClick={onHistory}>全部回憶</button>}/><article className="buy-again-row"><div><small>{new Date(lastOrder.completedAt).toLocaleDateString('zh-HK')} · 來自你嘅正式歷史訂單</small><strong>{lastOrder.itemSummary}</strong><span>{lastOrder.amountLabel??'歷史價格未提供'}</span></div><ActionButton variant="secondary" disabled={!lastOrder.reorderEligible} onClick={()=>onBuyAgain(lastOrder)}>按目前菜單重建</ActionButton></article></section>:null}

    <section className="memory-ecosystem"><SectionHeading eyebrow="MORE FUN MEMORY" title="將每一餐，儲成你嘅記憶" action={<button className="text-action" onClick={onMember}>我的記憶</button>}/><div className="memory-ecosystem-grid">
      <button className="ecosystem-jar" onClick={onJar}><i className={`mini-jar level-${Math.min(3,cartCount)}`} aria-hidden="true"/><span><small>記憶罐</small><strong>{cartCount?`${cartCount} 件餐點`:'等待第一樣餐點'}</strong></span></button>
      <button onClick={onMember}><span>記憶種子</span><strong>{seeds}</strong><small>由正式會員資料提供</small></button>
      <button onClick={onMember}><span>記憶勳章</span><strong>{member?.state==='READY'&&member.badges?`${member.badges.filter(item=>item.state==='EARNED').length} 枚`:'待連接'}</strong><small>查看收藏</small></button>
      <button onClick={onMember}><span>回憶券</span><strong>{member?.state==='READY'&&member.coupons?`${member.coupons.filter(item=>item.state==='AVAILABLE').length} 張`:'待連接'}</strong><small>優惠由正式定價確認</small></button>
    </div></section>
  </section></PullRefreshSurface>;
}

export function MenuView({connection,categories,activeCategoryId,setCategory,query,setQuery,layout,setLayout,products,recommendations,onProduct,cartCount,quote,onCart}:{
  connection:CustomerConnectionState;categories:readonly {categoryId:string;name:string}[];activeCategoryId:string|null;setCategory:(id:string|null)=>void;query:string;setQuery:(v:string)=>void;layout:MenuLayout;setLayout:(v:MenuLayout)=>void;products:readonly CustomerProduct[];recommendations:readonly CustomerRecommendation[];onProduct:(p:CustomerProduct,origin:ProductOriginRect)=>void;cartCount:number;quote:CustomerQuoteSnapshot|null;onCart:()=>void;
}){
  return <section className="page menu-page">
    <CollapsingHeader><PageIntro kicker="點單" title="今日想食咩？" detail="先揀分類，再逐步設定；售價同供應以店舖最新資料為準。"/><div className="menu-tools"><ExpandingSearch value={query} onChange={setQuery}/><div className="layout-toggle" role="group" aria-label="菜單顯示方式"><button className={layout==='grid'?'active':''} aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}>格狀</button><button className={layout==='list'?'active':''} aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>列表</button></div></div></CollapsingHeader>
    <JourneyCoach active={1}/>
    {categories.length?<div className="category-rail" role="tablist" aria-label="商品分類">{categories.map(category=><button role="tab" aria-selected={activeCategoryId===category.categoryId} key={category.categoryId} className={activeCategoryId===category.categoryId?'active':''} onClick={()=>setCategory(category.categoryId)}>{category.name}</button>)}</div>:null}
    {!query.trim()?<RecommendationRail compact eyebrow="SMART PICKS" title="呢刻值得先睇" recommendations={recommendations.slice(0,3)} onProduct={onProduct}/>:null}
    {connection==='LOADING'?<MenuSkeleton/>:
      !categories.length?<EmptyState title={connection==='NOT_CONNECTED'?'菜單服務尚未連接':'今日暫時未有菜單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式商品、規格、價格同供應狀態。':'店舖目前未提供可售商品。'}/>:
      products.length?<div className={`product-list layout-${layout}`}>{products.map(product=><button className={'product-card '+(product.available?'available':'unavailable')} data-product-id={product.productId} style={{viewTransitionName:productTransitionName(product.productId)} as CSSProperties} disabled={!product.available} key={product.productId} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height})}}><ProductMedia product={product}/><span className="product-information">{product.badge?<small>{product.badge}</small>:null}<strong>{product.name}</strong><p>{product.description}</p><em>{product.displayPriceLabel??'價格待店舖提供'}</em></span><span className="sellability">{product.available?'設定':'暫停供應'}</span></button>)}</div>:
      <EmptyState title={query.trim()?`搵唔到「${query.trim()}」`:'呢個分類暫時未有商品'} detail="試下另一個名稱，或者切換其他分類。"><ActionButton variant="secondary" onClick={()=>setQuery('')}>清除搜尋</ActionButton></EmptyState>}
    {cartCount>0?<button className="floating-cart" onClick={onCart}><b>{cartCount}</b><span><strong>打開記憶罐</strong><small>{quote?quoteMeta[quote.freshness].label:'等待餐牌價格'}</small></span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):'查看'}</AnimatedValue></button>:null}
  </section>;
}

function JarVisual({count}:{count:number}){
  const level=count===0?'empty':count===1?'first':count<5?'half':'full';
  const stateLabel=count===0?'等待第一樣':count===1?'第一樣已放好':count<5?'今餐漸漸成形':'準備好去確認';
  const stateDetail=count===0?'每加一樣，記憶罐都會留下今餐嘅形狀。':count===1?'由第一個選擇開始，今餐已經有咗方向。':count<5?'你嘅選擇正逐樣累積，送出前仍然可以修改。':'今餐已經成形，下一步可以核對正式報價。';
  return <div className={`memory-jar-visual level-${level}`} aria-label={count?`記憶罐有 ${count} 件餐點`:'記憶罐係空嘅'}>
    <div className="jar-aura" aria-hidden="true"><i/><i/><i/></div>
    <div className="jar-stage" aria-hidden="true">
      <div className="jar-lid"><i/></div>
      <div className="jar-glass">
        <div className="jar-reflection"/>
        <div className="jar-particles"><i/><i/><i/><i/><i/></div>
        <span>{count||'+'}</span>
        <em>MEMORY JAR</em>
      </div>
    </div>
    <div className="jar-state-copy"><small>{stateLabel}</small><b>{stateDetail}</b></div>
  </div>;
}

export function CartView({cart,quote,checkout,member,suggestions,products,onProduct,onCheckoutChange,onQuantity,onRemove,onMenu,onCheckout}:{cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;checkout:CustomerCheckoutDraft;member?:CustomerMemberProjection;suggestions:readonly CustomerRecommendation[];products:readonly CustomerProduct[];onProduct:(product:CustomerProduct,origin:ProductOriginRect|null,line?:CustomerCartLine)=>void;onCheckoutChange:(value:CustomerCheckoutDraft)=>void;onQuantity:(id:string,q:number)=>void;onRemove:(id:string)=>void;onMenu:()=>void;onCheckout:()=>void;}){
  const [removeConfirm,setRemoveConfirm]=useState<string|null>(null);
  const itemCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <section className="page cart-page">
    <PageIntro kicker="記憶罐" title={cart.length?'今餐已經有個樣':'由第一樣想食嘅開始'} detail="記憶罐係今次落單草稿。未去到安全提交前，都未建立正式訂單。" aside={cart.length?<button className="text-action" onClick={onMenu}>繼續加餐</button>:null}/>
    <JourneyCoach active={3}/>
    <JarVisual count={itemCount}/>
    {!cart.length?<EmptyState title="記憶罐仲係空嘅" detail="去菜單揀一樣真正想食嘅，設定會逐步帶你完成。"><ActionButton onClick={onMenu}>開始點餐</ActionButton></EmptyState>:
    <>
      <section className="jar-live-summary" aria-live="polite"><span>今次已選</span><AnimatedValue as="strong">{itemCount} 件餐點</AnimatedValue><small>{quote?quoteMeta[quote.freshness].label:'等待餐牌價格'}</small></section>
      <div className="cart-lines">{cart.map(line=>{
        const product=products.find(item=>item.productId===line.productId);
        return <article className="cart-line" key={line.lineId}>
          <div className="cart-line-main"><span className="cart-line-index" aria-hidden="true">{String(cart.indexOf(line)+1).padStart(2,'0')}</span><div><strong>{line.productName}</strong><p>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join('、')||'原味設定'}</p>{line.note?<small>備註：{line.note}</small>:null}{line.attention?<div className="line-attention" role="alert"><b>只修正呢一項</b><span>{line.attention}</span></div>:null}</div></div>
          <div className="cart-line-actions"><QuantityStepper label={line.productName} quantity={line.quantity} min={1} onChange={quantity=>onQuantity(line.lineId,quantity)}/><div><button disabled={!product} onClick={event=>{if(product){const rect=event.currentTarget.getBoundingClientRect();onProduct(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height},line)}}}>{line.attention?'修正':'編輯'}</button><button className="remove-line" onClick={()=>setRemoveConfirm(line.lineId)}>移除</button></div></div>
          {removeConfirm===line.lineId?<div className="remove-confirm" role="alert"><p>只移除「{line.productName}」？其他餐點會保留。</p><button onClick={()=>setRemoveConfirm(null)}>保留</button><ActionButton variant="danger" onClick={()=>{onRemove(line.lineId);setRemoveConfirm(null)}}>確認移除</ActionButton></div>:null}
        </article>;
      })}</div>
      {member?.state==='READY'&&member.preferences?.length?<section className="remembered-tastes"><span>我哋記得你</span><div>{member.preferences.map(item=><b key={item}>{item}</b>)}</div><small>口味習慣唔會自動改今次餐點；請逐項確認。</small></section>:<section className="remembered-tastes disconnected"><span>已儲存口味</span><p>會員偏好尚未連接，今次設定唔會寫入客戶身份。</p></section>}
      <section className="jar-contact"><SectionHeading eyebrow="取餐聯絡" title="今次點稱呼你？"/><div className="checkout-form compact"><label htmlFor="jar-name"><span>稱呼 <small>選填</small></span><input id="jar-name" value={checkout.name} onChange={event=>onCheckoutChange({...checkout,name:event.target.value})} autoComplete="name" placeholder="例如：陳小姐"/></label><label htmlFor="jar-phone"><span>電話</span><input id="jar-phone" type="tel" inputMode="tel" value={checkout.phone} onChange={event=>onCheckoutChange({...checkout,phone:event.target.value})} autoComplete="tel" placeholder="只作今次取餐核對"/></label></div></section>
      {suggestions.length?<RecommendationRail eyebrow="今餐可以再睇" title="加一樣，都要有理由" recommendations={suggestions} onProduct={(product,origin)=>onProduct(product,origin)}/>:null}
      <QuoteSummary quote={quote} cart={cart}/>
      {quote?.freshness==='MATERIAL_CHANGE'?<section className="repair-card" role="alert"><span>需要你確認</span><h2>餐點或價格有重要變更</h2><p>只修正受影響項目。記憶罐其他內容唔會被清空。</p><ActionButton variant="secondary" wide onClick={onMenu}>返回菜單修正</ActionButton></section>:null}
      <div className="screen-primary-action"><div><span>下一步</span><strong>{quote?money(quote.currency,quote.totalMinor):'等待餐牌價格'}</strong></div><ActionButton wide disabled={quote?.freshness==='MATERIAL_CHANGE'} onClick={onCheckout}>前往最後確認</ActionButton></div>
    </>}
  </section>;
}

function localPublishedTotal(cart:readonly CustomerCartLine[]){
  if(!cart.length||cart.some(line=>!Number.isSafeInteger(line.publishedUnitPriceMinor)))return null;
  return cart.reduce((sum,line)=>sum+Number(line.publishedUnitPriceMinor)*line.quantity,0);
}

function QuoteSummary({quote,cart}:{quote:CustomerQuoteSnapshot|null;cart:readonly CustomerCartLine[]}){
  const meta=quote?quoteMeta[quote.freshness]:null;
  const published=localPublishedTotal(cart);
  return <section className={`quote-card quote-${meta?.tone??'current'}`} aria-live="polite"><div><span>訂單總額</span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):published!==null?money('HKD',published):'更新中'}</AnimatedValue></div><p>{meta?.detail??(published!==null?'按目前餐牌價格顯示；送出時會自動核對最新資料。':'正在更新餐牌資料。')}</p>{meta?<b>{meta.label}</b>:published!==null?<b>目前餐牌價格</b>:<i className="inline-loader" aria-hidden="true"/>}</section>;
}

export function CheckoutView({cart,quote,checkout,setCheckout,paymentChannels,pending,actionState,onSubmit,onReadback,onBack,onRepair,onPaymentEvidence}:{
  cart:readonly CustomerCartLine[];quote:CustomerQuoteSnapshot|null;checkout:CustomerCheckoutDraft;setCheckout:(v:CustomerCheckoutDraft)=>void;paymentChannels:NonNullable<CustomerReadModelSnapshot['paymentChannels']>;pending:CustomerPendingIntent|null;actionState:ActionState;onSubmit:()=>void;onReadback:(intent:CustomerPendingIntent)=>void;onBack:()=>void;onRepair:()=>void;onPaymentEvidence:(file:File)=>void;
}){
  const unknown=pending?.state==='UNKNOWN';
  const waiting=pending?.state==='PENDING';
  const materialChange=quote?.freshness==='MATERIAL_CHANGE';
  const [openPaymentChannelId,setOpenPaymentChannelId]=useState<string|null>(null);
  const openPaymentChannel=paymentChannels.find(channel=>channel.channelId===openPaymentChannelId)??null;
  return <section className="page checkout-page">
    <button className="back-link" onClick={onBack}>返回記憶罐</button>
    <PageIntro kicker="最後確認 · 3 / 3" title={unknown?'正在確認訂單':'資料清楚，先安心送出'} detail={unknown?'請勿重複提交。系統只會查詢原本嗰次落單。':'價格已按發佈餐牌計算；送出後由 SMT 核對版本同價格，一致就直接接單。'}/>
    <JourneyCoach active={4}/>
    <ol className="checkout-steps" aria-label="落單步驟"><li className="done">揀好餐點</li><li className="done">確認聯絡</li><li className="active">安全提交</li></ol>
    <section className="checkout-review" aria-label="訂單摘要"><div><span>餐點</span><strong>{cart.reduce((sum,line)=>sum+line.quantity,0)} 件</strong></div><div><span>目前餐牌價格</span><AnimatedValue>{quote?money(quote.currency,quote.totalMinor):'尚未取得'}</AnimatedValue></div><div><span>價格狀態</span><strong>{quote?quoteMeta[quote.freshness].label:'確認中'}</strong></div></section>
    <section className="checkout-contact"><SectionHeading eyebrow="取餐聯絡" title="核對今次資料"/><div className="checkout-form"><label htmlFor="customer-name"><span>稱呼 <small>選填</small></span><input id="customer-name" name="name" value={checkout.name} onChange={event=>setCheckout({...checkout,name:event.target.value})} autoComplete="name" placeholder="例如：陳小姐"/></label><label htmlFor="customer-phone"><span>電話</span><input id="customer-phone" name="tel" value={checkout.phone} onChange={event=>setCheckout({...checkout,phone:event.target.value})} type="tel" inputMode="tel" autoComplete="tel" placeholder="用作取餐核對" aria-describedby="phone-help"/></label><small id="phone-help">只用作今次取餐核對。會員身份、口味偏好同推廣同意係分開資料。</small></div></section>
    <section className="checkout-payment"><SectionHeading eyebrow="付款方式" title="今次點樣付款？"/>
      <div className="payment-method-grid">
        <button type="button" className={checkout.paymentMethod==='PAY_AT_STORE'?'active':''} onClick={()=>{setOpenPaymentChannelId(null);setCheckout({...checkout,paymentMethod:'PAY_AT_STORE',paymentChannelId:undefined,paymentChannelLabel:undefined,paymentEvidence:undefined})}}><b>到店付款</b><span>取餐時再付款</span></button>
        <button type="button" className={checkout.paymentMethod==='ELECTRONIC'?'active':''} onClick={()=>setCheckout({...checkout,paymentMethod:'ELECTRONIC'})}><b>電子支付</b><span>選擇支付渠道，再提供付款截圖</span></button>
      </div>
      {checkout.paymentMethod==='ELECTRONIC'?<div className="electronic-payment-flow">
        <div className="payment-channel-grid" role="list" aria-label="電子支付渠道">{paymentChannels.map(channel=><button type="button" key={channel.channelId} className={checkout.paymentChannelId===channel.channelId?'active':''} onClick={()=>{const changed=checkout.paymentChannelId!==channel.channelId;setCheckout({...checkout,paymentMethod:'ELECTRONIC',paymentChannelId:channel.channelId,paymentChannelLabel:channel.label,...(changed?{paymentEvidence:undefined}:{})});setOpenPaymentChannelId(channel.channelId)}}><b>{channel.label}</b><span>{channel.qrImageUrl?'查看付款 QR':'QR 圖待提供'}</span></button>)}</div>
        {!paymentChannels.length?<p className="payment-channel-empty">店舖暫時未開放電子支付渠道。</p>:null}
        <div className="payment-evidence"><p>完成付款後，再上傳付款截圖畀店舖核對；提供截圖唔代表付款已確認。</p><label className="evidence-picker"><span>{checkout.paymentEvidence?.fileName??'選擇付款截圖'}</span><input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(!file)return;onPaymentEvidence(file)}}/></label>{checkout.paymentEvidence?<small>已選擇：{checkout.paymentEvidence.fileName}</small>:null}</div>
      </div>:null}
    </section>
    {materialChange?<section className="safe-submit danger" role="alert"><span>目前被阻擋</span><h2>請先重新確認變更</h2><p>總額或餐點狀態有重要變更。未確認前唔可以送出。</p><ActionButton variant="secondary" wide onClick={onRepair}>返回記憶罐查看</ActionButton></section>:
    <section className={`safe-submit state-${actionState}`} role={unknown||waiting?'status':undefined}><i className="submit-orbit" aria-hidden="true"><b/><b/><b/></i><span>{unknown?'結果未知':waiting?'等待中':'安全提交'}</span><h2>{unknown?'正在確認訂單結果':waiting?'正在確認接單結果':quote?'準備送出落單要求':'等待餐牌價格'}</h2><p>{unknown?'店舖可能已收到落單要求。請勿重複提交，先查詢原本嗰次結果。':waiting?'落單要求已送出，SMT 正核對餐牌版本同價格；未有終局前唔會自動重送。':'如果結果未明，系統會保留原本嗰次落單並先讀回結果，唔會盲目重送。'}</p>{unknown||waiting?<div className="order-confirm-progress" role="progressbar" aria-label={unknown?'正在確認訂單結果':'等待店舖確認'} aria-valuetext="處理中"><i/><span>{unknown?'正在查詢原本訂單結果…':'訂單已送出，等待店舖回覆…'}</span></div>:<StatefulAction state={actionState} labels={{default:pending?.state==='NOT_CONNECTED'?'使用原本落單再試':'確認並送出',loading:'正在安全處理',pending:'等待店舖確認',unknown:'重新確認提交結果',disabled:quote?'需要先修正變更':'等待餐牌價格'}} onClick={onSubmit}/>}
    {unknown&&pending?<button type="button" className="order-confirm-readback" onClick={()=>onReadback(pending)}>立即重新確認結果</button>:null}
    {unknown?<small>系統只會讀取原本結果，未有重新提交。</small>:pending?.state==='NOT_CONNECTED'?<small>本機草稿已保存，未建立正式訂單。</small>:null}</section>}
    {openPaymentChannel?<div className="payment-qr-backdrop" role="presentation" onClick={()=>setOpenPaymentChannelId(null)}><section className="payment-qr-sheet" role="dialog" aria-modal="true" aria-label={openPaymentChannel.label+' 付款 QR'} onClick={event=>event.stopPropagation()}><header><div><small>電子支付</small><h2>{openPaymentChannel.label}</h2></div><button type="button" onClick={()=>setOpenPaymentChannelId(null)}>關閉</button></header>{openPaymentChannel.qrImageUrl?<><div className="payment-qr-image"><img src={openPaymentChannel.qrImageUrl} alt={openPaymentChannel.label+' 付款 QR Code'}/></div><p>可以直接截圖，或者儲存付款碼後用手機付款。完成後返嚟上傳付款截圖。</p><a className="payment-qr-download" href={openPaymentChannel.qrImageUrl+(openPaymentChannel.qrImageUrl.includes('?')?'&':'?')+'download=1'} download>儲存付款碼</a></>:<><div className="payment-qr-placeholder"><b>QR 圖片待提供</b><span>位置已保留；店舖未發布圖片前唔會顯示假付款碼。</span></div><p>呢個渠道暫時未可以完成電子付款。</p></>}</section></div>:null}
  </section>;
}

export function OrdersView({segment,setSegment,active,history,expandedOrderId,setExpandedOrderId,onReorder,onBrowse,connection}:{
  segment:OrderSegment;setSegment:(v:OrderSegment)=>void;active:readonly CustomerOrderProjection[];history:readonly CustomerHistoryProjection[];expandedOrderId:string|null;setExpandedOrderId:(v:string|null)=>void;onReorder:(order:CustomerHistoryProjection)=>void;onBrowse:()=>void;connection:CustomerConnectionState;
}){
  const [hiddenHistoryIds,setHiddenHistoryIds]=useState<readonly string[]>([]);
  const [lastHiddenId,setLastHiddenId]=useState<string|null>(null);
  const visibleHistory=history.filter(order=>!hiddenHistoryIds.includes(order.orderId));
  const hideFromView=(orderId:string)=>{
    setHiddenHistoryIds(ids=>[...ids,orderId]);
    setLastHiddenId(orderId);
  };
  const undoHide=()=>{
    if(!lastHiddenId)return;
    setHiddenHistoryIds(ids=>ids.filter(id=>id!==lastHiddenId));
    setLastHiddenId(null);
  };
  return <section className="page orders-page">
    <PageIntro kicker="我的訂單" title={segment==='current'?'而家去到邊？':'食過嘅，都收得好好'} detail={segment==='current'?'收到、接單、製作、可取餐與交收會按正式狀態逐步更新。':'歷史只係回憶；再次下單會按目前菜單重新驗證。'}/>
    <div className="segmented" role="tablist" aria-label="訂單類別"><button role="tab" aria-selected={segment==='current'} className={segment==='current'?'active':''} onClick={()=>setSegment('current')}>進行中</button><button role="tab" aria-selected={segment==='history'} className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>歷史訂單</button></div>
    {segment==='current'?(!active.length?<EmptyState title={connection==='NOT_CONNECTED'?'訂單服務尚未連接':'暫時冇進行中訂單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示店舖正式接單同製作進度。':'點餐後，最新進度會喺呢度。'}><ActionButton onClick={onBrowse}>開始點餐</ActionButton></EmptyState>:<div className="active-order-list">{active.map(order=><OrderCard key={order.orderId} order={order} expanded={expandedOrderId===order.orderId} onToggle={()=>setExpandedOrderId(expandedOrderId===order.orderId?null:order.orderId)}/>)}</div>):(!history.length?<EmptyState title={connection==='NOT_CONNECTED'?'歷史訂單尚未連接':'仲未有完成訂單'} detail={connection==='NOT_CONNECTED'?'連接後只會顯示正式完成嘅訂單。':'完成第一張訂單後，就可以喺呢度再次回味。'}/>:<>{lastHiddenId?<section className="history-view-feedback" role="status"><span>已從今次檢視收起；正式訂單紀錄冇被刪除。</span><button onClick={undoHide}>復原</button></section>:null}{visibleHistory.length?<div className="history-list">{visibleHistory.map(order=><article className="history-card" key={order.orderId}><div className="history-date"><strong>{new Date(order.completedAt).toLocaleDateString('zh-HK',{day:'2-digit'})}</strong><span>{new Date(order.completedAt).toLocaleDateString('zh-HK',{month:'short',year:'numeric'})}</span></div><div className="history-copy"><small>{order.displayCode}</small><strong>{order.itemSummary}</strong><span>{order.amountLabel??'歷史價格未提供'}</span></div><div className="history-actions"><button onClick={()=>hideFromView(order.orderId)}>今次收起</button><ActionButton variant="secondary" disabled={!order.reorderEligible} onClick={()=>onReorder(order)}>{order.reorderEligible?'再次下單':'目前不可重建'}</ActionButton></div></article>)}</div>:<EmptyState compact title="今次檢視已經收起全部歷史" detail="正式訂單紀錄冇被刪除；可以復原最近一次操作。"><ActionButton variant="secondary" onClick={undoHide}>復原最近一項</ActionButton></EmptyState>}</>)}
  </section>;
}

function OrderCard({order,expanded,onToggle}:{order:CustomerOrderProjection;expanded:boolean;onToggle:()=>void}){
  const meta=stageMeta[order.stage];
  const handoverLabel={NOT_ARRIVED:'等待到店',ARRIVED:'已到店',VERIFIED:'已完成取餐核對',HANDED_OVER:'餐點已交收',UNKNOWN:'交收狀態確認中'}[order.handoverState??'UNKNOWN'];
  const pickupStage=order.stage==='READY'||order.stage==='PICKUP_VERIFICATION';
  const sequence:CustomerOrderStage[]=['RECEIVED','ACCEPTED','PREPARING','READY','HANDED_OVER','COMPLETED'];
  const effectiveStage=order.stage==='DELAYED'?'PREPARING':order.stage==='PICKUP_VERIFICATION'?'READY':order.stage;
  const currentIndex=sequence.indexOf(effectiveStage);
  return <article className={`order-status-card stage-${order.stage.toLowerCase()}`}>
    <div className="order-status-top"><span>{order.displayCode}</span><b>{order.readback==='CONFIRMED'?'店舖資料已確認':order.readback==='PARTIAL'?'部分資料更新中':'狀態確認中'}</b></div>
    <div className="order-status-copy"><span className="eyebrow">{meta.label}</span><AnimatedValue as="h2">{meta.title}</AnimatedValue><p>{order.rejectionReason??meta.detail}</p>{order.etaLabel?<div className="eta"><span>預計取餐</span><AnimatedValue>{order.etaLabel}</AnimatedValue></div>:null}</div>
    {order.stage!=='REJECTED'?<ol className="order-progress" aria-label="訂單進度">{sequence.map((stage,index)=><li key={stage} className={index<currentIndex?'done':index===currentIndex?'active':''}><i aria-hidden="true"/><span>{stageMeta[stage].label}</span></li>)}</ol>:null}
    {order.stage==='DELAYED'?<section className="delay-card" role="status"><span>稍有延誤</span><AnimatedValue as="strong">{order.etaLabel??'時間待更新'}</AnimatedValue><p>店舖仍然製作中，未到可取餐階段。</p></section>:null}
    {pickupStage?<section className="pickup-card"><i className="pickup-code-aura" aria-hidden="true"><b/><b/></i><span>向店員出示取餐碼</span><div className="pickup-code-lockup"><small>YOUR PICKUP CODE</small><AnimatedValue as="strong">{order.pickupCode??'等待店舖提供'}</AnimatedValue><em>{order.phoneMasked??'電話核對資料未提供'}</em></div><ol className="pickup-boundary" aria-label="取餐交收階段"><li className="done">可取餐</li><li className={order.handoverState==='ARRIVED'||order.handoverState==='VERIFIED'||order.handoverState==='HANDED_OVER'?'done':''}>已到店</li><li className={order.handoverState==='VERIFIED'||order.handoverState==='HANDED_OVER'?'done':''}>已核對</li><li className={order.handoverState==='HANDED_OVER'?'done':''}>已交收</li></ol><p>可取餐唔等於已到店、已核對、已交收或已完成。</p></section>:null}
    <ActionButton variant="secondary" wide aria-expanded={expanded} onClick={onToggle}>{expanded?'收起訂單詳情':'查看訂單詳情'}</ActionButton>
    {expanded?<section className="order-detail-card"><header><div><span>今次餐點</span><strong>{order.itemSummary}</strong></div>{order.amountLabel?<em>{order.amountLabel}</em>:null}</header><ol className="timeline">{order.timeline.map((item,index)=><li key={`${item.at}-${index}`} className={item.stage===order.stage?'active':''}><i aria-hidden="true"/><div><span>{item.label}</span>{item.detail?<p>{item.detail}</p>:null}</div><time dateTime={item.at}>{new Date(item.at).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ol><div className="detail-row"><span>取餐交收</span><strong>{handoverLabel}</strong></div></section>:null}
  </article>;
}

function memberState(connection:CustomerConnectionState,member?:CustomerMemberProjection):CustomerProjectionState{
  if(member)return member.state;
  if(connection==='LOADING')return 'LOADING';
  if(connection==='ERROR')return 'ERROR';
  if(connection==='STALE'||connection==='PARTIAL')return 'STALE';
  return 'NOT_CONNECTED';
}

function ProjectionState({state,title,detail,onRefresh}:{state:CustomerProjectionState;title:string;detail:string;onRefresh:()=>void}){
  if(state==='LOADING')return <section className="projection-state loading" aria-busy="true"><i/><div><strong>正在整理{title}</strong><p>正式資料到達前，畫面會保持原有結構。</p></div></section>;
  if(state==='READY')return null;
  const copy=state==='EMPTY'?`暫時未有${title}`:state==='ERROR'?`${title}暫時讀取唔到`:state==='STALE'?`${title}需要更新`:`${title}尚未連接`;
  return <section className={`projection-state state-${state.toLowerCase()}`} role={state==='ERROR'?'alert':'status'}><span>{copy}</span><p>{detail}</p>{state==='ERROR'||state==='STALE'?<ActionButton variant="secondary" onClick={onRefresh}>重新讀取</ActionButton>:<b>等待正式資料</b>}</section>;
}

function CouponCollection({state,coupons,onRefresh}:{state:CustomerProjectionState;coupons?:readonly CustomerMemoryCouponProjection[];onRefresh:()=>void}){
  const collectionState=state==='READY'?(coupons?.length?'READY':'EMPTY'):state;
  return <section className="member-module coupons-module"><SectionHeading eyebrow="回憶券" title="留畀下一次嘅小心意"/><ProjectionState state={collectionState} title="回憶券" detail="回憶券狀態同可用條件要由店舖正式會員資料提供；實際優惠會喺點餐時重新確認。" onRefresh={onRefresh}/>{collectionState==='READY'?<div className="coupon-list">{coupons?.map(coupon=><article key={coupon.couponId} className={`coupon state-${coupon.state.toLowerCase()}`}><i className="coupon-mark" aria-hidden="true"><b>MF</b><span/></i><div><span>{coupon.state==='AVAILABLE'?'可使用':coupon.state==='LOCKED'?'未解鎖':coupon.state==='USED'?'已使用':'已過期'}</span><strong>{coupon.name}</strong><p>{coupon.detail??'詳情由正式會員資料提供。'}</p></div><small>{coupon.expiryLabel??'有效期資料未提供'}</small></article>)}</div>:null}</section>;
}

function BadgeCollection({state,badges,onRefresh}:{state:CustomerProjectionState;badges?:readonly CustomerMemoryBadgeProjection[];onRefresh:()=>void}){
  const collectionState=state==='READY'?(badges?.length?'READY':'EMPTY'):state;
  return <section className="member-module badges-module"><SectionHeading eyebrow="記憶勳章" title="每一枚，都係真實回憶"/><ProjectionState state={collectionState} title="記憶勳章" detail="獲得、鎖定、進度同日期只會顯示店舖正式會員資料；畫面唔會自己頒發。" onRefresh={onRefresh}/>{collectionState==='READY'?<div className="badge-collection">{badges?.map(badge=><article key={badge.badgeId} className={badge.state==='EARNED'?'earned':'locked'}><i className="badge-medallion" aria-hidden="true"><b/><span>{badge.name.slice(0,1)}</span><em/></i><div><small>{badge.state==='EARNED'?'已獲得':'未解鎖'}</small><strong>{badge.name}</strong><p>{badge.detail??badge.progressLabel??'進度由正式會員資料提供。'}</p>{badge.earnedAt?<time dateTime={badge.earnedAt}>{new Date(badge.earnedAt).toLocaleDateString('zh-HK')}</time>:null}</div></article>)}</div>:null}</section>;
}

export function MemberView({connection,snapshot,history,pendingIntents,readingIntentId,onRefresh,onReadback,onDiscard,onFallback,onReorder,onBrowse}:{connection:CustomerConnectionState;snapshot:CustomerReadModelSnapshot|null;history:readonly CustomerHistoryProjection[];pendingIntents:readonly CustomerPendingIntent[];readingIntentId:string|null;onRefresh:()=>void;onReadback:(intent:CustomerPendingIntent)=>void;onDiscard:(id:string)=>void;onFallback:()=>void;onReorder:(order:CustomerHistoryProjection)=>void;onBrowse:()=>void;}){
  const member=snapshot?.member;
  const state=memberState(connection,member);
  const seedsState=state==='READY'?(member?.seeds?.state??'EMPTY'):state;
  const lastOrder=history[0];
  return <section className="page member-page">
    <section className="member-hero"><div><span>我的記憶</span><h1>{member?.state==='READY'&&member.displayName?`${member.displayName}，歡迎返嚟。`:'你嘅記憶，只來自真實相遇。'}</h1><p>{member?.state==='READY'?(member.memberLabel??member.lastVisitLabel??'會員資料已連接'):'店舖未提供正式會員資料前，我哋唔會顯示假積分、假等級或假獎賞。'}</p></div><i className="member-orbit" aria-hidden="true"><b/><b/><b/></i><span className={`member-connection state-${state.toLowerCase()}`}>{state==='READY'?'資料已連接':state==='LOADING'?'同步中':'會員資料未連接'}</span></section>

    <section className="member-module seeds-module"><SectionHeading eyebrow="記憶種子" title="每次返嚟，都有段關係"/><ProjectionState state={seedsState} title="記憶種子" detail="種子數量、進度、下一個小心意同歷史必須由店舖正式會員資料提供。" onRefresh={onRefresh}/>{seedsState==='READY'?<div className="seed-dashboard"><div className="seed-value"><i className="seed-constellation" aria-hidden="true"><b/><b/><b/></i><span>目前記憶種子</span><AnimatedValue as="strong">{member?.seeds?.valueLabel??'—'}</AnimatedValue><small>{member?.seeds?.progressLabel??'進度資料未提供'}</small></div><div className="next-care"><span>下一個小心意</span><strong>{member?.seeds?.nextBenefitLabel??'由店舖會員資料提供'}</strong><p>畫面唔會用固定種子數推算獎賞。</p></div>{member?.seeds?.history?.length?<ol className="seed-history">{member.seeds.history.map(item=><li key={`${item.occurredAt}-${item.label}`}><i/><span>{item.label}</span><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleDateString('zh-HK')}</time></li>)}</ol>:null}</div>:null}</section>

    <CouponCollection state={state} coupons={member?.coupons} onRefresh={onRefresh}/>
    <BadgeCollection state={state} badges={member?.badges} onRefresh={onRefresh}/>

    <section className="member-module tastes-module"><SectionHeading eyebrow="我哋記得你" title="常食味道同口味習慣"/><ProjectionState state={state} title="口味習慣" detail="會員偏好、今次取餐聯絡同推廣同意係分開資料；訂單表格唔會覆寫會員身份。" onRefresh={onRefresh}/>{state==='READY'?<><div className="taste-cloud">{member?.preferences?.length?member.preferences.map(item=><span key={item}>{item}</span>):<p>暫時未有已確認口味偏好。</p>}</div>{member?.frequentTasteLabels?.length?<div className="frequent-tastes"><span>常食味道</span>{member.frequentTasteLabels.map(item=><b key={item}>{item}</b>)}</div>:null}</>:null}</section>

    {lastOrder?<section className="member-module recent-memory"><SectionHeading eyebrow="最近一次返嚟" title="想唔想再食一次？"/><article><div><small>{new Date(lastOrder.completedAt).toLocaleDateString('zh-HK')}</small><strong>{lastOrder.itemSummary}</strong><span>{lastOrder.amountLabel??'歷史價格未提供'}</span></div><ActionButton variant="secondary" disabled={!lastOrder.reorderEligible} onClick={()=>onReorder(lastOrder)}>按目前菜單重建</ActionButton></article></section>:<section className="member-module recent-memory"><EmptyState compact title="最近回憶仲係空嘅" detail="完成第一張訂單後，就可以喺呢度再次點餐。"><ActionButton onClick={onBrowse}>開始第一餐</ActionButton></EmptyState></section>}

    <section className="member-module recovery-module"><SectionHeading eyebrow="安全恢復" title="等待確認嘅落單" action={<b>{pendingIntents.length}</b>}/>{pendingIntents.length?<div className="pending-list">{pendingIntents.map(intent=>{const copy=intent.state==='UNKNOWN'?'結果仍在確認':intent.state==='PENDING'?'店舖確認中':intent.state==='NOT_CONNECTED'?'尚未連接店舖':'已保存落單草稿';return <article className={`pending-card state-${intent.state.toLowerCase()}`} key={intent.submissionId}><div><span>{copy}</span><p>{intent.lastMessage??'落單資料已安全保留喺本機。'}</p><small>建立於 {new Date(intent.createdAt).toLocaleString('zh-HK')}</small></div><div className="pending-actions"><button onClick={()=>onDiscard(intent.submissionId)}>刪除草稿</button><ActionButton variant="secondary" loading={readingIntentId===intent.submissionId} onClick={()=>onReadback(intent)}>重新確認</ActionButton></div></article>})}</div>:<p className="quiet-state">冇等待確認嘅落單。需要時，本機草稿會喺呢度等你處理。</p>}</section>

    <section className="care-card"><span>MORE FUN CARE</span><h2>{member?.careMessage??'需要我哋補返一點心意？'}</h2><p>由你主動開啟支援；系統唔會自動轉送記憶罐、會員或個人資料。</p><ActionButton variant="secondary" wide onClick={onFallback}>聯絡 More Fun Care</ActionButton></section>
  </section>;
}

type ProductStep={kind:'variation';label:string}|{kind:'group';label:string;groupIndex:number}|{kind:'finish';label:string};

export function ProductSheet({product,selections,selectedVariationId,quantity,note,currentStep,editing,setStep,setVariation,setQuantity,setNote,toggle,origin,onClose,onAdd}:{
  product:CustomerProduct;selections:CustomerSelectionState;selectedVariationId:string|null;quantity:number;note:string;currentStep:number;editing:boolean;setStep:(step:number)=>void;setVariation:(id:string)=>void;setQuantity:(quantity:number)=>void;setNote:(note:string)=>void;toggle:(groupId:string,optionId:string)=>void;origin:ProductOriginRect|null;onClose:()=>void;onAdd:()=>void;
}){
  const steps:ProductStep[]=[...(product.variations?.length?[{kind:'variation' as const,label:'規格'}]:[]),...product.optionGroups.map((group,groupIndex)=>({kind:'group' as const,label:group.name,groupIndex})),{kind:'finish' as const,label:'數量與備註'}];
  const safeStep=Math.min(currentStep,steps.length-1);
  const step=steps[safeStep];
  const variationOk=!product.variationRequired||Boolean(selectedVariationId);
  const validation=validateCustomerSelections(product,selections);
  const stepComplete=(candidate:ProductStep)=>{
    if(candidate.kind==='variation')return variationOk;
    if(candidate.kind==='finish')return quantity>0;
    const group=product.optionGroups[candidate.groupIndex];
    const count=(selections[group.optionGroupId]??[]).length;
    return count>=Math.max(group.required?1:0,group.minSelections)&&count<=group.maxSelections;
  };
  const currentComplete=stepComplete(step);
  const summary=(candidate:ProductStep)=>{
    if(candidate.kind==='variation')return product.variations?.find(item=>item.variationId===selectedVariationId)?.name??'未選';
    if(candidate.kind==='finish')return `${quantity} 件${note?' · 有備註':''}`;
    const group=product.optionGroups[candidate.groupIndex];
    const names=group.options.filter(item=>(selections[group.optionGroupId]??[]).includes(item.optionId)).map(item=>item.name);
    return names.length?names.join('、'):'不需要';
  };
  const advance=()=>{if(currentComplete)setStep(Math.min(steps.length-1,safeStep+1))};
  return <ProductDialog label={`${product.name} 商品詳情`} origin={origin} returnFocusId={product.productId} onClose={onClose}>
    <div className="product-sheet-hero"><ProductMedia product={product}/><div className="product-sheet-copy"><span>{product.badge??'逐步設定'}</span><h2>{product.name}</h2><p>{product.description}</p><AnimatedValue as="strong">{product.displayPriceLabel??'價格待店舖提供'}</AnimatedValue></div></div>
    <JourneyCoach active={2}/>
    <section className={`step-coach ${currentComplete?'is-ready':''}`} aria-live="polite"><span>第 {safeStep+1} 步</span><strong>{step.label}</strong><p>{currentComplete?(step.kind==='finish'?'設定完成，可以加入記憶罐。':'呢一步完成，可以繼續。'):'完成目前必選項目後，會帶你去下一步。'}</p></section>
    <div className="config-progress"><div><span>設定進度</span><strong>{safeStep+1} / {steps.length}</strong></div><i><b style={{transform:`scaleX(${(safeStep+1)/steps.length})`}}/></i></div>
    <ol className="config-step-list" aria-label="商品設定步驟">{steps.map((candidate,index)=><li key={`${candidate.kind}-${candidate.label}`} className={index===safeStep?'active':index<safeStep&&stepComplete(candidate)?'done':''}><button disabled={index>safeStep} aria-current={index===safeStep?'step':undefined} onClick={()=>setStep(index)}><i>{index<safeStep&&stepComplete(candidate)?'✓':index+1}</i><span><small>{index===safeStep?'目前步驟':index<safeStep?'已完成':'稍後'}</small><strong>{candidate.label}</strong>{index<safeStep?<em>{summary(candidate)}</em>:null}</span></button></li>)}</ol>
    <div className="product-config-stage" key={safeStep}>
      {step.kind==='variation'?<fieldset className="choice-group"><legend><span>揀一個規格</span><small>{product.variationRequired?'必選':'可選'}</small></legend><div className="choice-grid">{product.variations?.map(item=><button type="button" key={item.variationId} disabled={!item.available} aria-pressed={selectedVariationId===item.variationId} className={selectedVariationId===item.variationId?'active':''} onClick={()=>{setVariation(item.variationId);setStep(Math.min(steps.length-1,safeStep+1))}}><span>{item.name}</span>{!item.available?<small>暫不可選</small>:selectedVariationId===item.variationId?<small>已選</small>:null}</button>)}</div>{product.variationRequired&&!variationOk?<p className="choice-error">請揀一個規格先繼續</p>:null}</fieldset>:null}
      {step.kind==='group'?(()=>{const group=product.optionGroups[step.groupIndex];const selected=selections[group.optionGroupId]??[];const minimum=Math.max(group.required?1:0,group.minSelections);return <fieldset className="choice-group"><legend><span>{group.name}</span><small>{minimum?`最少 ${minimum}`:'可選'} · 最多 {group.maxSelections}</small></legend><p className="selection-count">已選 {selected.length} 項</p><div className="choice-grid">{group.options.map(option=>{const isSelected=selected.includes(option.optionId);return <button type="button" key={option.optionId} disabled={!option.available} aria-pressed={isSelected} className={isSelected?'active':''} onClick={()=>{toggle(group.optionGroupId,option.optionId);if(!isSelected&&group.maxSelections===1&&minimum===1)setStep(Math.min(steps.length-1,safeStep+1))}}><span>{option.name}</span>{!option.available?<small>暫不可選</small>:isSelected?<small>已選</small>:null}</button>})}</div>{selected.length<minimum?<p className="choice-error">仲要揀 {minimum-selected.length} 項</p>:null}</fieldset>})():null}
      {step.kind==='finish'?<section className="finish-step"><div><span>今次數量</span><QuantityStepper label={product.name} quantity={quantity} min={1} onChange={setQuantity}/></div><label htmlFor="product-note"><span>今次備註 <small>選填</small></span><textarea id="product-note" value={note} onChange={event=>setNote(event.target.value)} maxLength={120} placeholder="例如：醬汁分開。請勿填寫敏感個人資料。"/><small>{note.length} / 120</small></label><section className="selection-summary"><span>目前選擇</span><p>{[product.variations?.find(item=>item.variationId===selectedVariationId)?.name,...product.optionGroups.flatMap(group=>group.options.filter(option=>(selections[group.optionGroupId]??[]).includes(option.optionId)).map(option=>option.name))].filter(Boolean).join(' · ')||'原味設定'}</p></section></section>:null}
    </div>
    <div className="sheet-actions">{safeStep>0?<ActionButton variant="ghost" onClick={()=>setStep(safeStep-1)}>上一步</ActionButton>:<ActionButton variant="ghost" onClick={onClose}>稍後再揀</ActionButton>}{step.kind==='finish'?<ActionButton wide disabled={!validation.ok||!variationOk||quantity<1} onClick={onAdd}>{editing?'更新記憶罐':'加入記憶罐'}</ActionButton>:<ActionButton wide disabled={!currentComplete} onClick={advance}>{currentComplete?'下一步':'完成必選項目'}</ActionButton>}</div>
  </ProductDialog>;
}
