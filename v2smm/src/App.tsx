import {useMemo,useState} from 'react';
import capabilities from './capabilities.json';
import {categories,channelHealthFixtures,dineSessions,exceptionFixtures,orderRows,products,workTickets,type Product} from './fixtures';

type View='order'|'work'|'orders'|'dine'|'more';
type Mode='ONLINE'|'OFFLINE'|'DEGRADED';
type SubmissionState='IDLE'|'PENDING'|'UNKNOWN';
type CartLine={id:number;name:string;config:string;quantity:number;attention?:string};

const commandCapabilities=capabilities.filter(item=>item.kind==='COMMAND_SHAPE');

export function App(){
  const [view,setView]=useState<View>('order');
  const [mode,setMode]=useState<Mode>('ONLINE');
  const [category,setCategory]=useState<string>('人氣');
  const [selected,setSelected]=useState<Product|null>(null);
  const [searchQuery,setSearchQuery]=useState('');
  const [selectedOptions,setSelectedOptions]=useState<Record<string,string[]>>({});
  const [cart,setCart]=useState<CartLine[]>([]);
  const [cartOpen,setCartOpen]=useState(false);
  const [submissionState,setSubmissionState]=useState<SubmissionState>('IDLE');
  const [submissionId]=useState(()=>`SMM-${Date.now().toString(36).toUpperCase()}`);
  const [notice,setNotice]=useState<string|null>(null);
  const [moreTool,setMoreTool]=useState<'sellability'|'business'|'reporting'|'printing'|'diagnostics'|'channels'|'capabilities'|null>(null);
  const [orderSegment,setOrderSegment]=useState<'active'|'history'>('active');
  const [query,setQuery]=useState('');
  const [sourceFilter,setSourceFilter]=useState('全部');

  const visibleProducts=products.filter(p=>{
    const categoryOk=category==='人氣'?p.category==='人氣'||p.id==='p2':p.category===category;
    const q=searchQuery.trim().toLowerCase();
    const searchOk=!q||[p.name,p.category,p.price].join(' ').toLowerCase().includes(q);
    return categoryOk&&searchOk;
  });
  const visibleOrders=orderRows.filter(row=>{
    const segmentOk=orderSegment==='active'?row.status!=='已完成':row.status==='已完成';
    const queryOk=!query||[row.code,row.source,row.status].join(' ').toLowerCase().includes(query.toLowerCase());
    const sourceOk=sourceFilter==='全部'||row.source===sourceFilter;
    return segmentOk&&queryOk&&sourceOk;
  });

  const showNotWired=(label:string)=>{
    setNotice(`${label}：NOT_WIRED｜呢一輪只保留操作形狀，唔會建立正式交易、派號、寫入 Store Kernel 或直連雲端。`);
  };

  const chooseProduct=(product:Product)=>{
    setSelected(product);
    setSelectedOptions({});
  };

  const addPreviewLine=()=>{
    if(!selected)return;
    const groups=[...(selected.modifierGroups??[]),...(selected.comboGroups??[])];
    for(const group of groups){
      const values=selectedOptions[group.label]??[];
      const min=group.min??(group.required?1:0);
      const max=group.max??1;
      if(values.length<min){setNotice(`請完成 ${group.label}：最少揀 ${min} 項。`);return;}
      if(values.length>max){setNotice(`${group.label}：最多揀 ${max} 項。`);return;}
    }
    const config=Object.entries(selectedOptions).filter(([,values])=>values.length).map(([k,values])=>`${k}：${values.join('、')}`).join(' · ')||'無額外設定';
    setCart(current=>[...current,{id:Date.now(),name:selected.name,config,quantity:1}]);
    setSelected(null);
    setSelectedOptions({});
    setNotice('已加入本機 Cart 預覽。未計價、未建立正式訂單。');
  };

  return <main className="app-shell" data-mode={mode.toLowerCase()}>
    <header className="topbar">
      <div className="brand-mark">磨</div>
      <div className="brand-copy"><strong>MFK SMM</strong><span>MF01 · 前線輔助終端 · 小米粒</span></div>
      <button className="state-pill" onClick={()=>setMode(mode==='ONLINE'?'OFFLINE':mode==='OFFLINE'?'DEGRADED':'ONLINE')} aria-label="切換展示連線狀態">
        <i/>{mode==='ONLINE'?'展示：已連線':mode==='OFFLINE'?'展示：離線':'展示：降級'}
      </button>
    </header>

    <section className="authority-strip" role="status">
      <b>Migration Mode</b><span>UI / Workflow / Capability Shape</span><em>所有 Command：NOT_WIRED</em>
    </section>

    {notice?<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice(null)}>收起</button></div>:null}

    {mode!=='ONLINE'?<section className={`recovery-banner ${mode.toLowerCase()}`}>
      <strong>{mode==='OFFLINE'?'離線展示狀態':'部分服務降級'}</strong>
      <span>{mode==='OFFLINE'?'只顯示最近已知畫面；唔會假裝可以正式提交。':'部分 readback 可能係 UNKNOWN / PARTIAL；安全操作必須等 authority 接通。'}</span>
      <button onClick={()=>showNotWired('重新確認')}>重新確認</button>
    </section>:null}

    <section className="stage">
      {view==='order'?<OrderView category={category} setCategory={setCategory} query={searchQuery} setQuery={setSearchQuery} visibleProducts={visibleProducts} chooseProduct={chooseProduct} cart={cart} openCart={()=>setCartOpen(true)}/>:null}
      {view==='work'?<WorkView onAction={showNotWired}/>:null}
      {view==='orders'?<OrdersView segment={orderSegment} setSegment={setOrderSegment} query={query} setQuery={setQuery} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} rows={visibleOrders} onAction={showNotWired}/>:null}
      {view==='dine'?<DineView onAction={showNotWired}/>:null}
      {view==='more'?<MoreView tool={moreTool} setTool={setMoreTool} onAction={showNotWired}/>:null}
    </section>

    <nav className="bottom-nav" aria-label="主要功能">
      <NavButton active={view==='order'} label="點單" glyph="＋" onClick={()=>setView('order')}/>
      <NavButton active={view==='work'} label="待處理" glyph="◎" badge="3" onClick={()=>setView('work')}/>
      <NavButton active={view==='orders'} label="訂單" glyph="▤" onClick={()=>setView('orders')}/>
      <NavButton active={view==='dine'} label="堂食" glyph="⌂" onClick={()=>setView('dine')}/>
      <NavButton active={view==='more'} label="更多" glyph="•••" onClick={()=>setView('more')}/>
    </nav>

    {selected?<ProductSheet product={selected} values={selectedOptions} setValue={(group,value,max)=>setSelectedOptions(current=>{const values=current[group]??[];const exists=values.includes(value);const next=exists?values.filter(item=>item!==value):max===1?[value]:values.length<max?[...values,value]:values;return {...current,[group]:next};})} onClose={()=>setSelected(null)} onAdd={addPreviewLine}/>:null}
    {cartOpen?<CartSheet cart={cart} submissionId={submissionId} submissionState={submissionState} setSubmissionState={setSubmissionState} onClose={()=>setCartOpen(false)} onRemove={id=>setCart(current=>current.filter(line=>line.id!==id))} onQuantity={(id,quantity)=>setCart(current=>current.map(line=>line.id===id?{...line,quantity:Math.max(1,quantity)}:line))} onAction={showNotWired}/>:null}
  </main>;
}

function OrderView({category,setCategory,query,setQuery,visibleProducts,chooseProduct,cart,openCart}:{category:string;setCategory:(v:string)=>void;query:string;setQuery:(v:string)=>void;visibleProducts:Product[];chooseProduct:(p:Product)=>void;cart:CartLine[];openCart:()=>void}){
  const itemCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <section className="page order-page">
    <header className="hero compact"><div><span>點單 · TRUSTED_STAFF</span><h1>快速建立點餐意圖</h1><small>SMM 只係受信任 Staff Order Source；正式 Menu / Quote / Order authority 仍然屬 SMT。</small></div><b className="tag">NOT_WIRED</b></header>
    <label className="search"><span>搜尋 Menu</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋商品／分類"/></label>
    <div className="category-rail">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    {visibleProducts.length?<div className="product-grid">{visibleProducts.map(product=><button key={product.id} className={`product-card ${product.unavailable?'disabled':''}`} disabled={product.unavailable} onClick={()=>chooseProduct(product)}><span className="product-avatar">{product.tone}</span><strong>{product.name}</strong><small>{product.unavailable?'暫停供應 · projection only':product.price}</small><i>{product.modifierGroups?.length?'可客製':''}{product.comboGroups?.length?' 套餐':''}</i></button>)}</div>:<section className="panel"><h2>零結果</h2><p className="callout">搵唔到商品。清除搜尋或者返回「人氣」；唔會白屏，唔會自行放寬到不可售商品。</p><button className="primary" onClick={()=>{setQuery('');setCategory('人氣')}}>返回人氣</button></section>}
    <button className="cart-bar" onClick={openCart}><div><b>{itemCount}</b><span>Cart 預覽</span></div><div><strong>Quote：等待 SMT</strong><small>只展示 workflow，不自行計價</small></div><em>查看</em></button>
  </section>;
}
function WorkView({onAction}:{onAction:(s:string)=>void}){
  return <section className="page">
    <header className="hero"><div><span>待處理</span><h1>前線製作／異常</h1><small>Read-only projection；SMM 唔持有 production / cancel / print authority。</small></div><div className="hero-count"><b>{workTickets.length}</b><small>張</small></div></header>

    <section className="panel">
      <h2>Exception / Pending Action Queue</h2>
      <p className="callout">只聚合要注意嘅事，deep-link 去責任頁；唔建立第二個 workflow engine。</p>
      {exceptionFixtures.map(item=><div className="list-row" key={item.id}><div><strong>{item.kind}</strong><small>{item.summary} · {item.route}</small></div><span className={item.state==='UNKNOWN'?'status unknown':item.state==='STALE'?'status warning':'status critical'}>{item.state}</span></div>)}
    </section>

    <div className="cards">{workTickets.map((ticket,index)=><article className={`work-card ${ticket.status==='稍有延誤'?'alert':''}`} key={ticket.code}><div className="work-main"><div className="eyebrow"><span>{ticket.age} · {ticket.source}</span><b>#{ticket.code}</b></div><h2>{ticket.items}</h2><p>工位：{ticket.route}</p><p>打包：{ticket.packing}</p><p>時間：{ticket.eta}</p>{ticket.status==='稍有延誤'?<p className="callout">Delay 只更新 ETA；唔會假裝 Ready。</p>:null}</div><div className="work-side"><span className={`status ${ticket.status==='稍有延誤'?'critical':ticket.status==='製作中'?'warning':'neutral'}`}>{ticket.status}</span>{index===0?<button onClick={()=>onAction('查看正式訂單')}>查看訂單</button>:null}</div></article>)}</div>
  </section>;
}
function OrdersView({segment,setSegment,query,setQuery,sourceFilter,setSourceFilter,rows,onAction}:{segment:'active'|'history';setSegment:(v:'active'|'history')=>void;query:string;setQuery:(v:string)=>void;sourceFilter:string;setSourceFilter:(v:string)=>void;rows:typeof orderRows;onAction:(s:string)=>void}){
  return <section className="page">
    <header className="hero"><div><span>訂單</span><h1>Result / Readback</h1><small>UI projection only；UNKNOWN 會保留，不會當 FAILED。</small></div><div className="hero-count"><b>{rows.length}</b><small>張</small></div></header>
    <div className="segmented"><button className={segment==='active'?'active':''} onClick={()=>setSegment('active')}>進行中</button><button className={segment==='history'?'active':''} onClick={()=>setSegment('history')}>歷史</button></div>
    <label className="search"><span>搜尋</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="訂單號／來源／狀態"/></label>
    <div className="source-filter" aria-label="訂單來源">{['全部','Keeta','現場','自家客戶端','電話'].map(source=><button key={source} className={sourceFilter===source?'active':''} onClick={()=>setSourceFilter(source)}>{source}</button>)}</div>
    <div className="cards">{rows.map(row=><article className="order-card" key={row.code}><div className="order-head"><div><small>{row.time} · {row.source}</small><h2>#{row.code}</h2></div><span className={`status ${row.readback==='UNKNOWN'?'unknown':row.readback==='PARTIAL'?'warning':'positive'}`}>{row.readback}</span></div><div className="order-meta"><span>{row.status}</span><b>{row.amount}</b><span>{row.items}</span></div>{row.note?<p>備註：{row.note}</p>:null}<div className="order-actions"><button onClick={()=>onAction('完成／交收')}>完成</button><button className="danger" onClick={()=>onAction('取消訂單')}>取消</button><button onClick={()=>onAction('重新 Readback')}>重新確認</button></div></article>)}</div>
  </section>;
}

function DineView({onAction}:{onAction:(s:string)=>void}){
  return <section className="page">
    <header className="hero"><div><span>堂食</span><h1>桌面／掛單</h1><small>保留 donor workflow shape；今輪零 live command。</small></div><b className="tag">NOT_WIRED</b></header>
    <article className="panel"><h2>開枱</h2><div className="field-grid"><label>人數<input defaultValue="2"/></label><label>枱號<input placeholder="例如 A1"/></label></div><button className="primary" onClick={()=>onAction('開枱')}>開枱</button></article>
    <div className="cards">{dineSessions.map(session=><article className="dine-card" key={session.table}><div><small>{session.opened}</small><h2>{session.table}</h2><span>{session.covers} 位 · {session.orders} 張單</span></div><button onClick={()=>onAction(`管理 ${session.table}`)}>管理</button></article>)}</div>
  </section>;
}

function MoreView({tool,setTool,onAction}:{tool:string|null;setTool:(v:any)=>void;onAction:(s:string)=>void}){
  const migrated=capabilities.filter(item=>item.status==='MIGRATED_SHAPE').length;
  return <section className="page">
    <header className="hero"><div><span>更多</span><h1>輔助營運工具</h1><small>只保留 SMM 真正需要嘅 read / assistive shape；Command 全部 NOT_WIRED。</small></div><div className="hero-count"><b>{capabilities.length}</b><small>能力</small></div></header>
    <div className="tool-grid">
      <Tool title="商品供應" detail="售罄／暫停／恢復" state="NOT_WIRED" onClick={()=>setTool('sellability')}/>
      <Tool title="Channel Health" detail="只讀來源／readback 狀態" state="SHAPE" onClick={()=>setTool('channels')}/>
      <Tool title="營業日" detail="Record / Classification only" state="NON_BLOCKING" onClick={()=>setTool('business')}/>
      <Tool title="營運報表" detail="營業額／訂單／AOV" state="SHAPE" onClick={()=>setTool('reporting')}/>
      <Tool title="列印管理" detail="狀態／incident presentation" state="NOT_WIRED" onClick={()=>setTool('printing')}/>
      <Tool title="診斷中心" detail="Failure / UNKNOWN / PARTIAL" state="SHAPE" onClick={()=>setTool('diagnostics')}/>
      <Tool title="Capability Registry" detail={`${migrated} shape · ${commandCapabilities.length} command`} state={String(capabilities.length)} onClick={()=>setTool('capabilities')}/>
    </div>
    {tool?<div className="drawer"><div className="drawer-head"><strong>{toolTitle(tool)}</strong><button onClick={()=>setTool(null)}>關閉</button></div>{tool==='capabilities'?<CapabilityRegistry/>:<ToolBody tool={tool} onAction={onAction}/>}</div>:null}
  </section>;
}
function Tool({title,detail,state,onClick}:{title:string;detail:string;state:string;onClick:()=>void}){return <button className="tool-card" onClick={onClick}><span>◆</span><strong>{title}</strong><small>{detail}</small><em>{state}</em></button>}

function ToolBody({tool,onAction}:{tool:string;onAction:(s:string)=>void}){
  if(tool==='sellability')return <><p className="callout">Product / Modifier / Combo quick-control shape。所有 mutation 明確 NOT_WIRED；SMM 唔係 sellability authority。</p><div className="list-row"><div><strong>紫米飯團</strong><small>目前：供應中</small></div><button onClick={()=>onAction('商品售罄')}>售罄</button></div><div className="list-row"><div><strong>限定午餐</strong><small>目前：暫停供應</small></div><button onClick={()=>onAction('恢復供應')}>恢復</button></div></>;
  if(tool==='channels')return <>{channelHealthFixtures.map(item=><div className="list-row" key={item.channel}><div><strong>{item.channel}</strong><small>{item.detail}</small></div><span className={item.state==='NOT_WIRED'?'status unknown':'status positive'}>{item.state}</span></div>)}<p className="callout">Channel Health 只係 read-only projection。Connected badge 永遠唔可以代替 authoritative readback。</p></>;
  if(tool==='business')return <><div className="metric-grid"><Metric label="Business Day" value="2026-09-21"/><Metric label="狀態" value="OPEN / 展示"/><Metric label="開始" value="05:00"/><Metric label="Readback" value="NOT_WIRED"/></div><p className="callout">BUSINESS_DAY = RECORD / CLASSIFICATION / REPORTING ONLY。永遠唔可以阻 Order / Checkout / Payment / Local Commit。</p></>;
  if(tool==='reporting')return <><div className="metric-grid"><Metric label="有效營業額" value="$6,420"/><Metric label="訂單" value="96"/><Metric label="平均訂單" value="$66.9"/><Metric label="Freshness" value="DEMO"/></div><p className="callout">只保留報表 UI shape；數字係 fixture，唔係 current system truth。</p></>;
  if(tool==='printing')return <><p className="callout">SMM 唔擁有實體打印 authority。只顯示 health / incident / retry presentation；真正 reprint 由 SMT authority 執行。</p><div className="list-row"><div><strong>#021 收據</strong><small>狀態：UNKNOWN</small></div><button onClick={()=>onAction('列印／重印')}>重印</button></div></>;
  return <><div className="diag-line"><span>Shell</span><b>PASS</b><small>0 ms</small></div><div className="diag-line"><span>Network</span><b className="warn">UNKNOWN</b><small>NOT_WIRED</small></div><div className="diag-line"><span>Order Readback</span><b className="warn">PARTIAL</b><small>projection only</small></div><button className="primary wide" onClick={()=>onAction('重新診斷')}>重新診斷</button></>;
}
function CapabilityRegistry(){
  const groups=[...new Set(capabilities.map(item=>item.group))];
  return <div className="registry">{groups.map(group=><section key={group}><h3>{group}</h3>{capabilities.filter(item=>item.group===group).map(item=><article key={item.id}><div><strong>{item.label}</strong><small>{item.id}</small></div><div><span>{item.surface}</span><em className={item.status==='NOT_WIRED'?'red':''}>{item.status}</em></div></article>)}</section>)}</div>;
}

function ProductSheet({product,values,setValue,onClose,onAdd}:{product:Product;values:Record<string,string[]>;setValue:(g:string,v:string,max:number)=>void;onClose:()=>void;onAdd:()=>void}){
  const groups=[...(product.modifierGroups??[]),...(product.comboGroups??[])];
  return <div className="overlay" role="presentation"><section className="sheet" role="dialog" aria-modal="true"><div className="sheet-grabber"/><header><div><span>Product / Modifier / Combo</span><h2>{product.name}</h2><small>{product.price} · 價格只係展示 label</small></div><button onClick={onClose}>✕</button></header>{groups.length?groups.map(group=>{const min=group.min??(group.required?1:0);const max=group.max??1;const selected=values[group.label]??[];return <section className="option-group" key={group.label}><div><strong>{group.label}</strong><span>{min===max&&max===1?'揀 1 項':`最少 ${min} · 最多 ${max}`}</span></div><div className="option-grid">{group.options.map(option=><button key={option} className={selected.includes(option)?'active':''} onClick={()=>setValue(group.label,option,max)}>{option}</button>)}</div><small>{selected.length>=min&&selected.length<=max?'目前選擇有效':'需要完成選擇'} · session-only</small></section>}):<p className="callout">呢件商品冇額外配置。</p>}<div className="sheet-actions"><button onClick={onClose}>返回</button><button className="primary" onClick={onAdd}>加入 Cart 預覽</button></div></section></div>;
}
function CartSheet({cart,submissionId,submissionState,setSubmissionState,onClose,onRemove,onQuantity,onAction}:{cart:CartLine[];submissionId:string;submissionState:SubmissionState;setSubmissionState:(v:SubmissionState)=>void;onClose:()=>void;onRemove:(id:number)=>void;onQuantity:(id:number,quantity:number)=>void;onAction:(s:string)=>void}){
  const itemCount=cart.reduce((sum,line)=>sum+line.quantity,0);
  return <div className="overlay"><section className="sheet cart-sheet"><div className="sheet-grabber"/><header><div><span>Cart / Checkout Draft</span><h2>本機意圖預覽</h2><small>SMM source = TRUSTED_STAFF · 無 pricing engine · 無 formal order authority</small></div><button onClick={onClose}>✕</button></header>
    {cart.length===0?<p className="empty">Cart 目前未有項目。</p>:<div className="cart-lines">{cart.map(line=><article key={line.id}><div><strong>{line.name}</strong><small>{line.config}</small>{line.attention?<p className="callout">{line.attention}</p>:null}</div><div><div className="qty-stepper"><button disabled={line.quantity<=1} onClick={()=>onQuantity(line.id,line.quantity-1)}>−</button><b>{line.quantity}</b><button onClick={()=>onQuantity(line.id,line.quantity+1)}>＋</button></div><button onClick={()=>onRemove(line.id)}>移除</button></div></article>)}</div>}
    <article className="quote-box"><span>Quote Preview</span><strong>等待 SMT Quote</strong><small>{itemCount} 件 · Price / Availability / revision 將來由同一 authority readback</small></article>
    <article className="pending-box"><span>Stable Submission Identity</span><strong>{submissionId}</strong><small>SESSION-ONLY identity shape；真正接線後同一 intent retry 必須沿用同一 identity。</small></article>
    <article className="pending-box"><span>Result Certainty</span><strong>{submissionState==='IDLE'?'NOT_SUBMITTED':submissionState}</strong><small>UNKNOWN ≠ FAILED。未 resolve 前禁止建立 New Attempt / New Order。</small></article>
    <div className="sheet-actions"><button onClick={onClose}>繼續點單</button><button className="primary" disabled={!cart.length} onClick={()=>{setSubmissionState('PENDING');onAction('正式落單／同一 submission handoff')}}>提交訂單（NOT_WIRED）</button></div>
    {submissionState!=='IDLE'?<div className="pending-actions"><button onClick={()=>setSubmissionState('UNKNOWN')}>展示 UNKNOWN</button><button onClick={()=>onAction('same-intent readback / retry')}>重新確認同一 Intent（NOT_WIRED）</button></div>:null}
  </section></div>;
}
function NavButton({active,label,glyph,badge,onClick}:{active:boolean;label:string;glyph:string;badge?:string;onClick:()=>void}){return <button className={active?'active':''} onClick={onClick}><span>{glyph}</span><small>{label}</small>{badge?<b>{badge}</b>:null}</button>}
function Metric({label,value}:{label:string;value:string}){return <article className="metric"><span>{label}</span><strong>{value}</strong></article>}
function toolTitle(tool:string){return ({sellability:'商品供應',channels:'Channel Health',business:'營業日',reporting:'營運報表',printing:'列印管理',diagnostics:'診斷中心',capabilities:'Capability Registry'} as Record<string,string>)[tool]??tool}
