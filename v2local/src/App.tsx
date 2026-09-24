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
import {ComboWorkspace,HoldCartWorkspace,HoldListWorkspace,OrganizeWorkspace,ProductConfigWorkspace,type OrderingPanelState,type WorkspaceHoldDraft,type WorkspaceProduct} from './features/ordering/OrderingCenterWorkspaces.tsx';

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
  mode:'quick'|'standard';
  categoryRows:1|2;
  categoryColumns:5|6|7;
  showImages:boolean;
  density:'standard'|'compact';
};
const ORDER_UI_KEY='mfk.smt.presentation.order-ui.v2';
const DEFAULT_ORDER_UI:OrderingUiSettings={mode:'quick',categoryRows:1,categoryColumns:7,showImages:false,density:'standard'};

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
  {to:'/',label:'點餐',icon:'order',end:true},
  {to:'/orders',label:'訂單',icon:'orders'},
  {to:'/dining',label:'堂食',icon:'dining'},
  {to:'/soldout',label:'售罄',icon:'soldout'},
  {to:'/more',label:'更多',icon:'more'},
] as const;

function NavGlyph({name}:{name:(typeof nav)[number]['icon']}){
  const common={width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(name==='order')return <svg {...common}><path d="M5 7h14l-1 12H6L5 7Z"/><path d="M8 7a4 4 0 0 1 8 0M9 12h6"/></svg>;
  if(name==='orders')return <svg {...common}><path d="M7 3h10v4H7zM5 5H3v16h18V5h-2"/><path d="M8 12h8M8 16h6"/></svg>;
  if(name==='dining')return <svg {...common}><path d="M5 6h14v5H5z"/><path d="M7 11v8m10-8v8M9 6V4m6 2V4"/></svg>;
  if(name==='soldout')return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m8.5 8.5 7 7"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>;
}

function OrderingPage({cart,setCart,serviceMode,setServiceMode,uiSettings}:{cart:CartLine[];setCart:(v:CartLine[])=>void;serviceMode:ServiceMode;setServiceMode:(m:ServiceMode)=>void;uiSettings:OrderingUiSettings}){
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
    if(category==='all'&&categories[0])setCategory(categories[0].id);
    else if(category!=='all'&&!categories.some(row=>row.id===category)&&categories[0])setCategory(categories[0].id);
  },[category,categories.map(row=>row.id).join('|')]);
  const visible=products
    .filter(product=>category==='all'||product.categoryId===category)
    .slice();
  const runtimeOrders=useMemo(()=>{void runtimeRevision;return localRuntime.orders();},[runtimeRevision]);
  const heldCarts=useMemo(()=>{void runtimeRevision;return localRuntime.holds();},[runtimeRevision]);
  const businessCutoff=readBusinessCutoff();
  const businessWindow=resolveBusinessWindow(Date.now(),businessCutoff.hour,businessCutoff.minute);
  const businessOrderCount=runtimeOrders.filter(order=>{
    const at=Date.parse(order.createdAt);
    return Number.isFinite(at)&&at>=businessWindow.start&&at<businessWindow.end&&order.fulfillmentLabel!=='已取消';
  }).length;
  const capacityNotice=capacityNoticeForCount(businessOrderCount);
  const queueItem=(order:(typeof runtimeOrders)[number])=>{
    const createdAt=Date.parse(order.createdAt);
    const etaAt=Number.isFinite(createdAt)?new Date(createdAt+storeSettings.fulfillmentMinutes*60_000):null;
    return {
      id:order.id,
      orderId:order.display,
      sourceLabel:order.sourceLabel,
      waitLabel:new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}),
      etaLabel:etaAt?'ETA '+etaAt.toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}):undefined,
      itemCount:order.items.reduce((sum,item)=>sum+item.qty,0),
    };
  };
  const isKeetaOrder=(order:(typeof runtimeOrders)[number])=>/^Keeta\b/i.test(String(order.sourceLabel||''));
  const pendingOrders=runtimeOrders
    .filter(order=>order.fulfillmentLabel==='待處理'&&!isKeetaOrder(order))
    .slice(0,6).map(queueItem);
  const activeOrders=runtimeOrders
    .filter(order=>isKeetaOrder(order)&&!['已完成','已取消'].includes(order.fulfillmentLabel))
    .slice(0,8).map(queueItem);
  const demoPending=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('demo')==='pending';
  const pendingQueue=pendingOrders.length||!demoPending?pendingOrders:[
    {id:'demo-pending-1',orderId:'P031',sourceLabel:'WhatsApp',waitLabel:'14:02',etaLabel:'ETA 14:22',itemCount:2,demo:true},
    {id:'demo-pending-2',orderId:'P032',sourceLabel:'磨飯 App',waitLabel:'14:05',etaLabel:'ETA 14:25',itemCount:4,demo:true},
  ];
  const providerQueue=activeOrders.length||!demoPending?activeOrders:[
    {id:'demo-keeta-1',orderId:'K824',sourceLabel:'Keeta',waitLabel:'14:01',etaLabel:'ETA 14:21',itemCount:3,demo:true},
  ];
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
  const holdTables=Array.from({length:9},(_,index)=>{
    const id='T'+String(index+1).padStart(2,'0');
    const occupied=heldCarts.find(hold=>hold.kind==='dining'&&hold.assignedTable===id);
    return {id,label:String(index+1),occupied:Boolean(occupied),codeLabel:occupied?.codeLabel};
  });

  const comboIds=new Set(comboData.combos.map(combo=>combo.id));
  const presentDetail=(line:CartLine)=>{
    const raw=String(line.detail||'').trim();
    if(!raw)return {};
    if(comboIds.has(line.productId))return {comboDetail:raw};
    const parts=raw.split(' · ').map(part=>part.trim()).filter(Boolean);
    const optionParts=parts.filter(part=>part.includes('：'));
    const noteParts=parts.filter(part=>!part.includes('：'));
    return {
      ...(optionParts.length?{optionDetail:optionParts.join(' · ')}:{}),
      ...(noteParts.length?{note:noteParts.join(' · ')}:{}),
    };
  };
  const presentationCart=(()=>{
    if(!combineSimilar){
      return cart.flatMap((line,lineIndex)=>Array.from({length:Math.max(1,line.qty)},(_,unitIndex)=>({
        id:line.id+'::'+unitIndex,
        name:line.name,
        quantity:1,
        lineTotalLabel:money(line.unitMinor),
        serviceMode:line.serviceMode,
        groupId:products.find(product=>product.id===line.productId)?.categoryId??'local',
        groupLabel:products.find(product=>product.id===line.productId)?.category??'本機',
        detail:line.detail,
        ...presentDetail(line),
        sourceLineIds:[line.id] as readonly string[],
        _index:lineIndex+unitIndex/100,
      })));
    }
    const source=cart.map((line,index)=>({
      key:[line.productId,line.serviceMode,line.unitMinor,line.detail||''].join('::'),
      line,index,
    }));
    const groups=new Map<string,{line:CartLine;qty:number;totalMinor:number;sourceLineIds:string[];index:number}>();
    for(const {key,line,index} of source){
      const current=groups.get(key);
      if(current){
        current.qty+=line.qty;
        current.totalMinor+=line.unitMinor*line.qty;
        current.sourceLineIds.push(line.id);
      }else{
        groups.set(key,{line,qty:line.qty,totalMinor:line.unitMinor*line.qty,sourceLineIds:[line.id],index});
      }
    }
    return [...groups.values()].sort((a,b)=>a.index-b.index).map(group=>({
      id:group.line.id,
      name:group.line.name,
      quantity:group.qty,
      lineTotalLabel:money(group.totalMinor),
      serviceMode:group.line.serviceMode,
      groupId:products.find(product=>product.id===group.line.productId)?.categoryId??'local',
      groupLabel:products.find(product=>product.id===group.line.productId)?.category??'本機',
      detail:group.line.detail,
      ...presentDetail(group.line),
      sourceLineIds:group.sourceLineIds as readonly string[],
      _index:group.index,
    }));
  })();

  const view:OrderingWorkspaceViewModel={
    pendingOrders:pendingQueue,activeOrders:providerQueue,categories,selectedCategoryId:category,
    categoryRows:uiSettings.categoryRows,categoryColumns:uiSettings.categoryColumns,
    showProductImages:uiSettings.showImages,productDensity:uiSettings.density,
    orderingMode:uiSettings.mode,
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
    feedbackMessage:recent?((products.find(product=>product.id===recent)?.name??'商品')+' 已加入購物籃'):undefined,
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,combineSimilar,
      lines:presentationCart,
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),checkoutEnabled:cart.length>0&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
    },
    heldCartCount:heldCarts.length,
    workItems:[
      {id:'riceball-pool',label:'飯團待組區',count:0,description:'未完成飯團會集中喺呢度',statusLabel:'目前清空',enabled:true,active:panel?.type==='organize',tone:'riceball'},
      {id:'required',label:'必選區',count:0,description:'需要處理嘅必選會喺呢度',statusLabel:'目前清空',enabled:true,active:panel?.type==='organize',tone:'required'},
      {id:'combo',label:'紫米套餐',count:comboData.combos.length,description:'建立正式套餐配置',statusLabel:comboData.combos.length?'可設定':'未有已發布套餐',enabled:comboData.combos.length>0,active:panel?.type==='combo',tone:'combo'},
    ],
    actionAvailability:{
      lineServiceMode:true,
      lineEdit:true,
      lineQuantity:true,
      holdCart:cart.length>0||heldCarts.length>0,
      cancelCart:cart.length>0,
    },
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product||!product.priceReady||!product.sellable)return;
    const existing=combineSimilar?cart.find(item=>item.productId===id&&item.serviceMode===serviceMode&&!item.detail):undefined;
    const createdId=nextLocalCartLineId();
    const next=existing
      ?cart.map(item=>item.id===existing.id?{...item,qty:item.qty+1}:item)
      :[...cart,{id:createdId,productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode}];
    setCart(next);
    setRecent(id);
    setHighlight(existing?.id??createdId);
    setPulse(value=>value+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };

  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number)=>{
    const product=products.find(item=>item.id===productId);if(!product||!product.priceReady||!product.sellable)return;
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:product.id,name:product.name,qty,unitMinor:product.priceMinor+deltaMinor,serviceMode,detail};
    setCart([...cart,line]);setRecent(product.id);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };

  const addCombo=(comboId:string,comboName:string,detail:string,unitMinor:number)=>{
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:comboId,name:comboName,qty:1,unitMinor,serviceMode,detail};
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
    :panel?.type==='organize'?'整理工作台'
    :panel?.type==='combo'?'紫米套餐區'
    :panel?.type==='hold'?'暫存工作台'
    :panel?.type==='holds'?'暫存單':'';

  const panelBody=panel?.type==='product'
    ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);return product?<ProductConfigWorkspace product={product} onAdd={(detail,delta,qty)=>addConfigured(product.id,detail,delta,qty)}/>:null})()
    :panel?.type==='organize'
      ?<OrganizeWorkspace lines={cart} onDone={()=>setPanel(null)}/>
      :panel?.type==='combo'
        ?<ComboWorkspace products={workspaceProducts} combos={comboData.combos} pools={comboData.pools} onAdd={addCombo}/>
        :panel?.type==='hold'
          ?<HoldCartWorkspace
            lines={cart}
            totalMinor={total}
            tables={holdTables}
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
            ?<HoldListWorkspace holds={heldCarts as readonly WorkspaceHoldDraft[]} currentCartCount={cart.reduce((sum,line)=>sum+line.qty,0)} onRestore={hold=>{
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

  const actions:OrderingWorkspaceActions={
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
      const target=lineIds[0];
      if(!target)return;
      setCart(cart.map(item=>item.id===target?{...item,qty:item.qty+delta}:item).filter(item=>item.qty>0));
    },
    onEditCartLine:lineId=>{
      const line=cart.find(item=>item.id===lineId);
      if(!line)return;
      if(comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'combo'});
      else setPanel({type:'product',productId:line.productId});
    },
    onHoldCart:()=>{if(cart.length)setPanel({type:'hold'});},
    onOpenHeldOrders:()=>setPanel({type:'holds'}),
    onRemoveCartLine:lineIds=>{
      const ids=new Set(lineIds);
      if(ids.size===1){
        const id=[...ids][0]!;
        const target=cart.find(item=>item.id===id);
        if(target&&target.qty>1&&!combineSimilar){
          setCart(cart.map(item=>item.id===id?{...item,qty:item.qty-1}:item));
          return;
        }
      }
      setCart(cart.filter(item=>!ids.has(item.id)));
    },
    onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{if(id==='combo')setPanel({type:'combo'});else setPanel({type:'organize'});},
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
        mode:parsed?.mode==='standard'?'standard':'quick',
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
          <span className="clean-rail-icon"><NavGlyph name={item.icon}/></span>
          <span className="clean-rail-label">{item.label}</span>
          {item.to==='/orders'&&activeOrderCount>0?<span className="clean-rail-badge" aria-label={'進行中訂單 '+activeOrderCount}>{activeOrderCount>99?'99+':activeOrderCount}</span>:null}
        </NavLink>)}
      </nav>
      {location.pathname==='/'?<section className="clean-order-controls" aria-label="點單操作設定">
        <button type="button" onClick={()=>setOrderUi(current=>({...current,mode:current.mode==='quick'?'standard':'quick'}))}><small>點選</small><b>{orderUi.mode==='quick'?'快速':'普通'}</b></button>
        <button type="button" className={displaySettingsOpen?'active':''} onClick={()=>setDisplaySettingsOpen(value=>!value)} aria-expanded={displaySettingsOpen}><small>介面</small><b>顯示設定</b></button>
        <div><small>ETA</small><b>{readSmtStoreSettings().fulfillmentMinutes}m</b></div>
      </section>:null}
      {location.pathname==='/'&&displaySettingsOpen?<section className="clean-display-settings" role="dialog" aria-label="點單顯示設定">
        <header><div><small>DISPLAY</small><strong>顯示設定</strong></div><button type="button" aria-label="關閉顯示設定" onClick={()=>setDisplaySettingsOpen(false)}>×</button></header>
        <label><span>分類行數</span><div><button type="button" className={orderUi.categoryRows===1?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:1}))}>1 行</button><button type="button" className={orderUi.categoryRows===2?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:2}))}>2 行</button></div></label>
        <label><span>分類每行</span><div>{([5,6,7] as const).map(value=><button type="button" key={value} className={orderUi.categoryColumns===value?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryColumns:value}))}>{value}</button>)}</div></label>
        <label><span>商品圖片</span><div><button type="button" className={!orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:false}))}>隱藏</button><button type="button" className={orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:true}))}>顯示</button></div></label>
        <label><span>商品密度</span><div><button type="button" className={orderUi.density==='standard'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'standard'}))}>標準</button><button type="button" className={orderUi.density==='compact'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'compact'}))}>緊湊</button></div></label>
        <footer><span>商品卡固定每行 4 格</span><button type="button" onClick={()=>setOrderUi(DEFAULT_ORDER_UI)}>重設</button></footer>
      </section>:null}
      <StaffSessionBadge/>
      <div className="clean-runtime-state"><b>LOCAL</b><span>本機優先</span></div>
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
+(minor/100).toFixed(2);
let localCartLineSequence=0;
const nextLocalCartLineId=()=>{localCartLineSequence+=1;return 'line-'+Date.now().toString(36)+'-'+localCartLineSequence.toString(36)};

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
  {to:'/',label:'點餐',icon:'order',end:true},
  {to:'/orders',label:'訂單',icon:'orders'},
  {to:'/dining',label:'堂食',icon:'dining'},
  {to:'/soldout',label:'售罄',icon:'soldout'},
  {to:'/more',label:'更多',icon:'more'},
] as const;

function NavGlyph({name}:{name:(typeof nav)[number]['icon']}){
  const common={width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(name==='order')return <svg {...common}><path d="M5 7h14l-1 12H6L5 7Z"/><path d="M8 7a4 4 0 0 1 8 0M9 12h6"/></svg>;
  if(name==='orders')return <svg {...common}><path d="M7 3h10v4H7zM5 5H3v16h18V5h-2"/><path d="M8 12h8M8 16h6"/></svg>;
  if(name==='dining')return <svg {...common}><path d="M5 6h14v5H5z"/><path d="M7 11v8m10-8v8M9 6V4m6 2V4"/></svg>;
  if(name==='soldout')return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m8.5 8.5 7 7"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>;
}

function OrderingPage({cart,setCart,serviceMode,setServiceMode,uiSettings}:{cart:CartLine[];setCart:(v:CartLine[])=>void;serviceMode:ServiceMode;setServiceMode:(m:ServiceMode)=>void;uiSettings:OrderingUiSettings}){
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
    if(category==='all'&&categories[0])setCategory(categories[0].id);
    else if(category!=='all'&&!categories.some(row=>row.id===category)&&categories[0])setCategory(categories[0].id);
  },[category,categories.map(row=>row.id).join('|')]);
  const visible=products
    .filter(product=>category==='all'||product.categoryId===category)
    .slice();
  const runtimeOrders=useMemo(()=>{void runtimeRevision;return localRuntime.orders();},[runtimeRevision]);
  const heldCarts=useMemo(()=>{void runtimeRevision;return localRuntime.holds();},[runtimeRevision]);
  const businessCutoff=readBusinessCutoff();
  const businessWindow=resolveBusinessWindow(Date.now(),businessCutoff.hour,businessCutoff.minute);
  const businessOrderCount=runtimeOrders.filter(order=>{
    const at=Date.parse(order.createdAt);
    return Number.isFinite(at)&&at>=businessWindow.start&&at<businessWindow.end&&order.fulfillmentLabel!=='已取消';
  }).length;
  const capacityNotice=capacityNoticeForCount(businessOrderCount);
  const queueItem=(order:(typeof runtimeOrders)[number])=>{
    const createdAt=Date.parse(order.createdAt);
    const etaAt=Number.isFinite(createdAt)?new Date(createdAt+storeSettings.fulfillmentMinutes*60_000):null;
    return {
      id:order.id,
      orderId:order.display,
      sourceLabel:order.sourceLabel,
      waitLabel:new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}),
      etaLabel:etaAt?'ETA '+etaAt.toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}):undefined,
      itemCount:order.items.reduce((sum,item)=>sum+item.qty,0),
    };
  };
  const isKeetaOrder=(order:(typeof runtimeOrders)[number])=>/^Keeta\b/i.test(String(order.sourceLabel||''));
  const pendingOrders=runtimeOrders
    .filter(order=>order.fulfillmentLabel==='待處理'&&!isKeetaOrder(order))
    .slice(0,6).map(queueItem);
  const activeOrders=runtimeOrders
    .filter(order=>isKeetaOrder(order)&&!['已完成','已取消'].includes(order.fulfillmentLabel))
    .slice(0,8).map(queueItem);
  const demoPending=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('demo')==='pending';
  const pendingQueue=pendingOrders.length||!demoPending?pendingOrders:[
    {id:'demo-pending-1',orderId:'P031',sourceLabel:'WhatsApp',waitLabel:'14:02',etaLabel:'ETA 14:22',itemCount:2,demo:true},
    {id:'demo-pending-2',orderId:'P032',sourceLabel:'磨飯 App',waitLabel:'14:05',etaLabel:'ETA 14:25',itemCount:4,demo:true},
  ];
  const providerQueue=activeOrders.length||!demoPending?activeOrders:[
    {id:'demo-keeta-1',orderId:'K824',sourceLabel:'Keeta',waitLabel:'14:01',etaLabel:'ETA 14:21',itemCount:3,demo:true},
  ];
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
  const holdTables=Array.from({length:9},(_,index)=>{
    const id='T'+String(index+1).padStart(2,'0');
    const occupied=heldCarts.find(hold=>hold.kind==='dining'&&hold.assignedTable===id);
    return {id,label:String(index+1),occupied:Boolean(occupied),codeLabel:occupied?.codeLabel};
  });

  const comboIds=new Set(comboData.combos.map(combo=>combo.id));
  const presentDetail=(line:CartLine)=>{
    const raw=String(line.detail||'').trim();
    if(!raw)return {};
    if(comboIds.has(line.productId))return {comboDetail:raw};
    const parts=raw.split(' · ').map(part=>part.trim()).filter(Boolean);
    const optionParts=parts.filter(part=>part.includes('：'));
    const noteParts=parts.filter(part=>!part.includes('：'));
    return {
      ...(optionParts.length?{optionDetail:optionParts.join(' · ')}:{}),
      ...(noteParts.length?{note:noteParts.join(' · ')}:{}),
    };
  };
  const presentationCart=(()=>{
    if(!combineSimilar){
      return cart.flatMap((line,lineIndex)=>Array.from({length:Math.max(1,line.qty)},(_,unitIndex)=>({
        id:line.id+'::'+unitIndex,
        name:line.name,
        quantity:1,
        lineTotalLabel:money(line.unitMinor),
        serviceMode:line.serviceMode,
        groupId:products.find(product=>product.id===line.productId)?.categoryId??'local',
        groupLabel:products.find(product=>product.id===line.productId)?.category??'本機',
        detail:line.detail,
        ...presentDetail(line),
        sourceLineIds:[line.id] as readonly string[],
        _index:lineIndex+unitIndex/100,
      })));
    }
    const source=cart.map((line,index)=>({
      key:[line.productId,line.serviceMode,line.unitMinor,line.detail||''].join('::'),
      line,index,
    }));
    const groups=new Map<string,{line:CartLine;qty:number;totalMinor:number;sourceLineIds:string[];index:number}>();
    for(const {key,line,index} of source){
      const current=groups.get(key);
      if(current){
        current.qty+=line.qty;
        current.totalMinor+=line.unitMinor*line.qty;
        current.sourceLineIds.push(line.id);
      }else{
        groups.set(key,{line,qty:line.qty,totalMinor:line.unitMinor*line.qty,sourceLineIds:[line.id],index});
      }
    }
    return [...groups.values()].sort((a,b)=>a.index-b.index).map(group=>({
      id:group.line.id,
      name:group.line.name,
      quantity:group.qty,
      lineTotalLabel:money(group.totalMinor),
      serviceMode:group.line.serviceMode,
      groupId:products.find(product=>product.id===group.line.productId)?.categoryId??'local',
      groupLabel:products.find(product=>product.id===group.line.productId)?.category??'本機',
      detail:group.line.detail,
      ...presentDetail(group.line),
      sourceLineIds:group.sourceLineIds as readonly string[],
      _index:group.index,
    }));
  })();

  const view:OrderingWorkspaceViewModel={
    pendingOrders:pendingQueue,activeOrders:providerQueue,categories,selectedCategoryId:category,
    categoryRows:uiSettings.categoryRows,categoryColumns:uiSettings.categoryColumns,
    showProductImages:uiSettings.showImages,productDensity:uiSettings.density,
    orderingMode:uiSettings.mode,
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
    feedbackMessage:recent?((products.find(product=>product.id===recent)?.name??'商品')+' 已加入購物籃'):undefined,
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,combineSimilar,
      lines:presentationCart,
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),checkoutEnabled:cart.length>0&&((serviceMode==='takeaway'&&storeSettings.takeawayEnabled)||(serviceMode==='dine-in'&&storeSettings.dineInEnabled)),
    },
    heldCartCount:heldCarts.length,
    workItems:[
      {id:'riceball-pool',label:'飯團待組區',count:0,description:'未完成飯團會集中喺呢度',statusLabel:'目前清空',enabled:true,active:panel?.type==='organize',tone:'riceball'},
      {id:'required',label:'必選區',count:0,description:'需要處理嘅必選會喺呢度',statusLabel:'目前清空',enabled:true,active:panel?.type==='organize',tone:'required'},
      {id:'combo',label:'紫米套餐',count:comboData.combos.length,description:'建立正式套餐配置',statusLabel:comboData.combos.length?'可設定':'未有已發布套餐',enabled:comboData.combos.length>0,active:panel?.type==='combo',tone:'combo'},
    ],
    actionAvailability:{
      lineServiceMode:true,
      lineEdit:true,
      lineQuantity:true,
      holdCart:cart.length>0||heldCarts.length>0,
      cancelCart:cart.length>0,
    },
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product||!product.priceReady||!product.sellable)return;
    const existing=combineSimilar?cart.find(item=>item.productId===id&&item.serviceMode===serviceMode&&!item.detail):undefined;
    const createdId='line-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const next=existing
      ?cart.map(item=>item.id===existing.id?{...item,qty:item.qty+1}:item)
      :[...cart,{id:createdId,productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode}];
    setCart(next);
    setRecent(id);
    setHighlight(existing?.id??createdId);
    setPulse(value=>value+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };

  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number)=>{
    const product=products.find(item=>item.id===productId);if(!product||!product.priceReady||!product.sellable)return;
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:product.id,name:product.name,qty,unitMinor:product.priceMinor+deltaMinor,serviceMode,detail};
    setCart([...cart,line]);setRecent(product.id);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };

  const addCombo=(comboId:string,comboName:string,detail:string,unitMinor:number)=>{
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:comboId,name:comboName,qty:1,unitMinor,serviceMode,detail};
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
    :panel?.type==='organize'?'整理工作台'
    :panel?.type==='combo'?'紫米套餐區'
    :panel?.type==='hold'?'暫存工作台'
    :panel?.type==='holds'?'暫存單':'';

  const panelBody=panel?.type==='product'
    ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);return product?<ProductConfigWorkspace product={product} onAdd={(detail,delta,qty)=>addConfigured(product.id,detail,delta,qty)}/>:null})()
    :panel?.type==='organize'
      ?<OrganizeWorkspace lines={cart} onDone={()=>setPanel(null)}/>
      :panel?.type==='combo'
        ?<ComboWorkspace products={workspaceProducts} combos={comboData.combos} pools={comboData.pools} onAdd={addCombo}/>
        :panel?.type==='hold'
          ?<HoldCartWorkspace
            lines={cart}
            totalMinor={total}
            tables={holdTables}
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
            ?<HoldListWorkspace holds={heldCarts as readonly WorkspaceHoldDraft[]} currentCartCount={cart.reduce((sum,line)=>sum+line.qty,0)} onRestore={hold=>{
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

  const actions:OrderingWorkspaceActions={
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
      const target=lineIds[0];
      if(!target)return;
      setCart(cart.map(item=>item.id===target?{...item,qty:item.qty+delta}:item).filter(item=>item.qty>0));
    },
    onEditCartLine:lineId=>{
      const line=cart.find(item=>item.id===lineId);
      if(!line)return;
      if(comboData.combos.some(combo=>combo.id===line.productId))setPanel({type:'combo'});
      else setPanel({type:'product',productId:line.productId});
    },
    onHoldCart:()=>{if(cart.length)setPanel({type:'hold'});},
    onOpenHeldOrders:()=>setPanel({type:'holds'}),
    onRemoveCartLine:lineIds=>{
      const ids=new Set(lineIds);
      if(ids.size===1){
        const id=[...ids][0]!;
        const target=cart.find(item=>item.id===id);
        if(target&&target.qty>1&&!combineSimilar){
          setCart(cart.map(item=>item.id===id?{...item,qty:item.qty-1}:item));
          return;
        }
      }
      setCart(cart.filter(item=>!ids.has(item.id)));
    },
    onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{if(id==='combo')setPanel({type:'combo'});else setPanel({type:'organize'});},
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
        mode:parsed?.mode==='standard'?'standard':'quick',
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
          <span className="clean-rail-icon"><NavGlyph name={item.icon}/></span>
          <span className="clean-rail-label">{item.label}</span>
          {item.to==='/orders'&&activeOrderCount>0?<span className="clean-rail-badge" aria-label={'進行中訂單 '+activeOrderCount}>{activeOrderCount>99?'99+':activeOrderCount}</span>:null}
        </NavLink>)}
      </nav>
      {location.pathname==='/'?<section className="clean-order-controls" aria-label="點單操作設定">
        <button type="button" onClick={()=>setOrderUi(current=>({...current,mode:current.mode==='quick'?'standard':'quick'}))}><small>點選</small><b>{orderUi.mode==='quick'?'快速':'普通'}</b></button>
        <button type="button" className={displaySettingsOpen?'active':''} onClick={()=>setDisplaySettingsOpen(value=>!value)} aria-expanded={displaySettingsOpen}><small>介面</small><b>顯示設定</b></button>
        <div><small>ETA</small><b>{readSmtStoreSettings().fulfillmentMinutes}m</b></div>
      </section>:null}
      {location.pathname==='/'&&displaySettingsOpen?<section className="clean-display-settings" role="dialog" aria-label="點單顯示設定">
        <header><div><small>DISPLAY</small><strong>顯示設定</strong></div><button type="button" aria-label="關閉顯示設定" onClick={()=>setDisplaySettingsOpen(false)}>×</button></header>
        <label><span>分類行數</span><div><button type="button" className={orderUi.categoryRows===1?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:1}))}>1 行</button><button type="button" className={orderUi.categoryRows===2?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryRows:2}))}>2 行</button></div></label>
        <label><span>分類每行</span><div>{([5,6,7] as const).map(value=><button type="button" key={value} className={orderUi.categoryColumns===value?'active':''} onClick={()=>setOrderUi(current=>({...current,categoryColumns:value}))}>{value}</button>)}</div></label>
        <label><span>商品圖片</span><div><button type="button" className={!orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:false}))}>隱藏</button><button type="button" className={orderUi.showImages?'active':''} onClick={()=>setOrderUi(current=>({...current,showImages:true}))}>顯示</button></div></label>
        <label><span>商品密度</span><div><button type="button" className={orderUi.density==='standard'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'standard'}))}>標準</button><button type="button" className={orderUi.density==='compact'?'active':''} onClick={()=>setOrderUi(current=>({...current,density:'compact'}))}>緊湊</button></div></label>
        <footer><span>商品卡固定每行 4 格</span><button type="button" onClick={()=>setOrderUi(DEFAULT_ORDER_UI)}>重設</button></footer>
      </section>:null}
      <StaffSessionBadge/>
      <div className="clean-runtime-state"><b>LOCAL</b><span>本機優先</span></div>
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
