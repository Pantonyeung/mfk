import {useEffect,useMemo,useRef,useState} from 'react';
import {NavLink,Navigate,Route,Routes,useNavigate} from 'react-router';
import {useLocation} from 'react-router';
import {ProductionViewport} from './app/ProductionViewport.tsx';
import {OrderingWorkspace} from './features/ordering/OrderingWorkspace.tsx';
import {deriveOrderingGuidance,type OrderingWorkspaceActions,type OrderingWorkspaceViewModel,type ServiceMode} from './features/ordering/ordering-workspace-model.ts';
import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';
import type {CheckoutChannelFieldId,CheckoutChannelId,CheckoutTenderId,CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './features/checkout/checkout-workspace-model.ts';
import {RuntimeOrdersWorkspace} from './presentation/RuntimeOrdersWorkspace.tsx';
import {RuntimeDiningWorkspace,type DiningCheckoutRequest} from './presentation/RuntimeDiningWorkspace.tsx';
import {RuntimeSoldoutWorkspace} from './presentation/RuntimeSoldoutWorkspace.tsx';
import {LocalMoreWorkspace} from './presentation/LocalMoreWorkspace.tsx';
import {localRuntime,type DiningTender} from './runtime/local-runtime.ts';
import {readLocalAdminMenu,subscribeLocalAdminMenu} from './runtime/local-admin-menu.ts';
import {readSmtAdminConfigLkg,readSmtAdminSyncStatus,subscribeSmtAdminConfig} from './runtime/admin-config-sync.ts';
import {projectSyncedCombos,projectSyncedOrderingCatalog,type SyncedOptionSet} from './runtime/admin-config-projection.ts';
import {capacityNoticeForCount,readSmtFrontlinePresentation,readSmtStoreSettings} from './runtime/admin-operational-config.ts';
import {readBusinessCutoff} from './runtime/cash-opening.ts';
import {resolveBusinessWindow} from './runtime/local-operations.ts';
import {RuntimeReadyActivation} from './runtime/RuntimeReadyActivation.tsx';
import {StaffAuthGate,StaffSessionBadge} from './presentation/StaffAuthGate.tsx';
import {CashOpeningGate} from './presentation/CashOpeningGate.tsx';
import {readActiveStaffSession,staffAuthRequired} from './runtime/staff-auth.ts';
import {DEFAULT_SMT_FRONTLINE_UI_PREFERENCES,readSmtFrontlineUiPreferences,writeSmtFrontlineUiPreferences,type SmtFrontlineUiPreferences} from './runtime/frontline-ui-preferences.ts';
import {HoldCartWorkspace,HoldListWorkspace,ProductConfigWorkspace,type OrderingPanelState,type WorkspaceHoldDraft,type WorkspaceProduct} from './features/ordering/OrderingCenterWorkspaces.tsx';
import {ComboFastLaneWorkspace,RequiredFastLaneWorkspace,RiceballPoolWorkspace} from './features/ordering/FastLaneWorkspaces.tsx';
import {PendingOrderReviewWorkspace} from './features/ordering/PendingOrderReviewWorkspace.tsx';
import {applyPairingPlan,applyRequiredSelection,buildAutoPairingPlans,comboBlockingCount,comboDraftCount,comboSlots,countMainCourseUnits,countRiceballCandidateUnits,defaultSelectionsForProduct,dissolveComboLine,fillPendingComboGroup,fillPendingComboGroupFromConfiguredProduct,freeNoteForLine,nextPairingIndex,rebuildConfiguredLine,requiredTasks,restoreFastLaneLineComposition,riceballMealCombos,selectionsForLine,serializeFastLaneComposition,type FastLaneCartLine,type FastLanePairPlan,type FastLaneProduct} from './features/ordering/fast-lane-model.ts';

type Product={
  id:string;
  categoryId:string;
  category:string;
  name:string;
  priceMinor:number;
  priceReady:boolean;
  sellable:boolean;
  imageUrl?:string;
  optionSets:readonly SyncedOptionSet[];
};
type CartLine=FastLaneCartLine;

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

const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);
let localCartLineSequence=0;
const nextLocalCartLineId=()=>{localCartLineSequence+=1;return 'line-'+Date.now().toString(36)+'-'+localCartLineSequence.toString(36)};

const PRODUCT_ART_COLORS:Record<string,[string,string]>={
  '飯團':['#dbe9ff','#4d7fca'],
  '便當':['#cfdef5','#3f6fb4'],
  '小食':['#e7effc','#5d84bd'],
  '飲品':['#d5e6ff','#2f6fbd'],
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
  {to:'/soldout',label:'售罄／產能',icon:'⊘'},
] as const;

function OrderingPage({
  cart,setCart,serviceMode,setServiceMode,orderingMode,setOrderingMode,quickDrinkOpen,setQuickDrinkOpen,
  uiPreferences,onQuickDrinkCountChange,
}:{
  cart:CartLine[];
  setCart:(v:CartLine[])=>void;
  serviceMode:ServiceMode;
  setServiceMode:(m:ServiceMode)=>void;
  orderingMode:'normal'|'quick';
  setOrderingMode:(mode:'normal'|'quick')=>void;
  quickDrinkOpen:boolean;
  setQuickDrinkOpen:(value:boolean|((current:boolean)=>boolean))=>void;
  uiPreferences:SmtFrontlineUiPreferences;
  onQuickDrinkCountChange:(count:number)=>void;
}){
  const navigate=useNavigate();
  const [runtimeRevision,setRuntimeRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRuntimeRevision(value=>value+1)),[]);
  const [category,setCategory]=useState('all');
  const [viewMode,setViewMode]=useState<'original'|'organized'>('original');
  const [combineSimilar,setCombineSimilar]=useState(false);
  const [pulse,setPulse]=useState(0);
  const [recent,setRecent]=useState<string|undefined>();
  const [highlight,setHighlight]=useState<string|undefined>();
  const [panel,setPanel]=useState<OrderingPanelState>(null);
  const [panelDirty,setPanelDirty]=useState(false);
  useEffect(()=>setPanelDirty(false),[panel]);
  const requestClosePanel=()=>{
    if(panelDirty&&!window.confirm('有未保存修改，確定退出？'))return;
    setPanel(null);
  };
  const [adminMenuRevision,setAdminMenuRevision]=useState(0);
  const [adminConfigRevision,setAdminConfigRevision]=useState(0);
  useEffect(()=>subscribeLocalAdminMenu(()=>setAdminMenuRevision(value=>value+1)),[]);
  useEffect(()=>subscribeSmtAdminConfig(()=>setAdminConfigRevision(value=>value+1)),[]);
  const adminMenu=useMemo(()=>{void adminMenuRevision;return readLocalAdminMenu();},[adminMenuRevision]);
  const adminConfig=useMemo(()=>{void adminConfigRevision;return readSmtAdminConfigLkg();},[adminConfigRevision]);
  const syncStatus=useMemo(()=>{void adminConfigRevision;return readSmtAdminSyncStatus();},[adminConfigRevision]);
  const syncedCatalog=useMemo(
    ()=>adminConfig?projectSyncedOrderingCatalog(serviceMode,adminConfig):null,
    [adminConfig,serviceMode],
  );
  const comboData=useMemo(
    ()=>adminConfig?projectSyncedCombos(adminConfig):{combos:[] as const,pools:[] as const},
    [adminConfig],
  );

  const storeSettings=useMemo(()=>{void adminConfigRevision;return readSmtStoreSettings();},[adminConfigRevision]);
  const frontlinePresentation=useMemo(()=>{void adminConfigRevision;return readSmtFrontlinePresentation();},[adminConfigRevision]);
  const activeStaff=readActiveStaffSession();
  const canOverridePrice=Boolean(activeStaff)||!staffAuthRequired();
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
  const waitingHolds=useMemo(()=>heldCarts.filter(hold=>hold.kind==='waiting'),[heldCarts]);
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
  const nextDisplay='P'+String(localRuntime.orders().length+1).padStart(3,'0');

  const workspaceProducts:WorkspaceProduct[]=products.filter(product=>product.priceReady&&product.sellable).map(product=>({
    id:product.id,
    category:product.category,
    name:product.name,
    priceMinor:product.priceMinor,
    priceLabel:money(product.priceMinor),
    imageUrl:product.imageUrl??productArtwork(product),
    optionSets:product.optionSets,
  }));
  const fastLaneProducts:FastLaneProduct[]=workspaceProducts.map(product=>({
    id:product.id,name:product.name,category:product.category,priceMinor:product.priceMinor,optionSets:product.optionSets??[],
  }));
  const requiredWork=requiredTasks(cart,fastLaneProducts);
  const riceballCombos=riceballMealCombos(comboData.combos,comboData.pools,fastLaneProducts);
  const configuredRiceballUnits=countMainCourseUnits(cart,riceballCombos,comboData.pools,fastLaneProducts);
  const riceballPoolCount=Math.max(configuredRiceballUnits,countRiceballCandidateUnits(cart,fastLaneProducts));
  const primaryCombo=riceballCombos[0];
  const autoPairCount=buildAutoPairingPlans(cart,primaryCombo,comboData.pools,fastLaneProducts,nextPairingIndex(cart)).length;
  const comboWorkCount=comboDraftCount(cart)+autoPairCount;
  const requiredBlockers=requiredWork.length;
  const comboBlockers=comboBlockingCount(cart);
  const fastLaneBlockers=requiredBlockers+comboBlockers;
  const pendingDrinkTargetsFor=(lines:readonly FastLaneCartLine[])=>lines.flatMap(line=>{
    const draft=line.comboDraft;
    if(!draft)return [];
    const combo=comboData.combos.find(row=>row.id===draft.comboId&&row.active);
    if(!combo)return [];
    const slots=comboSlots(combo,comboData.pools,fastLaneProducts);
    return draft.pendingGroups
      .filter(group=>group.role==='DRINK')
      .flatMap(group=>{
        const slot=slots.find(row=>row.groupId===group.groupId&&row.role==='DRINK');
        return slot?[{comboLine:line,group,slot}]:[];
      });
  });
  const pendingDrinkTargets=pendingDrinkTargetsFor(cart);
  useEffect(()=>onQuickDrinkCountChange(pendingDrinkTargets.length),[pendingDrinkTargets.length,onQuickDrinkCountChange]);
  const quickDrinkTarget=pendingDrinkTargets[0];
  const quickDrinkChoices=(quickDrinkTarget?.slot.choices??[]).map(choice=>{
    const product=choice.productId?products.find(row=>row.id===choice.productId):undefined;
    return {
      id:choice.id,
      label:choice.label,
      priceAdjustmentLabel:choice.priceAdjustmentMinor===0?undefined:(choice.priceAdjustmentMinor>0?'+':'')+money(choice.priceAdjustmentMinor),
      enabled:choice.type!=='PRODUCT'||Boolean(product?.priceReady&&product.sellable),
      requiresConfiguration:choice.type==='PRODUCT'&&Boolean(product?.optionSets.length),
    };
  });
  const holdTables=Array.from({length:9},(_,index)=>{
    const id='T'+String(index+1).padStart(2,'0');
    const occupied=heldCarts.find(hold=>hold.kind==='dining'&&hold.assignedTable===id);
    return {id,label:String(index+1),occupied:Boolean(occupied),codeLabel:occupied?.codeLabel};
  });

  const productById=new Map(products.map(product=>[product.id,product] as const));
  const presentCartLine=(line:CartLine,index:number,quantity=line.qty,sourceLineIds:readonly string[]=[line.id])=>{
    const product=productById.get(line.productId);
    return {
      id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id+'::'+index,
      name:line.name,
      quantity,
      lineTotalLabel:money(line.unitMinor*quantity),
      serviceMode:line.serviceMode,
      groupId:product?.categoryId??'local',
      groupLabel:product?.category??'本機',
      detail:line.detail,
      sourceLineIds,
    };
  };
  const presentationCart=(()=>{
    if(!combineSimilar){
      return cart.flatMap((line,lineIndex)=>Array.from({length:Math.max(1,line.qty)},(_,unitIndex)=>
        presentCartLine(line,lineIndex+unitIndex/100,1,[line.id])
      ));
    }
    const groups=new Map<string,{line:CartLine;quantity:number;ids:string[];index:number}>();
    cart.forEach((line,index)=>{
      const key=[
        line.productId,
        line.serviceMode,
        line.unitMinor,
        line.detail??'',
        JSON.stringify(line.optionSelections??{}),
        line.freeNote??'',
        JSON.stringify(line.comboDraft??null),
      ].join('::');
      const current=groups.get(key);
      if(current){
        current.quantity+=line.qty;
        if(!current.ids.includes(line.id))current.ids.push(line.id);
      }else groups.set(key,{line,quantity:line.qty,ids:[line.id],index});
    });
    return [...groups.values()].sort((a,b)=>a.index-b.index).map(group=>
      presentCartLine(group.line,group.index,group.quantity,group.ids)
    );
  })();

  const checkoutEnabled=cart.length>0&&fastLaneBlockers===0&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled));
  const guidanceTarget=deriveOrderingGuidance({
    cartItemCount:cart.reduce((sum,line)=>sum+line.qty,0),
    requiredCount:requiredBlockers,
    pendingDrinkCount:pendingDrinkTargets.length,
    comboBlockingCount:comboBlockers,
    autoPairCount,
    checkoutEnabled,
  });

  const guideAfterStructuredChange=(next:readonly FastLaneCartLine[])=>{
    setPanelDirty(false);
    const nextRequired=requiredTasks(next,fastLaneProducts);
    if(nextRequired.length){
      setQuickDrinkOpen(false);
      setPanel({type:'fast-lane',lane:'required'});
      return;
    }
    const nextDrinks=pendingDrinkTargetsFor(next);
    if(nextDrinks.length){
      setPanel(null);
      setQuickDrinkOpen(true);
      return;
    }
    if(comboBlockingCount(next)>0){
      setQuickDrinkOpen(false);
      setPanel({type:'fast-lane',lane:'combo'});
      return;
    }
    const nextPlans=buildAutoPairingPlans(next,primaryCombo,comboData.pools,fastLaneProducts,nextPairingIndex(next));
    if(nextPlans.length){
      setQuickDrinkOpen(false);
      setPanel({type:'fast-lane',lane:'riceball-pool'});
      return;
    }
    setQuickDrinkOpen(false);
    setPanel(null);
  };

  const view:OrderingWorkspaceViewModel={
    pendingOrders,activeOrders,categories,selectedCategoryId:category,
    products:visible.map(product=>({
      id:product.id,
      name:product.name,
      priceLabel:product.priceReady?money(product.priceMinor):'未接價格',
      enabled:product.priceReady&&product.sellable&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
      requiresOptions:product.priceReady&&product.sellable&&product.optionSets.length>0,
      quickAddAllowed:!product.optionSets.some(set=>set.forceShow&&!set.required&&set.min===0),
      imageUrl:uiPreferences.showImages?(product.imageUrl??productArtwork(product)):undefined,
      ...(!product.priceReady?{badge:'未接價格'}:!product.sellable?{badge:'停售'}:{}),
    })),
    menuRevisionLabel:adminConfig
      ?storeSettings.storeName+' · ADMIN R'+adminConfig.revision+' · '+(syncStatus.state==='SYNCED'?'已同步':syncStatus.state==='LOCAL_LKG'?'LKG':'同步中')
      :'LOCAL FALLBACK · R'+adminMenu.revision,
    operationalNotice:capacityNotice
      ?'今日 '+capacityNotice.currentCount+'/'+capacityNotice.dailyLimit+' 單 · 已到 '+capacityNotice.warningAt+'% 提醒門檻'+(capacityNotice.hardStopConfigured?' · Admin 有 hard-stop 設定但目前只提示':'')
      :undefined,
    showCategories:uiPreferences.showCategories,
    categoryRows:uiPreferences.categoryRows,
    categoryColumns:uiPreferences.categoryColumns,
    productColumns:uiPreferences.productColumns,
    productCardHeight:uiPreferences.productCardHeight,
    fontScale:uiPreferences.fontScale,
    densityScale:uiPreferences.densityScale,
    serviceModes:{takeaway:storeSettings.takeawayEnabled,dineIn:storeSettings.dineInEnabled},
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,combineSimilar,
      lines:presentationCart,
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),
      checkoutEnabled,
      blockingMessage:fastLaneBlockers>0?'仍有 '+fastLaneBlockers+' 項必選／套餐待補；完成後先可結帳':undefined,
    },
    orderingMode,
    quickDrink:{
      open:quickDrinkOpen,
      pendingCount:pendingDrinkTargets.length,
      targetLabel:quickDrinkTarget?quickDrinkTarget.comboLine.comboDraft?.pairingLabel+' 組 · '+quickDrinkTarget.comboLine.name:undefined,
      choices:quickDrinkChoices,
    },
    heldCartCount:waitingHolds.length,
    workItems:[
      {id:'riceball-pool',label:'快速組合',count:riceballPoolCount},
      {id:'required',label:'必選區',count:requiredWork.length},
      {id:'combo',label:'紫米套餐區',count:comboWorkCount},
    ],
    actionAvailability:{
      lineServiceMode:true,
      lineEdit:true,
      lineQuantity:combineSimilar,
      holdCart:cart.length>0,
      cancelCart:cart.length>0,
    },
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
    guidanceTarget,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product||!product.priceReady||!product.sellable)return;
    const base:CartLine={id:nextLocalCartLineId(),productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode};
    const fastProduct=fastLaneProducts.find(item=>item.id===product.id);
    const line=fastProduct?rebuildConfiguredLine(base,fastProduct,defaultSelectionsForProduct(fastProduct),''):base;
    const next=[...cart,line];
    setCart(next);
    setRecent(id);
    setHighlight(line.id);
    setPulse(value=>value+1);
    if(orderingMode==='quick'&&requiredTasks(next,fastLaneProducts).length){
      setQuickDrinkOpen(false);
      setPanel({type:'fast-lane',lane:'required'});
    }
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };

  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number,structured:{readonly selections:Readonly<Record<string,readonly string[]>>;readonly note:string;readonly overrideUnitMinor?:number})=>{
    const product=products.find(item=>item.id===productId);if(!product||!product.priceReady||!product.sellable)return;
    const line:CartLine={
      id:nextLocalCartLineId(),productId:product.id,name:product.name,qty,unitMinor:structured.overrideUnitMinor??(product.priceMinor+deltaMinor),serviceMode,detail,
      optionSelections:structured.selections,freeNote:structured.note,
    };
    setCart([...cart,line]);setRecent(product.id);setHighlight(line.id);setPulse(value=>value+1);setPanelDirty(false);setPanel(null);
  };

  const updateConfigured=(lineId:string,productId:string,detail:string,deltaMinor:number,qty:number,structured:{readonly selections:Readonly<Record<string,readonly string[]>>;readonly note:string;readonly overrideUnitMinor?:number})=>{
    const product=products.find(item=>item.id===productId);if(!product)return;
    const next=cart.map(line=>line.id===lineId?{
      ...line,
      name:product.name,
      qty,
      unitMinor:structured.overrideUnitMinor??(product.priceMinor+deltaMinor),
      detail:detail||undefined,
      optionSelections:structured.selections,
      freeNote:structured.note,
    }:line);
    setCart(next);setHighlight(lineId);setPulse(value=>value+1);setPanelDirty(false);setPanel(null);
  };

  const applyRequired=(lineId:string,groupId:string,optionIds:readonly string[])=>{
    const next=applyRequiredSelection(cart,fastLaneProducts,lineId,groupId,optionIds);
    setCart(next);setHighlight(lineId);setPulse(value=>value+1);guideAfterStructuredChange(next);
  };
  const applyOnePair=(plan:FastLanePairPlan)=>{
    const next=applyPairingPlan(cart,plan,comboData.combos,comboData.pools,fastLaneProducts,nextLocalCartLineId);
    setCart(next);setPulse(value=>value+1);guideAfterStructuredChange(next);
  };
  const applyAutoPairs=(plans:readonly FastLanePairPlan[])=>{
    let next:readonly FastLaneCartLine[]=cart;
    for(const plan of plans)next=applyPairingPlan(next,plan,comboData.combos,comboData.pools,fastLaneProducts,nextLocalCartLineId);
    setCart([...next]);setPulse(value=>value+1);guideAfterStructuredChange(next);
  };
  const fillComboPending=(comboLineId:string,groupId:string,choiceId:string,sourceLineId?:string)=>{
    const next=fillPendingComboGroup(cart,comboLineId,groupId,choiceId,sourceLineId,comboData.combos,comboData.pools,fastLaneProducts);
    setCart(next);setHighlight(comboLineId);setPulse(value=>value+1);guideAfterStructuredChange(next);
  };
  const dissolveCombo=(comboLineId:string)=>{
    setCart(dissolveComboLine(cart,comboLineId,nextLocalCartLineId));setPulse(value=>value+1);
  };
  const fillQuickDrinkConfigured=(comboLineId:string,groupId:string,choiceId:string,configuredLine:CartLine)=>{
    const next=fillPendingComboGroupFromConfiguredProduct(cart,comboLineId,groupId,choiceId,configuredLine,comboData.combos,comboData.pools,fastLaneProducts);
    setCart(next);setHighlight(comboLineId);setPulse(value=>value+1);guideAfterStructuredChange(next);
  };
  const selectQuickDrink=(choiceId:string)=>{
    const target=quickDrinkTarget;if(!target)return;
    const choice=target.slot.choices.find(row=>row.id===choiceId);if(!choice)return;
    if(choice.type!=='PRODUCT'){
      fillComboPending(target.comboLine.id,target.group.groupId,choice.id);
      return;
    }
    const product=products.find(row=>row.id===choice.productId);
    const fastProduct=fastLaneProducts.find(row=>row.id===choice.productId);
    if(!product||!fastProduct||!product.priceReady||!product.sellable)return;
    if(product.optionSets.length){
      setQuickDrinkOpen(false);
      setPanel({type:'quick-drink-config',productId:product.id,comboLineId:target.comboLine.id,groupId:target.group.groupId,choiceId:choice.id});
      return;
    }
    const configured:CartLine=rebuildConfiguredLine({
      id:nextLocalCartLineId(),productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode:target.comboLine.serviceMode,
    },fastProduct,defaultSelectionsForProduct(fastProduct),'');
    fillQuickDrinkConfigured(target.comboLine.id,target.group.groupId,choice.id,configured);
  };

  const holdItems=()=>cart.map(line=>({
    id:line.productId,
    name:line.name,
    qty:line.qty,
    unitMinor:line.unitMinor,
    serviceMode:line.serviceMode,
    ...(line.detail?{detail:line.detail}:{}),
    composition:serializeFastLaneComposition(line,'HOLD'),
  }));
  const finishHold=()=>{setCart([]);setServiceMode('takeaway');setPanelDirty(false);setPanel(null);};

  const panelTitle=panel?.type==='product'?'商品選項'
    :panel?.type==='quick-drink-config'?'快捷飲品設定'
    :panel?.type==='pending-order'?'待處理訂單'
    :panel?.type==='fast-lane'?(panel.lane==='riceball-pool'?'快速組合':panel.lane==='required'?'必選區':'紫米套餐區')
    :panel?.type==='hold'?'暫存工作台'
    :panel?.type==='holds'?'暫存單':'';

  const panelBody=panel?.type==='product'
    ?(()=>{
      const product=workspaceProducts.find(item=>item.id===panel.productId);
      const line=panel.lineId?cart.find(item=>item.id===panel.lineId):undefined;
      const fastProduct=fastLaneProducts.find(item=>item.id===panel.productId);
      if(!product)return null;
      return <ProductConfigWorkspace
        product={product}
        canOverridePrice={canOverridePrice}
        mode={line?'edit':'add'}
        initialQty={line?.qty??1}
        initialSelections={line&&fastProduct?selectionsForLine(line,fastProduct):line?.optionSelections}
        initialNote={line&&fastProduct?freeNoteForLine(line,fastProduct):(line?.freeNote??'')}
        initialUnitMinor={line?.unitMinor}
        onDirtyChange={setPanelDirty}
        onAdd={(detail,delta,qty,structured)=>line
          ?updateConfigured(line.id,product.id,detail,delta,qty,structured)
          :addConfigured(product.id,detail,delta,qty,structured)}
      />;
    })()
    :panel?.type==='pending-order'
      ?(()=>{const order=runtimeOrders.find(item=>item.id===panel.orderId);return order?<PendingOrderReviewWorkspace
        order={order}
        onAccept={async()=>{
          const result=await localRuntime.acceptOrder(order.id);
          const isKeeta=/^Keeta\b/i.test(String(order.sourceLabel||''));
          if(isKeeta){
            if(result.provider.state==='ATTENTION')return '本地已接單；Keeta CONFIRM 需要處理：'+(result.provider.code??'UNKNOWN');
            if(result.provider.state==='SYNCED'||result.provider.state==='IDEMPOTENT')return '已接單；Keeta CONFIRM 已同步，打印沿現有正式路徑完成。';
          }
          return '已接受訂單；同一正式訂單進入製作中，打印沿現有正式路徑完成。';
        }}
        onOpenOrders={()=>{setPanel(null);navigate('/orders?orderId='+encodeURIComponent(order.id));}}
      />:null})()
    :panel?.type==='quick-drink-config'
      ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);return product?<ProductConfigWorkspace product={product} maxQty={1} canOverridePrice={canOverridePrice} onDirtyChange={setPanelDirty} onAdd={(detail,delta,_qty,structured)=>{
        fillQuickDrinkConfigured(panel.comboLineId,panel.groupId,panel.choiceId,{
          id:nextLocalCartLineId(),productId:product.id,name:product.name,qty:1,unitMinor:structured.overrideUnitMinor??(product.priceMinor+delta),serviceMode,
          detail,optionSelections:structured.selections,freeNote:structured.note,
        });
      }}/>:null})()
    :panel?.type==='fast-lane'
      ?panel.lane==='riceball-pool'
        ?<RiceballPoolWorkspace cart={cart} products={fastLaneProducts} combos={riceballCombos} pools={comboData.pools} onAutoPair={applyAutoPairs}/>
        :panel.lane==='required'
          ?<RequiredFastLaneWorkspace cart={cart} products={fastLaneProducts} onDirtyChange={setPanelDirty} onApply={applyRequired}/>
          :<ComboFastLaneWorkspace cart={cart} products={fastLaneProducts} combos={riceballCombos} pools={comboData.pools} onDirtyChange={setPanelDirty} onPair={applyOnePair} onFillPending={fillComboPending} onDissolve={dissolveCombo}/>
      :panel?.type==='hold'
          ?<HoldCartWorkspace
            lines={cart}
            totalMinor={total}
            tables={holdTables}
            onDirtyChange={setPanelDirty}
            onHoldWaiting={(partySize,note)=>{
              localRuntime.createHold({kind:'waiting',items:holdItems(),totalMinor:total,partySize,note:note||'暫存待客'});
              finishHold();
            }}
            onHoldQueue={(partySize,note)=>{
              localRuntime.createHold({kind:'dining',items:holdItems(),totalMinor:total,partySize,note:note||'堂食輪候'});
              finishHold();
            }}
            onHoldTable={(tableId,partySize,note)=>{
              const draft=localRuntime.createHold({kind:'dining',items:holdItems(),totalMinor:total,partySize,note:note||'直接掛枱'});
              void localRuntime.assignDiningTable?.(draft.id,tableId).then(()=>{
                setCart([]);setServiceMode('dine-in');setPanel(null);
              });
            }}
          />
          :panel?.type==='holds'
            ?<HoldListWorkspace holds={waitingHolds as readonly WorkspaceHoldDraft[]} onRestore={hold=>{
              const restored:CartLine[]=hold.items.map((item,index)=>{
                const parts=item.name.split('｜');
                const legacyName=parts.shift()||item.name;
                const legacyDetail=parts.length?parts.join('｜'):undefined;
                const base:CartLine={
                  id:'line-'+hold.id+'-'+index+'-'+Date.now().toString(36),
                  productId:item.id,
                  name:item.detail!==undefined?item.name:legacyName,
                  qty:item.qty,
                  unitMinor:item.unitMinor,
                  serviceMode:item.serviceMode??(hold.kind==='dining'?'dine-in':'takeaway'),
                  detail:item.detail??legacyDetail,
                };
                return restoreFastLaneLineComposition(base,item.composition);
              });
              setCart(restored);
              setServiceMode(hold.kind==='dining'?'dine-in':'takeaway');
              localRuntime.removeHold(hold.id);
              setPanel(null);
            }} onRemove={id=>localRuntime.removeHold(id)}/>
            :null;

  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,
    onAddProduct:add,
    onConfigureProduct:id=>{setQuickDrinkOpen(false);setPanelDirty(false);setPanel({type:'product',productId:id});},
    onChangeOrderingMode:setOrderingMode,
    onToggleQuickDrink:()=>setQuickDrinkOpen(value=>!value),
    onSelectQuickDrink:selectQuickDrink,
    onOpenQuickDrinkTargets:()=>{if(pendingDrinkTargets.length){setQuickDrinkOpen(false);setPanel({type:'fast-lane',lane:'combo'});}},
    onChangeServiceMode:mode=>{
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      setServiceMode(mode);setCart(cart.map(item=>({...item,serviceMode:mode})));
    },
    onChangeCartView:setViewMode,
    onToggleCombine:()=>setCombineSimilar(value=>!value),
    onChangeLineServiceMode:(lineIds,mode)=>{
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      const ids=new Set(lineIds);
      setCart(cart.map(item=>ids.has(item.id)?{...item,serviceMode:mode}:item));
    },
    onAdjustLineQuantity:(lineIds,delta)=>{
      const id=lineIds[0];if(!id)return;
      const target=cart.find(item=>item.id===id);if(!target)return;
      if(delta===1){
        setCart(cart.map(item=>item.id===id?{...item,qty:item.qty+1}:item));
        return;
      }
      if(target.qty>1)setCart(cart.map(item=>item.id===id?{...item,qty:item.qty-1}:item));
      else setCart(cart.filter(item=>item.id!==id));
    },
    onEditCartLine:lineIds=>{
      const line=cart.find(item=>item.id===lineIds[0]);
      if(!line)return;
      if(line.comboDraft||comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'fast-lane',lane:'combo'});
      else {setPanelDirty(false);setPanel({type:'product',productId:line.productId,lineId:line.id});}
    },
    onRemoveCartLine:lineIds=>{
      const ids=new Set(lineIds);
      if(!combineSimilar&&lineIds.length===1){
        const target=cart.find(item=>item.id===lineIds[0]);
        if(target&&target.qty>1){
          setCart(cart.map(item=>item.id===target.id?{...item,qty:item.qty-1}:item));
          return;
        }
      }
      setCart(cart.filter(item=>!ids.has(item.id)));
    },
    onHoldCart:()=>{if(cart.length){setPanelDirty(false);setPanel({type:'hold'});}},
    onOpenHeldOrders:()=>{if(!cart.length&&waitingHolds.length){setPanelDirty(false);setPanel({type:'holds'});}},
    onCancelCart:()=>{if(cart.length&&window.confirm('確定取消目前訂單？'))setCart([]);},
    onOpenWorkItem:id=>{setPanelDirty(false);setPanel({type:'fast-lane',lane:id});},
    onOpenQueueOrder:(_kind,id)=>{setQuickDrinkOpen(false);setPanelDirty(false);setPanel({type:'pending-order',orderId:id});},
    onCheckout:()=>navigate('/checkout'),
  };
  return <OrderingWorkspace view={view} actions={actions} centerPanel={panel&&panelBody?{
    title:panelTitle,
    body:panelBody,
    onClose:requestClosePanel,
    dirty:panelDirty,
    variant:panel.type==='product'||panel.type==='quick-drink-config'?'product':'default',
  }:null}/>;
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
  const checkoutSubmissionIdRef=useRef('SMT-CHECKOUT-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const checkoutCommitBusyRef=useRef(false);

  const methodLabels:Record<CheckoutTenderId,string>={
    CASH:'現金付款',ALIPAY:'AlipayHK',WECHAT:'WeChat Pay HK',FPS:'FPS／轉數快',PAYME:'PayMe',COMBO:'組合付款'
  };
  const channelLabels:Record<CheckoutChannelId,string>={
    'walk-in':'現場','whatsapp':'電話／WhatsApp','morefun-app':'磨飯 App','keeta':'Keeta','foodpanda':'Foodpanda'
  };

  const parseMoney=(value:string)=>Math.max(0,Math.round((Number(value)||0)*100));
  const cashMinor=parseMoney(cash);
  const comboMinor=(Object.values(split) as string[]).reduce((sum,value)=>sum+parseMoney(value),0);
  const settlementMode=channel==='walk-in'?'LOCAL_PAYMENT' as const:'CHANNEL_INFO' as const;
  const received=settlementMode==='LOCAL_PAYMENT'?(method==='CASH'?cashMinor:method==='COMBO'?comboMinor:due):due;
  const change=settlementMode==='LOCAL_PAYMENT'&&method==='CASH'?Math.max(0,received-due):0;
  const comboExact=method!=='COMBO'||comboMinor===due;
  const cashReady=method!=='CASH'||received>=due;
  const channelRequiredReady=channel==='walk-in'
    ?true
    :channel==='whatsapp'
      ?Boolean(customerPhone.trim())
      :Boolean(platformOrderNo.trim());
  const checkoutAdminConfig=readSmtAdminConfigLkg();
  const checkoutFastLaneProducts:FastLaneProduct[]=checkoutAdminConfig
    ?[...new Map((['takeaway','dine-in'] as const).flatMap(mode=>projectSyncedOrderingCatalog(mode,checkoutAdminConfig).products).map(product=>[
      product.id,
      {id:product.id,name:product.name,priceMinor:product.priceMinor,optionSets:product.optionSets??[]},
    ] as const)).values()]
    :[];
  const formalFastLaneBlockers=diningCheckout?0:requiredTasks(cart,checkoutFastLaneProducts).length+comboBlockingCount(cart);
  const localPaymentReady=comboExact&&cashReady;
  const confirmEnabled=cart.length>0&&formalFastLaneBlockers===0&&(settlementMode==='LOCAL_PAYMENT'?localPaymentReady:channelRequiredReady);
  const validationMessage=formalFastLaneBlockers>0?'仍有 '+formalFastLaneBlockers+' 項必選／套餐未完成，返回點餐完成後先可正式結帳':
    settlementMode==='CHANNEL_INFO'&&!channelRequiredReady
      ?(channel==='whatsapp'?'請先輸入客戶電話':'請先輸入訂單號碼／流水號')
      :method==='CASH'&&cash&&received<due?'收款金額不足':
    method==='COMBO'&&comboMinor!==due?'組合付款合計 '+money(comboMinor)+'，必須等於 '+money(due):undefined;

  const sourceParts=[channelLabels[channel]];
  if(channel==='whatsapp'){
    if(customerPhone.trim())sourceParts.push(customerPhone.trim());
    if(platformOrderNo.trim())sourceParts.push('參考 '+platformOrderNo.trim());
  }else if(channel!=='walk-in'){
    if(pickupCode.trim())sourceParts.push('取餐碼 '+pickupCode.trim());
    if(platformOrderNo.trim())sourceParts.push('單號 '+platformOrderNo.trim());
  }
  const sourceLabel=sourceParts.join(' · ');
  const comboEntries=(Object.entries(split) as [keyof typeof split,string][]).filter(([,value])=>parseMoney(value)>0);
  const localPaymentLabel=method==='COMBO'
    ?'COMBO '+comboEntries.map(([id,value])=>id+' '+money(parseMoney(value))).join(' + ')
    :method;
  const externalPaymentLabel:Record<Exclude<CheckoutChannelId,'walk-in'>,string>={
    whatsapp:'到店付款',
    'morefun-app':'到店付款',
    foodpanda:'FOODPANDA',
    keeta:'KEETA',
  };
  const paymentLabel=settlementMode==='LOCAL_PAYMENT'?localPaymentLabel:externalPaymentLabel[channel as Exclude<CheckoutChannelId,'walk-in'>];
  const tenderDisplay=settlementMode==='CHANNEL_INFO'
    ?channelLabels[channel]+(paymentLabel==='到店付款'?' · 到店付款':'')
    :method==='COMBO'
      ?comboEntries.map(([id,value])=>methodLabels[id]+' '+money(parseMoney(value))).join(' + ')
      :methodLabels[method];

  const channelInfo:CheckoutWorkspaceViewModel['channelInfo']=channel==='whatsapp'
    ?{
      title:'電話／WhatsApp 訂單資料',
      helperLabel:'付款方式唔喺呢度揀；先記錄客戶資料。',
      fields:[
        {id:'customerPhone',label:'客戶電話',placeholder:'輸入電話／WhatsApp',value:customerPhone,required:true},
        {id:'platformOrderNo',label:'流水號／參考',placeholder:'如有可輸入',value:platformOrderNo,required:false},
      ],
    }
    :channel==='morefun-app'
      ?{
        title:'磨飯 App 訂單資料',
        helperLabel:'記錄 App 訂單識別；到店付款由來源狀態處理。',
        fields:[
          {id:'platformOrderNo',label:'App 訂單號碼／流水號',placeholder:'輸入 App 訂單號碼',value:platformOrderNo,required:true},
          {id:'pickupCode',label:'取餐碼',placeholder:'如有可輸入',value:pickupCode,required:false},
        ],
      }
      :channel==='foodpanda'
        ?{
          title:'Foodpanda 訂單資料',
          helperLabel:'平台單只記錄平台資料，唔再揀門店付款方式。',
          fields:[
            {id:'platformOrderNo',label:'Foodpanda 訂單號碼',placeholder:'輸入平台單號',value:platformOrderNo,required:true},
            {id:'pickupCode',label:'取餐碼',placeholder:'如有可輸入',value:pickupCode,required:false},
          ],
        }
        :channel==='keeta'
          ?{
            title:'Keeta 訂單資料',
            helperLabel:'平台單只記錄平台資料，唔再揀門店付款方式。',
            fields:[
              {id:'platformOrderNo',label:'Keeta 訂單號碼',placeholder:'輸入 Keeta 單號',value:platformOrderNo,required:true},
              {id:'pickupCode',label:'取餐碼',placeholder:'如有可輸入',value:pickupCode,required:false},
            ],
          }
          :{title:'現場收款',fields:[]};

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
    methods:(['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO'] as CheckoutTenderId[]).map(id=>({
      id,label:methodLabels[id],enabled:true,selected:method===id,
    })),
    settlementMode,
    selectedMethodLabel:methodLabels[method],
    amount:{dueLabel:money(due),receivedLabel:money(received),changeLabel:money(change)},
    cashInput:cash,cashEntryVisible:settlementMode==='LOCAL_PAYMENT'&&method==='CASH',exactCashEnabled:settlementMode==='LOCAL_PAYMENT'&&method==='CASH',confirmEnabled,
    paymentState:state,
    channelInfo,
    comboMode:settlementMode==='LOCAL_PAYMENT'&&method==='COMBO',
    splitTenders:(['CASH','FPS','PAYME','ALIPAY','WECHAT'] as const).map(id=>({id,label:methodLabels[id],amount:split[id]})),
    validationMessage,statusMessage:printStatus,completionReview:completion,
  };

  const correctionMethods=(selectedId:CheckoutTenderId)=>(['CASH','ALIPAY','WECHAT','FPS','PAYME'] as CheckoutTenderId[]).map(id=>({
    id,label:methodLabels[id],enabled:true,selected:selectedId===id,
  }));

  const confirm=async()=>{
    if(!confirmEnabled||checkoutCommitBusyRef.current||completion)return;
    checkoutCommitBusyRef.current=true;
    setState('processing');
    try{
      if(diningCheckout){
        const tenderCode:DiningTender=method==='COMBO'?'COMBO':method;
        const updated=await localRuntime.settleDiningHold(
          diningCheckout.holdId,
          diningCheckout.selections,
          tenderCode
        );
        setCompletion({
          displayOrderCode:diningCheckout.codeLabel,
          sourceLabel:'堂食 · '+diningCheckout.tableLabel+' 號枱',
          tenderLabel:tenderDisplay,
          dueLabel:money(due),
          receivedLabel:money(received),
          changeLabel:money(change),
          statusLabel:updated.remainingMinor===0?'堂食已全數結帳':'堂食分項結帳完成',
          printStatusLabel:'堂食付款已記錄；按堂食打印規則處理',
          drawerStatusLabel:method==='CASH'?'現金付款：櫃桶按現場收款路徑處理':'非現金：不開櫃桶',
          canCorrectPayment:false,
          correctionMethods:[],
        });
        setState('success');
        setPrintStatus('堂食 '+diningCheckout.tableLabel+' 號枱 · 已記錄 '+tenderDisplay+' · 未結 '+money(updated.remainingMinor));
        return;
      }

      if(formalFastLaneBlockers>0)throw new Error('FAST_LANE_FORMAL_ORDER_INCOMPLETE');
      const order=localRuntime.createOrder({
        items:cart.map(line=>({
          id:line.productId,
          name:line.name,
          qty:line.qty,
          unitMinor:line.unitMinor,
          serviceMode:line.serviceMode,
          ...(line.detail?{detail:line.detail}:{}),
          composition:serializeFastLaneComposition(line,'ORDER'),
        })),
        totalMinor:due,
        paymentLabel,
        sourceLabel,
        submissionId:checkoutSubmissionIdRef.current,
        ...(pickupCode.trim()?{providerPickupCode:pickupCode.trim()}:{}),
      });
      const cashCommit=settlementMode==='LOCAL_PAYMENT'&&method==='CASH';
      setCompletion({
        orderId:order.id,
        displayOrderCode:order.display,
        sourceLabel,
        tenderLabel:tenderDisplay,
        dueLabel:money(due),
        ...(settlementMode==='LOCAL_PAYMENT'?{receivedLabel:money(received),changeLabel:money(change)}:{}),
        statusLabel:'正式交易已提交',
        printStatusLabel:'打印工作已建立 · 正在送出',
        drawerStatusLabel:cashCommit?'現金櫃桶：開櫃指令隨小票送出':'非現金／平台來源：不開櫃桶',
        canCorrectPayment:settlementMode==='LOCAL_PAYMENT'&&method!=='COMBO',
        correctionMethods:settlementMode==='LOCAL_PAYMENT'&&method!=='COMBO'?correctionMethods(method):[],
      });
      setState('success');
      setPrintStatus('正式交易已完成 · 正在送打印');

      void localRuntime.printInitialOrderOutputsOnce(order.id).then(summary=>{
        const receipt=summary.results.find(row=>row.role==='顧客小票');
        const printLabel=summary.planned===0
          ?'未有已綁定打印 Route'
          :summary.failed===0
            ?'已送出 '+summary.sent+'/'+summary.planned+' 個打印工作'
            :'部分失敗 '+summary.sent+'/'+summary.planned;
        const drawerLabel=!cashCommit
          ?'非現金／平台來源：不開櫃桶'
          :receipt?.ok
            ?'現金櫃桶：開櫃指令已隨小票送出'
            :receipt
              ?'現金櫃桶：小票／開櫃指令失敗，需人工檢查'
              :'現金櫃桶：未有可用小票／櫃桶 Route';
        setCompletion(current=>current?{...current,printStatusLabel:printLabel,drawerStatusLabel:drawerLabel}:current);
        setPrintStatus('正式交易已完成 · '+printLabel);
      }).catch(error=>{
        const detail=error instanceof Error?error.message:String(error);
        setCompletion(current=>current?{...current,printStatusLabel:'打印狀態 UNKNOWN／FAILED · '+detail,drawerStatusLabel:cashCommit?'現金櫃桶：狀態需人工檢查':'非現金／平台來源：不開櫃桶'}:current);
        setPrintStatus('正式交易已完成 · 打印狀態需檢查');
      });
    }catch{
      setState('failure');
    }finally{
      checkoutCommitBusyRef.current=false;
    }
  };

  const actions:CheckoutWorkspaceActions={
    onBack:()=>{if(diningCheckout){setCart([]);onDiningCheckoutDone();navigate('/dining');}else navigate('/')},
    onSelectChannel:setChannel,
    onSelectMethod:setMethod,
    onChangeChannelInfo:(fieldId:CheckoutChannelFieldId,value:string)=>{
      if(fieldId==='customerPhone')setCustomerPhone(value);
      else if(fieldId==='pickupCode')setPickupCode(value);
      else setPlatformOrderNo(value);
    },
    onChangeSplitAmount:(id,value)=>setSplit(current=>({...current,[id]:value})),
    onCashKey:key=>{
      if(key==='⌫')setCash(value=>value.slice(0,-1));
      else if(key==='00')setCash(value=>(value||'')+'00');
      else setCash(value=>(value||'')+key);
    },
    onQuickCash:amount=>setCash(value=>((Number(value)||0)+amount).toFixed(2)),
    onExactCash:()=>setCash((due/100).toFixed(2)),
    onConfirm:confirm,onRetry:confirm,
    onCorrectPayment:methodId=>{
      if(!completion?.orderId||methodId==='COMBO')return;
      void localRuntime.correctOrderPayment(completion.orderId,methodId).then(()=>{
        setMethod(methodId);
        setCompletion(current=>current?{
          ...current,
          tenderLabel:methodLabels[methodId],
          correctionMethods:correctionMethods(methodId),
          statusLabel:'正式交易已提交 · 付款方式已修正',
        }:current);
      });
    },
    onDone:()=>{setCart([]);if(diningCheckout){onDiningCheckoutDone();navigate('/dining');}else navigate('/')},
  };

  return <CheckoutWorkspace view={view} actions={actions}/>;
}

function OperationalApp(){
  const navigate=useNavigate();
  const location=useLocation();
  const [globalArrival,setGlobalArrival]=useState<{orderId:string;display:string;sourceLabel:string}|null>(null);
  const arrivalTimerRef=useRef<number|undefined>(undefined);
  const [cart,setCartState]=useState<CartLine[]>([]);
  const [serviceMode,setServiceMode]=useState<ServiceMode>('takeaway');
  const [diningCheckout,setDiningCheckout]=useState<DiningCheckoutRequest|null>(null);
  const [orderingMode,setOrderingMode]=useState<'normal'|'quick'>('normal');
  const [quickDrinkOpen,setQuickDrinkOpen]=useState(false);
  const [quickDrinkCount,setQuickDrinkCount]=useState(0);
  const [displayToolsOpen,setDisplayToolsOpen]=useState(false);
  const [uiPreferences,setUiPreferences]=useState<SmtFrontlineUiPreferences>(()=>readSmtFrontlineUiPreferences());
  useEffect(()=>writeSmtFrontlineUiPreferences(uiPreferences),[uiPreferences]);
  const [navRevision,setNavRevision]=useState(0);
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
      if(arrivalTimerRef.current!==undefined)window.clearTimeout(arrivalTimerRef.current);
      arrivalTimerRef.current=window.setTimeout(()=>setGlobalArrival(null),3000);
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
      if(arrivalTimerRef.current!==undefined)window.clearTimeout(arrivalTimerRef.current);
    };
  },[]);


  const prepareDiningCheckout=(request:DiningCheckoutRequest)=>{
    const next:CartLine[]=request.lines.map((line,index)=>{
      const parts=line.name.split('｜');
      const name=parts.shift()||line.name;
      const detail=parts.length?parts.join('｜'):undefined;
      return {
        id:'dining-checkout-'+request.holdId+'-'+line.lineIndex+'-'+index,
        productId:line.id,
        name,
        qty:line.qty,
        unitMinor:line.unitMinor,
        serviceMode:'dine-in',
        detail,
      };
    });
    setDiningCheckout(request);
    setServiceMode('dine-in');
    setCartState(next);
  };

  return <><RuntimeReadyActivation/><ProductionViewport><div className="clean-app">
    {globalArrival?<div className="mfk-global-order-alert" role="status" aria-live="assertive">
      <div>
        <strong>新訂單</strong>
        <span>#{globalArrival.display} · {globalArrival.sourceLabel}</span>
      </div>
      <button type="button" onClick={()=>setGlobalArrival(null)}>稍後處理</button>
      <button type="button" className="primary" onClick={()=>{
        const orderId=globalArrival.orderId;
        setGlobalArrival(null);
        navigate('/orders?orderId='+encodeURIComponent(orderId));
      }}>立即處理</button>
    </div>:null}
    <aside className="clean-rail">
      <div className="clean-brand" aria-label="磨飯">磨</div>
      <button type="button" className={'clean-more-button'+(location.pathname==='/more'?' active':'')} aria-label="更多／工具中心" onClick={()=>navigate('/more')}><span>☰</span><small>更多</small></button>
      <nav aria-label="MFK 主導航">
        {nav.map(item=><NavLink key={item.to} to={item.to} end={'end' in item?item.end:false} className={({isActive})=>isActive?'active':''}>
          <span className="clean-rail-icon">{item.icon}</span>
          <span className="clean-rail-label">{item.label}</span>
          {item.to==='/orders'&&activeOrderCount>0?<span className="clean-rail-badge" aria-label={'進行中訂單 '+activeOrderCount}>{activeOrderCount>99?'99+':activeOrderCount}</span>:null}
        </NavLink>)}
      </nav>
      {location.pathname==='/'?<div className="clean-order-tools" aria-label="點單快捷工具">
        <button type="button" className={orderingMode==='quick'?'active':''} onClick={()=>setOrderingMode(value=>value==='quick'?'normal':'quick')}><span>快</span><small>{orderingMode==='quick'?'快捷':'普通'}</small></button>
        <button type="button" className={(quickDrinkOpen?'active ':'')+(quickDrinkCount>0?'flow-next':'')} onClick={()=>setQuickDrinkOpen(value=>!value)}><span>飲</span><small>飲品</small>{quickDrinkCount>0?<b>{quickDrinkCount}</b>:null}</button>
        <button type="button" className={displayToolsOpen?'active':''} onClick={()=>setDisplayToolsOpen(value=>!value)}><span>顯</span><small>顯示</small></button>
        {displayToolsOpen?<div className="clean-display-popover">
          <header><b>顯示設定</b><button type="button" onClick={()=>setDisplayToolsOpen(false)}>×</button></header>
          <section className="slider"><span>分類行數 <b>{uiPreferences.categoryRows}</b></span><input type="range" min="1" max="3" step="1" value={uiPreferences.categoryRows} onChange={e=>setUiPreferences(current=>({...current,categoryRows:Number(e.target.value) as 1|2|3}))}/></section>
          <section className="slider"><span>分類每行 <b>{uiPreferences.categoryColumns}</b></span><input type="range" min="4" max="9" step="1" value={uiPreferences.categoryColumns} onChange={e=>setUiPreferences(current=>({...current,categoryColumns:Number(e.target.value)}))}/></section>
          <section className="slider"><span>產品每行 <b>{uiPreferences.productColumns}</b></span><input type="range" min="3" max="6" step="1" value={uiPreferences.productColumns} onChange={e=>setUiPreferences(current=>({...current,productColumns:Number(e.target.value)}))}/></section>
          <section className="slider"><span>產品卡高度 <b>{uiPreferences.productCardHeight}px</b></span><input type="range" min="100" max="190" step="2" value={uiPreferences.productCardHeight} onChange={e=>setUiPreferences(current=>({...current,productCardHeight:Number(e.target.value)}))}/></section>
          <section className="slider"><span>字體 <b>{Math.round(uiPreferences.fontScale*100)}%</b></span><input type="range" min="0.85" max="1.25" step="0.01" value={uiPreferences.fontScale} onChange={e=>setUiPreferences(current=>({...current,fontScale:Number(e.target.value)}))}/></section>
          <section className="slider"><span>整體密度 <b>{Math.round(uiPreferences.densityScale*100)}%</b></span><input type="range" min="0.85" max="1.15" step="0.01" value={uiPreferences.densityScale} onChange={e=>setUiPreferences(current=>({...current,densityScale:Number(e.target.value)}))}/></section>
          <section><span>商品圖片</span><div><button type="button" className={!uiPreferences.showImages?'active':''} onClick={()=>setUiPreferences(current=>({...current,showImages:false}))}>隱藏</button><button type="button" className={uiPreferences.showImages?'active':''} onClick={()=>setUiPreferences(current=>({...current,showImages:true}))}>顯示</button></div></section>
          <section><span>商品分類</span><div><button type="button" className={!uiPreferences.showCategories?'active':''} onClick={()=>setUiPreferences(current=>({...current,showCategories:false}))}>隱藏</button><button type="button" className={uiPreferences.showCategories?'active':''} onClick={()=>setUiPreferences(current=>({...current,showCategories:true}))}>顯示</button></div></section>
          <small className="clean-display-saved">即時 Preview · 自動保存 · 重開保留</small>
          <button type="button" className="reset" onClick={()=>setUiPreferences(DEFAULT_SMT_FRONTLINE_UI_PREFERENCES)}>恢復預設顯示</button>
        </div>:null}
      </div>:null}
      <StaffSessionBadge/>
      <div className="clean-runtime-state">LOCAL<br/>OFFLINE</div>
    </aside>
    <section className="clean-route-stage">
      <Routes>
        <Route index element={<OrderingPage
          cart={cart}
          setCart={setCart}
          serviceMode={serviceMode}
          setServiceMode={setServiceMode}
          orderingMode={orderingMode}
          setOrderingMode={setOrderingMode}
          quickDrinkOpen={quickDrinkOpen}
          setQuickDrinkOpen={setQuickDrinkOpen}
          uiPreferences={uiPreferences}
          onQuickDrinkCountChange={setQuickDrinkCount}
        />}/>
        <Route path="checkout" element={<CheckoutPage cart={cart} setCart={setCart} diningCheckout={diningCheckout} onDiningCheckoutDone={()=>setDiningCheckout(null)}/>}/>
        <Route path="orders" element={<RuntimeOrdersWorkspace runtime={runtime}/>}/>
        <Route path="dining" element={<RuntimeDiningWorkspace runtime={runtime} onCheckout={prepareDiningCheckout}/>}/>
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
