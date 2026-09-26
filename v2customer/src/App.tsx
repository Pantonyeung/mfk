import {useEffect,useMemo,useState} from 'react';
import {createCustomerPendingIntent,readCustomerLocalWorkspace,writeCustomerLocalWorkspace,type CustomerLocalPreferences} from './persistence';
import {resolveCustomerRuntimePort} from './runtime';
import {buildCustomerRecommendations} from './recommendation';
import {publishedCartRepairs,quotePublishedCart,repairPublishedCartLine} from './local-quote';
import {buildWhatsAppFallbackUrl} from './whatsapp-fallback';
import {selectedCustomerOptions,toggleCustomerSelection,validateCustomerSelections,type CustomerSelectionState} from './selection';
import {BottomNavigation,CustomerHeader,StatusBanner,type ActionState,type ProductOriginRect} from './ui/primitives';
import {CartView,CheckoutView,HomeView,MemberView,MenuView,OrdersView,ProductSheet,type MenuLayout,type OrderSegment} from './components/customer-views';
import type {
  CustomerCartLine,
  CustomerCheckoutDraft,
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerPendingIntent,
  CustomerProduct,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
  CustomerRuntimePort,
} from './product-types';

export type View='home'|'menu'|'cart'|'checkout'|'orders'|'more';

const nowIso=()=>new Date().toISOString();
const withoutPaymentEvidence=(value:CustomerCheckoutDraft):CustomerCheckoutDraft=>{
  const {paymentEvidence:_paymentEvidence,...rest}=value;
  return Object.freeze({...rest});
};
const presentWithContinuity=(change:()=>void)=>{
  const candidate=document as Document&{startViewTransition?:(update:()=>void)=>void};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!candidate.startViewTransition){change();return}
  candidate.startViewTransition(change);
};

// Compatibility vocabulary for established capability gates: 自家落單、菜單、購物籃、最後確認、訂單進度、
// 落單狀態、搜尋商品、商品詳情、最少、最多、安全提交、Submission ID、等待店舖接單、未能接單、
// 已接單、製作中、稍有延誤、可取餐、取餐核對、已交收、已完成、再次下單、自家渠道暫時不可用、
// 重新確認提交結果、記憶罐、記憶種子。UNKNOWN customer copy remains「請勿重複提交」；Recovery identity stays internal.

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
  const [selectedQuantity,setSelectedQuantity]=useState(1);
  const [selectedNote,setSelectedNote]=useState('');
  const [editingLineId,setEditingLineId]=useState<string|null>(null);
  const [productStep,setProductStep]=useState(0);
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('current');
  const [expandedOrderId,setExpandedOrderId]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [readingIntentId,setReadingIntentId]=useState<string|null>(null);
  const [jarPulseKey,setJarPulseKey]=useState(0);
  const [fallbackIntentId,setFallbackIntentId]=useState<string|null>(null);
  const [submitProbe,setSubmitProbe]=useState<Readonly<{attempt:number;total:number}>|null>(null);

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
    if(!port)return;
    let stopped=false;
    let busy=false;
    const poll=async()=>{
      if(stopped||busy||document.visibilityState!=='visible'||!navigator.onLine)return;
      busy=true;
      try{
        const next=await port.readSnapshot();
        if(!stopped){setSnapshot(next);setConnection('READY');}
      }catch{
        if(!stopped)setConnection('STALE');
      }finally{busy=false;}
    };
    const timer=window.setInterval(()=>void poll(),3000);
    const visible=()=>{if(document.visibilityState==='visible')void poll();};
    const focused=()=>void poll();
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('focus',focused);
    return()=>{stopped=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',focused);};
  },[port]);

  useEffect(()=>{
    const online=()=>setBrowserOnline(true);
    const offline=()=>setBrowserOnline(false);
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);
    return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline)};
  },[]);

  useEffect(()=>{
    setQuote(quotePublishedCart(cart,snapshot?.menu));
  },[cart,snapshot?.menu]);

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
    const changed=JSON.stringify(next)!==JSON.stringify(cart);
    const nextCheckout=changed&&checkout.paymentEvidence?withoutPaymentEvidence(checkout):checkout;
    setCart(next);
    if(nextCheckout!==checkout){
      setCheckout(nextCheckout);
      setNotice('餐點已更新；付款截圖需要重新提供，避免沿用上一個版本嘅付款證明。');
    }
    persist({cart:next,checkout:nextCheckout});
  };

  const closeProduct=()=>{
    setSelectedProduct(null);
    setSelectedProductOrigin(null);
    setSelections({});
    setSelectedVariationId(null);
    setSelectedQuantity(1);
    setSelectedNote('');
    setEditingLineId(null);
    setProductStep(0);
  };

  const openProduct=(product:CustomerProduct,origin:ProductOriginRect|null,line?:CustomerCartLine)=>{
    const restored:Record<string,string[]>={};
    if(line){
      for(const selection of line.selections){
        restored[selection.optionGroupId]=[...(restored[selection.optionGroupId]??[]),selection.optionId];
      }
    }
    setSelectedProduct(product);
    setSelectedProductOrigin(origin);
    setSelections(restored);
    setSelectedVariationId(line?.selectedVariationId??null);
    setSelectedQuantity(line?.quantity??1);
    setSelectedNote(line?.note??'');
    setEditingLineId(line?.lineId??null);
    setProductStep(0);
  };

  const addSelectedProduct=()=>{
    if(!selectedProduct)return;
    const validation=validateCustomerSelections(selectedProduct,selections);
    if(!validation.ok){setNotice(validation.issues[0]??'請完成商品設定');return}
    if(selectedProduct.variationRequired&&!selectedVariationId){setNotice('請先揀必選規格');return}
    const variation=selectedProduct.variations?.find(item=>item.variationId===selectedVariationId);
    const existing=editingLineId?cart.find(line=>line.lineId===editingLineId):null;
    const line:CustomerCartLine=Object.freeze({
      lineId:existing?.lineId??crypto.randomUUID(),
      productId:selectedProduct.productId,
      productName:selectedProduct.name,
      quantity:selectedQuantity,
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:{}),
      selections:selectedCustomerOptions(selectedProduct,selections),
      createdAt:existing?.createdAt??nowIso(),
      ...(selectedNote.trim()?{note:selectedNote.trim()}:{}),
      ...(Number.isSafeInteger(selectedProduct.publishedUnitPriceMinor)?{
        publishedUnitPriceMinor:Number(selectedProduct.publishedUnitPriceMinor)+selectedCustomerOptions(selectedProduct,selections).reduce((sum,option)=>sum+Number(option.publishedAdjustmentMinor||0),0),
      }:{}),
    });
    updateCart(existing?cart.map(item=>item.lineId===existing.lineId?line:item):[...cart,line]);
    setJarPulseKey(value=>value+1);
    setNotice(existing?'記憶罐已更新；未建立正式訂單。':'已加入記憶罐；未建立正式訂單。');
    closeProduct();
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
    const sameCart=JSON.stringify(cart)===JSON.stringify(intent.cart);
    const nextCart=sameCart?[]:cart;
    const nextCheckout=withoutPaymentEvidence(checkout);
    setPendingIntents(nextPending);
    setCart(nextCart);
    setCheckout(nextCheckout);
    setFallbackIntentId(null);
    persist({cart:nextCart,checkout:nextCheckout,pendingIntents:nextPending});
    setNotice(message);
    setOrderSegment('current');
    changeView('orders');
    void refresh();
  };

  const uploadPaymentEvidence=async(file:File)=>{
    setNotice('正在上載付款截圖…');
    changeCheckout({...checkout,paymentEvidence:{fileName:file.name,mimeType:file.type||'application/octet-stream',size:file.size,state:'LOCAL_PENDING_UPLOAD'}});
    if(!port?.uploadPaymentEvidence){setNotice('付款截圖上載服務暫時未連接。');return}
    try{
      const uploaded=await port.uploadPaymentEvidence(file);
      changeCheckout({...checkout,paymentEvidence:{fileName:file.name,mimeType:file.type,size:file.size,state:'UPLOADED',evidenceRef:uploaded.evidenceRef}});
      setNotice('付款截圖已上載，等待店舖核對。');
    }catch(error){
      changeCheckout({...checkout,paymentEvidence:undefined});
      setNotice(error instanceof Error?error.message:'付款截圖上載失敗，請再試。');
    }
  };

  const submit=async()=>{
    if(submitting)return;
    if(cart.length===0){setNotice('記憶罐未有商品。');return}
    if(checkout.phone.replace(/\D/g,'').length<8){setNotice('請輸入至少 8 位電話號碼。');return}
    const selectedPaymentChannel=checkout.paymentMethod==='ELECTRONIC'
      ?(snapshot?.paymentChannels??[]).find(channel=>channel.channelId===checkout.paymentChannelId)
      :undefined;
    if(checkout.paymentMethod==='ELECTRONIC'&&!checkout.paymentChannelId){setNotice('請先選擇一個店舖提供嘅電子支付方式。');return}
    if(checkout.paymentMethod==='ELECTRONIC'&&(!selectedPaymentChannel?.qrImageUrl||checkout.paymentChannelLabel!==selectedPaymentChannel.label)){setNotice('付款方式資料已更新或者 QR 尚未設定，請重新選擇付款方式。');return}
    if(checkout.paymentMethod==='ELECTRONIC'&&!checkout.paymentEvidence){setNotice('電子支付需要提供今次付款截圖，畀店舖核對。');return}
    if(checkout.paymentMethod==='ELECTRONIC'&&checkout.paymentEvidence?.state==='LOCAL_PENDING_UPLOAD'){setNotice('付款截圖已選擇，但上載仍未完成；未完成前唔會當成已付款。');return}
    const cartFingerprint=JSON.stringify(cart);
    const checkoutFingerprint=JSON.stringify(checkout);
    let existing=pendingIntents.find(item=>
      (item.state==='DRAFT'||item.state==='NOT_CONNECTED')&&
      JSON.stringify(item.cart)===cartFingerprint&&
      JSON.stringify(item.checkout)===checkoutFingerprint&&
      item.menuRevision===String(menu?.revision||'')
    );
    setSubmitting(true);
    setFallbackIntentId(null);
    let attemptedIntent:CustomerPendingIntent|null=null;
    try{
      const sameCartUnknown=pendingIntents.find(item=>item.state==='UNKNOWN'&&JSON.stringify(item.cart)===cartFingerprint);
      if(sameCartUnknown){
        if(!port?.readSubmission){
          setNotice('上一個同一餐點提交結果仍未確認；未有安全讀回前唔會建立另一張單。');
          return;
        }
        const prior=await port.readSubmission(sameCartUnknown.submissionId);
        if(prior.state==='CONFIRMED'){
          resolveConfirmedIntent(sameCartUnknown,prior.message||'店舖已確認上一個提交');
          return;
        }
        saveIntent(Object.freeze({...sameCartUnknown,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:prior.message}));
        setNotice('上一個同一餐點提交結果仍未確認；已查詢原本 Submission ID，唔會建立第二張單。');
        return;
      }

      const staleUnknowns=pendingIntents.filter(item=>item.state==='UNKNOWN'&&JSON.stringify(item.cart)!==cartFingerprint);
      if(staleUnknowns.length&&port?.readSubmission){
        const resolvedIds:string[]=[];
        for(const priorIntent of staleUnknowns){
          const prior=await port.readSubmission(priorIntent.submissionId);
          if(prior.state==='CONFIRMED')resolvedIds.push(priorIntent.submissionId);
        }
        if(resolvedIds.length){
          const nextPending=pendingIntents.filter(item=>!resolvedIds.includes(item.submissionId));
          setPendingIntents(nextPending);
          persist({pendingIntents:nextPending});
        }
      }

      const base=existing??createCustomerPendingIntent(cart,checkout,String(menu?.revision||''));
      if(!port?.submitOrder){
        const cleanCheckout=withoutPaymentEvidence(checkout);
        const offlineIntent=Object.freeze({...base,checkout:cleanCheckout,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'店舖接單系統暫時未連接；可以改用 WhatsApp。'});
        setCheckout(cleanCheckout);
        saveIntent(offlineIntent);
        setFallbackIntentId(base.submissionId);
        setNotice('暫時未能自動接單；可以改用 WhatsApp。');
        return;
      }

      if(port.probeOrderBackend){
        setSubmitProbe({attempt:1,total:3});
        const health=await port.probeOrderBackend((attempt,total)=>setSubmitProbe({attempt,total}));
        setSubmitProbe(null);
        if(!health.reachable){
          const cleanCheckout=withoutPaymentEvidence(checkout);
          const offlineIntent=Object.freeze({...base,checkout:cleanCheckout,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'已完成 3 次有限連線檢查；暫時未能自動接單。'});
          setCheckout(cleanCheckout);
          saveIntent(offlineIntent);
          setFallbackIntentId(base.submissionId);
          setNotice('已完成 3 次連線檢查；暫時未能自動接單，可以轉用 WhatsApp。');
          return;
        }
      }

      const pending=Object.freeze({...base,state:'PENDING' as const,updatedAt:nowIso(),lastMessage:'正在連接店舖接單系統'});
      attemptedIntent=pending;
      saveIntent(pending);
      const result=await port.submitOrder(pending);
      if(result.state==='CONFIRMED'){resolveConfirmedIntent(pending,result.message||'店舖已確認訂單');return}

      const cleanCheckout=withoutPaymentEvidence(checkout);
      setCheckout(cleanCheckout);
      if(result.state==='UNKNOWN'){
        saveIntent(Object.freeze({...pending,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:result.message}));
        setFallbackIntentId(null);
        setNotice('提交結果未明；系統會先查詢原本嗰次落單，唔會建立第二張。今次付款截圖已從新訂單表格清除。');
        return;
      }

      const unresolved=Object.freeze({...pending,checkout:cleanCheckout,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:result.message});
      saveIntent(unresolved);
      if(result.state==='NOT_CONNECTED')setFallbackIntentId(pending.submissionId);
      setNotice(result.message);
    }catch{
      const cleanCheckout=withoutPaymentEvidence(checkout);
      setCheckout(cleanCheckout);
      if(attemptedIntent){
        saveIntent(Object.freeze({...attemptedIntent,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:'提交結果未明；需要讀回原本結果'}));
        setFallbackIntentId(null);
        setNotice('提交結果未明；原本嗰次落單已保留並會先讀回，唔會自動重送。');
      }else{
        const base=existing??createCustomerPendingIntent(cart,cleanCheckout,String(menu?.revision||''));
        const offlineIntent=Object.freeze({...base,checkout:cleanCheckout,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'店舖接單系統暫時未連接；可以改用 WhatsApp。'});
        saveIntent(offlineIntent);
        setFallbackIntentId(base.submissionId);
        setNotice('暫時未能完成店舖連線檢查；可以改用 WhatsApp。');
      }
    }finally{
      setSubmitProbe(null);
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
      setJarPulseKey(value=>value+1);
      setNotice(result.attention?.length?'已按目前菜單重建記憶罐；需要修正：'+result.attention.join('、'):'已按目前菜單、價格同供應狀態重建記憶罐。');
      changeView('cart');
    }catch{
      setNotice('暫時未能重新驗證舊訂單；冇建立新訂單。');
    }
  };

  const acceptCartRepair=(lineId:string)=>{
    const line=cart.find(item=>item.lineId===lineId);
    if(!line){setNotice('搵唔到需要更新嘅餐點。');return}
    const repaired=repairPublishedCartLine(line,menu);
    if(!repaired){
      setNotice('呢一項唔可以直接接受新價格；請用「修正」只編輯呢一項，其他餐點會保留。');
      return;
    }
    updateCart(cart.map(item=>item.lineId===lineId?repaired:item));
    setNotice('已按目前餐牌更新「'+repaired.productName+'」；其他餐點冇改動。');
  };

  const requestFallback=async()=>{
    const fallback=snapshot?.fallback;
    const submissionId=fallbackIntentId??pendingIntents[0]?.submissionId;
    if(!fallback?.enabled){setNotice('店舖暫時未設定 WhatsApp 備用聯絡。');return}
    const url=buildWhatsAppFallbackUrl({fallback,cart,checkout,quote,submissionId});
    if(!url){setNotice('WhatsApp 備用聯絡資料未完整。');return}
    window.open(url,'_blank','noopener,noreferrer');
    setNotice('已開啟 WhatsApp；訊息只會喺你主動送出後傳送畀店舖。');
  };

  const activeOrders=snapshot?.activeOrders??[];
  const history=snapshot?.history??[];
  const currentPending=pendingIntents[0]??null;
  const currentFallbackIntent=pendingIntents.find(item=>item.state==='NOT_CONNECTED'&&JSON.stringify(item.cart)===JSON.stringify(cart))??null;
  const fallbackAvailable=Boolean((fallbackIntentId||currentFallbackIntent)&&snapshot?.fallback?.enabled);
  const cartCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  const cartRepairs=useMemo(()=>publishedCartRepairs(cart,menu),[cart,menu]);
  const allProducts=menu?.products??[];
  const homeRecommendations=buildCustomerRecommendations({products:allProducts,history,cart,limit:4});
  const menuRecommendations=buildCustomerRecommendations({products:allProducts,history,cart,activeCategoryId:effectiveCategoryId,limit:4});
  const cartSuggestions=buildCustomerRecommendations({products:allProducts,history,cart,activeCategoryId:effectiveCategoryId,limit:2});
  const actionState:ActionState=quote?.freshness==='MATERIAL_CHANGE'||!cart.length||!quote?'disabled':readingIntentId||submitting?'loading':currentPending?.state==='UNKNOWN'?'unknown':currentPending?.state==='PENDING'?'pending':'default';

  return <main className="customer-shell" data-network={!browserOnline?'offline':connection.toLowerCase()}>
    <CustomerHeader storeName={snapshot?.store?.storeName} connection={connection} browserOnline={browserOnline} onHome={()=>changeView('home')} onService={()=>changeView('more')}/>
    <div className="global-status" aria-live="polite">
      {notice?<section className="notice" role="status"><p>{notice}</p><button onClick={()=>setNotice(null)}>收起</button></section>:null}
      {!browserOnline?<StatusBanner tone="offline" title="目前離線" detail="已載入內容仍然可以查看。本機記憶罐、聯絡資料同待提交草稿已保留，恢復連線前唔會自動提交。"/>:null}
      {browserOnline&&connection==='ERROR'?<StatusBanner tone="danger" title="暫時未能同步店舖資料" detail={error||'請檢查連線後再試。'} actionLabel="安全重試" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='NOT_CONNECTED'?<StatusBanner tone="warning" title="店舖服務尚未連接" detail="記憶罐、聯絡資料同待提交草稿會保留喺本機；正式菜單、價格、訂單、會員同取餐狀態唔會用假資料代替。"/>:null}
      {browserOnline&&(connection==='STALE'||connection==='PARTIAL')?<StatusBanner tone="warning" title="正顯示最近一次資料" detail="店舖最新狀態仍在更新。涉及價格或落單結果時會要求再次確認。" actionLabel="更新資料" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='UNKNOWN'?<StatusBanner tone="warning" title="正在確認店舖狀態" detail="暫時唔會將未確認結果當成成功。" actionLabel="重新確認" onAction={()=>void refresh()}/>:null}
      {fallbackAvailable?<StatusBanner tone="warning" title="暫時未能自動接單" detail="系統已完成 3 次有限連線檢查；呢張訂單未送入正式接單流程。你可以用同一份餐點資料改經 WhatsApp 人手落單。" actionLabel="轉用 WhatsApp" onAction={()=>void requestFallback()}/>:null}
    </div>

    <section className="viewport" aria-busy={connection==='LOADING'}>
      {view==='home'?<HomeView snapshot={snapshot} connection={connection} activeOrders={activeOrders} history={history} recommendations={homeRecommendations} cartCount={cartCount} onRefresh={()=>void refresh()} onProduct={openProduct} onBrowse={()=>changeView('menu')} onJar={()=>changeView('cart')} onOrders={()=>{setOrderSegment('current');changeView('orders')}} onHistory={()=>{setOrderSegment('history');changeView('orders')}} onMember={()=>changeView('more')} onBuyAgain={order=>void reorder(order)} onFallback={()=>void requestFallback()}/>:null}
      {view==='menu'?<MenuView connection={connection} categories={categories} activeCategoryId={effectiveCategoryId} setCategory={category=>presentWithContinuity(()=>changeCategory(category))} query={search} setQuery={setSearch} layout={menuLayout} setLayout={layout=>presentWithContinuity(()=>setMenuLayout(layout))} products={visibleProducts} recommendations={menuRecommendations} onProduct={(product,origin)=>openProduct(product,origin)} cartCount={cartCount} quote={quote} onCart={()=>changeView('cart')}/>:null}
      {view==='cart'?<CartView cart={cart} quote={quote} repairs={cartRepairs} checkout={checkout} member={snapshot?.member} suggestions={cartSuggestions} products={menu?.products??[]} onProduct={openProduct} onAcceptRepair={acceptCartRepair} onCheckoutChange={changeCheckout} onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))} onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))} onMenu={()=>changeView('menu')} onCheckout={()=>changeView('checkout')}/>:null}
      {view==='checkout'?<CheckoutView cart={cart} quote={quote} checkout={checkout} setCheckout={changeCheckout} paymentChannels={snapshot?.paymentChannels??[]} pending={currentPending} actionState={actionState} submitProbe={submitProbe} fallbackAvailable={fallbackAvailable} onFallback={()=>void requestFallback()} onSubmit={()=>void submit()} onReadback={intent=>void readbackIntent(intent)} onBack={()=>changeView('cart')} onRepair={()=>changeView('cart')} onPaymentEvidence={file=>void uploadPaymentEvidence(file)}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} active={activeOrders} history={history} expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId} onReorder={order=>void reorder(order)} onBrowse={()=>changeView('menu')} connection={connection}/>:null}
      {view==='more'?<MemberView connection={connection} snapshot={snapshot} history={history} pendingIntents={pendingIntents} readingIntentId={readingIntentId} onRefresh={()=>void refresh()} onReadback={intent=>void readbackIntent(intent)} onDiscard={removeIntent} onFallback={()=>void requestFallback()} onReorder={order=>void reorder(order)} onBrowse={()=>changeView('menu')}/>:null}
    </section>

    {view!=='checkout'?<BottomNavigation active={view} cartCount={cartCount} orderCount={activeOrders.length} pulseKey={jarPulseKey} onChange={changeView}/>:null}

    {selectedProduct?<ProductSheet product={selectedProduct} selections={selections} selectedVariationId={selectedVariationId} quantity={selectedQuantity} note={selectedNote} currentStep={productStep} editing={Boolean(editingLineId)} setStep={setProductStep} setVariation={setSelectedVariationId} setQuantity={setSelectedQuantity} setNote={setSelectedNote} toggle={(groupId,optionId)=>{
      const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
      if(group)setSelections(current=>toggleCustomerSelection(current,group,optionId));
    }} origin={selectedProductOrigin} onClose={closeProduct} onAdd={addSelectedProduct}/>:null}
  </main>;
}
