import {useMemo,useState,type ReactNode} from 'react';
import {ActionFeedback,ConfirmDialog,DisabledReason,EmptyState,StatusTag} from '../../presentation/SmtUi.tsx';
import type {CartLineViewModel,OrderingProductViewModel,OrderingWorkspaceActions,OrderingWorkspaceViewModel,ServiceMode} from './ordering-workspace-model.ts';
import './ordering-workspace.css';

function ProductCard({product,actions,recentlyAdded,mode}:{product:OrderingProductViewModel;actions:OrderingWorkspaceActions;recentlyAdded:boolean;mode:'quick'|'standard'}){
  const onBody=()=>{
    if(!product.enabled)return;
    if(mode==='standard'||product.hasRequiredOptions)actions.onConfigureProduct(product.id);
    else actions.onAddProduct(product.id);
  };
  return <article className={`ordering-product-card ${product.imageUrl?'has-media':'text-only'}${product.enabled?'':' disabled'}${recentlyAdded?' recently-added':''}`}>
    <button type="button" className="ordering-product-body" aria-label={`${product.name}，${product.priceLabel}${product.requiresOptions?'，需要設定選項':''}`} disabled={!product.enabled} onClick={onBody}>
      {product.imageUrl?<span className="ordering-product-media" aria-hidden="true"><span>磨</span><img src={product.imageUrl} alt="" loading="lazy" decoding="async" onError={event=>event.currentTarget.remove()}/></span>:null}
      <span className="ordering-product-copy">
        <span className="ordering-product-topline">{product.badge?<small>{product.badge}</small>:product.hasRequiredOptions?<small className="configure">必選設定</small>:mode==='standard'?<small>開啟設定</small>:product.requiresOptions?<small className="quick">可快加 · 可設定</small>:<small className="quick">一按加入</small>}</span>
        <b>{product.name}</b><strong>{product.priceLabel}</strong>
      </span>
    </button>
    {product.enabled&&mode==='quick'&&product.requiresOptions&&!product.hasRequiredOptions?<button type="button" className="ordering-product-more" aria-label={`設定 ${product.name}`} onClick={()=>actions.onConfigureProduct(product.id)}>設定</button>:null}
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
  return <article className={`ordering-cart-line${highlighted?' line-updated':''}`} aria-label={`購物籃商品 ${line.name}`}>
    <div className="ordering-line-identity">
      <span className="ordering-line-sequence">{index+1}</span>
      {availability.lineServiceMode?<button type="button" className={`ordering-line-mode ${line.serviceMode}`} onClick={()=>actions.onChangeLineServiceMode(line.id,nextMode)} aria-label={`第 ${index+1} 項切換外賣堂食`}>{line.serviceMode==='takeaway'?'外':'堂'}</button>:<span className={`ordering-line-mode ${line.serviceMode}`} aria-label={line.serviceMode==='takeaway'?'外賣':'堂食'}>{line.serviceMode==='takeaway'?'外':'堂'}</span>}
    </div>
    {availability.lineEdit?<button type="button" className="ordering-line-copy ordering-line-copy-button" onClick={()=>actions.onEditCartLine(line.id)} aria-label={`修改 ${line.name}`}><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:<small>按商品名稱修改設定</small>}</button>:<div className="ordering-line-copy"><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>}
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
          <span><strong>{group.label}</strong><small>{group.lines.length} 款 · {quantity} 件</small></span><b aria-hidden="true">{hidden?'＋':'−'}</b>
        </button>
        {!hidden?<div className="ordering-cart-group-lines">{group.lines.map(({line,index})=><CartLineRow key={line.id} line={line} index={index} highlighted={highlightedLineId===line.id} actions={actions} availability={availability}/>)}</div>:null}
      </section>;
    })}
  </div>;
}

export function OrderingWorkspace({view,actions,centerPanel}:{view:OrderingWorkspaceViewModel;actions:OrderingWorkspaceActions;centerPanel?:{readonly title:string;readonly body:ReactNode;readonly onClose:()=>void}|null}){
  const [cancelOpen,setCancelOpen]=useState(false);
  const availability=view.actionAvailability??{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true};
  const serviceModes=view.serviceModes??{takeaway:true,dineIn:true};
  const itemCount=view.cart.lines.reduce((sum,line)=>sum+line.quantity,0);
  const checkoutReason=!view.cart.lines.length?'先選擇商品，加入購物籃後就可以結帳。':!view.cart.checkoutEnabled?'目前用餐方式暫停接單，請選擇可用方式。':'';

  return <div className={`ordering-workspace${centerPanel?' panel-open':''}`}>
    <main className={`ordering-catalog${centerPanel?' ordering-catalog--panel':''}`} aria-label={centerPanel?centerPanel.title:'點單商品'}>
      {centerPanel?<section className="ordering-center-panel">
        <header className="ordering-center-panel-head"><div><small>即時設定</small><strong>{centerPanel.title}</strong><span>選項、數量同價錢會即時更新；必選完成先可以儲存。</span></div><button type="button" aria-label="關閉設定" onClick={centerPanel.onClose}>×</button></header>
        <div className="ordering-center-panel-body">{centerPanel.body}</div>
      </section>:<>
        <header className="ordering-task-header">
          <div><span>點單</span><h1>一按加入，有必選先停低</h1><p>快速模式適合繁忙時段；普通模式每件商品都先核對設定。</p></div>
          <div className="ordering-source-status"><StatusTag tone="success">本機可用</StatusTag>{view.menuRevisionLabel?<small>{view.menuRevisionLabel}</small>:null}</div>
        </header>

        {view.feedbackMessage?<ActionFeedback tone="success" title={view.feedbackMessage} detail={`購物籃而家有 ${itemCount} 件商品；可以繼續揀，或者前往結帳。`}/>:null}
        {view.operationalNotice?<ActionFeedback tone="warning" title="營運提醒" detail={view.operationalNotice}/>:null}

        <section className="ordering-command-bar" aria-label="點單模式與快捷區">
          <div className="ordering-mode-switch" role="group" aria-label="商品點選模式">
            <span><b>點選模式</b><small>{view.orderingMode==='quick'?'冇必選就直接加入':'每件商品先打開設定'}</small></span>
            <div><button type="button" className={view.orderingMode==='quick'?'active':''} aria-pressed={view.orderingMode==='quick'} onClick={()=>actions.onChangeOrderingMode('quick')}>快速</button><button type="button" className={view.orderingMode==='standard'?'active':''} aria-pressed={view.orderingMode==='standard'} onClick={()=>actions.onChangeOrderingMode('standard')}>普通</button></div>
          </div>
          <div className="ordering-work-items">
            {view.workItems.map(item=><button type="button" key={item.id} className={`${item.tone}${item.active?' active':''}`} aria-pressed={item.active} disabled={!item.enabled} onClick={()=>actions.onOpenWorkItem(item.id)}>
              <span><b>{item.label}</b><small>{item.description}</small></span><strong>{item.count}</strong><em>{item.statusLabel}</em>
            </button>)}
          </div>
        </section>

        <section className="ordering-find-products" aria-label="搜尋及篩選商品">
          <label className="ordering-search"><span aria-hidden="true">⌕</span><input type="search" value={view.searchQuery} onChange={event=>actions.onSearchQuery(event.target.value)} placeholder="搜尋商品名稱" aria-label="搜尋商品"/>{view.searchQuery?<button type="button" aria-label="清除搜尋" onClick={()=>actions.onSearchQuery('')}>×</button>:null}</label>
          {view.showCategories===false?null:<nav className="ordering-categories" aria-label="商品分類">
            {view.categories.map(category=><button type="button" key={category.id} aria-pressed={view.selectedCategoryId===category.id} className={view.selectedCategoryId===category.id?'active':''} onClick={()=>actions.onSelectCategory(category.id)}>{category.label}</button>)}
          </nav>}
        </section>

        {view.products.length
          ?<section className="ordering-product-grid" aria-live="polite">{view.products.map(product=><ProductCard key={product.id} product={product} actions={actions} mode={view.orderingMode} recentlyAdded={view.recentlyAddedProductId===product.id}/>)}</section>
          :<EmptyState icon="⌕" title="搵唔到商品" detail="試下清除搜尋，或者選擇其他分類。" actionLabel="清除搜尋" onAction={()=>actions.onSearchQuery('')}/>}
      </>}
    </main>

    <aside key={view.cartPulseNonce} className={`ordering-cart${view.cartPulseNonce>0?' cart-updated':''}`} aria-label="購物籃">
      <header className="ordering-cart-head">
        <div className="ordering-cart-order-id"><small>目前訂單</small><strong>#{view.cart.orderId}</strong><span>{itemCount?`${itemCount} 件商品`:'等待加入商品'}</span></div>
        <ServiceToggle value={view.cart.serviceMode} onChange={actions.onChangeServiceMode} availability={serviceModes}/>
      </header>
      {view.cart.lines.length?<div className="ordering-cart-view-row"><span>核對商品</span><div className="ordering-cart-view-toggle" role="group" aria-label="購物籃檢視"><button type="button" className={view.cart.viewMode==='original'?'active':''} aria-pressed={view.cart.viewMode==='original'} onClick={()=>actions.onChangeCartView('original')}>逐項</button><button type="button" className={view.cart.viewMode==='organized'?'active':''} aria-pressed={view.cart.viewMode==='organized'} onClick={()=>actions.onChangeCartView('organized')}>按類整理</button></div></div>:null}
      <div className={`ordering-cart-lines ${view.cart.viewMode}`}>
        {view.cart.lines.length?(view.cart.viewMode==='original'
          ?view.cart.lines.map((line,index)=><CartLineRow key={line.id} line={line} index={index} highlighted={view.highlightedCartLineId===line.id} actions={actions} availability={availability}/>)
          :<OrganizedCart lines={view.cart.lines} highlightedLineId={view.highlightedCartLineId} actions={actions} availability={availability}/>
        ):<EmptyState icon="＋" title="購物籃仲未有商品" detail="由左邊揀一件商品開始；需要設定嘅商品會逐步帶你完成。"/>}
      </div>
      {view.cart.lines.length?<>
        <div className="ordering-cart-facts"><span><small>小計</small><b>{view.cart.subtotalLabel}</b></span><span><small>包裝</small><b>{view.cart.packagingLabel}</b></span><span><small>折扣</small><b>{view.cart.discountLabel}</b></span></div>
        <div className="ordering-cart-total"><span>應付總額</span><strong>{view.cart.totalLabel}</strong></div>
        {availability.holdCart||availability.cancelCart?<div className={`ordering-cart-secondary-actions${!availability.cancelCart?' single':''}`}>{availability.holdCart?<button type="button" onClick={actions.onHoldCart}>{view.cart.lines.length?'暫存訂單':'取回訂單'}</button>:null}{availability.cancelCart?<button type="button" className="destructive" onClick={()=>setCancelOpen(true)}>取消呢張單</button>:null}</div>:null}
      </>:null}
      {!view.cart.checkoutEnabled?<DisabledReason>{checkoutReason}</DisabledReason>:null}
      <button type="button" className="ordering-checkout" disabled={!view.cart.checkoutEnabled} onClick={actions.onCheckout}>{view.cart.checkoutEnabled?`前往結帳 ${view.cart.totalLabel}`:'加入商品後前往結帳'}</button>
    </aside>

    <ConfirmDialog open={cancelOpen} title="取消目前訂單？" description="購物籃入面嘅商品會全部移除。呢個動作唔會建立正式訂單。" confirmLabel="確認取消" tone="danger" onClose={()=>setCancelOpen(false)} onConfirm={()=>{actions.onCancelCart();setCancelOpen(false)}}/>
  </div>;
}
