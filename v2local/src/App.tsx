import {useEffect,useMemo,useState} from 'react';
import {NavLink,Navigate,Route,Routes,useNavigate} from 'react-router';
import {ProductionViewport} from './app/ProductionViewport.tsx';
import {OrderingWorkspace} from './features/ordering/OrderingWorkspace.tsx';
import type {OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './features/ordering/ordering-workspace-model.ts';
import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';
import type {CheckoutChannelId,CheckoutTenderId,CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './features/checkout/checkout-workspace-model.ts';
import {RuntimeOrdersWorkspace} from './presentation/RuntimeOrdersWorkspace.tsx';
import {RuntimeDiningWorkspace} from './presentation/RuntimeDiningWorkspace.tsx';
import {RuntimeSoldoutWorkspace} from './presentation/RuntimeSoldoutWorkspace.tsx';
import {LocalMoreWorkspace} from './presentation/LocalMoreWorkspace.tsx';
import {localRuntime} from './runtime/local-runtime.ts';
import {ComboWorkspace,HoldCartWorkspace,HoldListWorkspace,OrganizeWorkspace,ProductConfigWorkspace,type OrderingPanelState,type WorkspaceHoldDraft,type WorkspaceProduct} from './features/ordering/OrderingCenterWorkspaces.tsx';

type Product={id:string;category:string;name:string;priceMinor:number};
type CartLine={id:string;productId:string;name:string;qty:number;unitMinor:number;serviceMode:ServiceMode;detail?:string};

const products:readonly Product[]=[
  {id:'riceball',category:'飯團',name:'原味飯團',priceMinor:4100},
  {id:'tuna',category:'飯團',name:'紫菜吞拿魚飯團',priceMinor:4300},
  {id:'pork',category:'飯團',name:'泡菜豬肉飯團',priceMinor:4500},
  {id:'bento',category:'便當',name:'肉燥便當',priceMinor:4800},
  {id:'curry',category:'便當',name:'咖喱便當',priceMinor:5000},
  {id:'wedges',category:'小食',name:'香脆薯角',priceMinor:1800},
  {id:'milkTea',category:'飲品',name:'台式奶茶',priceMinor:1600},
  {id:'lemonTea',category:'飲品',name:'手打檸檬茶',priceMinor:2000},
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

function OrderingPage({cart,setCart,serviceMode,setServiceMode}:{cart:CartLine[];setCart:(v:CartLine[])=>void;serviceMode:ServiceMode;setServiceMode:(m:ServiceMode)=>void}){
  const navigate=useNavigate();
  const [runtimeRevision,setRuntimeRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRuntimeRevision(value=>value+1)),[]);
  const [category,setCategory]=useState('all');
  const [viewMode,setViewMode]=useState<'original'|'organized'>('original');
  const [pulse,setPulse]=useState(0);
  const [recent,setRecent]=useState<string|undefined>();
  const [highlight,setHighlight]=useState<string|undefined>();
  const [panel,setPanel]=useState<OrderingPanelState>(null);
  const categories=[
    {id:'all',label:'熱門'},{id:'飯團',label:'飯團'},{id:'套餐',label:'套餐'},{id:'便當',label:'便當'},
    {id:'小食',label:'小食'},{id:'飲品',label:'飲品'},{id:'素食',label:'素食'},{id:'湯品',label:'湯品'},
    {id:'配料',label:'配料'},{id:'更多',label:'更多'},
  ];
  const visible=products.filter(p=>category==='all'||p.category===category);
  const runtimeOrders=useMemo(()=>{void runtimeRevision;return localRuntime.orders();},[runtimeRevision]);
  const heldCarts=useMemo(()=>{void runtimeRevision;return localRuntime.holds();},[runtimeRevision]);
  const queueItem=(order:(typeof runtimeOrders)[number])=>({
    id:order.id,
    orderId:order.display,
    sourceLabel:order.sourceLabel,
    waitLabel:new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}),
    itemCount:order.items.reduce((sum,item)=>sum+item.qty,0),
  });
  const pendingOrders=runtimeOrders.filter(order=>order.fulfillmentLabel==='待處理').slice(0,6).map(queueItem);
  const activeOrders=runtimeOrders.filter(order=>order.fulfillmentLabel==='進行中'||order.fulfillmentLabel==='可取餐').slice(0,8).map(queueItem);
  const total=cart.reduce((sum,line)=>sum+line.unitMinor*line.qty,0);
  const nextDisplay='P'+String(localRuntime.orders().length+1).padStart(3,'0');

  const view:OrderingWorkspaceViewModel={
    pendingOrders,activeOrders,categories,selectedCategoryId:category,
    products:visible.map(product=>({
      id:product.id,name:product.name,priceLabel:money(product.priceMinor),
      enabled:true,requiresOptions:['飯團','便當'].includes(product.category),imageUrl:productArtwork(product),
    })),
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,
      lines:cart.map(line=>({
        id:line.id,name:line.name,quantity:line.qty,lineTotalLabel:money(line.unitMinor*line.qty),
        serviceMode:line.serviceMode,groupId:'local',groupLabel:'本機',detail:line.detail,
      })),
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),checkoutEnabled:cart.length>0,
    },
    workItems:[
      {id:'riceball-pool',label:'飯團待組區',count:0},
      {id:'required',label:'必選區',count:0},
      {id:'combo',label:'紫米套餐區',count:0},
      {id:'holds',label:'暫存單',count:heldCarts.length},
      {id:'soldout',label:'售罄管理',count:0},
    ],
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };

  const add=(id:string)=>{
    const product=products.find(item=>item.id===id);if(!product)return;
    const existing=cart.find(item=>item.productId===id&&item.serviceMode===serviceMode);
    const next=existing
      ?cart.map(item=>item.id===existing.id?{...item,qty:item.qty+1}:item)
      :[...cart,{id:'line-'+Date.now().toString(36),productId:product.id,name:product.name,qty:1,unitMinor:product.priceMinor,serviceMode}];
    setCart(next);
    setRecent(id);
    setHighlight(existing?.id??next[next.length-1]?.id);
    setPulse(value=>value+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };
  const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number)=>{
    const product=products.find(item=>item.id===productId);if(!product)return;
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:product.id,name:product.name,qty,unitMinor:product.priceMinor+deltaMinor,serviceMode,detail};
    setCart([...cart,line]);setRecent(product.id);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };
  const addCombo=(productId:string,detail:string,unitMinor:number)=>{
    const product=products.find(item=>item.id===productId);if(!product)return;
    const line:CartLine={id:'line-'+Date.now().toString(36),productId:product.id,name:product.name,qty:1,unitMinor,serviceMode,detail};
    setCart([...cart,line]);setHighlight(line.id);setPulse(value=>value+1);setPanel(null);
  };
  const workspaceProducts:WorkspaceProduct[]=products.map(product=>({...product,priceLabel:money(product.priceMinor),imageUrl:productArtwork(product)}));
  const panelTitle=panel?.type==='product'?'商品選項':panel?.type==='organize'?'整理工作台':panel?.type==='combo'?'紫米套餐區':panel?.type==='hold'?'暫存／候位':panel?.type==='holds'?'暫存單':'';
  const panelBody=panel?.type==='product'
    ?(()=>{const product=workspaceProducts.find(item=>item.id===panel.productId);return product?<ProductConfigWorkspace product={product} onAdd={(detail,delta,qty)=>addConfigured(product.id,detail,delta,qty)}/>:null})()
    :panel?.type==='organize'
      ?<OrganizeWorkspace lines={cart} onDone={()=>setPanel(null)}/>
      :panel?.type==='combo'
        ?<ComboWorkspace products={workspaceProducts} onAdd={addCombo}/>
        :panel?.type==='hold'
          ?<HoldCartWorkspace lines={cart} totalMinor={total} onHold={(kind,partySize,note)=>{
            localRuntime.createHold({
              kind,
              items:cart.map(line=>({id:line.productId,name:line.detail?line.name+'｜'+line.detail:line.name,qty:line.qty,unitMinor:line.unitMinor})),
              totalMinor:total,partySize,note
            });
            setCart([]);setPanel(null);
            if(kind==='dining')navigate('/dining');
          }}/>
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

  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,onAddProduct:add,onConfigureProduct:id=>setPanel({type:'product',productId:id}),
    onChangeServiceMode:setServiceMode,onChangeCartView:mode=>{setViewMode(mode);if(mode==='organized')setPanel({type:'organize'});},
    onChangeLineServiceMode:(lineId,mode)=>setCart(cart.map(item=>item.id===lineId?{...item,serviceMode:mode}:item)),
    onAdjustLineQuantity:(lineId,delta)=>setCart(cart.map(item=>item.id===lineId?{...item,qty:item.qty+delta}:item).filter(item=>item.qty>0)),
    onEditCartLine:lineId=>{const line=cart.find(item=>item.id===lineId);if(line)setPanel({type:'product',productId:line.productId});},onHoldCart:()=>setPanel(cart.length?{type:'hold'}:{type:'holds'}),onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{if(id==='soldout')navigate('/soldout');else if(id==='combo')setPanel({type:'combo'});else if(id==='holds')setPanel({type:'holds'});else setPanel({type:'organize'});},
    onOpenQueueOrder:(_kind,id)=>navigate('/orders?orderId='+encodeURIComponent(id)),
    onCheckout:()=>navigate('/checkout'),
  };
  return <OrderingWorkspace view={view} actions={actions} centerPanel={panel&&panelBody?{title:panelTitle,body:panelBody,onClose:()=>setPanel(null)}:null}/>;
}

function CheckoutPage({cart,setCart}:{cart:CartLine[];setCart:(v:CartLine[])=>void}){
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
      orderId:'P'+String(localRuntime.orders().length+1).padStart(3,'0'),
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

  const confirm=()=>{
    if(!confirmEnabled)return;
    setState('processing');
    try{
      const order=localRuntime.createOrder({
        items:cart.map(line=>({id:line.productId,name:line.detail?line.name+'｜'+line.detail:line.name,qty:line.qty,unitMinor:line.unitMinor})),
        totalMinor:due,paymentLabel,sourceLabel,
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
    onBack:()=>navigate('/'),
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
    onDone:()=>{setCart([]);navigate('/')},
  };

  return <CheckoutWorkspace view={view} actions={actions}/>;
}

export function MfkV2LocalApp(){
  const [cart,setCartState]=useState<CartLine[]>([]);
  const [serviceMode,setServiceMode]=useState<ServiceMode>('takeaway');
  const setCart=(next:CartLine[])=>setCartState(next);
  const runtime=useMemo(()=>localRuntime,[]);

  return <ProductionViewport><div className="clean-app">
    <aside className="clean-rail">
      <div className="clean-brand" aria-label="磨飯">磨</div>
      <nav aria-label="MFK 主導航">
        {nav.map(item=><NavLink key={item.to} to={item.to} end={'end' in item?item.end:false} className={({isActive})=>isActive?'active':''}>
          <span className="clean-rail-icon">{item.icon}</span><span className="clean-rail-label">{item.label}</span>
        </NavLink>)}
      </nav>
      <div className="clean-runtime-state">LOCAL<br/>OFFLINE</div>
    </aside>
    <section className="clean-route-stage">
      <Routes>
        <Route index element={<OrderingPage cart={cart} setCart={setCart} serviceMode={serviceMode} setServiceMode={setServiceMode}/>}/>
        <Route path="checkout" element={<CheckoutPage cart={cart} setCart={setCart}/>}/>
        <Route path="orders" element={<RuntimeOrdersWorkspace runtime={runtime}/>}/>
        <Route path="dining" element={<RuntimeDiningWorkspace runtime={runtime}/>}/>
        <Route path="soldout" element={<RuntimeSoldoutWorkspace runtime={runtime}/>}/>
        <Route path="more" element={<LocalMoreWorkspace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </section>
  </div></ProductionViewport>;
}
