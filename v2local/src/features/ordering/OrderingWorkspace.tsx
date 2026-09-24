import {useMemo,useState,type ReactNode} from 'react';
import {ActionFeedback,ConfirmDialog,DisabledReason} from '../../presentation/SmtUi.tsx';
import type {CartLineViewModel,OrderingProductViewModel,OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './ordering-workspace-model.ts';
import './ordering-workspace.css';

function QueueStrip({title,kind,orders,onOpen}:{title:string;kind:'pending'|'active';orders:OrderingWorkspaceViewModel['pendingOrders'];onOpen:(kind:'pending'|'active',id:string)=>void}){
  const tone=kind==='pending'?'attention':'provider';
  return <section className={`ordering-queue-group tone-${tone}`} aria-label={title}>
    <header><strong>{title}</strong><span>{orders.length}</span></header>
    <div className="ordering-queue-list">
      {orders.length?orders.map(order=><button type="button" key={order.id} className={order.demo?'is-demo':''} onClick={()=>order.demo?undefined:onOpen(kind,order.id)} aria-disabled={order.demo||undefined}>
        <span><b>#{order.orderId}</b><strong>{order.sourceLabel}</strong>{order.demo?<em>示範</em>:null}</span>
        <span><small>{order.itemCount} 件</small><em>{order.waitLabel}</em>{order.etaLabel?<i>{order.etaLabel}</i>:null}</span>
      </button>):<p>0</p>}
    </div>
  </section>;
}

function ProductCard({product,actions,recentlyAdded,mode}:{product:OrderingProductViewModel;actions:OrderingWorkspaceActions;recentlyAdded:boolean;mode:'quick'|'standard'}){
  const onBody=()=>{
    if(!product.enabled)return;
    if(mode==='standard'||product.hasRequiredOptions)actions.onConfigureProduct(product.id);
    else actions.onAddProduct(product.id);
  };
  return <article className={`ordering-product-card text-only${product.enabled?'':' disabled'}${recentlyAdded?' recently-added':''}`}>
    <button type="button" className="ordering-product-body" aria-label={`${product.name}，${product.priceLabel}${product.requiresOptions?'，有選項':''}`} disabled={!product.enabled} onClick={onBody}>
      <span className="ordering-product-copy">
        <span className="ordering-product-topline">{product.badge?<small>{product.badge}</small>:product.hasRequiredOptions?<small className="configure">必選</small>:null}</span>
        <b>{product.name}</b><strong>{product.priceLabel}</strong>
      </span>
    </button>
    {product.enabled&&product.requiresOptions&&!product.hasRequiredOptions?<button type="button" className="ordering-product-more" aria-label={`設定 ${product.name}`} onClick={()=>actions.onConfigureProduct(product.id)}>設定</button>:null}
  </article>;
}

function CartLineRow({line,index,highlighted,actions,availability}:{line:CartLineViewModel;index:number;highlighted:boolean;actions:OrderingWorkspaceActions;availability:NonNullable<OrderingWorkspaceViewModel['actionAvailability']>}){
  const nextMode:ServiceMode=line.serviceMode==='takeaway'?'dine-in':'takeaway';
  const modeLabel=line.serviceMode==='takeaway'?'外':'堂';
  const sourceLineIds=line.sourceLineIds??[line.id];
  const fallbackDetail=!line.optionDetail&&!line.comboDetail&&!line.note?line.detail:undefined;
  const content=<>
    <b>{line.name}</b>
    {line.optionDetail||fallbackDetail?<small className="ordering-line-option">{line.optionDetail??fallbackDetail}</small>:null}
    {line.comboDetail?<small className="ordering-line-combo">套餐：{line.comboDetail}</small>:null}
    {line.note?<small className="ordering-line-note">備註：{line.note}</small>:null}
  </>;
  const identity=<>
    <span className="ordering-line-sequence">{index+1}</span>
    <span className={`ordering-line-mode ${line.serviceMode}`}>{modeLabel}</span>
  </>;
  return <article className={`ordering-cart-line${highlighted?' line-updated':''}`} aria-label={`購物籃商品 ${line.name}`}>
    {availability.lineServiceMode
      ?<button type="button" className="ordering-line-identity" onClick={()=>actions.onChangeLineServiceMode(sourceLineIds,nextMode)} aria-label={`第 ${index+1} 項，${line.serviceMode==='takeaway'?'外賣':'堂食'}，按一下切換為${nextMode==='takeaway'?'外賣':'堂食'}`}>{identity}</button>
      :<div className="ordering-line-identity" aria-label={`第 ${index+1} 項，${line.serviceMode==='takeaway'?'外賣':'堂食'}`}>{identity}</div>}
    {availability.lineEdit?<button type="button" className="ordering-line-copy ordering-line-copy-button" onClick={()=>actions.onEditCartLine(sourceLineIds[0]??line.id)} aria-label={`修改 ${line.name}`}>{content}</button>:<div className="ordering-line-copy">{content}</div>}
    <div className="ordering-line-qty">
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(sourceLineIds,-1)} aria-label={`減少 ${line.name}`}>−</button>:null}
      <strong>{line.quantity}</strong>
      {availability.lineQuantity?<button type="button" onClick={()=>actions.onAdjustLineQuantity(sourceLineIds,1)} aria-label={`增加 ${line.name}`}>＋</button>:null}
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
          <span><strong>{group.label}</strong><small>{group.lines.length} 款 · {quantity} 件</small></span><b aria-hidden="true">{hidden?'＋':'−'}</b>
        </button>
        {!hidden?<div className="ordering-cart-group-lines">{group.lines.map(({line,index})=><CartLineRow key={line.id} line={line} index={index} highlighted={highlightedLineId===line.id||(line.sourceLineIds?.includes(highlightedLineId??'')??false)} actions={actions} availability={availability}/>)}</div>:null}
      </section>;
    })}
  </div>;
}

export function OrderingWorkspace({view,actions,centerPanel}:{view:OrderingWorkspaceViewModel;actions:OrderingWorkspaceActions;centerPanel?:{readonly title:string;readonly body:ReactNode;readonly onClose:()=>void}|null}){
  const [cancelOpen,setCancelOpen]=useState(false);
  const availability=view.actionAvailability??{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true};
  const serviceModes=view.serviceModes??{takeaway:true,dineIn:true};
  const wholeNextMode:ServiceMode=view.cart.serviceMode==='takeaway'?'dine-in':'takeaway';
  const wholeNextAllowed=wholeNextMode==='takeaway'?serviceModes.takeaway:serviceModes.dineIn;
  const itemCount=view.cart.lines.reduce((sum,line)=>sum+line.quantity,0);
  const checkoutReason=!view.cart.lines.length?'先選擇商品，加入購物籃後就可以結帳。':!view.cart.checkoutEnabled?'目前用餐方式暫停接單，請選擇可用方式。':'';

  return <div className={`ordering-workspace${centerPanel?' panel-open':''}`}>
    <main className="ordering-catalog" aria-label="點單商品">
      <section className="ordering-queue-deck" aria-label="訂單工作列">
        <QueueStrip title="待處理" kind="pending" orders={view.pendingOrders} onOpen={actions.onOpenQueueOrder}/>
        <QueueStrip title="Keeta" kind="active" orders={view.activeOrders} onOpen={actions.onOpenQueueOrder}/>
      </section>

      {view.operationalNotice?<ActionFeedback tone="warning" title={view.operationalNotice}/>:null}
      {view.feedbackMessage?<ActionFeedback tone="success" title={view.feedbackMessage}/>:null}

      {view.showCategories===false?null:<nav
        className={`ordering-categories rows-${view.categoryRows}`}
        aria-label="商品分類"
        style={{gridTemplateColumns:`repeat(${view.categoryColumns},minmax(0,1fr))`}}
      >
        {view.categories.map(category=><button type="button" key={category.id} aria-pressed={view.selectedCategoryId===category.id} className={view.selectedCategoryId===category.id?'active':''} onClick={()=>actions.onSelectCategory(category.id)}>{category.label}</button>)}
      </nav>}

      {view.products.length
        ?<section className="ordering-product-grid" aria-live="polite">{view.products.map(product=><ProductCard key={product.id} product={product} actions={actions} mode={view.orderingMode} recentlyAdded={view.recentlyAddedProductId===product.id}/>)}</section>
        :<div className="ordering-products-empty">此分類未有可顯示商品</div>}

      <footer className="ordering-workbar" aria-label="點單輔助工作區">
        {view.workItems.map(item=><button type="button" key={item.id} className={`${item.tone}${item.active?' active':''}`} aria-pressed={item.active} disabled={!item.enabled} onClick={()=>actions.onOpenWorkItem(item.id)}>
          <span>{item.label}</span><b>{item.count}</b>
        </button>)}
      </footer>
    </main>
    <aside key={view.cartPulseNonce} className={`ordering-cart${view.cartPulseNonce>0?' cart-updated':''}`} aria-label="購物籃">
      <header className="ordering-cart-head">
        <div className="ordering-cart-order-id"><small>目前訂單</small><strong>#{view.cart.orderId}</strong><span>{itemCount?`${itemCount} 件商品`:'等待加入商品'}</span></div>
      </header>
      {view.cart.lines.length?<div className="ordering-cart-controls" aria-label="購物車顯示與用餐方式">
        <button type="button" className="ordering-cart-cycle" aria-label={`目前${view.cart.viewMode==='original'?'原單':'整理'}，按一下切換`} onClick={()=>actions.onChangeCartView(view.cart.viewMode==='original'?'organized':'original')}>
          <small>顯示</small><b>{view.cart.viewMode==='original'?'原單':'整理'}</b>
        </button>
        <button type="button" className={`ordering-cart-cycle service ${view.cart.serviceMode}`} disabled={!wholeNextAllowed} aria-label={`目前${view.cart.serviceMode==='takeaway'?'外賣':'堂食'}，按一下切換`} onClick={()=>actions.onChangeServiceMode(wholeNextMode)}>
          <small>全單</small><b>{view.cart.serviceMode==='takeaway'?'外賣':'堂食'}</b>
        </button>
        <button type="button" className={`ordering-cart-cycle combine${view.cart.combineSimilar?' active':''}`} aria-pressed={view.cart.combineSimilar} onClick={actions.onToggleCombine}>
          <small>相同商品</small><b>組合 {view.cart.combineSimilar?'開':'關'}</b>
        </button>
      </div>:null}
      <div className={`ordering-cart-lines ${view.cart.viewMode}`}>
        {view.cart.lines.length?(view.cart.viewMode==='original'
          ?view.cart.lines.map((line,index)=><CartLineRow key={line.id} line={line} index={index} highlighted={view.highlightedCartLineId===line.id||(line.sourceLineIds?.includes(view.highlightedCartLineId??'')??false)} actions={actions} availability={availability}/>)
          :<OrganizedCart lines={view.cart.lines} highlightedLineId={view.highlightedCartLineId} actions={actions} availability={availability}/>
        ):<div className="ordering-cart-empty">購物籃未有商品</div>}
      </div>
      {view.cart.lines.length?<>
        <div className="ordering-cart-facts"><span><small>小計</small><b>{view.cart.subtotalLabel}</b></span><span><small>包裝</small><b>{view.cart.packagingLabel}</b></span><span><small>折扣</small><b>{view.cart.discountLabel}</b></span></div>
        <div className="ordering-cart-total"><span>應付總額</span><strong>{view.cart.totalLabel}</strong></div>
        {availability.holdCart||availability.cancelCart?<div className={`ordering-cart-secondary-actions${!availability.cancelCart?' single':''}`}>{availability.holdCart?<button type="button" onClick={actions.onHoldCart}>{view.cart.lines.length?'暫存訂單':'取回訂單'}</button>:null}{availability.cancelCart?<button type="button" className="destructive" onClick={()=>setCancelOpen(true)}>取消呢張單</button>:null}</div>:null}
      </>:null}
      {!view.cart.checkoutEnabled?<DisabledReason>{checkoutReason}</DisabledReason>:null}
      <button type="button" className="ordering-checkout" disabled={!view.cart.checkoutEnabled} onClick={actions.onCheckout}>{view.cart.checkoutEnabled?`前往結帳 ${view.cart.totalLabel}`:'加入商品後前往結帳'}</button>
    </aside>

    {centerPanel?<div className="ordering-center-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)centerPanel.onClose()}}>
      <section className="ordering-center-panel" role="dialog" aria-modal="true" aria-label={centerPanel.title}>
        <header className="ordering-center-panel-head"><div><strong>{centerPanel.title}</strong></div><button type="button" aria-label="關閉設定" onClick={centerPanel.onClose}>×</button></header>
        <div className="ordering-center-panel-body">{centerPanel.body}</div>
      </section>
    </div>:null}

    <ConfirmDialog open={cancelOpen} title="取消目前訂單？" description="購物籃入面嘅商品會全部移除。呢個動作唔會建立正式訂單。" confirmLabel="確認取消" tone="danger" onClose={()=>setCancelOpen(false)} onConfirm={()=>{actions.onCancelCart();setCancelOpen(false)}}/>
  </div>;
}
