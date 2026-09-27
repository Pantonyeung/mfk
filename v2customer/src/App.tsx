import {useEffect,useMemo,useRef,useState} from 'react';
import {createCustomerPendingIntent,customerFallbackReference,readCustomerLocalWorkspace,writeCustomerLocalWorkspace,type CustomerLocalPreferences} from './persistence';
import {resolveCustomerRuntimePort} from './runtime';
import {buildCustomerRecommendations} from './recommendation';
import {publishedCartRepairs,quotePublishedCart,repairPublishedCartLine} from './local-quote';
import {buildWhatsAppFallbackUrl} from './whatsapp-fallback';
import {customerComboPublishedUnitMinor,customerStandalonePublishedUnitMinor,restoreCustomerComboSelectionState,selectedCustomerComboIntent,selectedCustomerOptions,toggleCustomerComboSelection,toggleCustomerSelection,validateCustomerComboSelection,validateCustomerSelections,type CustomerComboSelectionState,type CustomerSelectionState} from './selection';
import {BottomNavigation,CustomerHeader,StatusBanner,type ActionState,type ProductOriginRect} from './ui/primitives';
import {CartView,HomeView,MemberView,OrdersView,type MenuLayout,type OrderSegment} from './components/customer-views';
import {CheckoutUi4View,type CustomerUi4CheckoutStep} from './components/customer-checkout-ui4';
import {SubmitUi5View,WaitingStoreConfirmationUi5View} from './components/customer-submit-ui5';
import {ProductSheet} from './components/product-sheet-ui3';
import {Stage2Menu} from './stage2/Stage2Menu';
import {Stage2BottomNavigation} from './stage2/Stage2BottomNavigation';
import type {
  CustomerCartLine,
  CustomerCheckoutDraft,
  CustomerCommandResult,
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerPendingIntent,
  CustomerProduct,
  CustomerQuoteSnapshot,
  CustomerReadModelSnapshot,
  CustomerRuntimePort,
} from './product-types';

export type View='home'|'menu'|'cart'|'checkout'|'submit'|'waiting'|'orders'|'more';

type CustomerRoute={
  view:View;
  checkoutStep?:CustomerUi4CheckoutStep;
  submissionId?:string;
  waitingOrderId?:string;
};
const customerRouteFromPath=(pathname:string):CustomerRoute|null=>{
  if(pathname==='/memory-jar')return {view:'cart'};
  if(pathname==='/checkout/contact')return {view:'checkout',checkoutStep:'contact'};
  if(pathname==='/checkout/payment')return {view:'checkout',checkoutStep:'payment'};
  if(pathname==='/checkout/review')return {view:'checkout',checkoutStep:'review'};
  const submitMatch=pathname.match(/^\/submit\/([^/]+)$/);
  if(submitMatch)return {view:'submit',submissionId:decodeURIComponent(submitMatch[1])};
  const waitingMatch=pathname.match(/^\/orders\/([^/]+)\/waiting$/);
  if(waitingMatch)return {view:'waiting',waitingOrderId:decodeURIComponent(waitingMatch[1])};
  if(pathname==='/menu')return {view:'menu'};
  if(pathname==='/orders')return {view:'orders'};
  if(pathname==='/member')return {view:'more'};
  if(pathname==='/'||pathname==='')return {view:'home'};
  return null;
};
const pathForView=(view:'home'|'menu'|'cart'|'orders'|'more')=>({
  home:'/',
  menu:'/menu',
  cart:'/memory-jar',
  orders:'/orders',
  more:'/member',
})[view];
const pathForCheckoutStep=(step:CustomerUi4CheckoutStep)=>'/checkout/'+step;
const replacePath=(path:string)=>{
  if(typeof window==='undefined'||window.location.pathname===path)return;
  window.history.pushState({mfkCustomer:true},'',path);
};

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
  const initialRoute=useMemo(()=>customerRouteFromPath(typeof window==='undefined'?'':window.location.pathname),[]);
  const initialSubmission=initialRoute?.submissionId?initial.pendingIntents.find(item=>item.submissionId===initialRoute.submissionId):undefined;
  const [view,setView]=useState<View>(initialRoute?.view??initial.preferences.activeView);
  const [checkoutStep,setCheckoutStep]=useState<CustomerUi4CheckoutStep>(initialRoute?.checkoutStep??'contact');
  const [submitRouteId,setSubmitRouteId]=useState<string|null>(initialRoute?.submissionId??null);
  const [waitingOrderId,setWaitingOrderId]=useState<string|null>(initialRoute?.waitingOrderId??null);
  const [activeCategoryId,setActiveCategoryId]=useState<string|null>(initial.preferences.activeCategoryId);
  const [cart,setCart]=useState<readonly CustomerCartLine[]>(initialSubmission?.cart??initial.cart);
  const [checkout,setCheckout]=useState<CustomerCheckoutDraft>(initialSubmission?.checkout??initial.checkout);
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
  const [selectedComboEnabled,setSelectedComboEnabled]=useState(false);
  const [selectedComboSelections,setSelectedComboSelections]=useState<CustomerComboSelectionState>(Object.freeze([]));
  const [selectedVariationId,setSelectedVariationId]=useState<string|null>(null);
  const [selectedQuantity,setSelectedQuantity]=useState(1);
  const [selectedNote,setSelectedNote]=useState('');
  const [editingLineId,setEditingLineId]=useState<string|null>(null);
  const [orderSegment,setOrderSegment]=useState<OrderSegment>('current');
  const [expandedOrderId,setExpandedOrderId]=useState<string|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [readingIntentId,setReadingIntentId]=useState<string|null>(null);
  const [jarPulseKey,setJarPulseKey]=useState(0);
  const [fallbackIntentId,setFallbackIntentId]=useState<string|null>(null);
  const [submitProbe,setSubmitProbe]=useState<Readonly<{attempt:number;total:number}>|null>(null);
  const submitLockRef=useRef(false);

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
      if(next==='home'||next==='menu'||next==='cart'||next==='orders'||next==='more')replacePath(pathForView(next));
      persist({preferences:{activeView:next==='submit'||next==='waiting'?'orders':next,activeCategoryId}});
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

  const openCheckoutStep=async(step:CustomerUi4CheckoutStep)=>{
    if(step==='contact'||step==='review')await refresh();
    presentWithContinuity(()=>{
      setCheckoutStep(step);
      setView('checkout');
      replacePath(pathForCheckoutStep(step));
      persist({preferences:{activeView:'checkout',activeCategoryId}});
      window.scrollTo({top:0,behavior:'auto'});
    });
  };

  const openSubmitRoute=(submissionId:string)=>{
    presentWithContinuity(()=>{
      setSubmitRouteId(submissionId);
      setWaitingOrderId(null);
      setView('submit');
      replacePath('/submit/'+encodeURIComponent(submissionId));
      persist({preferences:{activeView:'orders',activeCategoryId}});
      window.scrollTo({top:0,behavior:'auto'});
    });
  };

  const openWaitingRoute=(orderId:string)=>{
    presentWithContinuity(()=>{
      setWaitingOrderId(orderId);
      setSubmitRouteId(null);
      setView('waiting');
      replacePath('/orders/'+encodeURIComponent(orderId)+'/waiting');
      persist({preferences:{activeView:'orders',activeCategoryId}});
      window.scrollTo({top:0,behavior:'auto'});
    });
  };

  const startUi5Submission=()=>{
    if(submitBlockReason){setNotice(submitBlockReason);return}
    if(!quote||quote.freshness!=='CURRENT'){setNotice('提交前價格未係 CURRENT；請先重新確認。');return}
    if(cartRepairs.length){setNotice('仍有餐點需要修正；只修受影響項目後再提交。');return}
    const cartFingerprint=JSON.stringify(cart);
    const checkoutFingerprint=JSON.stringify(checkout);
    const same=pendingIntents.find(item=>
      JSON.stringify(item.cart)===cartFingerprint&&
      JSON.stringify(item.checkout)===checkoutFingerprint&&
      item.menuRevision===String(menu?.revision||'')
    );
    if(same?.state==='DELIVERED'&&same.canonicalOrderId){openWaitingRoute(same.canonicalOrderId);return}
    const intent=same??createCustomerPendingIntent(cart,checkout,String(menu?.revision||''));
    if(!same)saveIntent(intent);
    openSubmitRoute(intent.submissionId);
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
    const onPopState=()=>{
      const route=customerRouteFromPath(window.location.pathname);
      if(!route)return;
      setView(route.view);
      if(route.checkoutStep)setCheckoutStep(route.checkoutStep);
      setSubmitRouteId(route.submissionId??null);
      setWaitingOrderId(route.waitingOrderId??null);
    };
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);

  useEffect(()=>{
    setQuote(quotePublishedCart(cart,snapshot?.menu));
  },[cart,snapshot?.menu]);

  const menu=snapshot?.menu;
  const selectedPaymentChannel=checkout.paymentMethod==='ELECTRONIC'
    ?(snapshot?.paymentChannels??[]).find(channel=>channel.channelId===checkout.paymentChannelId)
    :undefined;
  const submitBlockReason=(()=>{
    if(!cart.length)return '記憶罐未有商品。';
    if(checkout.phone.replace(/\D/g,'').length<8)return '請先輸入至少 8 位電話號碼。';
    if(checkout.paymentMethod!=='ELECTRONIC')return null;
    if(!checkout.paymentChannelId)return '請先選擇一個電子支付方式。';
    if(!selectedPaymentChannel||checkout.paymentChannelLabel!==selectedPaymentChannel.label)return '付款方式資料已更新，請重新選擇付款方式。';
    if(!selectedPaymentChannel.qrImageUrl)return '呢個電子支付方式未有付款 QR，暫時不可提交。請改用到店付款，或者選擇另一個已設定付款碼嘅渠道。';
    if(!checkout.paymentEvidence)return '請先上傳今次付款截圖。';
    if(checkout.paymentEvidence.state==='LOCAL_PENDING_UPLOAD')return '付款截圖仍在上載，請等上載完成。';
    return null;
  })();
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
      setNotice('餐點已更新；舊付款憑證已失效，請重新提供今次付款憑證。');
    }
    persist({cart:next,checkout:nextCheckout});
  };

  const closeProduct=()=>{
    setSelectedProduct(null);
    setSelectedProductOrigin(null);
    setSelections({});
    setSelectedComboEnabled(false);
    setSelectedComboSelections(Object.freeze([]));
    setSelectedVariationId(null);
    setSelectedQuantity(1);
    setSelectedNote('');
    setEditingLineId(null);
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
    setSelectedComboEnabled(Boolean(line?.combo));
    setSelectedComboSelections(restoreCustomerComboSelectionState(line?.combo));
    setSelectedVariationId(line?.selectedVariationId??null);
    setSelectedQuantity(line?.quantity??1);
    setSelectedNote(line?.note??'');
    setEditingLineId(line?.lineId??null);
  };

  const addSelectedProduct=()=>{
    if(!selectedProduct)return;
    const validation=validateCustomerSelections(selectedProduct,selections);
    if(!validation.ok){setNotice(validation.issues[0]??'請完成商品設定');return}
    if(selectedProduct.variationRequired&&!selectedVariationId){setNotice('請先揀必選規格');return}

    if(selectedComboEnabled){
      const comboValidation=validateCustomerComboSelection(selectedProduct,menu,selectedComboSelections);
      if(!comboValidation.ok){setNotice(comboValidation.issues[0]??'請完成套餐設定');return}
    }

    const ordinarySelections=selectedCustomerOptions(selectedProduct,selections);
    const comboIntent=selectedComboEnabled
      ?selectedCustomerComboIntent(selectedProduct,menu,selectedComboSelections)
      :null;
    if(selectedComboEnabled&&!comboIntent){setNotice('套餐資料待同步，暫時未能加入套餐。');return}

    const comboUnitMinor=comboIntent?customerComboPublishedUnitMinor(comboIntent,ordinarySelections):null;
    if(comboIntent&&comboUnitMinor===null){setNotice('套餐價格資料待同步，請稍後再試。');return}

    const standaloneUnitMinor=!comboIntent
      ?customerStandalonePublishedUnitMinor(selectedProduct,ordinarySelections)
      :null;
    if(!comboIntent&&standaloneUnitMinor===null){setNotice('商品價格資料待同步，請稍後再試。');return}
    const publishedUnitPriceMinor=comboIntent?comboUnitMinor:standaloneUnitMinor;

    const variation=selectedProduct.variations?.find(item=>item.variationId===selectedVariationId);
    const existing=editingLineId?cart.find(line=>line.lineId===editingLineId):null;
    const line:CustomerCartLine=Object.freeze({
      lineId:existing?.lineId??crypto.randomUUID(),
      productId:selectedProduct.productId,
      productName:selectedProduct.name,
      quantity:selectedQuantity,
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:{}),
      selections:ordinarySelections,
      ...(comboIntent?{combo:comboIntent}:{}),
      createdAt:existing?.createdAt??nowIso(),
      ...(selectedNote.trim()?{note:selectedNote.trim()}:{}),
      ...(publishedUnitPriceMinor!==null&&Number.isSafeInteger(publishedUnitPriceMinor)?{publishedUnitPriceMinor}:{}),
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

  const resolveDeliveredIntent=(intent:CustomerPendingIntent,result:CustomerCommandResult,message:string)=>{
    if(!result.orderId){
      const unknown=Object.freeze({...intent,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:'正式 Order 已回覆成功，但缺少 canonical Order readback identity；保持 UNKNOWN。'});
      saveIntent(unknown);
      setSubmitRouteId(intent.submissionId);
      setNotice('正式結果未完整讀回；請勿重複提交，只可重新確認原本提交。');
      return;
    }
    const delivered=Object.freeze({
      ...intent,
      state:'DELIVERED' as const,
      updatedAt:nowIso(),
      canonicalOrderId:result.orderId,
      ...(result.displayCode?{canonicalDisplay:result.displayCode}:{}),
      ...(result.committedAt?{committedAt:result.committedAt}:{}),
      lastMessage:message,
    });
    const nextPending=[delivered,...pendingIntents.filter(item=>item.submissionId!==intent.submissionId)].slice(0,12);
    const sameCart=JSON.stringify(cart)===JSON.stringify(intent.cart);
    const nextCart=sameCart?[]:cart;
    const nextCheckout=withoutPaymentEvidence(checkout);
    setPendingIntents(nextPending);
    setCart(nextCart);
    setCheckout(nextCheckout);
    setFallbackIntentId(null);
    setOrderSegment('current');
    setSubmitRouteId(null);
    setWaitingOrderId(result.orderId);
    setNotice('訂單已成功送達；而家等待店舖正式確認。');
    presentWithContinuity(()=>{
      setView('waiting');
      replacePath('/orders/'+encodeURIComponent(result.orderId!)+'/waiting');
      persist({
        cart:nextCart,
        checkout:nextCheckout,
        pendingIntents:nextPending,
        preferences:{activeView:'orders',activeCategoryId},
      });
      window.scrollTo({top:0,behavior:'auto'});
    });
    void refresh();
  };

  const uploadPaymentEvidence=async(file:File)=>{
    setNotice('正在上載付款截圖…');
    changeCheckout({...checkout,paymentEvidence:{fileName:file.name,mimeType:file.type||'application/octet-stream',size:file.size,state:'LOCAL_PENDING_UPLOAD'}});
    if(!port?.uploadPaymentEvidence){setNotice('付款截圖上載服務暫時未連接。');return}
    try{
      const uploaded=await port.uploadPaymentEvidence(file);
      changeCheckout({...checkout,paymentEvidence:{fileName:file.name,mimeType:file.type,size:file.size,state:'UPLOADED',evidenceRef:uploaded.evidenceRef}});
      setNotice('已提交付款憑證，等待店舖核對。');
    }catch(error){
      changeCheckout({...checkout,paymentEvidence:undefined});
      setNotice(error instanceof Error?error.message:'付款截圖上載失敗，請再試。');
    }
  };

  const submit=async(routeIntent?:CustomerPendingIntent)=>{
    if(submitLockRef.current||submitting)return;
    if(routeIntent&&routeIntent.state!=='DRAFT')return;
    const intentCart=routeIntent?.cart??cart;
    const intentCheckout=routeIntent?.checkout??checkout;
    const intentMenuRevision=routeIntent?.menuRevision??String(menu?.revision||'');
    const submitReason=(()=>{
      if(!intentCart.length)return '記憶罐未有商品。';
      if(intentCheckout.phone.replace(/\D/g,'').length<8)return '請先輸入至少 8 位電話號碼。';
      if(intentCheckout.paymentMethod==='ELECTRONIC'){
        const channel=(snapshot?.paymentChannels??[]).find(item=>item.channelId===intentCheckout.paymentChannelId);
        if(!intentCheckout.paymentChannelId||!channel||channel.label!==intentCheckout.paymentChannelLabel)return '付款方式資料已更新，請返回付款頁重新確認。';
        if(!channel.qrImageUrl)return '電子支付 QR 已失效，請返回付款頁重新確認。';
        if(intentCheckout.paymentEvidence?.state!=='UPLOADED'||!intentCheckout.paymentEvidence.evidenceRef)return '付款憑證未完成，請返回付款頁重新確認。';
      }
      const latestQuote=quotePublishedCart(intentCart,menu);
      const latestRepairs=publishedCartRepairs(intentCart,menu);
      if(!latestQuote||latestQuote.freshness!=='CURRENT'||latestRepairs.length)return '提交前餐牌、價格或供應資料有變更；請返回記憶罐只修受影響餐點。';
      return null;
    })();
    if(submitReason){setNotice(submitReason);return}
    submitLockRef.current=true;
    const cartFingerprint=JSON.stringify(intentCart);
    const checkoutFingerprint=JSON.stringify(intentCheckout);
    let existing=routeIntent??pendingIntents.find(item=>
      item.state==='DRAFT'&&
      JSON.stringify(item.cart)===cartFingerprint&&
      JSON.stringify(item.checkout)===checkoutFingerprint&&
      item.menuRevision===intentMenuRevision
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
          resolveDeliveredIntent(sameCartUnknown,prior,prior.message||'店舖已確認上一個提交');
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

      const base=existing??createCustomerPendingIntent(intentCart,intentCheckout,intentMenuRevision);
      if(!port?.submitOrder){
        const cleanCheckout=withoutPaymentEvidence(intentCheckout);
        const offlineIntent=Object.freeze({...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'店舖接單系統暫時未連接；可以改用 WhatsApp。'});
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
          const cleanCheckout=withoutPaymentEvidence(intentCheckout);
          const offlineIntent=Object.freeze({...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'已完成 3 次有限連線檢查；暫時未能自動接單。'});
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
      if(result.state==='CONFIRMED'){resolveDeliveredIntent(pending,result,result.message||'店舖已確認訂單');return}

      const cleanCheckout=withoutPaymentEvidence(intentCheckout);
      setCheckout(cleanCheckout);
      if(result.state==='UNKNOWN'){
        saveIntent(Object.freeze({...pending,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:result.message}));
        setFallbackIntentId(null);
        setNotice('提交結果未明；系統會先查詢原本嗰次落單，唔會建立第二張。今次付款截圖已從新訂單表格清除。');
        return;
      }

      if(result.state==='REJECTED'||result.state==='FAILED'){
        const rejected=Object.freeze({...pending,state:'REJECTED' as const,updatedAt:nowIso(),lastMessage:result.message});
        saveIntent(rejected);
        setFallbackIntentId(null);
        setNotice(result.message||'店舖未能接受今次訂單；請返回記憶罐重新確認。');
        return;
      }
      const unresolved=Object.freeze({...pending,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:result.message});
      saveIntent(unresolved);
      setFallbackIntentId(pending.submissionId);
      setNotice(result.message);
    }catch{
      const cleanCheckout=withoutPaymentEvidence(intentCheckout);
      setCheckout(cleanCheckout);
      if(attemptedIntent){
        saveIntent(Object.freeze({...attemptedIntent,state:'UNKNOWN' as const,updatedAt:nowIso(),lastMessage:'提交結果未明；需要讀回原本結果'}));
        setFallbackIntentId(null);
        setNotice('提交結果未明；原本嗰次落單已保留並會先讀回，唔會自動重送。');
      }else{
        const base=existing??createCustomerPendingIntent(intentCart,intentCheckout,intentMenuRevision);
        const offlineIntent=Object.freeze({...base,state:'NOT_CONNECTED' as const,updatedAt:nowIso(),lastMessage:'店舖接單系統暫時未連接；可以改用 WhatsApp。'});
        saveIntent(offlineIntent);
        setFallbackIntentId(base.submissionId);
        setNotice('暫時未能完成店舖連線檢查；可以改用 WhatsApp。');
      }
    }finally{
      submitLockRef.current=false;
      setSubmitProbe(null);
      setSubmitting(false);
    }
  };

  const readbackIntent=async(intent:CustomerPendingIntent)=>{
    if(readingIntentId)return;
    setReadingIntentId(intent.submissionId);
    try{
      if(!port?.readSubmission){
        saveIntent(Object.freeze({...intent,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:'訂單查詢服務尚未連接；只可稍後重新讀回原本提交'}));
        setNotice('訂單查詢服務尚未連接；冇重新提交任何交易。');
        return;
      }
      const result=await port.readSubmission(intent.submissionId);
      if(result.state==='CONFIRMED'){resolveDeliveredIntent(intent,result,result.message||'店舖已確認訂單');return}
      if(result.state==='REJECTED'||result.state==='FAILED'){
        saveIntent(Object.freeze({...intent,state:'REJECTED',updatedAt:nowIso(),lastMessage:result.message}));
        setNotice(result.message||'店舖未能接受今次訂單。');
        return;
      }
      saveIntent(Object.freeze({...intent,state:'UNKNOWN',updatedAt:nowIso(),lastMessage:result.message}));
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
      const nextCheckout=checkout.paymentEvidence?withoutPaymentEvidence(checkout):checkout;
      setCart(result.cart);
      if(nextCheckout!==checkout)setCheckout(nextCheckout);
      persist({
        cart:result.cart,
        checkout:nextCheckout,
        preferences:{activeView:'cart',activeCategoryId},
      });
      setJarPulseKey(value=>value+1);
      setNotice(result.attention?.length?'已按目前菜單重建記憶罐；需要修正：'+result.attention.join('、'):'已按目前菜單、價格同供應狀態重建記憶罐。');
      presentWithContinuity(()=>{
        setView('cart');
        replacePath('/memory-jar');
        window.scrollTo({top:0,behavior:'auto'});
      });
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

  const requestFallback=async(intent?:CustomerPendingIntent)=>{
    const fallback=snapshot?.fallback;
    const target=intent
      ??(fallbackIntentId?pendingIntents.find(item=>item.submissionId===fallbackIntentId):undefined)
      ??pendingIntents.find(item=>item.state==='NOT_CONNECTED');
    if(!fallback?.enabled){setNotice('店舖暫時未設定 WhatsApp 備用聯絡。');return}
    const targetCart=target?.cart??cart;
    const targetCheckout=target?.checkout??checkout;
    const pickupDigits=targetCheckout.phone.replace(/\D/g,'');
    const url=buildWhatsAppFallbackUrl({
      fallback,
      cart:targetCart,
      checkout:targetCheckout,
      quote:target?null:quote,
      ...(target?.publishedTotalMinor!==undefined?{publishedTotalMinor:target.publishedTotalMinor}:{}),
      ...(target?{fallbackReference:customerFallbackReference(target)}:{}),
      ...(pickupDigits.length>=4?{pickupCode:pickupDigits.slice(-4)}:{}),
    });
    if(!url){setNotice('WhatsApp 備用聯絡資料未完整。');return}
    window.open(url,'_blank','noopener,noreferrer');
    setNotice('已開啟 WhatsApp；舊 Online Submit 保持鎖定，訊息只會喺你主動送出後傳送畀店舖。');
  };

  const activeOrders=snapshot?.activeOrders??[];
  const history=snapshot?.history??[];
  const recoveryIntents=pendingIntents.filter(item=>item.state!=='DELIVERED');
  const currentPending=recoveryIntents[0]??null;
  const currentFallbackIntent=recoveryIntents.find(item=>item.state==='NOT_CONNECTED'&&JSON.stringify(item.cart)===JSON.stringify(cart))??null;
  const fallbackAvailable=Boolean((fallbackIntentId||currentFallbackIntent)&&snapshot?.fallback?.enabled);
  const activeSubmitIntent=submitRouteId?pendingIntents.find(item=>item.submissionId===submitRouteId)??null:null;
  const waitingOrder=waitingOrderId?activeOrders.find(order=>order.orderId===waitingOrderId)??null:null;
  const waitingIntent=waitingOrderId?pendingIntents.find(item=>item.state==='DELIVERED'&&item.canonicalOrderId===waitingOrderId)??null:null;
  const cartCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  const cartRepairs=useMemo(()=>publishedCartRepairs(cart,menu),[cart,menu]);
  const allProducts=menu?.products??[];
  const homeRecommendations=buildCustomerRecommendations({products:allProducts,history,cart,limit:4});
  const menuRecommendations=buildCustomerRecommendations({products:allProducts,history,cart,limit:8});
  const cartSuggestions=buildCustomerRecommendations({products:allProducts,history,cart,activeCategoryId:effectiveCategoryId,limit:2});
  const productRecommendations=selectedProduct?buildCustomerRecommendations({products:allProducts,history,cart,activeCategoryId:selectedProduct.categoryId,limit:8}).filter(item=>item.product.productId!==selectedProduct.productId).slice(0,3):[];
  const actionState:ActionState=quote?.freshness==='MATERIAL_CHANGE'||!cart.length||!quote||Boolean(submitBlockReason)?'disabled':readingIntentId||submitting?'loading':currentPending?.state==='UNKNOWN'?'unknown':currentPending?.state==='PENDING'?'pending':'default';

  return <main className="customer-shell" data-network={!browserOnline?'offline':connection.toLowerCase()}>
    {view==='menu'?null:<CustomerHeader storeName={snapshot?.store?.storeName} connection={connection} browserOnline={browserOnline} onHome={()=>changeView('home')} onService={()=>changeView('more')}/>}
    {view==='menu'?null:<div className="global-status" aria-live="polite">
      {notice?<section className="notice" role="status"><p>{notice}</p><button onClick={()=>setNotice(null)}>收起</button></section>:null}
      {!browserOnline?<StatusBanner tone="offline" title="目前離線" detail="已載入內容仍然可以查看。本機記憶罐、聯絡資料同待提交草稿已保留，恢復連線前唔會自動提交。"/>:null}
      {browserOnline&&connection==='ERROR'?<StatusBanner tone="danger" title="暫時未能同步店舖資料" detail={error||'請檢查連線後再試。'} actionLabel="安全重試" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='NOT_CONNECTED'?<StatusBanner tone="warning" title="店舖服務尚未連接" detail="記憶罐、聯絡資料同待提交草稿會保留喺本機；正式菜單、價格、訂單、會員同取餐狀態唔會用假資料代替。"/>:null}
      {browserOnline&&(connection==='STALE'||connection==='PARTIAL')?<StatusBanner tone="warning" title="正顯示最近一次資料" detail="店舖最新狀態仍在更新。涉及價格或落單結果時會要求再次確認。" actionLabel="更新資料" onAction={()=>void refresh()}/>:null}
      {browserOnline&&connection==='UNKNOWN'?<StatusBanner tone="warning" title="正在確認店舖狀態" detail="暫時唔會將未確認結果當成成功。" actionLabel="重新確認" onAction={()=>void refresh()}/>:null}
      {fallbackAvailable?<StatusBanner tone="warning" title="暫時未能自動接單" detail="系統已完成 3 次有限連線檢查；呢張訂單未送入正式接單流程。你可以用同一份餐點資料改經 WhatsApp 人手落單。" actionLabel="轉用 WhatsApp" onAction={()=>void requestFallback()}/>:null}
    </div>}

    <section className={view==='menu'?'stage2-viewport':'viewport'} aria-busy={connection==='LOADING'}>
      {view==='home'?<HomeView snapshot={snapshot} connection={connection} activeOrders={activeOrders} history={history} recommendations={homeRecommendations} cartCount={cartCount} onRefresh={()=>void refresh()} onProduct={openProduct} onBrowse={()=>changeView('menu')} onJar={()=>changeView('cart')} onOrders={()=>{setOrderSegment('current');changeView('orders')}} onHistory={()=>{setOrderSegment('history');changeView('orders')}} onMember={()=>changeView('more')} onBuyAgain={order=>void reorder(order)} onFallback={()=>void requestFallback()}/>:null}
      {view==='menu'?<Stage2Menu connection={connection} browserOnline={browserOnline} categories={categories} activeCategoryId={activeCategoryId} setCategory={category=>presentWithContinuity(()=>changeCategory(category))} query={search} setQuery={setSearch} products={menu?.products??[]} recommendations={menuRecommendations} onProduct={(product,origin)=>openProduct(product,origin)} cartCount={cartCount} onCart={()=>changeView('cart')}/>:null}
      {view==='cart'?<CartView cart={cart} quote={quote} repairs={cartRepairs} member={snapshot?.member} suggestions={cartSuggestions} products={menu?.products??[]} onProduct={openProduct} onAcceptRepair={acceptCartRepair} onQuantity={(lineId,quantity)=>updateCart(cart.map(line=>line.lineId===lineId?{...line,quantity:Math.max(1,quantity)}:line))} onRemove={lineId=>updateCart(cart.filter(line=>line.lineId!==lineId))} onMenu={()=>changeView('menu')} onCheckout={()=>void openCheckoutStep('contact')}/>:null}
      {view==='checkout'?<CheckoutUi4View step={checkoutStep} cart={cart} quote={quote} repairs={cartRepairs} checkout={checkout} setCheckout={changeCheckout} paymentChannels={snapshot?.paymentChannels??[]} onStep={step=>void openCheckoutStep(step)} onBackToJar={()=>changeView('cart')} onRepair={()=>changeView('cart')} onPaymentEvidence={file=>void uploadPaymentEvidence(file)} onReviewConfirmed={startUi5Submission}/>:null}
      {view==='submit'?(activeSubmitIntent?<SubmitUi5View intent={activeSubmitIntent} submitting={submitting} submitProbe={submitProbe} reading={readingIntentId===activeSubmitIntent.submissionId} fallbackAvailable={Boolean(snapshot?.fallback?.enabled)&&activeSubmitIntent.state==='NOT_CONNECTED'} onSubmit={()=>void submit(activeSubmitIntent)} onReadback={()=>void readbackIntent(activeSubmitIntent)} onFallback={()=>void requestFallback(activeSubmitIntent)} onBackReview={()=>void openCheckoutStep('review')} onBackToJar={()=>changeView('cart')}/>:<section className="page ui5-missing"><h1>提交資料未找到</h1><p>唔會建立新 Submission；請返回記憶罐重新確認。</p><button onClick={()=>changeView('cart')}>返回記憶罐</button></section>):null}
      {view==='waiting'?<WaitingStoreConfirmationUi5View order={waitingOrder} intent={waitingIntent} connection={connection} onRefresh={()=>void refresh()} onOrders={()=>{setOrderSegment('current');changeView('orders')}} onHome={()=>changeView('home')}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} active={activeOrders} history={history} expandedOrderId={expandedOrderId} setExpandedOrderId={setExpandedOrderId} onReorder={order=>void reorder(order)} onBrowse={()=>changeView('menu')} connection={connection}/>:null}
      {view==='more'?<MemberView connection={connection} snapshot={snapshot} history={history} pendingIntents={recoveryIntents} readingIntentId={readingIntentId} onRefresh={()=>void refresh()} onReadback={intent=>void readbackIntent(intent)} onDiscard={removeIntent} onFallback={()=>void requestFallback()} onReorder={order=>void reorder(order)} onBrowse={()=>changeView('menu')}/>:null}
    </section>

    {view==='menu'?<Stage2BottomNavigation active="menu" cartCount={cartCount} orderCount={activeOrders.length} onChange={changeView}/>:!['checkout','submit','waiting'].includes(view)?<BottomNavigation active={view as 'home'|'cart'|'orders'|'more'} cartCount={cartCount} orderCount={activeOrders.length} pulseKey={jarPulseKey} onChange={changeView}/>:null}

    {selectedProduct?<ProductSheet product={selectedProduct} menu={menu} selections={selections} comboEnabled={selectedComboEnabled} comboSelections={selectedComboSelections} selectedVariationId={selectedVariationId} quantity={selectedQuantity} note={selectedNote} editing={Boolean(editingLineId)} recommendations={productRecommendations} setVariation={setSelectedVariationId} setComboEnabled={setSelectedComboEnabled} clearCombo={()=>setSelectedComboSelections(Object.freeze([]))} setQuantity={setSelectedQuantity} setNote={setSelectedNote} toggle={(groupId,optionId)=>{
      const group=selectedProduct.optionGroups.find(item=>item.optionGroupId===groupId);
      if(group)setSelections(current=>toggleCustomerSelection(current,group,optionId));
    }} toggleCombo={(poolId,groupId,subPoolId,choiceId)=>{
      const pool=menu?.comboPools?.find(item=>item.poolId===poolId);
      const group=pool?.groups.find(item=>item.groupId===groupId);
      if(pool&&group)setSelectedComboSelections(current=>toggleCustomerComboSelection(current,pool,group,subPoolId,choiceId));
    }} origin={selectedProductOrigin} onClose={closeProduct} onAdd={addSelectedProduct}/>:null}
  </main>;
}
