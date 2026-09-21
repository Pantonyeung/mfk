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
      <span className="ordering-product-copy">{product.badge?<small>{product.badge}</small>:null}<b>{product.name}</b><strong>{product.priceLabel}</strong></span>
    </button>
    <button type="button" className="ordering-product-more" aria-label={`更多設定 ${product.name}`} disabled={!product.enabled} onClick={()=>actions.onConfigureProduct(product.id)}>⋮</button>
  </article>;
}

function ServiceToggle({value,onChange}:{value:ServiceMode;onChange:(mode:ServiceMode)=>void}){
  return <div className="ordering-service-toggle" role="group" aria-label="全單用餐方式">
    <button type="button" className={value==='takeaway'?'active':''} aria-pressed={value==='takeaway'} onClick={()=>onChange('takeaway')}>外賣</button>
    <button type="button" className={value==='dine-in'?'active':''} aria-pressed={value==='dine-in'} onClick={()=>onChange('dine-in')}>堂食</button>
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
  return <div className={`ordering-workspace${centerPanel?' panel-open':''}`}>
    <header className="ordering-flow-strip">
      <QueueStrip title="待處理" kind="pending" orders={view.pendingOrders} onOpen={actions.onOpenQueueOrder}/>
      <QueueStrip title="Keeta" kind="active" orders={view.activeOrders} onOpen={actions.onOpenQueueOrder}/>
    </header>

    <main className={`ordering-catalog${centerPanel?' ordering-catalog--panel':''}`} aria-label={centerPanel?centerPanel.title:'商品'}>
      {centerPanel?<section className="ordering-center-panel">
        <header className="ordering-center-panel-head"><div><small>點單工作台</small><strong>{centerPanel.title}</strong></div><button type="button" onClick={centerPanel.onClose}>×</button></header>
        <div className="ordering-center-panel-body">{centerPanel.body}</div>
      </section>:<>
        <nav className="ordering-categories" aria-label="商品分類">
          {view.categories.map(category=><button type="button" key={category.id} aria-pressed={view.selectedCategoryId===category.id} className={view.selectedCategoryId===category.id?'active':''} onClick={()=>actions.onSelectCategory(category.id)}>{category.label}</button>)}
        </nav>
        <section className="ordering-product-grid">{view.products.map(product=><ProductCard key={product.id} product={product} actions={actions} recentlyAdded={view.recentlyAddedProductId===product.id}/>)}</section>
      </>}
    </main>

    <aside key={view.cartPulseNonce} className={`ordering-cart${view.cartPulseNonce>0?' cart-updated':''}${view.holdPlacement?.active?' hold-active':''}`} aria-label="購物車">
      <header className="ordering-cart-head">
        <div className="ordering-cart-order-id"><small>ORDER</small><strong>#{view.cart.orderId}</strong></div>
        <div className="ordering-cart-head-actions">
          <div className="ordering-cart-view-toggle" role="group" aria-label="購物車檢視">
            <button type="button" className={view.cart.viewMode==='original'?'active':''} aria-pressed={view.cart.viewMode==='original'} onClick={()=>actions.onChangeCartView('original')}>原單</button>
            <button type="button" className={view.cart.viewMode==='organized'?'active':''} aria-pressed={view.cart.viewMode==='organized'} onClick={()=>actions.onChangeCartView('organized')}>整理</button>
          </div>
          <ServiceToggle value={view.cart.serviceMode} onChange={actions.onChangeServiceMode}/>
        </div>
      </header>
      {view.holdPlacement?.active?<div className="ordering-hold-placement">
        <header><div><small>暫存／堂食</small><strong>直接安排</strong></div><button type="button" onClick={actions.onCancelHoldPlacement}>返回購物車</button></header>
        <div className="ordering-hold-placement-body">
          <section className="ordering-hold-left">
            <button type="button" className="queue" onClick={actions.onHoldQueue}><b>加入輪候</b><span>直接放入堂食輪候，之後先安排枱號。</span></button>
            <button type="button" className="waiting" onClick={actions.onHoldWaiting}><b>暫存待客</b><span>客人話等一等，之後由「取回訂單」攞返。</span></button>
          </section>
          <section className="ordering-hold-tables" aria-label="堂食枱號">
            {view.holdPlacement.tables.map(table=><button type="button" key={table.id} disabled={table.occupied} className={table.occupied?'occupied':'available'} onClick={()=>actions.onHoldTable(table.id)}>
              <b>{table.label}</b><span>{table.occupied?(table.codeLabel??'使用中'):'空枱'}</span>
            </button>)}
          </section>
        </div>
      </div>:<>
        <div className={`ordering-cart-lines ${view.cart.viewMode}`}>
          {view.cart.lines.length?(view.cart.viewMode==='original'
            ?view.cart.lines.map((line,index)=><CartLineRow key={line.id} line={line} index={index} highlighted={view.highlightedCartLineId===line.id} actions={actions} availability={availability}/>)
            :<OrganizedCart lines={view.cart.lines} highlightedLineId={view.highlightedCartLineId} actions={actions} availability={availability}/>
          ):<div className="ordering-cart-empty">購物車未有商品</div>}
        </div>
        <div className="ordering-cart-facts"><span><small>小計</small><b>{view.cart.subtotalLabel}</b></span><span><small>包裝</small><b>{view.cart.packagingLabel}</b></span><span><small>折扣</small><b>{view.cart.discountLabel}</b></span></div>
        <div className="ordering-cart-total"><span>總計</span><strong>{view.cart.totalLabel}</strong></div>
        {availability.holdCart||availability.cancelCart?<div className={`ordering-cart-secondary-actions${!availability.cancelCart?' single':''}`}>{availability.holdCart?<button type="button" onClick={actions.onHoldCart}>{view.cart.lines.length?'暫存':'取回訂單'}</button>:null}{availability.cancelCart?<button type="button" className="destructive" onClick={actions.onCancelCart}>取消單</button>:null}</div>:null}
        <button type="button" className="ordering-checkout" aria-label="結帳" disabled={!view.cart.checkoutEnabled} onClick={actions.onCheckout}>結帳　{view.cart.totalLabel}</button>
      </>}
    </aside>

    <footer className="ordering-workbar">{view.workItems.map(item=><button type="button" key={item.id} onClick={()=>actions.onOpenWorkItem(item.id)}><span>{item.label}</span>{item.count>0?<b>{item.count}</b>:null}</button>)}</footer>
  </div>;
}
