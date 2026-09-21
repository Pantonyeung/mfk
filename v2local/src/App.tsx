import {useMemo,useState} from 'react';
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

type Product={id:string;category:string;name:string;priceMinor:number};
type CartLine={id:string;productId:string;name:string;qty:number;unitMinor:number;serviceMode:ServiceMode};

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
const nav=[
  {to:'/',label:'點餐',icon:'▦',end:true},
  {to:'/orders',label:'訂單',icon:'▤'},
  {to:'/dining',label:'堂食',icon:'▱'},
  {to:'/soldout',label:'售罄',icon:'⊘'},
  {to:'/more',label:'更多',icon:'•••'},
] as const;

function OrderingPage({cart,setCart,serviceMode,setServiceMode}:{cart:CartLine[];setCart:(v:CartLine[])=>void;serviceMode:ServiceMode;setServiceMode:(m:ServiceMode)=>void}){
  const navigate=useNavigate();
  const [category,setCategory]=useState('all');
  const [viewMode,setViewMode]=useState<'original'|'organized'>('original');
  const [pulse,setPulse]=useState(0);
  const [recent,setRecent]=useState<string|undefined>();
  const [highlight,setHighlight]=useState<string|undefined>();
  const categories=[{id:'all',label:'全部'},...[...new Set(products.map(p=>p.category))].map(x=>({id:x,label:x}))];
  const visible=products.filter(p=>category==='all'||p.category===category);
  const total=cart.reduce((sum,line)=>sum+line.unitMinor*line.qty,0);
  const nextDisplay='P'+String(localRuntime.orders().length+1).padStart(3,'0');
  const view:OrderingWorkspaceViewModel={
    pendingOrders:[],activeOrders:[],categories,selectedCategoryId:category,
    products:visible.map(p=>({id:p.id,name:p.name,priceLabel:money(p.priceMinor),enabled:true,requiresOptions:false})),
    cart:{
      orderId:nextDisplay,serviceMode,viewMode,
      lines:cart.map(line=>({id:line.id,name:line.name,quantity:line.qty,lineTotalLabel:money(line.unitMinor*line.qty),serviceMode:line.serviceMode,groupId:'local',groupLabel:'本機'})),
      subtotalLabel:money(total),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(total),checkoutEnabled:cart.length>0,
    },
    workItems:[
      {id:'riceball-pool',label:'飯團池',count:0},{id:'required',label:'必選項',count:0},
      {id:'combo',label:'套餐',count:0},{id:'soldout',label:'售罄',count:0}
    ],
    recentlyAddedProductId:recent,highlightedCartLineId:highlight,cartPulseNonce:pulse,
  };
  const add=(id:string)=>{
    const p=products.find(x=>x.id===id);if(!p)return;
    const existing=cart.find(x=>x.productId===id&&x.serviceMode===serviceMode);
    const next=existing?cart.map(x=>x.id===existing.id?{...x,qty:x.qty+1}:x):[...cart,{id:'line-'+Date.now().toString(36),productId:p.id,name:p.name,qty:1,unitMinor:p.priceMinor,serviceMode}];
    setCart(next);setRecent(id);setHighlight(existing?.id??next[next.length-1]?.id);setPulse(x=>x+1);
    window.setTimeout(()=>{setRecent(undefined);setHighlight(undefined)},700);
  };
  const actions:OrderingWorkspaceActions={
    onSelectCategory:setCategory,onAddProduct:add,onConfigureProduct:add,
    onChangeServiceMode:setServiceMode,onChangeCartView:setViewMode,
    onChangeLineServiceMode:(lineId,mode)=>setCart(cart.map(x=>x.id===lineId?{...x,serviceMode:mode}:x)),
    onAdjustLineQuantity:(lineId,delta)=>setCart(cart.map(x=>x.id===lineId?{...x,qty:x.qty+delta}:x).filter(x=>x.qty>0)),
    onEditCartLine:()=>{},onHoldCart:()=>{},onCancelCart:()=>setCart([]),
    onOpenWorkItem:id=>{if(id==='soldout')navigate('/soldout')},onOpenQueueOrder:()=>{},onCheckout:()=>navigate('/checkout'),
  };
  return <OrderingWorkspace view={view} actions={actions}/>;
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
    CASH:'現金',ALIPAY:'Alipay',WECHAT:'WeChat Pay',FPS:'轉數快',PAYME:'PayMe',COMBO:'組合付款'
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
      lines:cart.map(x=>({id:x.id,name:x.name,quantity:x.qty,lineTotalLabel:money(x.unitMinor*x.qty)})),
      subtotalLabel:money(due),packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:money(due),
    },
    channels:[
      {id:'walk-in',label:'現場',selected:channel==='walk-in'},
      {id:'whatsapp',label:'電話／WhatsApp',selected:channel==='whatsapp'},
      {id:'morefun-app',label:'磨飯 App',selected:channel==='morefun-app'},
      {id:'keeta',label:'Keeta',selected:channel==='keeta'},
      {id:'foodpanda',label:'Foodpanda',selected:channel==='foodpanda'},
    ],
    methods:(['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO'] as CheckoutTenderId[]).map(id=>({id,label:methodLabels[id],enabled:true,selected:method===id})),
    selectedMethodLabel:methodLabels[method],
    amount:{dueLabel:money(due),receivedLabel:money(received),changeLabel:money(change)},
    cashInput:cash,
    cashEntryVisible:method==='CASH',
    exactCashEnabled:method==='CASH',
    confirmEnabled,
    paymentState:state,
    channelFields:{
      showCustomerPhone:channel==='whatsapp',customerPhone,
      showPlatformFields:channel==='morefun-app'||channel==='keeta'||channel==='foodpanda',
      pickupCode,platformOrderNo,
    },
    comboMode:method==='COMBO',
    splitTenders:(['CASH','ALIPAY','WECHAT','FPS','PAYME'] as const).map(id=>({id,label:methodLabels[id],amount:split[id]})),
    validationMessage,
    statusMessage:printStatus,
    completionReview:completion,
  };

  const confirm=()=>{
    if(!confirmEnabled)return;
    setState('processing');
    try{
      const order=localRuntime.createOrder({
        items:cart.map(x=>({id:x.productId,name:x.name,qty:x.qty,unitMinor:x.unitMinor})),
        totalMinor:due,paymentLabel,sourceLabel
      });
      setCompletion({displayOrderCode:order.display,tenderLabel:tenderDisplay,dueLabel:money(due),receivedLabel:money(received),changeLabel:money(change),statusLabel:'COMPLETED'});
      setState('success');
      setPrintStatus('訂單已完成 · 正在送打印…');
      void localRuntime.printOrderOutputs(order.id).then(summary=>{
        if(summary.planned===0){setPrintStatus('訂單已完成 · 未有已綁定打印 Route');return;}
        if(summary.failed===0){setPrintStatus('訂單已完成 · 已送出 '+summary.sent+'/'+summary.planned+' 個打印工作');return;}
        const failures=summary.results.filter(row=>!row.ok).map(row=>row.role+':'+row.code).join('；');
        setPrintStatus('訂單已完成 · 打印部分失敗 '+summary.sent+'/'+summary.planned+' · '+failures);
      }).catch(error=>setPrintStatus('訂單已完成 · 打印失敗 '+(error instanceof Error?error.message:String(error))));
    }catch{setState('failure')}
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
      if(key==='⌫')setCash(v=>v.slice(0,-1));
      else if(key==='00')setCash(v=>(v||'')+'00');
      else setCash(v=>(v||'')+key);
    },
    onQuickCash:amount=>setCash(v=>(((Number(v)||0)+amount).toFixed(2))),
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
      <nav aria-label="MFK 主導航">{nav.map(item=><NavLink key={item.to} to={item.to} end={'end' in item?item.end:false} className={({isActive})=>isActive?'active':''}><span className="clean-rail-icon">{item.icon}</span><span className="clean-rail-label">{item.label}</span></NavLink>)}</nav>
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
