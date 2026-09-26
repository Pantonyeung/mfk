import {useEffect,useMemo,useRef,useState} from 'react';
import {NavLink,Navigate,Route,Routes,useNavigate} from 'react-router';
import {useLocation} from 'react-router';
import {ProductionViewport} from './app/ProductionViewport.tsx';
import {OrderingWorkspace} from './features/ordering/OrderingWorkspace.tsx';
import type {OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './features/ordering/ordering-workspace-model.ts';
import {clearDiningAddOrderUiSession,readDiningAddOrderUiSession,saveDiningAddOrderUiSession,type DiningAddOrderRequest} from './features/ordering/dining-add-order-ui-session.ts';
import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';
import {clearDiningCheckoutUiSession,diningCheckoutCart,readDiningCheckoutUiSession,saveDiningCheckoutUiSession} from './features/checkout/dining-checkout-ui-session.ts';
import type {CheckoutChannelId,CheckoutTenderId,CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './features/checkout/checkout-workspace-model.ts';
import {RuntimeOrdersWorkspace} from './presentation/RuntimeOrdersWorkspace.tsx';
import {RuntimeDiningWorkspace,type DiningCheckoutRequest} from './presentation/RuntimeDiningWorkspace.tsx';
import {RuntimeSoldoutWorkspace} from './presentation/RuntimeSoldoutWorkspace.tsx';
import {LocalMoreWorkspace} from './presentation/LocalMoreWorkspace.tsx';
import {localRuntime,type DiningTender} from './runtime/local-runtime.ts';
import {readLocalAdminMenu,subscribeLocalAdminMenu} from './runtime/local-admin-menu.ts';
import {readSmtAdminConfigLkg,readSmtAdminSyncStatus,subscribeSmtAdminConfig} from './runtime/admin-config-sync.ts';
import {projectSyncedCombos,projectSyncedOrderingCatalog,projectSyncedRiceballDrinkPromotion,type SyncedOptionSet} from './runtime/admin-config-projection.ts';
import {capacityNoticeForCount,readSmtFrontlinePresentation,readSmtStoreSettings} from './runtime/admin-operational-config.ts';
import {readBusinessCutoff} from './runtime/cash-opening.ts';
import {resolveBusinessWindow} from './runtime/local-operations.ts';
import {RuntimeReadyActivation} from './runtime/RuntimeReadyActivation.tsx';
import {StaffAuthGate,StaffSessionBadge} from './presentation/StaffAuthGate.tsx';
import {CashOpeningGate} from './presentation/CashOpeningGate.tsx';
import {ComboWorkspace,HoldCartWorkspace,HoldListWorkspace,OrganizeWorkspace,ProductConfigWorkspace,RequiredFastLaneWorkspace,applyRequiredSelectionToCart,initialHoldModeForLines,isDrinkSupplementProductId,projectDrinkSupplementChoices,quickConfigurationForProduct,requiredTasksForCart,type OrderingPanelState,type WorkspaceHoldDraft,type WorkspaceProduct} from './features/ordering/OrderingCenterWorkspaces.tsx';
import {RiceballPairingWorkspace} from './features/ordering/RiceballPairingWorkspace.tsx';
import {applyRiceballPairings,buildRiceballPairingDraft,existingPairingGroups,isPairedComboLine,nextPairingStartIndex,restorePairingGroup} from './features/ordering/riceball-pairing-model.ts';
import {applyRiceballDrinkPromotion,riceballDrinkPromotionStateEqual,stripRiceballDrinkPromotionDetail} from './features/ordering/riceball-drink-promotion-model.ts';

type Product={
  id:string;
  categoryId:string;
  category:string;
  name:string;
  description?:string;
  priceMinor:number;
  priceReady:boolean;
  sellable:boolean;
  imageUrl?:string;
  optionSets:readonly SyncedOptionSet[];
};
type CartLine={id:string;productId:string;name:string;qty:number;unitMinor:number;serviceMode:ServiceMode;detail?:string};

const BASE_PRODUCTS:readonly Product[]=[
  {id:'riceball',category:'飯團',name:'原味飯團',priceMinor:4100,priceReady:true},
  {id:'tuna',category:'飯團',name:'紫菜吞拿魚飯團',priceMinor:4300,priceReady:true},
  {id:'pork',category:'飯團',name:'泡菜豬肉飯團',priceMinor:4500,priceReady:true},
  {id:'bento',category:'便當',name:'肉燥便當',priceMinor:4800,priceReady:true},
  {id:'curry',category:'便當',name:'咖喱便當',priceMinor:5000,priceReady:true},
  {id:'wedges',category:'小食',name:'香脆薯角',priceMinor:1800,priceReady:true},
  {id:'milkTea',category:'飲品',name:'台式奶茶',priceMinor:1600,priceReady:true},
  {id:'lemonTea',category:'飲品',name:'手打檸檬茶',priceMinor:2000,priceReady:true},
];

const money=(minor:number)=>'$'+(minor/100).toFixed(2);
let localCartLineSequence=0;
const nextLocalCartLineId=()=>{
  localCartLineSequence+=1;
  return 'line-'+Date.now().toString(36)+'-'+localCartLineSequence.toString(36);
};

const PRODUCT_ART_COLORS:Record<string,[string,string]>={
  '飯團':['#f1c98f','#8a4f2b'],
  '便當':['#edb77d','#7a3f26'],
  '小食':['#e9c09d','#92552c'],
  '飲品':['#d7a66a','#7b4c3a'],
};

function productArtwork(product:Product){
  const [light,dark]=PRODUCT_ART_COLORS[product.category]??['#e4d6c3','#6a5747'];
  const safeName=product.name.slice(0,4).replace(/[&<>"]/g,'');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">'
    +'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+light+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient></defs>'
    +'<rect width="320" height="200" fill="url(#g)"/>'
    +'<ellipse cx="160" cy="150" rx="92" ry="30" fill="rgba(255,255,255,.55)"/>'
    +'<ellipse cx="160" cy="125" rx="78" ry="48" fill="rgba(78,46,25,.22)"/>'
    +'<circle cx="135" cy="112" r="30" fill="rgba(255,248,225,.75)"/><circle cx="175" cy="118" r="34" fill="rgba(226,103,47,.6)"/>'
    +'<text x="18" y="32" font-family="sans-serif" font-size="20" font-weight="700" fill="white">'+safeName+'</text>'
    +'</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

const nav=[
  {to:'/',label:'點餐',icon:'▦',end:true},
  {to:'/orders',label:'訂單',icon:'▤'},
  {to:'/dining',label:'堂食',icon:'▱'},
  {to:'/soldout',label:'售罄',icon:'⊘'},
  {to:'/more',label:'更多',icon:'•••'},
] as const;

function OrderingPage({cart,setCart,serviceMode,setServiceMode,diningAddition,onDiningAdditionDone}:{
  cart:CartLine[];
  setCart:(v:CartLine[])=>void;
  serviceMode:ServiceMode;
  setServiceMode:(m:ServiceMode)=>void;
  diningAddition:DiningAddOrderRequest|null;
  onDiningAdditionDone:()=>void;
}){
  const navigate=useNavigate();
  const [diningAddState,setDiningAddState]=useState<'idle'|'processing'|'done'|'failed'|'unknown'>('idle');
  const [diningAddStatus,setDiningAddStatus]=useState<string|undefined>();
  const [runtimeRevision,setRuntimeRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRuntimeRevision(value=>value+1)),[]);
  const [category,setCategory]=useState('all');
  const [viewMode,setViewMode]=useState<'original'|'organized'>('original');
  const [combineSimilar,setCombineSimilar]=useState(false);
  const [orderingMode,setOrderingMode]=useState<'quick'|'normal'>('quick');
  const [pulse,setPulse]=useState(0);
  const [recent,setRecent]=useState<string|undefined>();
  const [highlight,setHighlight]=useState<string|undefined>();
  const [panel,setPanel]=useState<OrderingPanelState>(null);
  const [adminMenuRevision,setAdminMenuRevision]=useState(0);
  const [adminConfigRevision,setAdminConfigRevision]=useState(0);
  useEffect(()=>subscribeLocalAdminMenu(()=>setAdminMenuRevision(value=>value+1)),[]);
  useEffect(()=>subscribeSmtAdminConfig(()=>setAdminConfigRevision(value=>value+1)),[]);
  useEffect(()=>{
    if(diningAddition&&serviceMode!=='dine-in')setServiceMode('dine-in');
  },[diningAddition?.holdId,serviceMode,setServiceMode]);
  useEffect(()=>{
    if(!diningAddition){
      setDiningAddState('idle');
      setDiningAddStatus(undefined);
      return;
    }
    let disposed=false;
    setDiningAddState('idle');
    setDiningAddStatus('堂食 '+diningAddition.tableLabel+' · 加單模式 · 會加入同一張訂單');
    void localRuntime.readDiningHold(diningAddition.holdId).then(async detail=>{
      if(disposed)return;
      if(detail.formalOrderId!==diningAddition.formalOrderId){
        setDiningAddState('failed');
        setDiningAddStatus('堂食訂單已更新；請返回堂食重新進入加單。');
        return;
      }
      const existing=detail.additions.find(row=>row.submissionId===diningAddition.submissionId);
      if(!existing)return;
      setDiningAddState('processing');
      setDiningAddStatus('加單已存在 · 正在核對新增項目打印狀態…');
      const result=await localRuntime.ensureDiningAdditionPrint(diningAddition.holdId,existing.id);
      if(disposed)return;
      if(result.state==='DONE'){
        setDiningAddState('done');
        setDiningAddStatus('加單已保存 · 新增項目已送打印');
      }else if(result.state==='UNKNOWN'){
        setDiningAddState('unknown');
        setDiningAddStatus('加單已保存 · 打印結果未知，系統唔會自動重印');
      }else{
        setDiningAddState('failed');
        setDiningAddStatus('加單已保存 · 新增項目打印未完成，請人手檢查');
      }
    }).catch(cause=>{
      if(disposed)return;
      console.warn('DINING_ADD_ORDER_RECOVERY_FAILED',cause);
      setDiningAddState('idle');
      setDiningAddStatus('未能核對加單狀態；請返回堂食重新讀取。');
    });
    return()=>{disposed=true;};
  },[diningAddition?.holdId,diningAddition?.submissionId,diningAddition?.formalOrderId]);
  const adminMenu=useMemo(()=>{void adminMenuRevision;return readLocalAdminMenu();},[adminMenuRevision]);
  const adminConfig=useMemo(()=>{void adminConfigRevision;return readSmtAdminConfigLkg();},[adminConfigRevision]);
  const syncStatus=useMemo(()=>{void adminConfigRevision;return readSmtAdminSyncStatus();},[adminConfigRevision]);
  const syncedCatalog=useMemo(
    ()=>adminConfig?projectSyncedOrderingCatalog(serviceMode,adminConfig):null,
    [adminConfig,serviceMode],
  );
  const promotionCatalogs=useMemo(
    ()=>adminConfig?{
      takeaway:projectSyncedOrderingCatalog('takeaway',adminConfig).products,
      'dine-in':projectSyncedOrderingCatalog('dine-in',adminConfig).products,
    }:null,
    [adminConfig],
  );
  const riceballDrinkPromotion=useMemo(
    ()=>adminConfig?projectSyncedRiceballDrinkPromotion(adminConfig):null,
    [adminConfig],
  );
  const comboData=useMemo(
    ()=>adminConfig?projectSyncedCombos(adminConfig):{combos:[] as const,pools:[] as const},
    [adminConfig],
  );
  useEffect(()=>{
    if(!promotionCatalogs)return;
    const normalized=applyRiceballDrinkPromotion(
      cart,
      promotionCatalogs,
      comboData.pools,
      riceballDrinkPromotion,
    );
    if(!riceballDrinkPromotionStateEqual(cart,normalized))setCart(normalized);
  },[cart,promotionCatalogs,comboData.pools,riceballDrinkPromotion,setCart]);

  const storeSettings=useMemo(()=>{void adminConfigRevision;return readSmtStoreSettings();},[adminConfigRevision]);
  const frontlinePresentation=useMemo(()=>{void adminConfigRevision;return readSmtFrontlinePresentation();},[adminConfigRevision]);
  useEffect(()=>{
    if(serviceMode==='takeaway'&&!storeSettings.takeawayEnabled&&storeSettings.dineInEnabled)setServiceMode('dine-in');
    if(serviceMode==='dine-in'&&!storeSettings.dineInEnabled&&storeSettings.takeawayEnabled)setServiceMode('takeaway');
  },[serviceMode,storeSettings.takeawayEnabled,storeSettings.dineInEnabled,setServiceMode]);

  const fallbackCategoryById=useMemo(()=>new Map(adminMenu.categories.map(row=>[row.id,row] as const)),[adminMenu]);
  const products:readonly Product[]=useMemo(()=>{
    if(syncedCatalog){
      return syncedCatalog.products.map(row=>({
        id:row.id,
        categoryId:row.categoryId,
        category:row.category,
        name:row.name,
        description:row.description,
        priceMinor:row.priceMinor,
        priceReady:row.priceReady,
        sellable:row.sellable,
        imageUrl:row.imageUrl,
        optionSets:row.optionSets,
      }));
    }
    return adminMenu.products
      .filter(row=>row.active)
      .slice()
      .sort((a,b)=>{
        const ac=fallbackCategoryById.get(a.categoryId)?.position??9999;
        const bc=fallbackCategoryById.get(b.categoryId)?.position??9999;
        return ac-bc||a.position-b.position||a.id.localeCompare(b.id);
      })
      .map(row=>{
        const base=BASE_PRODUCTS.find(item=>item.id===row.id);
        return {
          id:row.id,
          categoryId:row.categoryId,
          category:fallbackCategoryById.get(row.categoryId)?.name??'其他',
          name:row.name,
          priceMinor:base?.priceMinor??0,
          priceReady:Boolean(base),
          sellable:true,
          optionSets:[],
        };
      });
  },[syncedCatalog,adminMenu,fallbackCategoryById]);

  const categories=[
    {id:'all',label:'熱門'},
    ...(syncedCatalog
      ?syncedCatalog.categories.map(row=>({id:row.id,label:row.label}))
      :adminMenu.categories.slice().sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(row=>({id:row.id,label:row.name}))),
  ];
  const visible=products
    .filter(product=>category==='all'||product.categoryId===category)
    .slice()
    .sort((a,b)=>{
      if(category!=='all')return 0;
      const quick=new Map(frontlinePresentation.quickProductIds.map((id,index)=>[id,index] as const));
      const ai=quick.get(a.id),bi=quick.get(b.id);
      if(ai===undefined&&bi===undefined)return 0;
      if(ai===undefined)return 1;
      if(bi===undefined)return -1;
      return ai-bi;
    });
  const runtimeOrders=useMemo(()=>{void runtimeRevision;return localRuntime.orders();},[runtimeRevision]);
  const heldCarts=useMemo(()=>{void runtimeRevision;return localRuntime.holds();},[runtimeRevision]);
  const businessCutoff=readBusinessCutoff();
  const businessWindow=resolveBusinessWindow(Date.now(),businessCutoff.hour,businessCutoff.minute);
  const businessOrderCount=runtimeOrders.filter(order=>{
    const at=Date.parse(order.createdAt);
    return Number.isFinite(at)&&at>=businessWindow.start&&at<businessWindow.end&&order.fulfillmentLabel!=='已取消';
  }).length;
  const capacityNotice=capacityNoticeForCount(businessOrderCount);
  const queueItem=(order:(typeof runtimeOrders)[number])=>({
    id:order.id,
    orderId:order.display,
    sourceLabel:order.sourceLabel,
    waitLabel:new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}),
    itemCount:order.items.reduce((sum,item)=>sum+item.qty,0),
  });
  const isKeetaOrder=(order:(typeof runtimeOrders)[number])=>/^Keeta\b/i.test(String(order.sourceLabel||''));
  const pendingOrders=runtimeOrders
    .filter(order=>order.fulfillmentLabel==='待處理'&&!isKeetaOrder(order))
    .slice(0,6).map(queueItem);
  const activeOrders=runtimeOrders
    .filter(order=>isKeetaOrder(order)&&!['已完成','已取消'].includes(order.fulfillmentLabel))
    .slice(0,8).map(queueItem);
  const total=cart.reduce((sum,line)=>sum+line.unitMinor*line.qty,0);
  const nextDisplay=diningAddition?.codeLabel??('P'+String(localRuntime.orders().length+1).padStart(3,'0'));

  const workspaceProducts:WorkspaceProduct[]=products.filter(product=>product.priceReady&&product.sellable).map(product=>({
    id:product.id,
    category:product.category,
    name:product.name,
    priceMinor:product.priceMinor,
    priceLabel:money(product.priceMinor),
    imageUrl:product.imageUrl??productArtwork(product),
    optionSets:product.optionSets,
  }));
  const quickConfigurationById=new Map(workspaceProducts.map(product=>[product.id,quickConfigurationForProduct(product)] as const));
  const requiredWork=requiredTasksForCart(cart,workspaceProducts);
  const drinkSupplementChoices=projectDrinkSupplementChoices(workspaceProducts,comboData.pools);
  const pairingBlockedLineIds=new Set(requiredWork.map(task=>task.lineId));
  const riceballPairingExisting=existingPairingGroups(cart);
  const riceballPairingDraft=buildRiceballPairingDraft(
    cart,
    workspaceProducts,
    comboData.combos,
    comboData.pools,
    pairingBlockedLineIds,
    nextPairingStartIndex(cart),
  );
  const diningTableDefinitions=storeSettings.diningTables.length
    ?storeSettings.diningTables
    :Array.from({length:9},(_,index)=>({
      id:'T'+String(index+1).padStart(2,'0'),
      name:String(index+1)+' 號枱',
      active:true,
      sortOrder:index+1,
    }));
  const holdTables=diningTableDefinitions.map(table=>{
    const occupied=heldCarts.find(hold=>hold.kind==='dining'&&hold.assignedTable===table.id);
    return {id:table.id,label:table.name,occupied:Boolean(occupied),codeLabel:occupied?.codeLabel};
  });

  const presentCartLine=(line:CartLine,index:number,quantity=line.qty,sourceLineIds:readonly string[]=[line.id])=>({
    id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id,
    name:line.name,
    quantity,
    lineTotalLabel:money(line.unitMinor*quantity),
    serviceMode:line.serviceMode,
    groupId:'local',
    groupLabel:'本機',
    detail:line.detail,
    sourceLineIds,
  });
  const presentationCart=(()=>{
    if(!combineSimilar)return cart.map((line,index)=>presentCartLine(line,index,line.qty,[line.id]));
    const groups=new Map<string,{line:CartLine;quantity:number;ids:string[];index:number}>();
    cart.forEach((line,index)=>{
      const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::');
      const current=groups.get(key);
      if(current){
        current.quantity+=line.qty;
        if(!current.ids.includes(line.id))current.ids.push(line.id);
      }else groups.set(key,{line,quantity:line.qty,ids:[line.id],index});
    });
    return [...groups.values()].sort((a,b)=>a.index-b.index).map(group=>presentCartLine(group.line,group.index,group.quantity,group.ids));
  })();

  const view:OrderingWorkspaceViewModel={
    pendingOrders,activeOrders,categories,selectedCategoryId:category,
    products:visible.map(product=>({
      id:product.id,
      name:product.name,
      description:product.description,
      priceLabel:product.priceReady?money(product.priceMinor):'未接價格',
      enabled:product.priceReady&&product.sellable&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
      requiresOptions:product.priceReady&&product.sellable&&product.optionSets.length>0,
      quickAddAllowed:Boolean(quickConfigurationById.get(product.id)?.eligible),
      imageUrl:frontlinePresentation.showImages?(product.imageUrl??productArtwork(product)):undefined,
      ...(!product.priceReady?{badge:'未接價格'}:!product.sellable?{badge:'停售'}:{}),
    })),
    menuRevisionLabel:adminConfig
      ?storeSettings.storeName+' · ADMIN R'+adminConfig.revision+' · '+(syncStatus.state==='SYNCED'?'已同步':syncStatus.state==='LOCAL_LKG'?'LKG':'同步中')
      :'LOCAL FALLBACK · R'+adminMenu.revision,
    operationalNotice:diningAddition
      ?(diningAddStatus??('堂食 '+diningAddition.tableLabel+' · 加單模式'))
      :capacityNotice
        ?'今日 '+capacityNotice.currentCount+'/'+capacityNotice.dailyLimit+' 單 · 已到 '+capacityNotice.warningAt+'% 提醒門檻'+(capacityNotice.hardStopConfigured?' · Admin 有 hard-stop 設定但目前只提示':'')
        :undefined,
    showCategories:frontlinePresentation.showCategories,
    showDescriptions:frontlinePresentation.showDescriptions,
    productColumns:frontlinePresentation.tabletColumns,
    frontlineGuidance:(frontlinePresentation.headline||frontlinePresentation.body)
      ?{headline:frontlinePresentation.headline||undefined,body:frontlinePresentation.body||undefined}
      :undefined,
    serviceModes:diningAddition
      ?{takeaway:false,dineIn:storeSettings.dineInEnabled}
      :{takeaway:storeSettings.takeawayEnabled,dineIn:storeSettings.dineInEnabled},
    orderingMode,
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,combineSimilar,
      lines:presentationCart,
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),
      checkoutEnabled:diningAddition
        ?((diningAddState==='done'||diningAddState==='failed'||diningAddState==='unknown')||(cart.length>0&&requiredWork.length===0&&storeSettings.dineInEnabled&&diningAddState!=='processing'))
        :(cart.length>0&&requiredWork.length===0&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled))),
      ...(diningAddition?{
        primaryActionLabel:diningAddState==='processing'?'加單處理中':(diningAddState==='done'||diningAddState==='failed'||diningAddState==='unknown')?'返回堂食':'確認加單',
        contextLabel:'加單 · '+diningAddition.tableLabel,
      }:{}),
    },
    workItems:[
      {id:'riceball-pool',label:'飯團待組區',count:riceballPairingDraft.slots.length+riceballPairingExisting.length},
      {id:'required',label:'必選／補選',count:requiredWork.length},
      {id:'combo',label:'紫米套餐區',count:comboData.combos.length},
    ],
    actionAvailability:{
      lineServiceMode:!diningAddition,
      lineEdit:true,
      lineQuantity:true,
      holdCart:!diningAddition&&(cart.length>0||heldCarts.length>0),
      cancelCart:cart.length>0,
    },
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product||!product.priceReady||!product.sellable)return;
    const quickConfig=quickConfigurationById.get(id);
    if(!quickConfig?.eligible){setPanel({type:'product',productId:id});return;}
    const line:CartLine={
      id:nextLocalCartLineId(),
      productId:product.id,
      name:product.name,
      qty:1,
      unitMinor:product.priceMinor+quickConfig.deltaMinor,
      serviceMode,
      detail:quickConfig.detail||undefined,
    };
    setCart([...cart,line]);
    setRecent(id);
    setHighlight(line.id);
    setPulse(value=>value+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };

  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number,lineId?:string)=>{
    const product=products.find(item=>item.id===productId);if(!product||!product.priceReady||!product.sellable)return;
    if(lineId){
      const existing=cart.find(item=>item.id===lineId);if(!existing)return;
      const next=cart.map(item=>item.id===lineId?{
        ...item,
        name:product.name,
        qty,
        unitMinor:product.priceMinor+deltaMinor,
        detail:detail||undefined,
        serviceMode:existing.serviceMode,
      }:item);
      setCart(next);setRecent(product.id);setHighlight(lineId);setPulse(value=>value+1);setPanel(null);return;
    }
    const line:CartLine={id:nextLocalCartLineId(),productId:product.id,name:product.name,qty,unitMinor:product.priceMinor+deltaMinor,serviceMode,detail:detail||undefined};
    setCart([...cart,line]);setRecent(product.id);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };

  const applyRequired=(lineId:string,groupId:string,optionIds:readonly string[])=>{
    const next=applyRequiredSelectionToCart(cart,workspaceProducts,lineId,groupId,optionIds);
    setCart(next);
    setHighlight(lineId);
    setPulse(value=>value+1);
  };

  const addDrinkSupplement=(
    choiceId:string,
    qty:number,
    targetLineId?:string,
    configurationDetail='',
    configurationAdjustmentMinor=0,
    returnPanel:'required'|'riceball-pair'='required',
  )=>{
    const choice=drinkSupplementChoices.find(row=>row.id===choiceId);
    if(!choice||!choice.enabled)return;
    const targets=cart.filter(line=>!isDrinkSupplementProductId(line.productId));
    const target=targetLineId?targets.find(line=>line.id===targetLineId):undefined;
    const targetIndex=target?targets.findIndex(line=>line.id===target.id):-1;
    const targetDetail=target
      ?'指定餐點：'+String(targetIndex+1)+' '+target.name
      :'未指定配餐（按落單次序）';
    const detail=[targetDetail,configurationDetail.trim()].filter(Boolean).join(' · ');
    const line:CartLine={
      id:nextLocalCartLineId(),
      productId:'drink-supplement:'+choice.id,
      name:'飲品｜'+choice.label,
      qty:Math.max(1,Math.floor(qty||1)),
      unitMinor:choice.adjustmentMinor+configurationAdjustmentMinor,
      serviceMode:target?.serviceMode??serviceMode,
      detail,
    };
    setCart([...cart,line]);
    setHighlight(line.id);
    setPulse(value=>value+1);
    setPanel(returnPanel==='riceball-pair'?{type:'riceball-pair'}:{type:'required'});
  };

  const configureDrinkSupplement=(choiceId:string,qty:number,targetLineId?:string,returnPanel:'required'|'riceball-pair'='required')=>{
    const choice=drinkSupplementChoices.find(row=>row.id===choiceId);
    if(!choice?.enabled)return;
    if(!choice.requiresConfiguration||!choice.productId){
      addDrinkSupplement(choiceId,qty,targetLineId,'',0,returnPanel);
      return;
    }
    setPanel({type:'drink-config',choiceId,qty:Math.max(1,Math.floor(qty||1)),...(targetLineId?{targetLineId}:{}),returnTo:returnPanel});
  };

  const applyPairingAssignments=(assignments:Readonly<Record<string,string|undefined>>)=>{
    const applied=applyRiceballPairings(
      cart,
      workspaceProducts,
      comboData.combos,
      comboData.pools,
      riceballPairingDraft,
      assignments,
      nextLocalCartLineId,
    );
    if(!applied.groups.length)return;
    setCart(applied.lines);
    setHighlight(applied.lines[applied.lines.length-1]?.id);
    setPulse(value=>value+1);
    setPanel({type:'riceball-pair'});
  };

  const restorePairing=(label:string)=>{
    setCart(restorePairingGroup(cart,workspaceProducts,label));
    setPulse(value=>value+1);
    setPanel({type:'riceball-pair'});
  };

  const addCombo=(comboId:string,comboName:string,detail:string,unitMinor:number)=>{
    const line:CartLine={id:nextLocalCartLineId(),productId:comboId,name:comboName,qty:1,unitMinor,serviceMode,detail};
    setCart([...cart,line]);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };

  const holdItems=()=>cart.map(line=>({
    id:line.productId,
    name:line.detail?line.name+'｜'+line.detail:line.name,
    qty:line.qty,
    unitMinor:line.unitMinor,
  }));
  const finishHold=()=>{setCart([]);setServiceMode('takeaway');setPanel(null);};

  const panelTitle=panel?.type==='product'?'商品選項'
    :panel?.type==='required'?'必選／補選'
    :panel?.type==='drink-config'?'飲品設定'
    :panel?.type==='riceball-pair'?'飯團待組區'
    :panel?.type==='organize'?'整理工作台'
    :panel?.type==='combo'?'紫米套餐區'
    :panel?.type==='hold'?'暫存工作台'
    :panel?.type==='holds'?'暫存單':'';

  const panelBody=panel?.type==='product'
    ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);const line=panel.lineId?cart.find(item=>item.id===panel.lineId):undefined;return product?<ProductConfigWorkspace key={product.id+':'+(panel.lineId??'add')} product={product} mode={panel.lineId?'edit':'add'} initial={line?{qty:line.qty,detail:stripRiceballDrinkPromotionDetail(line.detail)||undefined}:undefined} onAdd={(detail,delta,qty)=>addConfigured(product.id,detail,delta,qty,panel.lineId)}/>:null})()
    :panel?.type==='required'
      ?<RequiredFastLaneWorkspace
        cart={cart}
        products={workspaceProducts}
        onApply={applyRequired}
        drinkChoices={drinkSupplementChoices}
        onAddDrink={(choiceId,qty,targetLineId)=>addDrinkSupplement(choiceId,qty,targetLineId)}
        onConfigureDrink={configureDrinkSupplement}
      />
    :panel?.type==='drink-config'
      ?(()=>{const choice=drinkSupplementChoices.find(row=>row.id===panel.choiceId);const product=choice?.productId?workspaceProducts.find(row=>row.id===choice.productId):undefined;return choice&&product?<ProductConfigWorkspace
        key={'drink:'+choice.id}
        product={product}
        initial={{qty:panel.qty}}
        pricingBaseMinor={choice.adjustmentMinor}
        onAdd={(detail,delta,qty)=>addDrinkSupplement(choice.id,qty,panel.targetLineId,detail,delta,panel.returnTo??'required')}
      />:null})()
    :panel?.type==='riceball-pair'
      ?<RiceballPairingWorkspace
        cart={cart}
        products={workspaceProducts}
        combos={comboData.combos}
        pools={comboData.pools}
        blockedLineIds={pairingBlockedLineIds}
        onApply={applyPairingAssignments}
        onRestore={restorePairing}
        drinkChoices={drinkSupplementChoices}
        onAddDrink={(choiceId,qty,targetLineId)=>addDrinkSupplement(choiceId,qty,targetLineId,'',0,'riceball-pair')}
        onConfigureDrink={(choiceId,qty,targetLineId)=>configureDrinkSupplement(choiceId,qty,targetLineId,'riceball-pair')}
      />
    :panel?.type==='organize'
      ?<OrganizeWorkspace lines={cart} onDone={()=>setPanel(null)}/>
      :panel?.type==='combo'
        ?<ComboWorkspace products={workspaceProducts} combos={comboData.combos} pools={comboData.pools} onAdd={addCombo}/>
        :panel?.type==='hold'
          ?<HoldCartWorkspace
            lines={cart}
            totalMinor={total}
            tables={holdTables}
            initialMode={initialHoldModeForLines(cart)}
            onHoldWaiting={(partySize,note)=>{
              localRuntime.createHold({kind:'waiting',items:holdItems(),totalMinor:total,partySize,note:note||'暫存待客'});
              finishHold();
            }}
            onHoldQueue={(partySize,note)=>{
              const draft=localRuntime.createHold({kind:'dining',items:holdItems(),totalMinor:total,partySize,note:note||'堂食輪候'});
              void localRuntime.admitDiningHold?.(draft.id).then(()=>{
                void localRuntime.ensureDiningInitialPrint?.(draft.id).catch(()=>{});
                finishHold();
              }).catch(()=>{});
            }}
            onHoldTable={(tableId,partySize,note)=>{
              const draft=localRuntime.createHold({kind:'dining',items:holdItems(),totalMinor:total,partySize,note:note||'直接掛枱'});
              void localRuntime.assignDiningTable?.(draft.id,tableId).then(()=>{
                void localRuntime.ensureDiningInitialPrint?.(draft.id).catch(()=>{});
                setCart([]);setServiceMode('dine-in');setPanel(null);
              });
            }}
          />
          :panel?.type==='holds'
            ?<HoldListWorkspace holds={heldCarts as readonly WorkspaceHoldDraft[]} onRestore={hold=>{
              const restored:CartLine[]=hold.items.map((item,index)=>{
                const parts=item.name.split('｜');
                const name=parts.shift()||item.name;
                const detail=parts.length?parts.join('｜'):undefined;
                return {
                  id:'line-'+hold.id+'-'+index+'-'+Date.now().toString(36),
                  productId:item.id,
                  name,
                  qty:item.qty,
                  unitMinor:item.unitMinor,
                  serviceMode:hold.kind==='dining'?'dine-in':'takeaway',
                  detail,
                };
              });
              setCart(restored);
              setServiceMode(hold.kind==='dining'?'dine-in':'takeaway');
              localRuntime.removeHold(hold.id);
              setPanel(null);
            }} onRemove={id=>localRuntime.removeHold(id)}/>
            :null;

  const finishDiningAddition=()=>{
    setCart([]);
    onDiningAdditionDone();
    navigate('/dining');
  };

  const submitDiningAddition=async()=>{
    if(!diningAddition)return;
    if(diningAddState==='done'||diningAddState==='failed'||diningAddState==='unknown'){
      finishDiningAddition();
      return;
    }
    if(diningAddState==='processing'||!cart.length||requiredWork.length>0)return;
    setDiningAddState('processing');
    setDiningAddStatus('堂食 '+diningAddition.tableLabel+' · 正在保存加單…');
    try{
      const committed=await localRuntime.appendDiningItems(diningAddition.holdId,{
        submissionId:diningAddition.submissionId,
        items:holdItems(),
        totalMinor:total,
        sourceLabel:'現場',
      });
      const result=await localRuntime.ensureDiningAdditionPrint(diningAddition.holdId,committed.additionId);
      if(result.state==='DONE'){
        setDiningAddState('done');
        setDiningAddStatus('加單已保存 · 新增項目已送打印');
      }else if(result.state==='UNKNOWN'){
        setDiningAddState('unknown');
        setDiningAddStatus('加單已保存 · 打印結果未知，系統唔會自動重印');
      }else{
        setDiningAddState('failed');
        setDiningAddStatus('加單已保存 · 新增項目打印未完成，請人手檢查');
      }
    }catch(cause){
      console.warn('DINING_ADD_ORDER_SUBMIT_FAILED',cause);
      try{
        const detail=await localRuntime.readDiningHold(diningAddition.holdId);
        const existing=detail.additions.find(row=>row.submissionId===diningAddition.submissionId);
        if(existing){
          const result=await localRuntime.ensureDiningAdditionPrint(diningAddition.holdId,existing.id);
          if(result.state==='DONE'){
            setDiningAddState('done');
            setDiningAddStatus('加單已保存 · 新增項目已送打印');
          }else if(result.state==='UNKNOWN'){
            setDiningAddState('unknown');
            setDiningAddStatus('加單已保存 · 打印結果未知，系統唔會自動重印');
          }else{
            setDiningAddState('failed');
            setDiningAddStatus('加單已保存 · 新增項目打印未完成，請人手檢查');
          }
          return;
        }
      }catch(readbackCause){
        console.warn('DINING_ADD_ORDER_READBACK_FAILED',readbackCause);
      }
      setDiningAddState('idle');
      setDiningAddStatus('加單未完成；請核對堂食內容後再試。');
    }
  };

  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,
    onChangeOrderingMode:setOrderingMode,
    onAddProduct:add,
    onConfigureProduct:id=>setPanel({type:'product',productId:id}),
    onChangeServiceMode:mode=>{
      if(diningAddition)return;
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      setServiceMode(mode);setCart(cart.map(item=>({...item,serviceMode:mode})));
    },
    onChangeCartView:mode=>{setViewMode(mode);if(mode==='organized')setPanel({type:'organize'});},
    onToggleCombine:()=>setCombineSimilar(value=>!value),
    onChangeLineServiceMode:(lineId,mode)=>{
      if(diningAddition)return;
      const line=cart.find(item=>item.id===lineId);
      if(line&&isPairedComboLine(line)){setPanel({type:'riceball-pair'});return;}
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      setCart(cart.map(item=>item.id===lineId?{...item,serviceMode:mode}:item));
    },
    onAdjustLineQuantity:(lineId,delta)=>{
      const line=cart.find(item=>item.id===lineId);
      if(line&&isPairedComboLine(line)){setPanel({type:'riceball-pair'});return;}
      setCart(cart.map(item=>item.id===lineId?{...item,qty:item.qty+delta}:item).filter(item=>item.qty>0));
    },
    onEditCartLine:lineId=>{
      const line=cart.find(item=>item.id===lineId);
      if(!line)return;
      if(isPairedComboLine(line)){setPanel({type:'riceball-pair'});return;}
      if(isDrinkSupplementProductId(line.productId)){setPanel({type:'required'});return;}
      if(comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'combo'});
      else setPanel({type:'product',productId:line.productId,lineId:line.id});
    },
    onHoldCart:()=>{if(diningAddition)return;cart.length?setPanel({type:'hold'}):setPanel({type:'holds'});},
    onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{
      if(id==='riceball-pool')setPanel({type:'riceball-pair'});
      else if(id==='required')setPanel({type:'required'});
      else if(id==='combo')setPanel({type:'combo'});
      else setPanel({type:'organize'});
    },
    onOpenQueueOrder:(_kind,id)=>navigate('/orders?orderId='+encodeURIComponent(id)),
    onCheckout:()=>{if(diningAddition){void submitDiningAddition();return;}navigate('/checkout');},
  };

  return <OrderingWorkspace view={view} actions={actions} centerPanel={panel&&panelBody?{title:panelTitle,body:panelBody,onClose:()=>setPanel(null)}:null}/>;
}

function CheckoutPage({cart,setCart,diningCheckout,onDiningCheckoutDone}:{cart:CartLine[];setCart:(v:CartLine[])=>void;diningCheckout:DiningCheckoutRequest|null;onDiningCheckoutDone:()=>void}){
  const navigate=useNavigate();
  const due=cart.reduce((sum,line)=>sum+line.unitMinor*line.qty,0);
  const [channel,setChannel]=useState<CheckoutChannelId>('walk-in');
  const [method,setMethod]=useState<CheckoutTenderId>('CASH');
  const [cash,setCash]=useState('');
  const [customerPhone,setCustomerPhone]=useState('');
  const [pickupCode,setPickupCode]=useState('');
  const [platformOrderNo,setPlatformOrderNo]=useState('');
  const [split,setSplit]=useState<Record<'CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME',string>>({CASH:'',ALIPAY:'',WECHAT:'',FPS:'',PAYME:''});
  const [state,setState]=useState<'selected'|'processing'|'success'|'failure'>('selected');
  const [completion,setCompletion]=useState<CheckoutWorkspaceViewModel['completionReview']>();
  const [printStatus,setPrintStatus]=useState<string|undefined>();
  const [diningRecovering,setDiningRecovering]=useState(Boolean(diningCheckout));
  const [diningRequiresRefresh,setDiningRequiresRefresh]=useState(false);
  const [checkoutFailure,setCheckoutFailure]=useState<string|undefined>();

  const methodLabels:Record<CheckoutTenderId,string>={
    CASH:'現金付款',ALIPAY:'AlipayHK',WECHAT:'WeChat Pay HK',FPS:'FPS／轉數快',PAYME:'PayMe',COMBO:'組合付款'
  };
  const channelLabels:Record<CheckoutChannelId,string>={
    'walk-in':'現場','whatsapp':'電話／WhatsApp','morefun-app':'磨飯 App','keeta':'Keeta','foodpanda':'Foodpanda'
  };

  useEffect(()=>{
    if(!diningCheckout){
      setDiningRecovering(false);
      setDiningRequiresRefresh(false);
      setCheckoutFailure(undefined);
      return;
    }
    let disposed=false;
    setDiningRecovering(true);
    setDiningRequiresRefresh(false);
    setCheckoutFailure(undefined);
    void localRuntime.readDiningHold(diningCheckout.holdId).then(detail=>{
      if(disposed)return;
      const prior=detail.payments.find(payment=>payment.submissionId===diningCheckout.submissionId);
      if(prior){
        const tender=prior.tender as CheckoutTenderId;
        setMethod(tender);
        if(prior.tender==='CASH')setCash(((prior.receivedMinor??prior.amountMinor)/100).toFixed(2));
        setCompletion({
          displayOrderCode:detail.codeLabel,
          tenderLabel:methodLabels[tender],
          dueLabel:money(prior.amountMinor),
          ...(prior.tender==='CASH'?{
            receivedLabel:money(prior.receivedMinor??prior.amountMinor),
            changeLabel:money(prior.changeMinor??0),
          }:{}),
          statusLabel:detail.remainingMinor===0?'堂食已全數結帳':'堂食分項結帳完成',
        });
        setState('success');
        setPrintStatus('堂食付款已存在 · 正在核對付款收據狀態…');
        void localRuntime.ensureDiningPaymentReceipt(detail.holdId,diningCheckout.submissionId).then(result=>{
          if(result.state==='DONE'){setPrintStatus('堂食付款已存在 · 付款收據已處理');return;}
          if(result.state==='UNKNOWN'){setPrintStatus('堂食付款已存在 · 收據／錢箱結果未知，系統唔會自動重試');return;}
          setPrintStatus('堂食付款已存在 · 付款收據未完成，請人手檢查');
        }).catch(error=>setPrintStatus('堂食付款已存在 · 收據狀態讀取失敗 '+(error instanceof Error?error.message:String(error))));
        setDiningRecovering(false);
        return;
      }
      if(detail.checkoutRevision!==diningCheckout.expectedRevision){
        setDiningRequiresRefresh(true);
        setCheckoutFailure('堂食內容已經更新；請返回堂食重新選擇未結項目，系統冇收款。');
        setState('failure');
        setDiningRecovering(false);
        return;
      }
      setState('selected');
      setPrintStatus('堂食結帳已恢復 · 尚未付款');
      setDiningRecovering(false);
    }).catch(cause=>{
      if(disposed)return;
      setDiningRequiresRefresh(true);
      setCheckoutFailure('未能核對堂食付款狀態：'+(cause instanceof Error?cause.message:String(cause))+'。請返回堂食重新讀取，系統冇自動收款。');
      setState('failure');
      setDiningRecovering(false);
    });
    return()=>{disposed=true;};
  },[diningCheckout?.holdId,diningCheckout?.submissionId,diningCheckout?.expectedRevision]);

  const parseMoney=(value:string)=>Math.max(0,Math.round((Number(value)||0)*100));
  const cashMinor=parseMoney(cash);
  const comboMinor=(Object.values(split) as string[]).reduce((sum,value)=>sum+parseMoney(value),0);
  const received=method==='CASH'?cashMinor:method==='COMBO'?comboMinor:due;
  const change=method==='CASH'?Math.max(0,received-due):0;
  const comboExact=method!=='COMBO'||comboMinor===due;
  const cashReady=method!=='CASH'||received>=due;
  const confirmEnabled=cart.length>0&&!diningRecovering&&!diningRequiresRefresh&&comboExact&&cashReady;
  const validationMessage=method==='CASH'&&cash&&received<due?'收款金額不足':
    method==='COMBO'&&comboMinor!==due?'組合付款合計 '+money(comboMinor)+'，必須等於 '+money(due):undefined;

  const sourceParts=[channelLabels[channel]];
  if(channel==='whatsapp'&&customerPhone.trim())sourceParts.push(customerPhone.trim());
  if(channel!=='walk-in'&&channel!=='whatsapp'){
    if(pickupCode.trim())sourceParts.push('取餐碼 '+pickupCode.trim());
    if(platformOrderNo.trim())sourceParts.push('單號 '+platformOrderNo.trim());
  }
  const sourceLabel=sourceParts.join(' · ');
  const comboEntries=(Object.entries(split) as [keyof typeof split,string][]).filter(([,value])=>parseMoney(value)>0);
  const paymentLabel=method==='COMBO'
    ?'COMBO '+comboEntries.map(([id,value])=>id+' '+money(parseMoney(value))).join(' + ')
    :method;
  const tenderDisplay=method==='COMBO'
    ?comboEntries.map(([id,value])=>methodLabels[id]+' '+money(parseMoney(value))).join(' + ')
    :methodLabels[method];

  const view:CheckoutWorkspaceViewModel={
    order:{
      orderId:diningCheckout?.codeLabel??('P'+String(localRuntime.orders().length+1).padStart(3,'0')),
      lines:cart.map(line=>({id:line.id,name:line.name,detail:line.detail,quantity:line.qty,lineTotalLabel:money(line.unitMinor*line.qty)})),
      subtotalLabel:money(due),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(due),
    },
    channels:[
      {id:'walk-in',label:'現場',selected:channel==='walk-in'},
      {id:'whatsapp',label:'電話／WhatsApp',selected:channel==='whatsapp'},
      {id:'morefun-app',label:'磨飯 App',selected:channel==='morefun-app'},
      {id:'foodpanda',label:'Foodpanda',selected:channel==='foodpanda'},
      {id:'keeta',label:'Keeta',selected:channel==='keeta'},
    ],
    methods:(['CASH','FPS','PAYME','ALIPAY','WECHAT','COMBO'] as CheckoutTenderId[]).map(id=>({
      id,label:methodLabels[id],enabled:true,selected:method===id,
    })),
    selectedMethodLabel:methodLabels[method],
    amount:{dueLabel:money(due),receivedLabel:money(received),changeLabel:money(change)},
    cashInput:cash,cashEntryVisible:method==='CASH',exactCashEnabled:method==='CASH',confirmEnabled,
    paymentState:state,
    channelFields:{
      showCustomerPhone:channel==='whatsapp',customerPhone,
      showPlatformFields:channel==='morefun-app'||channel==='keeta'||channel==='foodpanda',
      pickupCode,platformOrderNo,
    },
    comboMode:method==='COMBO',
    splitTenders:(['CASH','FPS','PAYME','ALIPAY','WECHAT'] as const).map(id=>({id,label:methodLabels[id],amount:split[id]})),
    validationMessage,statusMessage:printStatus,failureMessage:checkoutFailure,completionReview:completion,
  };

  const confirm=async()=>{
    if(!confirmEnabled)return;
    setState('processing');
    try{
      if(diningCheckout){
        const tenderCode:DiningTender=method==='COMBO'?'COMBO':method;
        const updated=await localRuntime.settleDiningHold(
          diningCheckout.holdId,
          diningCheckout.selections,
          tenderCode,
          {
            submissionId:diningCheckout.submissionId,
            expectedRevision:diningCheckout.expectedRevision,
            ...(tenderCode==='CASH'?{receivedMinor:received}:{}),
            ...(tenderCode==='COMBO'?{
              splitTenders:comboEntries.map(([id,value])=>({tender:id,amountMinor:parseMoney(value)})),
            }:{}),
          }
        );
        const payment=updated.payments.find(row=>row.submissionId===diningCheckout.submissionId);
        setCompletion({
          displayOrderCode:diningCheckout.codeLabel,
          tenderLabel:payment?methodLabels[payment.tender as CheckoutTenderId]:tenderDisplay,
          dueLabel:money(payment?.amountMinor??due),
          ...(payment?.tender==='CASH'?{
            receivedLabel:money(payment.receivedMinor??payment.amountMinor),
            changeLabel:money(payment.changeMinor??0),
          }:{
            receivedLabel:money(received),
            changeLabel:money(change),
          }),
          statusLabel:updated.remainingMinor===0?'堂食已全數結帳':'堂食分項結帳完成',
        });
        setCheckoutFailure(undefined);
        setState('success');
        setPrintStatus('堂食 '+diningCheckout.tableLabel+' · 已保存付款 · 正在打印付款收據…');
        void localRuntime.ensureDiningPaymentReceipt(diningCheckout.holdId,diningCheckout.submissionId).then(result=>{
          if(result.state==='DONE'){setPrintStatus('堂食 '+diningCheckout.tableLabel+' · 付款收據已送出 · 未收 '+money(updated.remainingMinor));return;}
          if(result.state==='UNKNOWN'){setPrintStatus('堂食 '+diningCheckout.tableLabel+' · 收據／錢箱結果未知 · 唔會自動重試');return;}
          setPrintStatus('堂食 '+diningCheckout.tableLabel+' · 付款已保存，但付款收據未完成 · 請人手檢查');
        }).catch(error=>setPrintStatus('堂食付款已保存 · 收據處理失敗 '+(error instanceof Error?error.message:String(error))));
        return;
      }

      const order=localRuntime.createOrder({
        items:cart.map(line=>({
          id:line.productId,
          name:line.name,
          qty:line.qty,
          unitMinor:line.unitMinor,
          serviceMode:line.serviceMode,
          ...(line.detail?{detail:line.detail}:{}),
        })),
        totalMinor:due,
        paymentLabel,
        sourceLabel,
        ...(pickupCode.trim()?{providerPickupCode:pickupCode.trim()}:{}),
      });
      setCompletion({
        displayOrderCode:order.display,tenderLabel:tenderDisplay,dueLabel:money(due),
        receivedLabel:money(received),changeLabel:money(change),statusLabel:'COMPLETED',
      });
      setState('success');
      setPrintStatus('訂單已完成 · 正在送打印…');
      void localRuntime.printOrderOutputs(order.id).then(summary=>{
        if(summary.planned===0){setPrintStatus('訂單已完成 · 未有已綁定打印 Route');return;}
        if(summary.failed===0){setPrintStatus('訂單已完成 · 已送出 '+summary.sent+'/'+summary.planned+' 個打印工作');return;}
        const failures=summary.results.filter(row=>!row.ok).map(row=>row.role+':'+row.code).join('；');
        setPrintStatus('訂單已完成 · 打印部分失敗 '+summary.sent+'/'+summary.planned+' · '+failures);
      }).catch(error=>setPrintStatus('訂單已完成 · 打印失敗 '+(error instanceof Error?error.message:String(error))));
    }catch(cause){
      const code=cause instanceof Error?cause.message:String(cause);
      if(diningCheckout){
        if(code==='DINING_CHECKOUT_STALE'||code==='DINING_CHECKOUT_REFRESH_REQUIRED'){
          setDiningRequiresRefresh(true);
          setCheckoutFailure('堂食內容已更新；請返回堂食重新選擇未結項目，系統冇收款。');
        }else if(code==='DINING_SUBMISSION_CONFLICT'){
          setDiningRequiresRefresh(true);
          setCheckoutFailure('同一堂食付款識別出現內容衝突；請返回堂食重新讀取，系統冇建立第二筆付款。');
        }else{
          setCheckoutFailure('堂食付款未完成：'+code+'。請核對後重試；系統會沿用同一付款識別。');
        }
      }
      setState('failure');
    }
  };

  const actions:CheckoutWorkspaceActions={
    onBack:()=>{if(diningCheckout){setCart([]);onDiningCheckoutDone();navigate('/dining');}else navigate('/')},
    onSelectChannel:setChannel,
    onSelectMethod:setMethod,
    onChangeCustomerPhone:setCustomerPhone,
    onChangePickupCode:setPickupCode,
    onChangePlatformOrderNo:setPlatformOrderNo,
    onChangeSplitAmount:(id,value)=>setSplit(current=>({...current,[id]:value})),
    onCashKey:key=>{
      if(key==='⌫')setCash(value=>value.slice(0,-1));
      else if(key==='00')setCash(value=>(value||'')+'00');
      else setCash(value=>(value||'')+key);
    },
    onQuickCash:amount=>setCash(value=>((Number(value)||0)+amount).toFixed(2)),
    onExactCash:()=>setCash((due/100).toFixed(2)),
    onConfirm:confirm,onRetry:()=>{if(diningCheckout&&diningRequiresRefresh){setCart([]);onDiningCheckoutDone();navigate('/dining');return;}void confirm();},
    onDone:()=>{setCart([]);if(diningCheckout){onDiningCheckoutDone();navigate('/dining');}else navigate('/')},
  };

  return <CheckoutWorkspace view={view} actions={actions}/>;
}

function OperationalApp(){
  const navigate=useNavigate();
  const location=useLocation();
  const [globalArrival,setGlobalArrival]=useState<{orderId:string;display:string;sourceLabel:string}|null>(null);
  const [snoozedArrival,setSnoozedArrival]=useState<{orderId:string;display:string;sourceLabel:string}|null>(null);
  const snoozeTimerRef=useRef<number|undefined>(undefined);
  const [diningCheckout,setDiningCheckout]=useState<DiningCheckoutRequest|null>(()=>readDiningCheckoutUiSession());
  const [diningAddition,setDiningAddition]=useState<DiningAddOrderRequest|null>(()=>readDiningAddOrderUiSession());
  const [cart,setCartState]=useState<CartLine[]>(()=>diningCheckout?diningCheckoutCart(diningCheckout):[]);
  const [serviceMode,setServiceMode]=useState<ServiceMode>(diningCheckout||diningAddition?'dine-in':'takeaway');
  const [navRevision,setNavRevision]=useState(0);
  useEffect(()=>{
    if(location.pathname==='/dining'&&diningAddition){
      clearDiningAddOrderUiSession();
      setDiningAddition(null);
      setCartState([]);
      setServiceMode('dine-in');
    }
  },[location.pathname]);
  const snoozeGlobalArrival=(delayMs:number)=>{
    if(!globalArrival)return;
    const pending=globalArrival;
    setGlobalArrival(null);
    setSnoozedArrival(pending);
    if(snoozeTimerRef.current!==undefined)window.clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current=window.setTimeout(()=>{
      setGlobalArrival(pending);
      setSnoozedArrival(null);
      try{
        const AudioContextCtor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(AudioContextCtor){
          const ctx=new AudioContextCtor();const osc=ctx.createOscillator();const gain=ctx.createGain();
          osc.frequency.value=1040;gain.gain.value=0.18;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.4);
        }
      }catch{}
    },delayMs);
  };
  useEffect(()=>localRuntime.subscribe(()=>setNavRevision(value=>value+1)),[]);
  const activeOrderCount=useMemo(()=>{
    void navRevision;
    return localRuntime.orders().filter(order=>order.fulfillmentLabel==='待處理'||order.fulfillmentLabel==='進行中'||order.fulfillmentLabel==='可取餐').length;
  },[navRevision]);
  const setCart=(next:CartLine[])=>setCartState(next);
  const runtime=useMemo(()=>localRuntime,[]);
  useEffect(()=>{
    const onArrival=(raw:Event)=>{
      const detail=(raw as CustomEvent<{canonicalOrderId?:string;display?:string;sourceLabel?:string}>).detail;
      if(!detail?.canonicalOrderId)return;
      setGlobalArrival({orderId:detail.canonicalOrderId,display:String(detail.display||''),sourceLabel:String(detail.sourceLabel||'新訂單')});
      try{
        const AudioContextCtor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(AudioContextCtor){
          const ctx=new AudioContextCtor();const osc=ctx.createOscillator();const gain=ctx.createGain();
          osc.frequency.value=1040;gain.gain.value=0.18;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.4);
        }
      }catch{}
    };
    window.addEventListener('mfk-customer-order-intake',onArrival);
    window.addEventListener('mfk-keeta-order-intake',onArrival);
    return()=>{
      window.removeEventListener('mfk-customer-order-intake',onArrival);
      window.removeEventListener('mfk-keeta-order-intake',onArrival);
    };
  },[]);


  const prepareDiningCheckout=(request:DiningCheckoutRequest)=>{
    // C2: persist UI intent only. Runtime remains the only payment authority.
    clearDiningAddOrderUiSession();
    setDiningAddition(null);
    saveDiningCheckoutUiSession(request);
    setDiningCheckout(request);
    setServiceMode('dine-in');
    setCartState(diningCheckoutCart(request));
  };

  const prepareDiningAddition=(request:DiningAddOrderRequest)=>{
    clearDiningCheckoutUiSession();
    setDiningCheckout(null);
    saveDiningAddOrderUiSession(request);
    setDiningAddition(request);
    setServiceMode('dine-in');
    setCartState([]);
  };

  return <><RuntimeReadyActivation/><ProductionViewport><div className="clean-app">
    {globalArrival?<div className="mfk-global-order-alert" role="alertdialog" aria-modal="false">
      <div>
        <strong>新訂單到達，要處理</strong>
        <span>#{globalArrival.display} · {globalArrival.sourceLabel}</span>
      </div>
      <button type="button" onClick={()=>{
        const orderId=globalArrival.orderId;
        setGlobalArrival(null);
        navigate('/orders?orderId='+encodeURIComponent(orderId));
      }}>立即處理</button>
      <button type="button" aria-label="30 秒後再提示" onClick={()=>snoozeGlobalArrival(30000)}>30 秒後</button>
      <button type="button" aria-label="1 分鐘後再提示" onClick={()=>snoozeGlobalArrival(60000)}>1 分鐘後</button>
    </div>:null}
    <aside className="clean-rail">
      <div className="clean-brand" aria-label="磨飯">磨</div>
      <nav aria-label="MFK 主導航">
        {nav.map(item=><NavLink key={item.to} to={item.to} end={'end' in item?item.end:false} className={({isActive})=>isActive?'active':''}>
          <span className="clean-rail-icon">{item.icon}</span>
          <span className="clean-rail-label">{item.label}</span>
          {item.to==='/orders'&&activeOrderCount>0?<span className="clean-rail-badge" aria-label={'進行中訂單 '+activeOrderCount}>{activeOrderCount>99?'99+':activeOrderCount}</span>:null}
        </NavLink>)}
      </nav>
      <StaffSessionBadge/>
      <div className="clean-runtime-state">LOCAL<br/>OFFLINE</div>
    </aside>
    <section className="clean-route-stage">
      <Routes>
        <Route index element={<OrderingPage cart={cart} setCart={setCart} serviceMode={serviceMode} setServiceMode={setServiceMode} diningAddition={diningAddition} onDiningAdditionDone={()=>{clearDiningAddOrderUiSession();setDiningAddition(null);}}/>}/>
        <Route path="checkout" element={<CheckoutPage cart={cart} setCart={setCart} diningCheckout={diningCheckout} onDiningCheckoutDone={()=>{clearDiningCheckoutUiSession();setDiningCheckout(null);}}/>}/>
        <Route path="orders" element={<RuntimeOrdersWorkspace runtime={runtime}/>}/>
        <Route path="dining" element={<RuntimeDiningWorkspace runtime={runtime} onCheckout={prepareDiningCheckout} onAddOrder={prepareDiningAddition}/>}/>
        <Route path="soldout" element={<RuntimeSoldoutWorkspace runtime={runtime}/>}/>
        <Route path="more" element={<LocalMoreWorkspace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </section>
  </div></ProductionViewport></>;
}


export function MfkV2LocalApp(){
  return <StaffAuthGate><CashOpeningGate><OperationalApp/></CashOpeningGate></StaffAuthGate>;
}
