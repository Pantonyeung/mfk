import {useMemo,useState,type ReactNode} from 'react';
import type {CartLineViewModel,OrderingProductViewModel,OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './ordering-workspace-model.ts';
import './ordering-workspace.css';

function QueueStrip({title,kind,orders,onOpen}:{title:string;kind:'pending'|'active';orders:OrderingWorkspaceViewModel['pendingOrders'];onOpen:(kind:'pending'|'active',id:string)=>void}){
  const empty=kind==='pending'?'暫無待處理單':'暫無 Keeta 訂單';
  return <section className={`ordering-queue-group ordering-queue-group--${kind}`} aria-label={title}>
    <header><strong>{title}</strong><span>{orders.length}</span></header>
    <div className="ordering-queue-list">
      {orders.length?orders.map(order=><button type="button" key={order.id} className="ordering-queue-card" onClick={()=>onOpen(kind,order.id)}>
        <span><b>#{order.orderId}</b><strong>{order.sourceLabel}</strong></span>
        <span><em>{order.waitLabel}</em><small>{order.itemCount} 件</small></span>
      </button>):<p className="ordering-empty">{empty}</p>}
    </div>
  </section>;
}

function ProductCard({product,actions,recentlyAdded,orderingMode}:{product:OrderingProductViewModel;actions:OrderingWorkspaceActions;recentlyAdded:boolean;orderingMode:'normal'|'quick'}){
  const onBody=()=>{
    if(!product.enabled)return;
    if(orderingMode==='quick'&&product.quickAddAllowed)actions.onAddProduct(product.id);
    else if(product.requiresOptions)actions.onConfigureProduct(product.id);
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

function TrashGlyph(){
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>
  </svg>;
}

function CartLineRow({line,index,highlighted,actions,availability}:{line:CartLineViewModel;index:number;highlighted:boolean;actions:OrderingWorkspaceActions;availability:NonNullable<OrderingWorkspaceViewModel['actionAvailability']>}){
  const sourceLineIds=line.sourceLineIds?.length?line.sourceLineIds:[line.id];
  const nextMode:ServiceMode=line.serviceMode==='takeaway'?'dine-in':'takeaway';
  return <article className={`ordering-cart-line${highlighted?' line-updated':''}`} aria-label={`購物車商品 ${line.name}`}>
    <div className="ordering-line-identity">
      <span className="ordering-line-sequence">{index+1}</span>
      {availability.lineServiceMode?<button type="button" className={`ordering-line-mode ${line.serviceMode}`} onClick={()=>actions.onChangeLineServiceMode(sourceLineIds,nextMode)} aria-label={`第 ${index+1} 項切換外賣堂食`}>{line.serviceMode==='takeaway'?'外':'堂'}</button>:<span className={`ordering-line-mode ${line.serviceMode}`} aria-label={line.serviceMode==='takeaway'?'外賣':'堂食'}>{line.serviceMode==='takeaway'?'外':'堂'}</span>}
    </div>
    {availability.lineEdit?<button type="button" className="ordering-line-copy ordering-line-copy-button" onClick={()=>actions.onEditCartLine(sourceLineIds)} aria-label={`修改 ${line.name}`}><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</button>:<div className="ordering-line-copy"><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>}
    <div className="ordering-line-qty">
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(sourceLineIds,-1)} aria-label={`減少 ${line.name}`}>−</button>:null}
      <strong>{line.quantity}</strong>
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(sourceLineIds,1)} aria-label={`增加 ${line.name}`}>＋</button>:null}
    </div>
    <strong className="ordering-line-total">{line.lineTotalLabel}</strong>
    <button type="button" className="ordering-line-remove" onClick={()=>actions.onRemoveCartLine(sourceLineIds)} aria-label={`刪除 ${line.name}`}><TrashGlyph/></button>
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
        {!hidden?<div className="ordering-cart-group-lines">{group.lines.map(({line,index})=><CartLineRow key={line.id} line={line} index={index} highlighted={highlightedLineId===line.id||Boolean(line.sourceLineIds?.includes(highlightedLineId??''))} actions={actions} availability={availability}/>)}</div>:null}
      </section>;
    })}
  </div>;
}

export function OrderingWorkspace({view,actions,centerPanel}:{view:OrderingWorkspaceViewModel;actions:OrderingWorkspaceActions;centerPanel?:{readonly title:string;readonly body:ReactNode;readonly onClose:()=>void}|null}){
  const availability=view.actionAvailability??{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true};
  const serviceModes=view.serviceModes??{takeaway:true,dineIn:true};
  const orderingMode=view.orderingMode??'normal';
  const quickDrink=view.quickDrink??{open:false,pendingCount:0,choices:[]};
  const itemCount=view.cart.lines.reduce((sum,line)=>sum+line.quantity,0);
  const guidanceTarget=view.guidanceTarget??(itemCount?'checkout':'product');
  return <div className={`ordering-workspace donor-skeleton${centerPanel?' panel-open':''}`} data-guidance={guidanceTarget}>
    <header className="ordering-flow-strip">
      <QueueStrip title="待處理" kind="pending" orders={view.pendingOrders} onOpen={actions.onOpenQueueOrder}/>
      <QueueStrip title="Keeta" kind="active" orders={view.activeOrders} onOpen={actions.onOpenQueueOrder}/>
    </header>

    <main className={`ordering-catalog${centerPanel?' ordering-catalog--panel':''}${!centerPanel&&guidanceTarget==='product'?' flow-next-catalog':''}`} aria-label={centerPanel?centerPanel.title:'商品'}>
      {centerPanel?<section className="ordering-center-panel">
        <header className="ordering-center-panel-head"><div><small>點單工作台</small><strong>{centerPanel.title}</strong></div><button type="button" onClick={centerPanel.onClose}>×</button></header>
        <div className="ordering-center-panel-body">{centerPanel.body}</div>
      </section>:<>
        <div className="ordering-catalog-toolbar">
          <div className="ordering-status-stack" aria-live="polite">
            {view.menuRevisionLabel?<div className="ordering-menu-local-status"><b>{view.menuRevisionLabel}</b><span>本機 Admin → POS</span></div>:null}
            {view.operationalNotice?<div className="ordering-menu-local-status warning"><b>{view.operationalNotice}</b><span>Admin 營運提示</span></div>:null}
          </div>
          <div className="ordering-fast-controls" aria-label="點單快捷">
            <div className="ordering-mode-switch" aria-label="點單模式">
              <button type="button" className={orderingMode==='normal'?'active':''} aria-pressed={orderingMode==='normal'} onClick={()=>actions.onChangeOrderingMode('normal')}>普通</button>
              <button type="button" className={orderingMode==='quick'?'active':''} aria-pressed={orderingMode==='quick'} onClick={()=>actions.onChangeOrderingMode('quick')}>快捷</button>
            </div>
            <button type="button" className={'ordering-quick-drink-toggle'+(quickDrink.pendingCount?' has-work':'')+(guidanceTarget==='quick-drink'?' flow-next':'')} aria-expanded={quickDrink.open} onClick={actions.onToggleQuickDrink}>快捷飲品 <b>{quickDrink.pendingCount}</b></button>
          </div>
        </div>
        {quickDrink.open?<section className="ordering-quick-drink-drawer" aria-label="快捷飲品">
          <header><div><small>QUICK DRINK</small><strong>{quickDrink.targetLabel?'正在補：'+quickDrink.targetLabel:'目前冇待補飲品'}</strong></div><span><button type="button" disabled={!quickDrink.pendingCount} onClick={actions.onOpenQuickDrinkTargets}>指定餐點</button><button type="button" onClick={actions.onToggleQuickDrink}>×</button></span></header>
          <div className="ordering-quick-drink-list">
            {quickDrink.choices.length?quickDrink.choices.map(choice=><button type="button" key={choice.id} disabled={!choice.enabled||!quickDrink.pendingCount} onClick={()=>actions.onSelectQuickDrink(choice.id)}><b>{choice.label}</b>{choice.priceAdjustmentLabel?<small>{choice.priceAdjustmentLabel}</small>:null}{choice.requiresConfiguration?<em>先設定</em>:null}</button>):<p>目前 Admin Combo 冇可用飲品 Choice。</p>}
          </div>
        </section>:null}
        {view.showCategories===false?null:<nav className="ordering-categories" aria-label="商品分類">
          {view.categories.map(category=><button type="button" key={category.id} aria-pressed={view.selectedCategoryId===category.id} className={view.selectedCategoryId===category.id?'active':''} onClick={()=>actions.onSelectCategory(category.id)}>{category.label}</button>)}
        </nav>}
        <section className="ordering-product-grid">{view.products.map(product=><ProductCard key={product.id} product={product} actions={actions} orderingMode={orderingMode} recentlyAdded={view.recentlyAddedProductId===product.id}/>)}</section>
      </>}
    </main>

    <aside key={view.cartPulseNonce} className={`ordering-cart${view.cartPulseNonce>0?' cart-updated':''}`} aria-label="購物車">
      <header className="ordering-cart-head">
        <div className="ordering-cart-order-id"><small>目前訂單</small><strong>#{view.cart.orderId}</strong><span>{itemCount?itemCount+' 件':'未有商品'}</span></div>
        <div className="ordering-cart-head-actions donor-head-actions">
          <button type="button" className="ordering-cart-cycle" onClick={()=>actions.onChangeCartView(view.cart.viewMode==='original'?'organized':'original')}>{view.cart.viewMode==='original'?'原單':'整理'}</button>
          <button type="button" className={`ordering-cart-cycle service ${view.cart.serviceMode}`} onClick={()=>actions.onChangeServiceMode(view.cart.serviceMode==='takeaway'?'dine-in':'takeaway')}>{view.cart.serviceMode==='takeaway'?'外賣':'堂食'}</button>
          <button type="button" className={`ordering-cart-cycle combine${view.cart.combineSimilar?' active':''}`} aria-pressed={view.cart.combineSimilar} onClick={actions.onToggleCombine}>組合 {view.cart.combineSimilar?'開':'關'}</button>
        </div>
      </header>
      <div className={`ordering-cart-lines ${view.cart.viewMode}`}>
        {view.cart.lines.length?(view.cart.viewMode==='original'
          ?view.cart.lines.map((line,index)=><CartLineRow key={line.id} line={line} index={index} highlighted={view.highlightedCartLineId===line.id||Boolean(line.sourceLineIds?.includes(view.highlightedCartLineId??''))} actions={actions} availability={availability}/>)
          :<OrganizedCart lines={view.cart.lines} highlightedLineId={view.highlightedCartLineId} actions={actions} availability={availability}/>
        ):<div className="ordering-cart-empty">未有商品</div>}
      </div>

      {view.cart.lines.length?<div className="ordering-cart-price-strip" aria-label="訂單金額">
        <span>餐點 <b>{view.cart.subtotalLabel}</b></span>
        {view.cart.packagingLabel!=='$0.00'?<span>包裝 <b>{view.cart.packagingLabel}</b></span>:null}
        {view.cart.discountLabel!=='$0.00'?<span>折扣 <b>{view.cart.discountLabel}</b></span>:null}
        <strong>{view.cart.totalLabel}</strong>
      </div>:null}

      {view.cart.lines.length?<div className="ordering-cart-secondary-actions active-cart">
        {availability.holdCart?<button type="button" onClick={actions.onHoldCart}>暫存</button>:<span/>}
        {availability.cancelCart?<button type="button" className="destructive" onClick={actions.onCancelCart}>取消</button>:<span/>}
      </div>:view.heldCartCount>0?<div className="ordering-cart-secondary-actions empty-cart">
        <button type="button" className="retrieve" onClick={actions.onOpenHeldOrders}>取回訂單 <b>{view.heldCartCount}</b></button>
      </div>:null}

      {view.cart.blockingMessage?<div className="ordering-cart-blocking" role="status">{view.cart.blockingMessage}</div>:null}
      {view.cart.lines.length?<button type="button" className={'ordering-checkout'+(guidanceTarget==='checkout'?' flow-next':'')} aria-label="結帳" disabled={!view.cart.checkoutEnabled} onClick={actions.onCheckout}>前往結帳　{view.cart.totalLabel}</button>:null}
    </aside>

    <footer className="ordering-workbar" aria-label="磨飯快捷工作">{view.workItems.map(item=>{
      const isGuided=guidanceTarget===item.id;
      return <button type="button" key={item.id} className={(item.count>0?'has-work':'')+(isGuided?' flow-next':'')} onClick={()=>actions.onOpenWorkItem(item.id)}><span>{item.label}</span><b>{item.count}</b></button>;
    })}</footer>
  </div>;
}
