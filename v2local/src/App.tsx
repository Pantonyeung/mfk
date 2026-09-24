import {useEffect,useMemo,useState} from 'react';
import {NavLink,Navigate,Route,Routes,useLocation,useNavigate} from 'react-router';
import {ProductionViewport} from './app/ProductionViewport.tsx';
import {OrderingWorkspace} from './features/ordering/OrderingWorkspace.tsx';
import type {OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './features/ordering/ordering-workspace-model.ts';
import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';
import type {CheckoutChannelId,CheckoutTenderId,CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './features/checkout/checkout-workspace-model.ts';
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
import {ComboWorkspace,HoldListWorkspace,ProductConfigWorkspace,type OrderingPanelState,type WorkspaceHoldDraft,type WorkspaceProduct} from './features/ordering/OrderingCenterWorkspaces.tsx';

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
type CartLine={id:string;productId:string;name:string;qty:number;unitMinor:number;serviceMode:ServiceMode;detail?:string};
type OrderingUiSettings={
  categoryRows:1|2;
  categoryColumns:5|6|7;
  showImages:boolean;
  density:'standard'|'compact';
};
const ORDER_UI_KEY='mfk.smt.presentation.order-ui.fusion-r1';
const DEFAULT_ORDER_UI:OrderingUiSettings={categoryRows:1,categoryColumns:7,showImages:false,density:'standard'};
let localCartLineSequence=0;
const nextLocalCartLineId=()=>{localCartLineSequence+=1;return 'line-'+Date.now().toString(36)+'-'+localCartLineSequence.toString(36)};

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

function OrderingPage({cart,setCart,serviceMode,setServiceMode,uiSettings}:{cart:CartLine[];setCart:(v:CartLine[])=>void;serviceMode:ServiceMode;setServiceMode:(m:ServiceMode)=>void;uiSettings:OrderingUiSettings}){
  const navigate=useNavigate();
  const [runtimeRevision,setRuntimeRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRuntimeRevision(value=>value+1)),[]);
  const [category,setCategory]=useState('');
  const [viewMode,setViewMode]=useState<'original'|'organized'>('original');
  const [combineSimilar,setCombineSimilar]=useState(false);
  const [pulse,setPulse]=useState(0);
  const [recent,setRecent]=useState<string|undefined>();
  const [highlight,setHighlight]=useState<string|undefined>();
  const [panel,setPanel]=useState<OrderingPanelState>(null);
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

  const categories=(syncedCatalog
    ?syncedCatalog.categories.map(row=>({id:row.id,label:row.label}))
    :adminMenu.categories.slice().sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(row=>({id:row.id,label:row.name})));
  useEffect(()=>{
    if(!categories.length)return;
    if(!category||!categories.some(row=>row.id===category))setCategory(categories[0]!.id);
  },[category,categories.map(row=>row.id).join('|')]);
  const visible=products.filter(product=>!category||product.categoryId===category).slice();

  const runtimeOrders=useMemo(()=>{void runtimeRevision;return localRuntime.orders();},[runtimeRevision]);
  const heldCarts=useMemo(()=>{void runtimeRevision;return localRuntime.holds();},[runtimeRevision]);
  const savedCarts=useMemo(()=>heldCarts.filter(hold=>hold.kind==='waiting'),[heldCarts]);
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
  const productById=new Map(products.map(product=>[product.id,product] as const));
  const presentLine=(line:CartLine,index:number,quantity=line.qty,sourceLineIds:readonly string[]=[line.id])=>{
    const product=productById.get(line.productId);
    return {
      id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id+'::'+index,
      name:line.name,
      quantity,
      lineTotalLabel:money(line.unitMinor*quantity),
      serviceMode:line.serviceMode,
      groupId:product?.categoryId??'other',
      groupLabel:product?.category??'其他',
      detail:line.detail,
      sourceLineIds,
    };
  };
  const presentationCart=(()=>{
    if(!combineSimilar){
      return cart.flatMap((line,lineIndex)=>Array.from({length:Math.max(1,line.qty)},(_,unitIndex)=>
        presentLine(line,lineIndex+unitIndex/100,1,[line.id])
      ));
    }
    const groups=new Map<string,{line:CartLine;quantity:number;ids:string[];index:number}>();
    cart.forEach((line,index)=>{
      const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::');
      const current=groups.get(key);
      if(current){current.quantity+=line.qty;if(!current.ids.includes(line.id))current.ids.push(line.id);}
      else groups.set(key,{line,quantity:line.qty,ids:[line.id],index});
    });
    return [...groups.values()].sort((a,b)=>a.index-b.index).map(group=>presentLine(group.line,group.index,group.quantity,group.ids));
  })();

  const view:OrderingWorkspaceViewModel={
    pendingOrders,activeOrders,categories,selectedCategoryId:category,
    categoryRows:uiSettings.categoryRows,categoryColumns:uiSettings.categoryColumns,
    showProductImages:uiSettings.showImages,productDensity:uiSettings.density,
    products:visible.map(product=>({
      id:product.id,
      name:product.name,
      priceLabel:product.priceReady?money(product.priceMinor):'未接價格',
      enabled:product.priceReady&&product.sellable&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
      requiresOptions:product.priceReady&&product.sellable&&product.optionSets.length>0,
      hasRequiredOptions:product.optionSets.some(set=>set.required||set.min>0),
      ...(uiSettings.showImages?{imageUrl:product.imageUrl??productArtwork(product)}:{}),
      ...(!product.priceReady?{badge:'未接價格'}:!product.sellable?{badge:'停售'}:{}),
    })),
    menuRevisionLabel:adminConfig
      ?storeSettings.storeName+' · ADMIN R'+adminConfig.revision+' · '+(syncStatus.state==='SYNCED'?'已同步':syncStatus.state==='LOCAL_LKG'?'LKG':'同步中')
      :'LOCAL FALLBACK · R'+adminMenu.revision,
    operationalNotice:capacityNotice
      ?'今日 '+capacityNotice.currentCount+'/'+capacityNotice.dailyLimit+' 單 · 已到 '+capacityNotice.warningAt+'% 提醒門檻'+(capacityNotice.hardStopConfigured?' · Admin 有 hard-stop 設定但目前只提示':'')
      :undefined,
    showCategories:frontlinePresentation.showCategories,
    serviceModes:{takeaway:storeSettings.takeawayEnabled,dineIn:storeSettings.dineInEnabled},
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,combineSimilar,
      lines:presentationCart,
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),checkoutEnabled:cart.length>0&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
    },
    heldCartCount:savedCarts.length,
    workItems:[
      {id:'riceball-pool',label:'飯團待組',count:0,enabled:false,tone:'riceball'},
      {id:'required',label:'必選',count:0,enabled:false,tone:'required'},
      {id:'combo',label:'紫米套餐',count:0,enabled:comboData.combos.length>0,tone:'combo'},
    ],
    actionAvailability:{
      lineServiceMode:true,
      lineEdit:true,
      lineQuantity:true,
      holdCart:cart.length>0,
      cancelCart:cart.length>0,
    },
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product||!product.priceReady||!product.sellable)return;
    const line:CartLine={id:nextLocalCartLineId(),productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode};
    setCart([...cart,line]);
    setRecent(id);
    setHighlight(line.id);
    setPulse(value=>value+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };

  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number)=>{
    const product=products.find(item=>item.id===productId);if(!product||!product.priceReady||!product.sellable)return;
    const lines=Array.from({length:Math.max(1,qty)},()=>({id:nextLocalCartLineId(),productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor+deltaMinor,serviceMode,detail} as CartLine));
    setCart([...cart,...lines]);setRecent(product.id);setHighlight(lines[lines.length-1]?.id);setPulse(value=>value+1);setPanel(null);
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
    :panel?.type==='combo'?'紫米套餐'
    :panel?.type==='holds'?'暫存單':'';

  const panelBody=panel?.type==='product'
    ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);return product?<ProductConfigWorkspace product={product} onAdd={(detail,delta,qty)=>addConfigured(product.id,detail,delta,qty)}/>:null})()
    :panel?.type==='combo'
      ?<ComboWorkspace products={workspaceProducts} combos={comboData.combos} pools={comboData.pools} onAdd={addCombo}/>
      :panel?.type==='holds'
        ?<HoldListWorkspace holds={savedCarts as readonly WorkspaceHoldDraft[]} onRestore={hold=>{
          const restored:CartLine[]=hold.items.flatMap((item,index)=>{
            const parts=item.name.split('｜');
            const name=parts.shift()||item.name;
            const detail=parts.length?parts.join('｜'):undefined;
            return Array.from({length:Math.max(1,item.qty)},(_,unit)=>({
              id:'line-'+hold.id+'-'+index+'-'+unit+'-'+Date.now().toString(36),
              productId:item.id,
              name,
              qty:1,
              unitMinor:item.unitMinor,
              serviceMode:'takeaway' as const,
              detail,
            }));
          });
          setCart(restored);
          setServiceMode('takeaway');
          localRuntime.removeHold(hold.id);
          setPanel(null);
        }} onRemove={id=>localRuntime.removeHold(id)}/>
        :null;

  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,
    onAddProduct:add,
    onConfigureProduct:id=>setPanel({type:'product',productId:id}),
    onChangeServiceMode:mode=>{
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      setServiceMode(mode);setCart(cart.map(item=>({...item,serviceMode:mode})));
    },
    onChangeCartView:mode=>{setViewMode(mode);if(mode==='organized')setPanel({type:'organize'});},
    onChangeLineServiceMode:(lineId,mode)=>{
      if(mode==='takeaway'&&!storeSettings.takeawayEnabled)return;
      if(mode==='dine-in'&&!storeSettings.dineInEnabled)return;
      setCart(cart.map(item=>item.id===lineId?{...item,serviceMode:mode}:item));
    },
    onAdjustLineQuantity:(lineId,delta)=>setCart(cart.map(item=>item.id===lineId?{...item,qty:item.qty+delta}:item).filter(item=>item.qty>0)),
    onEditCartLine:lineId=>{
      const line=cart.find(item=>item.id===lineId);
      if(!line)return;
      if(comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'combo'});
      els  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,
    onAddProduct:add,
    onConfigureProduct:id=>setPanel({type:'product',productId:id}),
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
        const clone:CartLine={...target,id:nextLocalCartLineId(),qty:1};
        setCart([...cart,clone]);
        setHighlight(clone.id);setPulse(value=>value+1);
        return;
      }
      if(target.qty>1){
        setCart(cart.map(item=>item.id===id?{...item,qty:item.qty-1}:item));
      }else setCart(cart.filter(item=>item.id!==id));
    },
    onEditCartLine:lineIds=>{
      const line=cart.find(item=>item.id===lineIds[0]);
      if(!line)return;
      if(comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'combo'});
      else setPanel({type:'product',productId:line.productId});
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
    onHoldCart:()=>{
      if(!cart.length)return;
      localRuntime.createHold({kind:'waiting',items:holdItems(),totalMinor:total,partySize:1,note:'暫存'});
      finishHold();
    },
    onOpenHeldOrders:()=>{if(!cart.length&&savedCarts.length)setPanel({type:'holds'});},
    onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{if(id==='combo'&&comboData.combos.length)setPanel({type:'combo'});},
    onOpenQueueOrder:(_kind,id)=>navigate('/orders?orderId='+encodeURIComponent(id)),
    onCheckout:()=>navigate('/checkout'),
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

  const methodLabels:Record<CheckoutTenderId,string>={
    CASH:'現金付款',ALIPAY:'AlipayHK',WECHAT:'WeChat Pay HK',FPS:'FPS／轉數快',PAYME:'PayMe',COMBO:'組合付款'
  };
  const channelLabels:Record<CheckoutChannelId,string>={
    'walk-in':'現場','whatsapp':'電話／WhatsApp','morefun-app':'磨飯 App','keeta':'Keeta','foodpanda':'Foodpanda'
  };

  const parseMoney=(value:string)=>Math.max(0,Math.round((Number(value)||0)*100));
  const cashMinor=parseMoney(cash);
  const comboMinor=(Object.values(split) as string[]).reduce((sum,value)=>sum+parseMoney(value),0);
  const received=method==='CASH'?cashMinor:method==='COMBO'?comboMinor:due;
  const change=method==='CASH'?Math.max(0,received-due):0;
  const comboExact=method!=='COMBO'||comboMinor===due;
  const cashReady=method!=='CASH'||received>=due;
  const confirmEnabled=cart.length>0&&comboExact&&cashReady;
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
    validationMessage,statusMessage:printStatus,completionReview:completion,
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
          tenderCode
        );
        setCompletion({
          displayOrderCode:diningCheckout.codeLabel,
          tenderLabel:tenderDisplay,
          dueLabel:money(due),
          receivedLabel:money(received),
          changeLabel:money(change),
          statusLabel:updated.remainingMinor===0?'堂食已全數結帳':'堂食分項結帳完成',
        });
        setState('success');
        setPrintStatus('堂食 '+diningCheckout.tableLabel+' 號枱 · 已記錄 '+tenderDisplay+' · 未結 '+money(updated.remainingMinor));
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
    }catch{
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
    onConfirm:confirm,onRetry:confirm,
    onDone:()=>{setCart([]);if(diningCheckout){onDiningCheckoutDone();navigate('/dining');}else navigate('/')},
  };

  return <CheckoutWorkspace view={view} actions={actions}/>;
}

function OperationalApp(){
  const location=useLocation();
  const [cart,setCartState]=useState<CartLine[]>([]);
  const [serviceMode,setServiceMode]=useState<ServiceMode>('takeaway');
  const [diningCheckout,setDiningCheckout]=useState<DiningCheckoutRequest|null>(null);
  const [navRevision,setNavRevision]=useState(0);
  const [displaySettingsOpen,setDisplaySettingsOpen]=useState(false);
  const [orderUi,setOrderUi]=useState<OrderingUiSettings>(()=>{
    try{
      const parsed=JSON.parse(localStorage.getItem(ORDER_UI_KEY)||'null') as Partial<OrderingUiSettings>|null;
      return {
        categoryRows:parsed?.categoryRows===2?2:1,
        categoryColumns:parsed?.categoryColumns===5||parsed?.categoryColumns===6?parsed.categoryColumns:7,
        showImages:parsed?.showImages===true,
        density:parsed?.density==='compact'?'compact':'standard',
      };
    }catch{return DEFAULT_ORDER_UI;}
  });
  useEffect(()=>localRuntime.subscribe(()=>setNavRevision(value=>value+1)),[]);
  useEffect(()=>{localStorage.setItem(ORDER_UI_KEY,JSON.stringify(orderUi));},[orderUi]);
  const activeOrderCount=useMemo(()=>{
    void navRevision;
    return localRuntime.orders().filter(order=>order.fulfillmentLabel==='待處理'||order.fulfillmentLabel==='進行中'||order.fulfillmentLabel==='可取餐').length;
  },[navRevision]);
  const setCart=(next:CartLine[])=>setCartState(next);
  const runtime=useMemo(()=>localRuntime,[]);

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
    <aside className="clean-rail">
      <div className="clean-brand" aria-label="磨飯">磨</div>
      <nav aria-label="MFK 主導航">
        {nav.map(item=><NavLink key={item.to} to={item.to} end={'end' in item?item.end:false} className={({isActive})=>isActive?'active':''}>
          <span className="clean-rail-icon">{item.icon}</span>
          <span className="clean-rail-label">{item.label}</span>
          {item.to==='/orders'&&activeOrderCount>0?<span className="clean-rail-badge" aria-label={'進行中訂單 '+activeOrderCount}>{activeOrderCount>99?'99+':activeOrderCount}</span>:null}
        </NavLink>)}
      </nav>
      {location.pathname==='/'?<section className="clean-order-display-entry" aria-label="點單顯示設定">
        <button type="button" className={displaySettingsOpen?'active':''} onClick={()=>setDisplaySettingsOpen(value=>!value)} aria-expanded={displaySettingsOpen}><span>▥</span><small>顯示</small></button>
      </section>:null}
      {location.pathname==='/'&&displaySettingsOpen?<section className="clean-display-settings" role="dialog" aria-label="點單顯示設定">
        <header><div><small>DISPLAY</small><strong>顯示設定</strong></div><button type="button" aria-label="關閉顯示設定" onClick={()=>setDisplaySettingsOpen(false)}>×</button></header>
        <label><span>分類行數</span><div><button type="button" className={orderUi.categoryRows===1?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:1}))}>1 行</button><button type="button" className={orderUi.categoryRows===2?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:2}))}>2 行</button></div></label>
        <label><span>分類每行</span><div>{([5,6,7] as const).map(value=><button type="button" key={value} className={orderUi.categoryColumns===value?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryColumns:value}))}>{value}</button>)}</div></label>
        <label><span>商品圖片</span><div><button type="button" className={!orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:false}))}>隱藏</button><button type="button" className={orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:true}))}>顯示</button></div></label>
        <label><span>商品密度</span><div><button type="button" className={orderUi.density==='standard'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'standard'}))}>標準</button><button type="button" className={orderUi.density==='compact'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'compact'}))}>緊湊</button></div></label>
        <footer><span>商品固定每行 4 格</span><button type="button" onClick={()=>setOrderUi(DEFAULT_ORDER_UI)}>重設</button></footer>
      </section>:null}
      <StaffSessionBadge/>
      <div className="clean-runtime-state">LOCAL<br/>OFFLINE</div>
    </aside>
    <section className="clean-route-stage">
      <Routes>
        <Route index element={<OrderingPage cart={cart} setCart={setCart} serviceMode={serviceMode} setServiceMode={setServiceMode} uiSettings={orderUi}/>}/>
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
