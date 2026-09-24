import {useMemo,useState,type ReactNode} from 'react';
import type {CartLineViewModel,OrderingProductViewModel,OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './ordering-workspace-model.ts';
import './ordering-workspace.css';

function QueueStrip({title,kind,orders,onOpen}:{title:string;kind:'pending'|'active';orders:OrderingWorkspaceViewModel['pendingOrders'];onOpen:(kind:'pending'|'active',id:string)=>void}){
  if(kind==='pending'){
    const visible=orders;
    return <section className="ordering-queue-group ordering-queue-group--pending" aria-label={title}>
      <header><strong>{title}</strong><div className="ordering-pending-head-actions"><span>{orders.length}</span>{orders.length>2&&orders[0]?<button type="button" onClick={()=>onOpen('pending',orders[0].id)}>更多</button>:null}</div></header>
      <div className="ordering-pending-list">
        {visible.length?visible.map(order=><button type="button" key={order.id} className="ordering-pending-card" onClick={()=>onOpen('pending',order.id)}>
          <span className="ordering-pending-primary"><b>#{order.orderId}</b><strong>{order.sourceLabel}</strong></span>
          <span className="ordering-pending-meta"><span>{order.waitLabel}</span><small>{order.itemCount} 件</small></span>
        </button>):<p className="ordering-empty">暫無待處理單</p>}
      </div>
    </section>;
  }
  return <section className="ordering-queue-group ordering-queue-group--active" aria-label={title}>
    <header><strong>{title}</strong><span>{orders.length}</span></header>
    <div className="ordering-active-list">
      {orders.length?orders.map(order=><button type="button" key={order.id} className="ordering-active-card" onClick={()=>onOpen('active',order.id)}>
        <div><b>#{order.orderId}</b><span>{order.sourceLabel}</span></div>
        <div><strong>{order.waitLabel}</strong><small>{order.itemCount} 件</small></div>
      </button>):<p className="ordering-empty">暫無 Keeta 訂單</p>}
    </div>
  </section>;
}

function ProductCard({product,actions,recentlyAdded}:{product:OrderingProductViewModel;actions:OrderingWorkspaceActions;recentlyAdded:boolean}){
  const onBody=()=>{
    if(!product.enabled)return;
    if(product.requiresOptions)actions.onConfigureProduct(product.id);
    else actions.onAddProduct(product.id);
  };
  return <article className={`ordering-product-card ${product.imageUrl?'has-media':'text-only'}${product.enabled?'':' disabled'}${recentlyAdded?' recently-added':''}`}>
    <button type="button" className="ordering-product-body" aria-label={`商品 ${product.name}`} disabled={!product.enabled} onClick={onBody}>
      {product.imageUrl?<span className="ordering-product-media" aria-hidden="true"><span>磨</span><img src={product.imageUrl} alt="" loading="lazy" decoding="async" onError={event=>event.currentTarget.remove()}/></span>:null}
      <span className="ordering-product-copy">{product.badge?<small>{product.badge}</small>:null}<b>{product.name}</b><strong>{product.priceLabel}</strong><em>{product.requiresOptions?'先設定':'直接加入'}</em></span>
    </button>
    <button type="button" className="ordering-product-more" aria-label={`更多設定 ${product.name}`} disabled={!product.enabled} onClick={()=>actions.onConfigureProduct(product.id)}>⋮</button>
  </article>;
}

function ServiceToggle({value,onChange,availability}:{value:ServiceMode;onChange:(mode:ServiceMode)=>void;availability:Readonly<{takeaway:boolean;dineIn:boolean}>}){
  return <div className="ordering-service-toggle" role="group" aria-label="全單用餐方式">
    <button type="button" disabled={!availability.takeaway} className={value==='takeaway'?'active':''} aria-pressed={value==='takeaway'} onClick={()=>onChange('takeaway')}>外賣</button>
    <button type="button" disabled={!availability.dineIn} className={value==='dine-in'?'active':''} aria-pressed={value==='dine-in'} onClick={()=>onChange('dine-in')}>堂食</button>
  </div>;
}

function CartLineRow({line,index,highlighted,actions,availability}:{line:CartLineViewModel;index:number;highlighted:boolean;actions:OrderingWorkspaceActions;availability:NonNullable<OrderingWorkspaceViewModel['actionAvailability']>}){
  const nextMode:ServiceMode=line.serviceMode==='takeaway'?'dine-in':'takeaway';
  return <article className={`ordering-cart-line${highlighted?' line-updated':''}`} aria-label={`購物車商品 ${line.name}`}>
    <div className="ordering-line-identity">
      <span className="ordering-line-sequence">{index+1}</span>
      {availability.lineServiceMode?<button type="button" className={`ordering-line-mode ${line.serviceMode}`} onClick={()=>actions.onChangeLineServiceMode(line.id,nextMode)} aria-label={`第 ${index+1} 項切換外賣堂食`}>{line.serviceMode==='takeaway'?'外':'堂'}</button>:<span className={`ordering-line-mode ${line.serviceMode}`} aria-label={line.serviceMode==='takeaway'?'外賣':'堂食'}>{line.serviceMode==='takeaway'?'外':'堂'}</span>}
    </div>
    {availability.lineEdit?<button type="button" className="ordering-line-copy ordering-line-copy-button" onClick={()=>actions.onEditCartLine(line.id)} aria-label={`修改 ${line.name}`}><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</button>:<div className="ordering-line-copy"><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>}
    <div className="ordering-line-qty">
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(line.id,-1)} aria-label={`減少 ${line.name}`}>−</button>:null}
      <strong>{line.quantity}</strong>
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(line.id,1)} aria-label={`增加 ${line.name}`}>＋</button>:null}
    </div>
    <strong className="ordering-line-total">{line.lineTotalLabel}</strong>
  </article>;
}

function OrganizedCart({lines,highlightedLineId,actions,availability}:{lines:readonly CartLineViewModel[];highlightedLineId?:string;actions:OrderingWorkspaceActions;availability:NonNullable<OrderingWorkspaceViewModel['actionAvailability']>}){
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const groups=useMemo(()=>{
    const map=new Map<string,{id:string;label:string;lines:{line:CartLineViewModel;index:number}[]}>();
    lines.forEach((line,index)=>{
      const current=map.get(line.groupId);
      if(current)current.lines.push({line,index});
      else map.set(line.groupId,{id:line.groupId,label:line.groupLabel,lines:[{line,index}]});
    });
    return [...map.values()];
  },[lines]);
  return <div className="ordering-cart-groups">
    {groups.map(group=>{
      const hidden=Boolean(collapsed[group.id]);
      const quantity=group.lines.reduce((sum,item)=>sum+item.line.quantity,0);
      return <section className="ordering-cart-group" key={group.id}>
        <button type="button" className="ordering-cart-group-head" aria-expanded={!hidden} onClick={()=>setCollapsed(current=>({...current,[group.id]:!current[group.id]}))}>
          <span><strong>{group.label}</strong><small>{group.lines.length} 款 · {quantity} 件</small></span><b>{hidden?'＋':'−'}</b>
        </button>
        {!hidden?<div className="ordering-cart-group-lines">{group.lines.map(({line,index})=><CartLineRow key={line.id} line={line} index={index} highlighted={highlightedLineId===line.id} actions={actions} availability={availability}/>)}</div>:null}
      </section>;
    })}
  </div>;
}

export function OrderingWorkspace({view,actions,centerPanel}:{view:OrderingWorkspaceViewModel;actions:OrderingWorkspaceActions;centerPanel?:{readonly title:string;readonly body:ReactNode;readonly onClose:()=>void}|null}){
  const availability=view.actionAvailability??{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true};
  const serviceModes=view.serviceModes??{takeaway:true,dineIn:true};
  const cartCount=view.cart.lines.reduce((sum,line)=>sum+line.quantity,0);
  const nextAction=centerPanel
    ?`完成「${centerPanel.title}」`
    :cartCount===0?'揀商品加入目前訂單'
    :view.cart.checkoutEnabled?'核對購物車，然後結帳':'完成目前必選／整理';
  const pressureCount=view.pendingOrders.length+view.activeOrders.length;
  return <div className={`ordering-workspace${centerPanel?' panel-open':''}`}>
    <header className="ordering-flow-strip">
      <QueueStrip title="待處理" kind="pending" orders={view.pendingOrders} onOpen={actions.onOpenQueueOrder}/>
      <QueueStrip title="Keeta" kind="active" orders={view.activeOrders} onOpen={actions.onOpenQueueOrder}/>
    </header>

    <main className={`ordering-catalog${centerPanel?' ordering-catalog--panel':''}`} aria-label={centerPanel?centerPanel.title:'商品'}>
      <section className="ordering-decision-strip" aria-live="polite">
        <div><small>NOW</small><strong>{centerPanel?centerPanel.title:view.cart.serviceMode==='takeaway'?'外賣點單':'堂食點單'}</strong><span>{cartCount} 件 · {view.cart.totalLabel}</span></div>
        <i aria-hidden="true"/>
        <div><small>NEXT</small><strong>{nextAction}</strong><span>{pressureCount?`另有 ${pressureCount} 張待留意訂單`:'目前冇額外訂單壓力'}</span></div>
      </section>
      {centerPanel?<section className="ordering-center-panel">
        <header className="ordering-center-panel-head"><div><small>點單工作台</small><strong>{centerPanel.title}</strong></div><button type="button" onClick={centerPanel.onClose}>×</button></header>
        <div className="ordering-center-panel-body">{centerPanel.body}</div>
      </section>:<>
        {view.menuRevisionLabel?<div className="ordering-menu-local-status"><b>{view.menuRevisionLabel}</b><span>本機 Admin → POS</span></div>:null}
        {view.operationalNotice?<div className="ordering-menu-local-status warning"><b>{view.operationalNotice}</b><span>Admin 營運提示</span></div>:null}
        {view.showCategories===false?null:<nav className="ordering-categories" aria-label="商品分類">
          {view.categories.map(category=><button type="button" key={category.id} aria-pressed={view.selectedCategoryId===category.id} className={view.selectedCategoryId===category.id?'active':''} onClick={()=>actions.onSelectCategory(category.id)}>{category.label}</button>)}
        </nav>}
        <section className="ordering-product-grid">{view.products.map(product=><ProductCard key={product.id} product={product} actions={actions} recentlyAdded={view.recentlyAddedProductId===product.id}/>)}</section>
      </>}
    </main>

    <aside key={view.cartPulseNonce} className={`ordering-cart${view.cartPulseNonce>0?' cart-updated':''}`} aria-label="購物車">
      <header className="ordering-cart-head">
        <div className="ordering-cart-order-id"><small>ORDER</small><strong>#{view.cart.orderId}</strong></div>
        <div className="ordering-cart-head-actions">
          <div className="ordering-cart-view-toggle" role="group" aria-label="購物車檢視">
            <button type="button" className={view.cart.viewMode==='original'?'active':''} aria-pressed={view.cart.viewMode==='original'} onClick={()=>actions.onChangeCartView('original')}>原單</button>
            <button type="button" className={view.cart.viewMode==='organized'?'active':''} aria-pressed={view.cart.viewMode==='organized'} onClick={()=>actions.onChangeCartView('organized')}>整理</button>
          </div>
          <ServiceToggle value={view.cart.serviceMode} onChange={actions.onChangeServiceMode} availability={serviceModes}/>
        </div>
      </header>
      <div className={`ordering-cart-lines ${view.cart.viewMode}`}>
        {view.cart.lines.length?(view.cart.viewMode==='original'
          ?view.cart.lines.map((line,index)=><CartLineRow key={line.id} line={line} index={index} highlighted={view.highlightedCartLineId===line.id} actions={actions} availability={availability}/>)
          :<OrganizedCart lines={view.cart.lines} highlightedLineId={view.highlightedCartLineId} actions={actions} availability={availability}/>
        ):<div className="ordering-cart-empty">購物車未有商品</div>}
      </div>
      <div className="ordering-cart-facts"><span><small>小計</small><b>{view.cart.subtotalLabel}</b></span><span><small>包裝</small><b>{view.cart.packagingLabel}</b></span><span><small>折扣</small><b>{view.cart.discountLabel}</b></span></div>
      <div className="ordering-cart-total"><span>總計</span><strong>{view.cart.totalLabel}</strong></div>
      {availability.holdCart||availability.cancelCart?<div className={`ordering-cart-secondary-actions${!availability.cancelCart?' single':''}`}>{availability.holdCart?<button type="button" onClick={actions.onHoldCart}>{view.cart.lines.length?'暫存':'取回訂單'}</button>:null}{availability.cancelCart?<button type="button" className="destructive" onClick={actions.onCancelCart}>取消單</button>:null}</div>:null}
      <div className="ordering-checkout-context"><span>下一步</span><b>{view.cart.checkoutEnabled?'核對付款並完成訂單':'完成必選後可結帳'}</b></div>
      <button type="button" className="ordering-checkout" aria-label="結帳" disabled={!view.cart.checkoutEnabled} onClick={actions.onCheckout}><span>結帳</span><strong>{view.cart.totalLabel}</strong></button>
    </aside>

    <footer className="ordering-workbar">{view.workItems.map(item=><button type="button" key={item.id} onClick={()=>actions.onOpenWorkItem(item.id)}><span>{item.label}</span>{item.count>0?<b>{item.count}</b>:null}</button>)}</footer>
  </div>;
}
