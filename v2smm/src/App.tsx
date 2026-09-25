import {useEffect,useMemo,useState} from 'react';
import {readSmmLocalWorkspace,writeSmmLocalWorkspace,createSmmPendingIntent,type SmmLocalPreferences} from './persistence';
import {resolveSmmRuntimePort} from './runtime';
import {pairSmmLan,probeSmmLan,readSmmLanPwaConfig,saveSmmLanPwaConfig} from './pwa-lan';
import {clearSmmStaffSession,listSmmStaff,readSmmStaffSession,refreshSmmStaffSession,verifySmmStaff,type SmmStaffDirectoryItem,type SmmStaffSession} from './pwa-staff';
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
  SmmServiceMode,
  SmmTender,
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
  const [serviceMode,setServiceMode]=useState<SmmServiceMode>(initial.preferences.serviceMode);
  const [tender,setTender]=useState<SmmTender>(initial.preferences.tender);
  const [cart,setCart]=useState<readonly SmmCartLine[]>(initial.cart);
  const [pendingIntents,setPendingIntents]=useState<readonly SmmPendingIntent[]>(initial.pendingIntents);
  const [staffSession,setStaffSession]=useState<SmmStaffSession|null>(()=>readSmmStaffSession());
  const [port]=useState<SmmRuntimePort|null>(()=>resolveSmmRuntimePort());
  const [connection,setConnection]=useState<SmmConnectionState>(port?'LOADING':'NOT_CONNECTED');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [selectedProduct,setSelectedProduct]=useState<SmmProduct|null>(null);
  const [selections,setSelections]=useState<SmmSelectionState>({});
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [cartOpen,setCartOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [orderSearch,setOrderSearch]=useState('');
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('active');
  const [moreTool,setMoreTool]=useState<'staff'|'connection'|'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null>(null);
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
      preferences:next.preferences??{activeView:view,activeCategoryId,sourceFilter,serviceMode,tender},
    });
  };

  const changeView=(next:View)=>{
    setView(next);
    persist({preferences:{activeView:next,activeCategoryId,sourceFilter,serviceMode,tender}});
  };

  const changeCategory=(next:string|null)=>{
    setActiveCategoryId(next);
    persist({preferences:{activeView:view,activeCategoryId:next,sourceFilter,serviceMode,tender}});
  };

  const changeSource=(next:string)=>{
    setSourceFilter(next);
    persist({preferences:{activeView:view,activeCategoryId,sourceFilter:next,serviceMode,tender}});
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

  useEffect(()=>{
    void refresh();
    const onOnline=()=>void refresh();
    const onPageShow=()=>void refresh();
    const onVisibility=()=>{if(document.visibilityState==='visible')void refresh();};
    window.addEventListener('online',onOnline);
    window.addEventListener('pageshow',onPageShow);
    document.addEventListener('visibilitychange',onVisibility);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    return()=>{
      window.removeEventListener('online',onOnline);
      window.removeEventListener('pageshow',onPageShow);
      document.removeEventListener('visibilitychange',onVisibility);
      window.clearInterval(timer);
    };
  },[]);

  useEffect(()=>{
    let cancelled=false;
    void refreshSmmStaffSession().then(session=>{if(!cancelled)setStaffSession(session);});
    return()=>{cancelled=true};
  },[]);

  const menu=snapshot?.menu;
  const productPrice=(product:SmmProduct,mode:SmmServiceMode)=>{
    const value=mode==='DINE_IN'?product.publishedDineInUnitPriceMinor:product.publishedTakeawayUnitPriceMinor;
    return Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
  };
  const repriceLine=(line:SmmCartLine,mode:SmmServiceMode):SmmCartLine=>{
    const product=menu?.products.find(item=>item.productId===line.productId);
    if(!product)return line;
    const base=productPrice(product,mode);
    if(base===null)return {...line,publishedUnitPriceMinor:undefined};
    const optionMinor=line.selections.reduce((sum,item)=>sum+(Number.isSafeInteger(Number(item.publishedAdjustmentMinor))?Number(item.publishedAdjustmentMinor):0),0);
    return Object.freeze({...line,publishedUnitPriceMinor:base+optionMinor});
  };
  const publishedTotalMinor=cart.every(line=>Number.isSafeInteger(Number(line.publishedUnitPriceMinor))&&Number(line.publishedUnitPriceMinor)>=0)
    ?cart.reduce((sum,line)=>sum+Number(line.publishedUnitPriceMinor)*line.quantity,0)
    :null;
  const quote:SmmQuoteSnapshot|null=menu&&publishedTotalMinor!==null&&cart.length?Object.freeze({
    quoteId:'PUBLISHED-'+menu.revision,
    revision:menu.revision,
    currency:'HKD',
    totalMinor:publishedTotalMinor,
    lines:Object.freeze(cart.map(line=>Object.freeze({
      lineId:line.lineId,
      currency:'HKD',
      finalUnitPriceMinor:Number(line.publishedUnitPriceMinor),
      lineTotalMinor:Number(line.publishedUnitPriceMinor)*line.quantity,
    }))),
    observedAt:menu.observedAt,
  }):null;
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


  useEffect(()=>{
    if(!menu||cart.length===0)return;
    let changed=false;
    let invalid=false;
    const next=cart.map(line=>{
      const product=menu.products.find(item=>item.productId===line.productId);
      if(!product||!product.available){
        invalid=true;
        if(line.publishedUnitPriceMinor!==undefined)changed=true;
        return Object.freeze({...line,publishedUnitPriceMinor:undefined});
      }

      let selectionsValid=true;
      const refreshedSelections=line.selections.map(selection=>{
        const group=product.optionGroups.find(item=>item.optionGroupId===selection.optionGroupId);
        const option=group?.options.find(item=>item.optionId===selection.optionId&&item.available);
        if(!group||!option){
          selectionsValid=false;
          return selection;
        }
        const adjustment=Number.isSafeInteger(Number(option.publishedAdjustmentMinor))
          ?Number(option.publishedAdjustmentMinor)
          :0;
        if(
          selection.optionName!==option.name||
          Number(selection.publishedAdjustmentMinor??0)!==adjustment
        )changed=true;
        return Object.freeze({
          optionGroupId:group.optionGroupId,
          optionId:option.optionId,
          optionName:option.name,
          publishedAdjustmentMinor:adjustment,
        });
      });

      const base=productPrice(product,serviceMode);
      const optionMinor=refreshedSelections.reduce(
        (sum,item)=>sum+(Number.isSafeInteger(Number(item.publishedAdjustmentMinor))?Number(item.publishedAdjustmentMinor):0),
        0,
      );
      const unitMinor=base!==null&&selectionsValid?base+optionMinor:undefined;
      if(line.publishedUnitPriceMinor!==unitMinor)changed=true;
      if(unitMinor===undefined)invalid=true;
      return Object.freeze({...line,selections:Object.freeze(refreshedSelections),publishedUnitPriceMinor:unitMinor});
    });

    if(!changed)return;
    setCart(Object.freeze(next));
    writeSmmLocalWorkspace({
      cart:Object.freeze(next),
      pendingIntents,
      preferences:{activeView:view,activeCategoryId,sourceFilter,serviceMode,tender},
    });
    setNotice(invalid
      ?'餐單已更新；部分草稿項目需要重新選擇後先可以提交。'
      :'餐單已更新；購物草稿已按目前發布價格重新計算。');
  },[menu?.revision,menu?.observedAt]);

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
    const selectedOptions=selectedSmmCartOptions(selectedProduct,selections);
    const baseMinor=productPrice(selectedProduct,serviceMode);
    if(baseMinor===null){
      setNotice('餐單價格資料未完整，請重新同步。');
      return;
    }
    const optionMinor=selectedOptions.reduce((sum,item)=>sum+(Number.isSafeInteger(Number(item.publishedAdjustmentMinor))?Number(item.publishedAdjustmentMinor):0),0);
    const line:SmmCartLine=Object.freeze({
      lineId:crypto.randomUUID(),
      productId:selectedProduct.productId,
      productName:selectedProduct.name,
      quantity:1,
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:{}),
      selections:selectedOptions,
      publishedUnitPriceMinor:baseMinor+optionMinor,
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

  const changeServiceMode=(next:SmmServiceMode)=>{
    const repriced=cart.map(line=>repriceLine(line,next));
    setServiceMode(next);
    setCart(repriced);
    writeSmmLocalWorkspace({
      cart:repriced,
      pendingIntents,
      preferences:{activeView:view,activeCategoryId,sourceFilter,serviceMode:next,tender},
    });
  };

  const changeTender=(next:SmmTender)=>{
    setTender(next);
    persist({preferences:{activeView:view,activeCategoryId,sourceFilter,serviceMode,tender:next}});
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
    if(!menu||publishedTotalMinor===null){
      setNotice('餐單價格／版本未完整，請先重新同步。');
      return;
    }
    if(snapshot?.connectionPath!=='LAN'&&!staffSession){
      setNotice('Internet 員工落單需要先喺「更多 → 員工帳戶」登入一次；之後呢部手機會保持同一個員工帳戶。');
      return;
    }
    const existing=pendingIntents.find(item=>
      (item.state==='DRAFT'||item.state==='NOT_CONNECTED'||item.state==='UNKNOWN')&&
      item.menuRevision===menu.revision&&
      item.checkout?.serviceMode===serviceMode&&
      item.checkout?.tender===tender&&
      item.publishedTotalMinor===publishedTotalMinor
    );

    let base:SmmPendingIntent;
    if(existing&&existing.state!=='DRAFT'){
      if(!port?.readSubmission){
        setNotice('原提交結果未明；未重新送出，避免重複訂單。');
        return;
      }
      const prior=await port.readSubmission(existing.submissionId);
      if(prior.state==='CONFIRMED'){
        resolveConfirmedIntent(existing,prior.message||'門店已確認訂單');
        return;
      }
      if(prior.state!=='REJECTED'){
        saveIntent(Object.freeze({...existing,state:prior.state==='UNKNOWN'?'UNKNOWN':'NOT_CONNECTED',updatedAt:nowIso(),lastMessage:prior.message}));
        setNotice('原提交結果仍未確認；未重新送出，避免重複訂單。');
        return;
      }
      removeIntent(existing.submissionId);
      base=createSmmPendingIntent({
        cart,
        menuRevision:menu.revision,
        publishedTotalMinor,
        serviceMode,
        tender,
      });
    }else{
      base=existing??createSmmPendingIntent({
        cart,
        menuRevision:menu.revision,
        publishedTotalMinor,
        serviceMode,
        tender,
      });
    }

    if(!port?.submitOrder){
      const next={...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'門店提交服務尚未連接；草稿已保存。'};
      saveIntent(Object.freeze(next));
      setNotice('已保存本機待提交草稿；未建立正式訂單。');
      return;
    }
    const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'已送到 Internet 訂單橋，等待 SMT 接收'});
    saveIntent(pending);
    try{
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED'){
        resolveConfirmedIntent(pending,result.message||'門店已確認訂單');
        return;
      }
      if(result.state==='REJECTED'){
        removeIntent(pending.submissionId);
        if(result.message.startsWith('SMM_PUBLISHED_PRICE_CHANGED')||result.message.startsWith('SMM_MENU_REVISION_CHANGED')){
          await refresh();
          setNotice('SMT 發現餐單版本／價格已更新；SMM 已重新同步，請確認新總額後再提交。');
        }else{
          setNotice(result.message);
        }
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
  const connectionLabel=connection==='READY'?(snapshot?.connectionPath==='LAN'?'LAN 已連接':'Internet 已連接'):connection==='LOADING'?'同步中':connection==='ERROR'?'同步失敗':'門店服務未連接';
  const webSmtAcceptance=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('target')==='web-smt';

  return <main className="app-shell" data-mode={connection==='READY'?'online':'offline'}>
    <header className="topbar">
      <div className="brand-mark">磨</div>
      <div className="brand-copy"><strong>磨飯流動店務</strong><span>{staffSession?.displayName??snapshot?.staff?.displayName??'店員模式'} · {snapshot?.staff?.storeId??'未連接門店'}</span></div>
      <button className="state-pill" onClick={()=>void refresh()} aria-label="重新同步門店資料"><i/>{connectionLabel}</button>
    </header>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}
    {webSmtAcceptance?<section className="recovery-banner"><strong>Web SMT 驗收模式</strong><span>呢個頁面只會將測試訂單送到臨時公網 SMT；唔會送去舖頭實機、唔會觸發實體打印。</span></section>:null}
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
        serviceMode={serviceMode}
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
        staffSession={staffSession}
        onStaffSession={setStaffSession}
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
      <NavButton active={view==='work'} label="待處理" glyph="◎" badge={(snapshot?.work??[]).filter(item=>item.state!=='NORMAL').length?String((snapshot?.work??[]).filter(item=>item.state!=='NORMAL').length):undefined} onClick={()=>changeView('work')}/>
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
      serviceMode={serviceMode}
      tender={tender}
      onServiceMode={changeServiceMode}
      onTender={changeTender}
      onClose={()=>setCartOpen(false)}
      onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))}
      onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))}
      onSubmit={()=>void submitCart()}
      onReadback={intent=>void readbackIntent(intent)}
    />:null}
  </main>;
}

function OrderView({connection,categories,activeCategoryId,setCategory,search,setSearch,products,cart,quote,serviceMode,onProduct,onCart}:{
  connection:SmmConnectionState;
  categories:readonly {categoryId:string;name:string}[];
  activeCategoryId:string|null;
  setCategory:(v:string|null)=>void;
  search:string;
  setSearch:(v:string)=>void;
  products:readonly SmmProduct[];
  cart:readonly SmmCartLine[];
  quote:SmmQuoteSnapshot|null;
  serviceMode:SmmServiceMode;
  onProduct:(p:SmmProduct)=>void;
  onCart:()=>void;
}){
  const count=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <section className="page order-page">
    <header className="hero compact"><div><span>點單</span><h1>快速點餐</h1><small>使用 Admin 已發布餐單；SMT 只喺提交時核對版本同價格。</small></div>{connection==='READY'?<b className="tag">已同步</b>:null}</header>
    <label className="search"><span>搜尋商品</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="輸入商品名稱"/></label>
    {categories.length?<div className="category-rail">{categories.map(item=><button key={item.categoryId} className={activeCategoryId===item.categoryId?'active':''} onClick={()=>setCategory(item.categoryId)}>{item.name}</button>)}</div>:null}
    {connection==='LOADING'?<EmptyState title="正在同步餐單" detail="請稍候。"/>:
      !categories.length?<EmptyState title={connection==='NOT_CONNECTED'?'餐單服務尚未連接':'暫時未有餐單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式分類、商品、規格同供應狀態。':'目前門店資料未提供任何可售商品。'}/>:
      products.length?<div className="product-grid">{products.map(product=>{const price=serviceMode==='DINE_IN'?product.publishedDineInUnitPriceMinor:product.publishedTakeawayUnitPriceMinor;return <button key={product.productId} className={`product-card ${product.available?'':'disabled'}`} disabled={!product.available} onClick={()=>onProduct(product)}><span className="product-avatar">{product.name.slice(0,1)}</span><strong>{product.name}</strong><small>{Number.isSafeInteger(Number(price))?money('HKD',Number(price)):(product.available?'可供應':'暫停供應')}</small><i>{product.optionGroups.length||product.variations?.length?'可設定':''}</i></button>})}</div>:
      <EmptyState title="搵唔到商品" detail="清除搜尋或者切換其他分類。"><button className="primary" onClick={()=>setSearch('')}>清除搜尋</button></EmptyState>}
    {count>0?<button className="cart-bar" onClick={onCart}><div><b>{count}</b><span>購物草稿</span></div><div><strong>{quote?money(quote.currency,quote.totalMinor):'價格資料未完整'}</strong><small>{quote?`已發布餐單版本 ${quote.revision}`:'請重新同步餐單'}</small></div><em>查看</em></button>:null}
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

function MoreView({connection,tool,setTool,snapshot,staffSession,onStaffSession,pendingIntents,onReadback,onDiscard,onSellability}:{
  connection:SmmConnectionState;
  tool:'staff'|'connection'|'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null;
  setTool:(v:'staff'|'connection'|'channels'|'business'|'printing'|'diagnostics'|'sellability'|'pending'|'capacity'|'reporting'|'refunds'|null)=>void;
  snapshot:SmmReadModelSnapshot|null;
  staffSession:SmmStaffSession|null;
  onStaffSession:(session:SmmStaffSession|null)=>void;
  pendingIntents:readonly SmmPendingIntent[];
  onReadback:(intent:SmmPendingIntent)=>void;
  onDiscard:(submissionId:string)=>void;
  onSellability:(productId:string,available:boolean)=>void;
}){
  return <section className="page">
    <header className="hero"><div><span>更多</span><h1>店務工具</h1><small>只顯示已知資料；未連接嘅功能會保持未連接。</small></div></header>
    <div className="tool-grid">
      <Tool title="員工帳戶" detail="同 SMT 共用同一員工身份" state={staffSession?.displayName??'未登入'} onClick={()=>setTool('staff')}/>
      <Tool title="連線設定" detail="Internet / LAN 配對" state={snapshot?.connectionPath==='LAN'?'LAN':snapshot?.connectionPath==='INTERNET'?'Internet':'未連接'} onClick={()=>setTool('connection')}/>
      <Tool title="待提交草稿" detail={`${pendingIntents.length} 個本機草稿`} state={pendingIntents.length?'需處理':'正常'} onClick={()=>setTool('pending')}/>
      <Tool title="平台狀態" detail="平台連線同資料新鮮度" state={snapshot?.channels?.length?String(snapshot.channels.length):'未連接'} onClick={()=>setTool('channels')}/>
      <Tool title="商品供應" detail="售罄／恢復操作入口" state={connection==='READY'?'可用':'未連接'} onClick={()=>setTool('sellability')}/>
      <Tool title="營業日" detail="只作記錄同報表分類" state={snapshot?.businessDay?.businessDate??'未連接'} onClick={()=>setTool('business')}/>
      <Tool title="產能" detail="只讀門店產能狀態" state={snapshot?.capacity?.state??'未連接'} onClick={()=>setTool('capacity')}/>
      <Tool title="營運報表" detail="當日訂單／營業額／平均單" state={snapshot?.reporting?.freshness??'未連接'} onClick={()=>setTool('reporting')}/>
      <Tool title="退款要求" detail="只讀退款／售後跟進" state={snapshot?.refundRequests?.length?String(snapshot.refundRequests.length):'未連接'} onClick={()=>setTool('refunds')}/>
      <Tool title="列印狀態" detail="只讀設備健康" state={snapshot?.printHealth?.length?String(snapshot.printHealth.length):'未連接'} onClick={()=>setTool('printing')}/>
      <Tool title="診斷" detail="連線、資料版本、本機草稿" state={connectionLabelShort(connection)} onClick={()=>setTool('diagnostics')}/>
    </div>
    {tool?<div className="drawer"><div className="drawer-head"><strong>{moreTitle(tool)}</strong><button onClick={()=>setTool(null)}>關閉</button></div>
      {tool==='staff'?<StaffLogin session={staffSession} onSession={onStaffSession}/>:
       tool==='connection'?<ConnectionSettings snapshot={snapshot}/>:
       tool==='pending'?<PendingIntents intents={pendingIntents} onReadback={onReadback} onDiscard={onDiscard}/>:
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

function StaffLogin({session,onSession}:{session:SmmStaffSession|null;onSession:(session:SmmStaffSession|null)=>void}){
  const [staff,setStaff]=useState<readonly SmmStaffDirectoryItem[]>([]);
  const [staffId,setStaffId]=useState(session?.staffId??'');
  const [pin,setPin]=useState('');
  const [state,setState]=useState(session?'已登入：'+session.displayName:'使用同 SMT 一樣嘅員工帳戶同 PIN；首次喺呢部手機登入後會保持登入。');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    void listSmmStaff().then(rows=>{
      if(cancelled)return;
      setStaff(rows);
      if(!staffId&&rows[0])setStaffId(rows[0].staffId);
    }).catch(()=>{if(!cancelled)setState('暫時未能讀取員工名單。');});
    return()=>{cancelled=true};
  },[]);

  if(session)return <section className="panel staff-login"><h2>{session.displayName}</h2><p>{session.role} · 呢部手機已使用同 SMT 共用嘅員工帳戶。離開收銀機去其他位置工作都會保持呢個帳戶；停用員工時會失效。</p><button className="danger" onClick={()=>{clearSmmStaffSession();onSession(null);setState('已登出。');}}>登出／切換帳戶</button></section>;

  return <section className="panel staff-login"><p>{state}</p>
    <label>員工帳戶<select value={staffId} onChange={e=>setStaffId(e.target.value)}><option value="" disabled>{staff.length?'請選擇帳戶':'未有可用帳戶'}</option>{staff.map(item=><option key={item.staffId} value={item.staffId}>{item.displayName} · {item.role}</option>)}</select></label>
    <label>PIN<input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 位數字"/></label>
    <button className="primary" disabled={busy||!staffId||pin.length<4} onClick={async()=>{
      if(busy)return;
      setBusy(true);setState('驗證中…');
      try{const next=await verifySmmStaff(staffId,pin);onSession(next);setPin('');setState('已登入：'+next.displayName);}
      catch(error){setState(error instanceof Error?error.message:'員工驗證失敗');}
      finally{setBusy(false);}
    }}>{busy?'驗證中…':'登入'}</button>
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
  return <><div className="diag-line"><span>門店連線</span><b className={connection==='READY'?'':'warn'}>{connectionLabelShort(connection)}</b><small>{snapshot?.connectionPath??'—'} · {snapshot?.observedAt?new Date(snapshot.observedAt).toLocaleString('zh-HK'):'未有讀回'}</small></div><div className="diag-line"><span>餐單版本</span><b>{snapshot?.menu?.revision??'—'}</b><small>{snapshot?.menu?.observedAt?new Date(snapshot.menu.observedAt).toLocaleString('zh-HK'):'未有餐單'}</small></div><div className="diag-line"><span>本機待提交</span><b>{pendingCount}</b><small>只係本機草稿，不係正式訂單</small></div></>;
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

function CartSheet({cart,quote,pending,serviceMode,tender,onServiceMode,onTender,onClose,onQuantity,onRemove,onSubmit,onReadback}:{
  cart:readonly SmmCartLine[];
  quote:SmmQuoteSnapshot|null;
  pending:SmmPendingIntent|null;
  serviceMode:SmmServiceMode;
  tender:SmmTender;
  onServiceMode:(mode:SmmServiceMode)=>void;
  onTender:(tender:SmmTender)=>void;
  onClose:()=>void;
  onQuantity:(id:string,q:number)=>void;
  onRemove:(id:string)=>void;
  onSubmit:()=>void;
  onReadback:(intent:SmmPendingIntent)=>void;
}){
  const tenders:[SmmTender,string][]=[['CASH','現金'],['ALIPAY','AlipayHK'],['WECHAT','WeChat Pay HK'],['FPS','FPS'],['PAYME','PayMe']];
  return <div className="overlay"><section className="sheet" role="dialog" aria-modal="true"><div className="sheet-grabber"/><header><div><span>購物草稿</span><h2>{cart.length} 項</h2><small>價格直接使用已發布餐單；提交時 SMT 會核對版本同價格。</small></div><button onClick={onClose}>✕</button></header>
    <section className="option-group"><div><strong>服務方式</strong><span>員工設定</span></div><div className="segmented"><button className={serviceMode==='TAKEAWAY'?'active':''} onClick={()=>onServiceMode('TAKEAWAY')}>外賣</button><button className={serviceMode==='DINE_IN'?'active':''} onClick={()=>onServiceMode('DINE_IN')}>堂食</button></div></section>
    <section className="option-group"><div><strong>收款方式</strong><span>只記錄，不自動開錢箱</span></div><div className="option-list">{tenders.map(([value,label])=><button key={value} className={tender===value?'active':''} onClick={()=>onTender(value)}>{label}</button>)}</div>{tender==='CASH'?<p className="callout">現金只會記錄為收款方式；需要開錢箱時由 SMT 人手操作。</p>:null}</section>
    {!cart.length?<EmptyState title="草稿係空嘅" detail="返回點單加入商品。"/>:cart.map(line=><div className="cart-line" key={line.lineId}><div><strong>{line.productName}</strong><small>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join(' · ')||'無額外設定'} · {Number.isSafeInteger(Number(line.publishedUnitPriceMinor))?money('HKD',Number(line.publishedUnitPriceMinor)):'價格待同步'}</small></div><div className="qty"><button onClick={()=>onQuantity(line.lineId,line.quantity-1)}>−</button><b>{line.quantity}</b><button onClick={()=>onQuantity(line.lineId,line.quantity+1)}>＋</button></div><button className="danger" onClick={()=>onRemove(line.lineId)}>移除</button></div>)}
    <div className="cart-total"><span>已發布總額</span><strong>{quote?money(quote.currency,quote.totalMinor):'價格資料未完整'}</strong><small>{quote?`餐單版本 ${quote.revision} · SMT 提交時再核對`:'請重新同步餐單'}</small></div>
    {pending?<p className="callout">{pending.state==='UNKNOWN'?'上次提交結果未明，請先重新確認，唔好重新送出。':pending.lastMessage??'已有待提交草稿'}</p>:null}
    <footer><button onClick={onClose}>返回</button>{pending?.state==='UNKNOWN'?<button className="primary" onClick={()=>onReadback(pending)}>重新確認結果</button>:<button className="primary" disabled={!cart.length||!quote} onClick={onSubmit}>提交訂單</button>}</footer>
  </section></div>;
}

function ConnectionSettings({snapshot}:{snapshot:SmmReadModelSnapshot|null}){
  const path=snapshot?.connectionPath;
  return <div className="connection-settings">
    <p className="callout">目前使用：<strong>{path==='LAN'?'LAN 直接門店':path==='INTERNET'?'Internet':'未連接'}</strong>。LAN 只係可選加速／直接門店通道；唔支援 LAN 嘅瀏覽器仍然會用 Internet 正常同步餐單、規則同更新。</p>
    <LanSetup onReady={()=>location.reload()}/>
  </div>;
}

function LanSetup({onReady}:{onReady:()=>void}){
  const saved=readSmmLanPwaConfig();
  const [host,setHost]=useState(saved?.host??'');
  const [port,setPort]=useState(saved?.port??17831);
  const [deviceId,setDeviceId]=useState(saved?.deviceId??('SMM-'+crypto.randomUUID().slice(0,8)));
  const [token,setToken]=useState(saved?.pairingToken??'');
  const [state,setState]=useState('可選：LAN 只係直接門店通道；Safari／Chrome 如唔支援，Internet 仍會同步餐單、規則同更新。');
  const config={host:host.trim(),port,deviceId:deviceId.trim(),pairingToken:token.trim()};
  return <section className="panel lan-setup"><h2>店內直接連線（可選）</h2><p>{state}</p>
    <label>SMT 位址<input value={host} onChange={e=>setHost(e.target.value)} placeholder="例如 192.168.1.20"/></label>
    <label>連接埠<input type="number" value={port} onChange={e=>setPort(Number(e.target.value)||17831)}/></label>
    <label>裝置名稱<input value={deviceId} onChange={e=>setDeviceId(e.target.value)}/></label>
    <label>配對碼<input value={token} onChange={e=>setToken(e.target.value)} placeholder="由 SMT Recovery 顯示"/></label>
    <div className="lan-actions">
      <button onClick={async()=>{try{setState('測試中…');await probeSmmLan(config);setState('瀏覽器可以連到 SMT。');}catch{setState('呢個瀏覽器目前未能直接連 SMT；可以繼續使用其他落單方式。');}}}>測試 LAN</button>
      <button className="primary" onClick={async()=>{try{setState('配對中…');await pairSmmLan(config);saveSmmLanPwaConfig(config);setState('配對成功。');onReady();}catch{setState('配對未成功；唔會阻止其他落單方式。');}}}>配對並使用</button>
    </div>
  </section>;
}

function EmptyState({title,detail,children}:{title:string;detail:string;children?:React.ReactNode}){
  return <section className="panel empty-state"><h2>{title}</h2><p>{detail}</p>{children}</section>;
}
function Tool({title,detail,state,onClick}:{title:string;detail:string;state:string;onClick:()=>void}){return <button className="tool-card" onClick={onClick}><span>◆</span><strong>{title}</strong><small>{detail}</small><em>{state}</em></button>}
function Metric({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
function NavButton({active,label,glyph,badge,onClick}:{active:boolean;label:string;glyph:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}><span>{glyph}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>}

function labelWorkState(state:string){return state==='NORMAL'?'正常':state==='DELAYED'?'延誤':state==='ACTION_REQUIRED'?'需處理':'未知'}
function connectionLabelShort(state:SmmConnectionState){return state==='READY'?'已連接':state==='LOADING'?'同步中':state==='ERROR'?'錯誤':state==='STALE'?'資料稍舊':state==='PARTIAL'?'部分資料':state==='UNKNOWN'?'未知':'未連接'}
function moreTitle(tool:string){return tool==='staff'?'員工帳戶':tool==='connection'?'連線設定':tool==='pending'?'待提交草稿':tool==='channels'?'平台狀態':tool==='business'?'營業日':tool==='capacity'?'產能':tool==='reporting'?'營運報表':tool==='refunds'?'退款要求':tool==='printing'?'列印狀態':tool==='sellability'?'商品供應':'診斷'}
