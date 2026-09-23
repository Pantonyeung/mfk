import {useEffect,useMemo,useRef,useState} from 'react';
import {
  createSmmPendingIntent,
  readSmmLocalWorkspace,
  writeSmmLocalWorkspace,
  type SmmLocalPreferences,
} from './persistence';
import {resolveSmmRuntimePort} from './runtime';
import {selectedSmmCartOptions,toggleSmmSelection,validateSmmSelections,type SmmSelectionState} from './selection';
import type {
  SmmCartLine,
  SmmCommandResult,
  SmmConnectionState,
  SmmPendingIntent,
  SmmProduct,
  SmmQuoteSnapshot,
  SmmReadModelSnapshot,
  SmmRuntimePort,
} from './product-types';
import {commandResultPresentation,connectionCopy,type CommandPresentation,type FeedbackTone,type QuotePresentation} from './presentation';
import {CartReview,OrderView,ProductConfigurator} from './order-flow';
import {MoreView,OrdersView,StatusView,WorkView} from './operations';
import {ActionNotice,AppShell,StateMessage,type PrimaryView} from './ui';

type OrderMode='menu'|'dine';

interface NoticeState {
  readonly tone:FeedbackTone;
  readonly message:string;
  readonly undoLineId?:string;
}

const nowIso=()=>new Date().toISOString();
const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);

function initialPrimaryView(view:SmmLocalPreferences['activeView']):PrimaryView{
  if(view==='dine')return 'order';
  if(view==='more')return 'more';
  return view;
}

function persistedPrimaryView(view:PrimaryView):SmmLocalPreferences['activeView']{
  // The persisted preference schema is frozen. Status shares the existing low-frequency "more" bucket.
  return view==='status'?'more':view;
}

export function App(){
  const initial=useMemo(()=>readSmmLocalWorkspace(),[]);
  const [view,setView]=useState<PrimaryView>(()=>initialPrimaryView(initial.preferences.activeView));
  const [orderMode,setOrderMode]=useState<OrderMode>('menu');
  const [activeCategoryId,setActiveCategoryId]=useState<string|null>(initial.preferences.activeCategoryId);
  const [sourceFilter,setSourceFilter]=useState(initial.preferences.sourceFilter);
  const [cart,setCart]=useState<readonly SmmCartLine[]>(initial.cart);
  const [pendingIntents,setPendingIntents]=useState<readonly SmmPendingIntent[]>(initial.pendingIntents);
  const [port]=useState<SmmRuntimePort|null>(()=>resolveSmmRuntimePort());
  const [connection,setConnection]=useState<SmmConnectionState>(port?'LOADING':'NOT_CONNECTED');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [quote,setQuote]=useState<SmmQuoteSnapshot|null>(null);
  const [quotePresentation,setQuotePresentation]=useState<QuotePresentation>({state:'idle'});
  const [quoteRequestVersion,setQuoteRequestVersion]=useState(0);
  const [command,setCommand]=useState<CommandPresentation>({state:'idle'});
  const [commandBusy,setCommandBusy]=useState(false);
  const [notice,setNotice]=useState<NoticeState|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [selectedProduct,setSelectedProduct]=useState<SmmProduct|null>(null);
  const [selections,setSelections]=useState<SmmSelectionState>({});
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [cartOpen,setCartOpen]=useState(false);
  const [search,setSearch]=useState('');
  const commandLockRef=useRef(false);

  const preferences=(overrides?:Partial<SmmLocalPreferences>):SmmLocalPreferences=>({
    activeView:persistedPrimaryView(view),
    activeCategoryId,
    sourceFilter,
    ...overrides,
  });

  const persist=(next:{
    cart?:readonly SmmCartLine[];
    pendingIntents?:readonly SmmPendingIntent[];
    preferences?:SmmLocalPreferences;
  })=>{
    writeSmmLocalWorkspace({
      cart:next.cart??cart,
      pendingIntents:next.pendingIntents??pendingIntents,
      preferences:next.preferences??preferences(),
    });
  };

  const changeView=(next:PrimaryView)=>{
    setView(next);
    persist({preferences:preferences({activeView:persistedPrimaryView(next)})});
  };

  const changeCategory=(next:string|null)=>{
    setActiveCategoryId(next);
    persist({preferences:preferences({activeCategoryId:next})});
  };

  const changeSource=(next:string)=>{
    setSourceFilter(next);
    persist({preferences:preferences({sourceFilter:next})});
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

  useEffect(()=>{void refresh()},[]);

  useEffect(()=>{
    if(cart.length===0){
      setQuote(null);
      setQuotePresentation({state:'idle'});
      return;
    }
    if(!port?.quoteCart){
      setQuote(null);
      setQuotePresentation({state:'unavailable',message:'正式報價服務目前未連接，本機不會自行估算價格。'});
      return;
    }
    let cancelled=false;
    setQuote(null);
    setQuotePresentation({state:'loading'});
    void port.quoteCart(cart).then(result=>{
      if(cancelled)return;
      setQuote(result);
      setQuotePresentation({state:'ready'});
    }).catch(reason=>{
      if(cancelled)return;
      setQuote(null);
      setQuotePresentation({state:'error',message:reason instanceof Error?reason.message:'暫時未能取得門店正式報價。'});
    });
    return()=>{cancelled=true};
  },[port,cart,quoteRequestVersion]);

  const menu=snapshot?.menu;
  const categories=menu?.categories??[];
  const effectiveCategoryId=activeCategoryId&&categories.some(category=>category.categoryId===activeCategoryId)
    ?activeCategoryId
    :null;
  const visibleProducts=(menu?.products??[]).filter(product=>{
    const query=search.trim().toLocaleLowerCase('zh-HK');
    const categoryOk=effectiveCategoryId?product.categoryId===effectiveCategoryId:Boolean(query);
    const searchOk=!query||[product.name,product.description??''].join(' ').toLocaleLowerCase('zh-HK').includes(query);
    return categoryOk&&searchOk;
  });

  const addSelectedProduct=()=>{
    if(!selectedProduct)return;
    const validation=validateSmmSelections(selectedProduct,selections);
    if(!validation.ok){
      setNotice({tone:'danger',message:validation.issues[0]??'請完成商品設定'});
      return;
    }
    if(selectedProduct.variationRequired&&!selectedVariationId){
      setNotice({tone:'danger',message:'請先選擇必選規格。'});
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
    setCommand({state:'idle'});
    setNotice({tone:'success',message:`已加入「${line.productName}」；購物籃共有 ${next.reduce((sum,item)=>sum+item.quantity,0)} 件商品。`,undoLineId:line.lineId});
  };

  const updateCart=(next:readonly SmmCartLine[])=>{
    setCart(next);
    setCommand({state:'idle'});
    persist({cart:next});
  };

  const undoAddedLine=(lineId:string)=>{
    const next=cart.filter(line=>line.lineId!==lineId);
    updateCart(next);
    setNotice({tone:'neutral',message:'已撤銷加入商品。'});
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

  const resolveConfirmedIntent=(intent:SmmPendingIntent,result:SmmCommandResult)=>{
    const remaining=pendingIntents.filter(item=>item.submissionId!==intent.submissionId);
    setPendingIntents(remaining);
    setCart([]);
    writeSmmLocalWorkspace({cart:[],pendingIntents:remaining,preferences:preferences()});
    setQuote(null);
    setQuotePresentation({state:'idle'});
    setCommand(commandResultPresentation('CONFIRMED',result.message,intent.submissionId));
    setNotice({tone:'success',message:result.message||'門店已確認訂單。'});
    void refresh();
  };

  const preserveTerminalPresentation=(intent:SmmPendingIntent,result:SmmCommandResult)=>{
    // REJECTED / FAILED are presentation truth only. The frozen persisted union has no terminal result.
    const lastMessage=result.state==='NOT_CONNECTED'
      ?result.message
      :'本機只保存草稿狀態，未保存終結結果。';
    const persisted=Object.freeze({...intent,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage});
    saveIntent(persisted);
    setCommand(commandResultPresentation(result.state,result.message,intent.submissionId));
  };

  const submitCart=async()=>{
    if(commandLockRef.current||cart.length===0)return;
    const blocked=pendingIntents.find(item=>item.state==='PENDING'||item.state==='UNKNOWN');
    if(blocked){
      setCartOpen(true);
      setCommand({state:'unknown',message:blocked.lastMessage??'正在確認訂單結果',submissionId:blocked.submissionId});
      setNotice({tone:'warning',message:'已有提交正在確認；請先 readback，系統不會重複提交。'});
      return;
    }
    const existing=pendingIntents.find(item=>item.state==='DRAFT'||item.state==='NOT_CONNECTED');
    const base=existing??createSmmPendingIntent(cart);
    if(!port?.submitOrder){
      const next=Object.freeze({...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'門店提交服務尚未連接；草稿已保存。'});
      saveIntent(next);
      setCommand(commandResultPresentation('NOT_CONNECTED',next.lastMessage??'',next.submissionId));
      return;
    }

    commandLockRef.current=true;
    setCommandBusy(true);
    setCommand({state:'submitting',submissionId:base.submissionId});
    const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'等待門店確認'});
    saveIntent(pending);
    try{
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED')resolveConfirmedIntent(pending,result);
      else if(result.state==='UNKNOWN'){
        const unknown=Object.freeze({...pending,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:result.message});
        saveIntent(unknown);
        setCommand(commandResultPresentation('UNKNOWN',result.message,pending.submissionId));
      }else preserveTerminalPresentation(pending,result);
    }catch{
      const unknown=Object.freeze({...pending,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:'提交結果未明'});
      saveIntent(unknown);
      setCommand({state:'unknown',message:'正在確認訂單結果',submissionId:pending.submissionId});
    }finally{
      commandLockRef.current=false;
      setCommandBusy(false);
    }
  };

  const readbackIntent=async(intent:SmmPendingIntent)=>{
    if(commandLockRef.current)return;
    if(!port?.readSubmission){
      const next=Object.freeze({...intent,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'門店查詢服務尚未連接'});
      saveIntent(next);
      setCommand({state:'not-connected',message:'門店查詢服務尚未連接；未有重新提交任何交易。',submissionId:intent.submissionId});
      setCartOpen(true);
      return;
    }

    commandLockRef.current=true;
    setCommandBusy(true);
    setCartOpen(true);
    setCommand({state:'readback',submissionId:intent.submissionId});
    try{
      const result=await port.readSubmission(intent.submissionId);
      if(result.state==='CONFIRMED')resolveConfirmedIntent(intent,result);
      else if(result.state==='UNKNOWN'){
        const unknown=Object.freeze({...intent,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:result.message});
        saveIntent(unknown);
        setCommand(commandResultPresentation('UNKNOWN',result.message,intent.submissionId));
      }else preserveTerminalPresentation(intent,result);
    }catch{
      const unknown=Object.freeze({...intent,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:'讀回結果未明'});
      saveIntent(unknown);
      setCommand({state:'unknown',message:'讀回結果未明；未有重新提交。',submissionId:intent.submissionId});
    }finally{
      commandLockRef.current=false;
      setCommandBusy(false);
    }
  };

  const createDine=async(tableLabel:string,covers:number):Promise<SmmCommandResult|null>=>{
    if(!port?.createDineSession){
      setNotice({tone:'warning',message:'堂食服務目前未連接；沒有建立任何正式桌面。'});
      return null;
    }
    try{
      const result=await port.createDineSession({tableLabel,covers,operationId:crypto.randomUUID()});
      if(result.state==='CONFIRMED')void refresh();
      return result;
    }catch{
      return {state:'UNKNOWN',message:'正在確認桌面結果；系統不會假設操作成功。'};
    }
  };

  const setSellability=async(productId:string,available:boolean)=>{
    if(!port?.setSellability){
      setNotice({tone:'warning',message:'商品供應控制目前未連接；沒有更改任何門店資料。'});
      return;
    }
    try{
      const result=await port.setSellability({productId,available,operationId:crypto.randomUUID()});
      const tone:FeedbackTone=result.state==='CONFIRMED'?'success':result.state==='REJECTED'||result.state==='FAILED'?'danger':'warning';
      setNotice({tone,message:result.message});
      if(result.state==='CONFIRMED')void refresh();
    }catch{
      setNotice({tone:'warning',message:'商品供應操作結果未明；請先確認正式門店狀態。'});
    }
  };

  const activePending=pendingIntents.find(item=>item.state==='PENDING'||item.state==='UNKNOWN')??pendingIntents[0]??null;
  const cartCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  const connectionState=connectionCopy(connection);
  const workAttention=snapshot?.work.filter(item=>item.state!=='NORMAL').length??0;
  const statusAttention=(snapshot?.channels.filter(item=>item.state!=='CONNECTED').length??0)+(snapshot?.capacity&&snapshot.capacity.state!=='NORMAL'?1:0);
  const brandDetail=snapshot?.staff?`${snapshot.staff.displayName} · ${snapshot.staff.storeId}`:'店員模式 · 未連接門店';

  return <AppShell
    view={view}
    onView={changeView}
    workBadge={workAttention?String(workAttention):undefined}
    statusBadge={statusAttention?String(statusAttention):undefined}
    draftBadge={pendingIntents.length?String(pendingIntents.length):undefined}
    brandDetail={brandDetail}
    connectionLabel={connectionState.label}
    connectionTone={connectionState.tone}
    onRefresh={()=>void refresh()}
  >
    {notice?<ActionNotice tone={notice.tone} message={notice.message} actionLabel={notice.undoLineId?'撤銷':undefined} onAction={notice.undoLineId?()=>undoAddedLine(notice.undoLineId!):undefined} onDismiss={()=>setNotice(null)}/>:null}
    {error?<StateMessage tone="danger" title="門店資料同步失敗" detail={error} actionLabel="再試一次" onAction={()=>void refresh()}/>:null}
    {connection==='NOT_CONNECTED'?<StateMessage tone="neutral" title="尚未連接門店服務" detail="本機草稿同操作偏好可以使用；正式餐單、報價、訂單同營運狀態會保持空白，唔會顯示假資料。"/>:null}

    {view==='order'?<OrderView
      connection={connection}
      mode={orderMode}
      onMode={setOrderMode}
      categories={categories}
      activeCategoryId={effectiveCategoryId}
      onCategory={changeCategory}
      search={search}
      onSearch={setSearch}
      products={visibleProducts}
      menuObservedAt={menu?.observedAt}
      cartCount={cartCount}
      cartSummary={quote?money(quote.currency,quote.totalMinor):'等待正式報價'}
      onProduct={product=>{setSelectedProduct(product);setSelections({});setSelectedVariationId(null)}}
      onCart={()=>setCartOpen(true)}
      dineSessions={snapshot?.dineSessions??[]}
      dineConnected={Boolean(port?.createDineSession)}
      onCreateDine={createDine}
    />:null}
    {view==='work'?<WorkView connection={connection} items={snapshot?.work??[]} onRefresh={()=>void refresh()}/>:null}
    {view==='orders'?<OrdersView connection={connection} rows={snapshot?.orders??[]} sourceFilter={sourceFilter} onSourceFilter={changeSource}/>:null}
    {view==='status'?<StatusView connection={connection} snapshot={snapshot} canSetSellability={Boolean(port?.setSellability)} onSellability={(productId,available)=>void setSellability(productId,available)}/>:null}
    {view==='more'?<MoreView connection={connection} snapshot={snapshot} pendingIntents={pendingIntents} onReadback={intent=>void readbackIntent(intent)} onDiscard={removeIntent}/>:null}

    {selectedProduct?<ProductConfigurator
      open
      product={selectedProduct}
      selections={selections}
      selectedVariationId={selectedVariationId}
      onVariation={setSelectedVariationId}
      onToggle={(groupId,optionId)=>{
        const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
        if(group)setSelections(current=>toggleSmmSelection(current,group,optionId));
      }}
      onClose={()=>setSelectedProduct(null)}
      onAdd={addSelectedProduct}
    />:null}

    <CartReview
      open={cartOpen}
      cart={cart}
      quote={quote}
      quotePresentation={quotePresentation}
      pending={activePending}
      command={command}
      busy={commandBusy}
      onClose={()=>setCartOpen(false)}
      onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))}
      onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))}
      onRetryQuote={()=>setQuoteRequestVersion(version=>version+1)}
      onSubmit={()=>void submitCart()}
      onReadback={intent=>void readbackIntent(intent)}
    />
  </AppShell>;
}
