import {useEffect,useMemo,useState} from 'react';
import {readSmmLocalWorkspace,writeSmmLocalWorkspace,createSmmPendingIntent,type SmmLocalPreferences} from './persistence';
import {resolveSmmRuntimePort} from './runtime';
import {createSmmQrHandoff,renderSmmQrHandoff} from './qr-handoff';
import {selectedSmmCartOptions,toggleSmmSelection,validateSmmSelections,type SmmSelectionState} from './selection';
import type {
  SmmCartLine,
  SmmConnectionState,
  SmmOrderProjection,
  SmmPendingIntent,
  SmmProduct,
  SmmQuoteSnapshot,
  SmmReadModelSnapshot,
  SmmRuntimePort,
} from './product-types';

type View='order'|'work'|'orders'|'dine'|'more';
type OrderSegment='active'|'history';

const nowIso=()=>new Date().toISOString();
const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);

export function App(){
  const initial=useMemo(()=>readSmmLocalWorkspace(),[]);
  const [view,setView]=useState<View>(initial.preferences.activeView);
  const [activeCategoryId,setActiveCategoryId]=useState<string|null>(initial.preferences.activeCategoryId);
  const [sourceFilter,setSourceFilter]=useState(initial.preferences.sourceFilter);
  const [cart,setCart]=useState<readonly SmmCartLine[]>(initial.cart);
  const [pendingIntents,setPendingIntents]=useState<readonly SmmPendingIntent[]>(initial.pendingIntents);
  const [port]=useState<SmmRuntimePort|null>(()=>resolveSmmRuntimePort());
  const [connection,setConnection]=useState<SmmConnectionState>(port?'LOADING':'NOT_CONNECTED');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [quote,setQuote]=useState<SmmQuoteSnapshot|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [selectedProduct,setSelectedProduct]=useState<SmmProduct|null>(null);
  const [selections,setSelections]=useState<SmmSelectionState>({});
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [cartOpen,setCartOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [orderSearch,setOrderSearch]=useState('');
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('active');
  const [moreTool,setMoreTool]=useState<'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null>(null);
  const [dineTable,setDineTable]=useState('');
  const [dineCovers,setDineCovers]=useState(2);

  const persist=(next:{
    cart?:readonly SmmCartLine[];
    pendingIntents?:readonly SmmPendingIntent[];
    preferences?:SmmLocalPreferences;
  })=>{
    writeSmmLocalWorkspace({
      cart:next.cart??cart,
      pendingIntents:next.pendingIntents??pendingIntents,
      preferences:next.preferences??{activeView:view,activeCategoryId,sourceFilter},
    });
  };

  const changeView=(next:View)=>{
    setView(next);
    persist({preferences:{activeView:next,activeCategoryId,sourceFilter}});
  };

  const changeCategory=(next:string|null)=>{
    setActiveCategoryId(next);
    persist({preferences:{activeView:view,activeCategoryId:next,sourceFilter}});
  };

  const changeSource=(next:string)=>{
    setSourceFilter(next);
    persist({preferences:{activeView:view,activeCategoryId,sourceFilter:next}});
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
      setError(reason instanceof Error?reason.message:'暫時未能讀取門店資料');
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
  const effectiveCategoryId=activeCategoryId&&categories.some(c=>c.categoryId===activeCategoryId)
    ?activeCategoryId
    :(categories[0]?.categoryId??null);
  const visibleProducts=(menu?.products??[]).filter(product=>{
    const categoryOk=!effectiveCategoryId||product.categoryId===effectiveCategoryId;
    const query=search.trim().toLowerCase();
    const searchOk=!query||[product.name,product.description??''].join(' ').toLowerCase().includes(query);
    return categoryOk&&searchOk;
  });

  const addSelectedProduct=()=>{
    if(!selectedProduct)return;
    const validation=validateSmmSelections(selectedProduct,selections);
    if(!validation.ok){
      setNotice(validation.issues[0]??'請完成商品設定');
      return;
    }
    if(selectedProduct.variationRequired&&!selectedVariationId){
      setNotice('請先選擇必選規格');
      return;
    }
    const variation=selectedProduct.variations?.find(item=>item.variationId===selectedVariationId);
    const line:SmmCartLine=Object.freeze({
      lineId:crypto.randomUUID(),
      productId:selectedProduct.productId,
      productName:selectedProduct.name,
      quantity:1,
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:{}),
      selections:selectedSmmCartOptions(selectedProduct,selections),
      createdAt:nowIso(),
    });
    const next=[...cart,line];
    setCart(next);
    persist({cart:next});
    setSelectedProduct(null);
    setSelections({});
    setSelectedVariationId(null);
    setNotice('已加入本機購物草稿；未提交正式訂單。');
  };

  const updateCart=(next:readonly SmmCartLine[])=>{
    setCart(next);
    persist({cart:next});
  };

  const saveIntent=(intent:SmmPendingIntent)=>{
    const next=[intent,...pendingIntents.filter(item=>item.submissionId!==intent.submissionId)].slice(0,20);
    setPendingIntents(next);
    persist({pendingIntents:next});
  };

  const removeIntent=(submissionId:string)=>{
    const next=pendingIntents.filter(item=>item.submissionId!==submissionId);
    setPendingIntents(next);
    persist({pendingIntents:next});
  };

  const resolveConfirmedIntent=(intent:SmmPendingIntent,message:string)=>{
    removeIntent(intent.submissionId);
    setCart([]);
    persist({cart:[],pendingIntents:pendingIntents.filter(item=>item.submissionId!==intent.submissionId)});
    setCartOpen(false);
    setNotice(message);
    void refresh();
  };

  const submitCart=async()=>{
    if(cart.length===0)return;
    const existing=pendingIntents.find(item=>item.state==='DRAFT'||item.state==='NOT_CONNECTED'||item.state==='UNKNOWN');
    const base=existing??createSmmPendingIntent(cart);
    if(!port?.submitOrder){
      const next={...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'門店提交服務尚未連接；草稿已保存。'};
      saveIntent(Object.freeze(next));
      setNotice('已保存本機待提交草稿；未建立正式訂單。');
      return;
    }
    const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'等待門店確認'});
    saveIntent(pending);
    try{
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED'){
        resolveConfirmedIntent(pending,result.message||'門店已確認訂單');
        return;
      }
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...pending,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.state==='UNKNOWN'?'結果未明；系統保留同一提交身份，唔會自動重送。':result.message);
    }catch{
      saveIntent(Object.freeze({...pending,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'提交結果未明'}));
      setNotice('提交結果未明；已保留同一提交身份，請先重新確認。');
    }
  };

  const readbackIntent=async(intent:SmmPendingIntent)=>{
    if(!port?.readSubmission){
      saveIntent(Object.freeze({...intent,state:'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:'門店查詢服務尚未連接'}));
      setNotice('門店查詢服務尚未連接；冇重新送出任何交易。');
      return;
    }
    try{
      const result=await port.readSubmission(intent.submissionId);
      if(result.state==='CONFIRMED'){
        resolveConfirmedIntent(intent,result.message||'門店已確認訂單');
        return;
      }
      const state=result.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED';
      saveIntent(Object.freeze({...intent,state,updatedAt:nowIso(),lastMessage:result.message}));
      setNotice(result.message);
    }catch{
      saveIntent(Object.freeze({...intent,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'讀回結果未明'}));
      setNotice('讀回結果未明；未有重新提交。');
    }
  };

  const localDraftCount=pendingIntents.length;
  const connectionLabel=connection==='READY'?'門店已連接':connection==='LOADING'?'同步中':connection==='ERROR'?'同步失敗':'門店服務未連接';

  return <main className="app-shell" data-mode={connection==='READY'?'online':'offline'}>
    <header className="topbar">
      <div className="brand-mark">磨</div>
      <div className="brand-copy"><strong>磨飯流動店務</strong><span>{snapshot?.staff?.displayName??'店員模式'} · {snapshot?.staff?.storeId??'未連接門店'}</span></div>
      <button className="state-pill" onClick={()=>void refresh()} aria-label="重新同步門店資料"><i/>{connectionLabel}</button>
    </header>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    {error?<section className="recovery-banner degraded"><strong>門店資料同步失敗</strong><span>{error}</span><button onClick={()=>void refresh()}>再試一次</button></section>:null}
    {connection==='NOT_CONNECTED'?<section className="recovery-banner offline"><strong>尚未連接門店服務</strong><span>本機草稿同操作偏好可以使用；正式餐單、報價、訂單同營運狀態會保持空白，唔會顯示假資料。</span></section>:null}

    <section className="stage">
      {view==='order'?<OrderView
        connection={connection}
        categories={categories}
        activeCategoryId={effectiveCategoryId}
        setCategory={changeCategory}
        search={search}
        setSearch={setSearch}
        products={visibleProducts}
        cart={cart}
        quote={quote}
        onProduct={product=>{setSelectedProduct(product);setSelections({});setSelectedVariationId(null)}}
        onCart={()=>setCartOpen(true)}
      />:null}
      {view==='work'?<WorkView connection={connection} items={snapshot?.work??[]} onRefresh={()=>void refresh()}/>:null}
      {view==='orders'?<OrdersView
        connection={connection}
        rows={snapshot?.orders??[]}
        segment={orderSegment}
        setSegment={setOrderSegment}
        query={orderSearch}
        setQuery={setOrderSearch}
        sourceFilter={sourceFilter}
        setSourceFilter={changeSource}
      />:null}
      {view==='dine'?<DineView
        connection={connection}
        sessions={snapshot?.dineSessions??[]}
        table={dineTable}
        covers={dineCovers}
        setTable={setDineTable}
        setCovers={setDineCovers}
        onCreate={async()=>{
          if(!port?.createDineSession){setNotice('堂食服務尚未連接；未建立正式桌面。');return}
          const result=await port.createDineSession({tableLabel:dineTable,covers:dineCovers,operationId:crypto.randomUUID()});
          setNotice(result.message);
          if(result.state==='CONFIRMED'){setDineTable('');void refresh()}
        }}
      />:null}
      {view==='more'?<MoreView
        connection={connection}
        tool={moreTool}
        setTool={setMoreTool}
        snapshot={snapshot}
        pendingIntents={pendingIntents}
        onReadback={intent=>void readbackIntent(intent)}
        onDiscard={removeIntent}
        onSellability={async(productId,available)=>{
          if(!port?.setSellability){setNotice('商品供應控制尚未連接；冇更改任何正式狀態。');return}
          const result=await port.setSellability({productId,available,operationId:crypto.randomUUID()});
          setNotice(result.message);
          if(result.state==='CONFIRMED')void refresh();
        }}
      />:null}
    </section>

    <nav className="bottom-nav" aria-label="主要功能">
      <NavButton active={view==='order'} label="點單" glyph="＋" onClick={()=>changeView('order')}/>
      <NavButton active={view==='work'} label="待處理" glyph="◎" badge={snapshot?.work.filter(item=>item.state!=='NORMAL').length?String(snapshot.work.filter(item=>item.state!=='NORMAL').length):undefined} onClick={()=>changeView('work')}/>
      <NavButton active={view==='orders'} label="訂單" glyph="▤" onClick={()=>changeView('orders')}/>
      <NavButton active={view==='dine'} label="堂食" glyph="⌂" onClick={()=>changeView('dine')}/>
      <NavButton active={view==='more'} label="更多" glyph="•••" badge={localDraftCount?String(localDraftCount):undefined} onClick={()=>changeView('more')}/>
    </nav>

    {selectedProduct?<ProductSheet
      product={selectedProduct}
      selections={selections}
      selectedVariationId={selectedVariationId}
      setVariation={setSelectedVariationId}
      toggle={(groupId,optionId)=>{
        const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
        if(group)setSelections(current=>toggleSmmSelection(current,group,optionId));
      }}
      onClose={()=>setSelectedProduct(null)}
      onAdd={addSelectedProduct}
    />:null}

    {cartOpen?<CartSheet
      cart={cart}
      quote={quote}
      pending={pendingIntents[0]??null}
      onClose={()=>setCartOpen(false)}
      onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))}
      onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))}
      onSubmit={()=>void submitCart()}
      onReadback={intent=>void readbackIntent(intent)}
    />:null}
  </main>;
}

function OrderView({connection,categories,activeCategoryId,setCategory,search,setSearch,products,cart,quote,onProduct,onCart}:{
  connection:SmmConnectionState;
  categories:readonly {categoryId:string;name:string}[];
  activeCategoryId:string|null;
  setCategory:(v:string|null)=>void;
  search:string;
  setSearch:(v:string)=>void;
  products:readonly SmmProduct[];
  cart:readonly SmmCartLine[];
  quote:SmmQuoteSnapshot|null;
  onProduct:(p:SmmProduct)=>void;
  onCart:()=>void;
}){
  const count=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <section className="page order-page">
    <header className="hero compact"><div><span>點單</span><h1>快速點餐</h1><small>商品、報價同正式訂單只會使用門店提供嘅權威資料。</small></div>{connection==='READY'?<b className="tag">已同步</b>:null}</header>
    <label className="search"><span>搜尋商品</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="輸入商品名稱"/></label>
    {categories.length?<div className="category-rail">{categories.map(item=><button key={item.categoryId} className={activeCategoryId===item.categoryId?'active':''} onClick={()=>setCategory(item.categoryId)}>{item.name}</button>)}</div>:null}
    {connection==='LOADING'?<EmptyState title="正在同步餐單" detail="請稍候。"/>:
      !categories.length?<EmptyState title={connection==='NOT_CONNECTED'?'餐單服務尚未連接':'暫時未有餐單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式分類、商品、規格同供應狀態。':'目前門店資料未提供任何可售商品。'}/>:
      products.length?<div className="product-grid">{products.map(product=><button key={product.productId} className={`product-card ${product.available?'':'disabled'}`} disabled={!product.available} onClick={()=>onProduct(product)}><span className="product-avatar">{product.name.slice(0,1)}</span><strong>{product.name}</strong><small>{product.available?'可供應':'暫停供應'}</small><i>{product.optionGroups.length||product.variations?.length?'可設定':''}</i></button>)}</div>:
      <EmptyState title="搵唔到商品" detail="清除搜尋或者切換其他分類。"><button className="primary" onClick={()=>setSearch('')}>清除搜尋</button></EmptyState>}
    {count>0?<button className="cart-bar" onClick={onCart}><div><b>{count}</b><span>購物草稿</span></div><div><strong>{quote?money(quote.currency,quote.totalMinor):'等待門店報價'}</strong><small>{quote?`報價版本 ${quote.revision}`:'本機唔會自行計價'}</small></div><em>查看</em></button>:null}
  </section>;
}

function WorkView({connection,items,onRefresh}:{connection:SmmConnectionState;items:NonNullable<SmmReadModelSnapshot['work']>;onRefresh:()=>void}){
  return <section className="page">
    <header className="hero"><div><span>待處理</span><h1>前線工作</h1><small>延誤、異常同需要跟進嘅項目會集中喺呢度。</small></div><div className="hero-count"><b>{items.length}</b><small>項</small></div></header>
    {!items.length?<EmptyState title={connection==='NOT_CONNECTED'?'待處理服務尚未連接':'暫時冇待處理項目'} detail={connection==='NOT_CONNECTED'?'連接後先顯示正式製作、延誤同異常資料。':'目前冇需要前線處理嘅事項。'}><button className="primary" onClick={onRefresh}>重新整理</button></EmptyState>:
    <div className="cards">{items.map(item=><article className={`work-card ${item.state==='DELAYED'||item.state==='ACTION_REQUIRED'?'alert':''}`} key={item.workId}><div className="work-main"><div className="eyebrow"><span>{new Date(item.observedAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</span><b>{item.displayCode??item.kind}</b></div><h2>{item.summary}</h2>{item.eta?<p>預計：{item.eta}</p>:null}</div><div className="work-side"><span className={`status ${item.state==='UNKNOWN'?'unknown':item.state==='NORMAL'?'positive':'critical'}`}>{labelWorkState(item.state)}</span></div></article>)}</div>}
  </section>;
}

function OrdersView({connection,rows,segment,setSegment,query,setQuery,sourceFilter,setSourceFilter}:{
  connection:SmmConnectionState;
  rows:readonly SmmOrderProjection[];
  segment:OrderSegment;
  setSegment:(v:OrderSegment)=>void;
  query:string;
  setQuery:(v:string)=>void;
  sourceFilter:string;
  setSourceFilter:(v:string)=>void;
}){
  const sources=['全部',...Array.from(new Set(rows.map(row=>row.source)))];
  const filtered=rows.filter(row=>{
    const history=row.lifecycle==='COMPLETED'||row.lifecycle==='CANCELLED';
    const segmentOk=segment==='history'?history:!history;
    const searchOk=!query.trim()||[row.displayCode,row.source,row.lifecycle,row.itemSummary].join(' ').toLowerCase().includes(query.toLowerCase());
    const sourceOk=sourceFilter==='全部'||row.source===sourceFilter;
    return segmentOk&&searchOk&&sourceOk;
  });
  return <section className="page">
    <header className="hero"><div><span>訂單</span><h1>訂單記錄</h1><small>未能確認嘅結果會保留「結果未明」，唔會當失敗。</small></div><div className="hero-count"><b>{filtered.length}</b><small>張</small></div></header>
    <div className="segmented"><button className={segment==='active'?'active':''} onClick={()=>setSegment('active')}>進行中</button><button className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>歷史</button></div>
    <label className="search"><span>搜尋</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="訂單號／來源／商品"/></label>
    {sources.length>1?<div className="source-filter">{sources.map(source=><button key={source} className={sourceFilter===source?'active':''} onClick={()=>setSourceFilter(source)}>{source}</button>)}</div>:null}
    {!filtered.length?<EmptyState title={connection==='NOT_CONNECTED'?'訂單服務尚未連接':'暫時冇符合條件嘅訂單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式訂單、來源、狀態同時間線。':'可以改用其他搜尋字或者來源篩選。'}/>:
    <div className="cards">{filtered.map(row=><article className="order-card" key={row.orderId}><div className="order-head"><div><small>{row.source} · {new Date(row.observedAt).toLocaleString('zh-HK')}</small><h2>{row.displayCode}</h2></div><span className={`status ${row.readback==='UNKNOWN'?'unknown':row.readback==='PARTIAL'?'warning':'positive'}`}>{row.readback==='CONFIRMED'?'已確認':row.readback==='PARTIAL'?'部分資料':'結果未明'}</span></div><div className="order-meta"><span>{row.lifecycle}</span>{row.amountLabel?<b>{row.amountLabel}</b>:null}<span>{row.itemSummary}</span></div>{row.note?<p>備註：{row.note}</p>:null}<div className="timeline">{row.timeline.map((item,index)=><div key={index}><b>{item.label}</b><span>{item.detail??''}</span><small>{new Date(item.at).toLocaleTimeString('zh-HK')}</small></div>)}</div></article>)}</div>}
  </section>;
}

function DineView({connection,sessions,table,covers,setTable,setCovers,onCreate}:{
  connection:SmmConnectionState;
  sessions:NonNullable<SmmReadModelSnapshot['dineSessions']>;
  table:string;
  covers:number;
  setTable:(v:string)=>void;
  setCovers:(v:number)=>void;
  onCreate:()=>void;
}){
  return <section className="page">
    <header className="hero"><div><span>堂食</span><h1>桌面管理</h1><small>正式開枱必須由門店服務確認；本機唔會自行建立桌面真相。</small></div></header>
    <article className="panel"><h2>開新桌</h2><div className="field-grid"><label>枱號<input value={table} onChange={e=>setTable(e.target.value)} placeholder="例如 A1"/></label><label>人數<input type="number" min={1} max={30} value={covers} onChange={e=>setCovers(Math.max(1,Number(e.target.value)||1))}/></label></div><button className="primary" disabled={connection!=='READY'||!table.trim()} onClick={onCreate}>{connection==='READY'?'建立桌面':'門店服務未連接'}</button></article>
    {!sessions.length?<EmptyState title={connection==='NOT_CONNECTED'?'堂食服務尚未連接':'目前冇開啟中桌面'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式桌面、客數同狀態。':'可以喺上面建立新桌面。'}/>:
    <div className="cards">{sessions.map(session=><article className="dine-card" key={session.sessionId}><div><small>{new Date(session.openedAt).toLocaleTimeString('zh-HK')}</small><h2>{session.tableLabel}</h2><span>{session.covers} 位 · {session.state}</span></div></article>)}</div>}
  </section>;
}

function MoreView({connection,tool,setTool,snapshot,pendingIntents,onReadback,onDiscard,onSellability}:{
  connection:SmmConnectionState;
  tool:'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null;
  setTool:(v:'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null)=>void;
  snapshot:SmmReadModelSnapshot|null;
  pendingIntents:readonly SmmPendingIntent[];
  onReadback:(intent:SmmPendingIntent)=>void;
  onDiscard:(submissionId:string)=>void;
  onSellability:(productId:string,available:boolean)=>void;
}){
  return <section className="page">
    <header className="hero"><div><span>更多</span><h1>店務工具</h1><small>只顯示已知資料；未連接嘅功能會保持未連接。</small></div></header>
    <div className="tool-grid">
      <Tool title="待提交草稿" detail={`${pendingIntents.length} 個本機草稿`} state={pendingIntents.length?'需處理':'正常'} onClick={()=>setTool('pending')}/>
      <Tool title="平台狀態" detail="平台連線同資料新鮮度" state={snapshot?.channels.length?String(snapshot.channels.length):'未連接'} onClick={()=>setTool('channels')}/>
      <Tool title="商品供應" detail="售罄／恢復操作入口" state={connection==='READY'?'可用':'未連接'} onClick={()=>setTool('sellability')}/>
      <Tool title="營業日" detail="只作記錄同報表分類" state={snapshot?.businessDay?.businessDate??'未連接'} onClick={()=>setTool('business')}/>
      <Tool title="產能" detail="只讀門店產能狀態" state={snapshot?.capacity?.state??'未連接'} onClick={()=>setTool('capacity')}/>
      <Tool title="營運報表" detail="當日訂單／營業額／平均單" state={snapshot?.reporting?.freshness??'未連接'} onClick={()=>setTool('reporting')}/>
      <Tool title="退款要求" detail="只讀退款／售後跟進" state={snapshot?.refundRequests.length?String(snapshot.refundRequests.length):'未連接'} onClick={()=>setTool('refunds')}/>
      <Tool title="列印狀態" detail="只讀設備健康" state={snapshot?.printHealth.length?String(snapshot.printHealth.length):'未連接'} onClick={()=>setTool('printing')}/>
      <Tool title="診斷" detail="連線、資料版本、本機草稿" state={connectionLabelShort(connection)} onClick={()=>setTool('diagnostics')}/>
    </div>
    {tool?<div className="drawer"><div className="drawer-head"><strong>{moreTitle(tool)}</strong><button onClick={()=>setTool(null)}>關閉</button></div>
      {tool==='pending'?<PendingIntents intents={pendingIntents} onReadback={onReadback} onDiscard={onDiscard}/>:
       tool==='channels'?<ChannelList connection={connection} channels={snapshot?.channels??[]}/>:
       tool==='business'?<BusinessDay projection={snapshot?.businessDay}/>:
       tool==='capacity'?<Capacity projection={snapshot?.capacity}/>:
       tool==='reporting'?<Reporting projection={snapshot?.reporting}/>:
       tool==='refunds'?<RefundRequests connection={connection} rows={snapshot?.refundRequests??[]}/>:
       tool==='printing'?<PrintHealth connection={connection} rows={snapshot?.printHealth??[]}/>:
       tool==='sellability'?<Sellability connection={connection} products={snapshot?.menu?.products??[]} onChange={onSellability}/>:
       <Diagnostics connection={connection} snapshot={snapshot} pendingCount={pendingIntents.length}/>}
    </div>:null}
  </section>;
}

function PendingIntents({intents,onReadback,onDiscard}:{intents:readonly SmmPendingIntent[];onReadback:(i:SmmPendingIntent)=>void;onDiscard:(id:string)=>void}){
  if(!intents.length)return <EmptyState title="冇待提交草稿" detail="所有本機草稿都已清理。"/>;
  return <>{intents.map(intent=><div className="list-row" key={intent.submissionId}><div><strong>{intent.state==='UNKNOWN'?'結果未明':intent.state==='NOT_CONNECTED'?'未連接':'待提交'}</strong><small>{intent.cart.length} 項 · {intent.submissionId}</small><small>{intent.lastMessage??'本機草稿，未代表正式訂單'}</small></div><div className="row-actions"><button onClick={()=>onReadback(intent)}>重新確認</button><button className="danger" onClick={()=>onDiscard(intent.submissionId)}>刪除草稿</button></div></div>)}</>;
}

function ChannelList({connection,channels}:{connection:SmmConnectionState;channels:NonNullable<SmmReadModelSnapshot['channels']>}){
  if(!channels.length)return <EmptyState title={connection==='NOT_CONNECTED'?'平台狀態尚未連接':'暫時冇平台狀態'} detail="系統唔會用假嘅已連線標記代替正式讀回。"/>;
  return <>{channels.map(item=><div className="list-row" key={item.channel}><div><strong>{item.channel}</strong><small>{item.detail}</small></div><span className={`status ${item.state==='CONNECTED'?'positive':item.state==='UNKNOWN'?'unknown':'warning'}`}>{item.state}</span></div>)}</>;
}

function BusinessDay({projection}:{projection:SmmReadModelSnapshot['businessDay']}){
  if(!projection)return <EmptyState title="營業日資料尚未連接" detail="營業日只作記錄同報表分類，永遠唔會阻止落單、付款或者本機提交。"/>;
  return <><div className="metric-grid"><Metric label="營業日" value={projection.businessDate}/><Metric label="狀態" value={projection.state}/><Metric label="讀取時間" value={new Date(projection.observedAt).toLocaleString('zh-HK')}/></div><p className="callout">營業日只作記錄及分類，唔係交易開關。</p></>;
}

function Capacity({projection}:{projection:SmmReadModelSnapshot['capacity']}){
  if(!projection)return <EmptyState title="產能資料尚未連接" detail="連接後會顯示正式產能狀態；SMM 唔會自行判斷門店忙閒。"/>;
  return <><div className="metric-grid"><Metric label="狀態" value={projection.state}/><Metric label="門店提示" value={projection.label}/></div><p className="callout">{projection.detail}</p><small>讀取：{new Date(projection.observedAt).toLocaleString('zh-HK')}</small></>;
}

function Reporting({projection}:{projection:SmmReadModelSnapshot['reporting']}){
  if(!projection)return <EmptyState title="營運報表尚未連接" detail="未連接時唔會顯示假營業額、假訂單數或者假平均單。"/>;
  return <><div className="metric-grid"><Metric label="營業日" value={projection.businessDate}/><Metric label="訂單" value={String(projection.orderCount)}/><Metric label="營業額" value={projection.salesLabel}/><Metric label="平均單" value={projection.averageOrderLabel}/></div><p className="callout">資料狀態：{projection.freshness} · {new Date(projection.observedAt).toLocaleString('zh-HK')}</p></>;
}

function RefundRequests({connection,rows}:{connection:SmmConnectionState;rows:NonNullable<SmmReadModelSnapshot['refundRequests']>}){
  if(!rows.length)return <EmptyState title={connection==='NOT_CONNECTED'?'退款要求尚未連接':'暫時冇退款要求'} detail="SMM 只顯示退款／售後跟進資料，唔持有退款或付款主權。"/>;
  return <>{rows.map(row=><div className="list-row" key={row.refundId}><div><strong>{row.displayCode} · {row.source}</strong><small>{row.reason}{row.amountLabel?` · ${row.amountLabel}`:''}</small></div><span className={`status ${row.state==='UNKNOWN'?'unknown':row.state==='RESOLVED'?'positive':'warning'}`}>{row.state}</span></div>)}</>;
}

function PrintHealth({connection,rows}:{connection:SmmConnectionState;rows:NonNullable<SmmReadModelSnapshot['printHealth']>}){
  if(!rows.length)return <EmptyState title={connection==='NOT_CONNECTED'?'列印狀態尚未連接':'暫時冇列印設備資料'} detail="SMM 只顯示狀態；實體列印同重印權限唔屬於呢個端口。"/>;
  return <>{rows.map(row=><div className="list-row" key={row.logicalPrinterId}><div><strong>{row.label}</strong><small>{row.detail}</small></div><span className={`status ${row.state==='READY'?'positive':row.state==='UNKNOWN'?'unknown':'warning'}`}>{row.state}</span></div>)}</>;
}

function Sellability({connection,products,onChange}:{connection:SmmConnectionState;products:readonly SmmProduct[];onChange:(id:string,available:boolean)=>void}){
  if(!products.length)return <EmptyState title={connection==='NOT_CONNECTED'?'商品供應服務尚未連接':'暫時冇商品'} detail="正式供應狀態必須由門店權威資料提供。"/>;
  return <>{products.map(product=><div className="list-row" key={product.productId}><div><strong>{product.name}</strong><small>{product.available?'供應中':'暫停供應'}</small></div><button onClick={()=>onChange(product.productId,!product.available)}>{product.available?'標記售罄':'恢復供應'}</button></div>)}</>;
}

function Diagnostics({connection,snapshot,pendingCount}:{connection:SmmConnectionState;snapshot:SmmReadModelSnapshot|null;pendingCount:number}){
  return <><div className="diag-line"><span>門店連線</span><b className={connection==='READY'?'':'warn'}>{connectionLabelShort(connection)}</b><small>{snapshot?.observedAt?new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有讀回'}</small></div><div className="diag-line"><span>餐單版本</span><b>{snapshot?.menu?.revision??'—'}</b><small>{snapshot?.menu?.observedAt?new Date(snapshot.menu.observedAt).toLocaleString('zh-HK'):'未有餐單'}</small></div><div className="diag-line"><span>本機待提交</span><b>{pendingCount}</b><small>只係本機草稿，不係正式訂單</small></div></>;
}

function ProductSheet({product,selections,selectedVariationId,setVariation,toggle,onClose,onAdd}:{
  product:SmmProduct;
  selections:SmmSelectionState;
  selectedVariationId:string|null;
  setVariation:(id:string)=>void;
  toggle:(groupId:string,optionId:string)=>void;
  onClose:()=>void;
  onAdd:()=>void;
}){
  const validation=validateSmmSelections(product,selections);
  const variationOk=!product.variationRequired||Boolean(selectedVariationId);
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><div className="sheet-grabber"/><header><div><span>商品設定</span><h2>{product.name}</h2><small>{product.description??'請完成所需選項'}</small></div><button onClick={onClose}>✕</button></header>
    {product.variations?.length?<section className="option-group"><div><strong>規格</strong><span>{product.variationRequired?'必選':'可選'}</span></div><div className="option-list">{product.variations.map(item=><button key={item.variationId} disabled={!item.available} className={selectedVariationId===item.variationId?'active':''} onClick={()=>setVariation(item.variationId)}>{item.name}</button>)}</div></section>:null}
    {product.optionGroups.map(group=><section className="option-group" key={group.optionGroupId}><div><strong>{group.name}</strong><span>最少 {Math.max(group.required?1:0,group.minSelections)} · 最多 {group.maxSelections}</span></div><div className="option-list">{group.options.map(option=><button key={option.optionId} disabled={!option.available} className={(selections[group.optionGroupId]??[]).includes(option.optionId)?'active':''} onClick={()=>toggle(group.optionGroupId,option.optionId)}>{option.name}</button>)}</div></section>)}
    {!validation.ok?<p className="callout">{validation.issues[0]}</p>:null}
    <footer><button onClick={onClose}>取消</button><button className="primary" disabled={!validation.ok||!variationOk} onClick={onAdd}>加入草稿</button></footer>
  </section></div>;
}

function CartSheet({cart,quote,pending,onClose,onQuantity,onRemove,onSubmit,onReadback}:{
  cart:readonly SmmCartLine[];
  quote:SmmQuoteSnapshot|null;
  pending:SmmPendingIntent|null;
  onClose:()=>void;
  onQuantity:(id:string,q:number)=>void;
  onRemove:(id:string)=>void;
  onSubmit:()=>void;
  onReadback:(intent:SmmPendingIntent)=>void;
}){
  const [qr,setQr]=useState<string|null>(null);
  const [qrBusy,setQrBusy]=useState(false);
  const makeQr=async()=>{
    if(!cart.length||qrBusy)return;
    setQrBusy(true);
    try{setQr(await renderSmmQrHandoff(createSmmQrHandoff(cart,quote)));}
    finally{setQrBusy(false);}
  };
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><div className="sheet-grabber"/><header><div><span>購物草稿</span><h2>{cart.length} 項</h2><small>本機只保存意圖；總額只接受門店正式報價。</small></div><button onClick={onClose}>✕</button></header>
    {!cart.length?<EmptyState title="草稿係空嘅" detail="返回點單加入商品。"/>:cart.map(line=><div className="cart-line" key={line.lineId}><div><strong>{line.productName}</strong><small>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join(' · ')||'無額外設定'}</small></div><div className="qty"><button onClick={()=>onQuantity(line.lineId,line.quantity-1)}>−</button><b>{line.quantity}</b><button onClick={()=>onQuantity(line.lineId,line.quantity+1)}>＋</button></div><button className="danger" onClick={()=>onRemove(line.lineId)}>移除</button></div>)}
    <div className="cart-total"><span>正式報價</span><strong>{quote?money(quote.currency,quote.totalMinor):'等待門店報價'}</strong><small>{quote?`版本 ${quote.revision}`:'本機唔會估算價格'}</small></div>
    {pending?<p className="callout">{pending.state==='UNKNOWN'?'上次提交結果未明，請先重新確認，唔好重新送出。':pending.lastMessage??'已有待提交草稿'}</p>:null}
    {qr?<div className="smm-qr-handoff"><img src={qr} alt="SMM 訂單交接 QR"/><div><strong>QR 交接</strong><p>畀 SMT 掃描後，會重新用門店餐單同價格驗證，再建立正式訂單。呢個 QR 本身唔係正式 Order。</p></div></div>:null}
    <footer><button onClick={onClose}>返回</button><button disabled={!cart.length||qrBusy} onClick={()=>void makeQr()}>{qrBusy?'產生中…':'產生 QR'}</button>{pending?.state==='UNKNOWN'?<button className="primary" onClick={()=>onReadback(pending)}>重新確認結果</button>:<button className="primary" disabled={!cart.length} onClick={onSubmit}>{quote?'提交訂單':'保存待提交草稿'}</button>}</footer>
  </section></div>;
}

function EmptyState({title,detail,children}:{title:string;detail:string;children?:React.ReactNode}){
  return <section className="panel empty-state"><h2>{title}</h2><p>{detail}</p>{children}</section>;
}
function Tool({title,detail,state,onClick}:{title:string;detail:string;state:string;onClick:()=>void}){return <button className="tool-card" onClick={onClick}><span>◆</span><strong>{title}</strong><small>{detail}</small><em>{state}</em></button>}
function Metric({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
function NavButton({active,label,glyph,badge,onClick}:{active:boolean;label:string;glyph:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}><span>{glyph}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>}

function labelWorkState(state:string){return state==='NORMAL'?'正常':state==='DELAYED'?'延誤':state==='ACTION_REQUIRED'?'需處理':'未知'}
function connectionLabelShort(state:SmmConnectionState){return state==='READY'?'已連接':state==='LOADING'?'同步中':state==='ERROR'?'錯誤':state==='STALE'?'資料稍舊':state==='PARTIAL'?'部分資料':state==='UNKNOWN'?'未知':'未連接'}
function moreTitle(tool:string){return tool==='pending'?'待提交草稿':tool==='channels'?'平台狀態':tool==='business'?'營業日':tool==='capacity'?'產能':tool==='reporting'?'營運報表':tool==='refunds'?'退款要求':tool==='printing'?'列印狀態':tool==='sellability'?'商品供應':'診斷'}
