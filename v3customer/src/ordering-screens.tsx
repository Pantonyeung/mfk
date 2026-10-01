import {useMemo,useState} from 'react';
import {CUSTOMER_V3_ASSETS as A} from './assets';
import {COLLECTION_LABELS,PREVIEW_PRODUCTS,jarTotal} from './preview-data';
import type {JarItem,MenuCollection,PreviewProduct} from './preview-data';

const BackTitle=({title,onBack,eyebrow}:Readonly<{title:string;onBack:()=>void;eyebrow?:string}>)=><div className="screen-title">
  <button type="button" onClick={onBack} aria-label="返回">‹</button>
  <span>{eyebrow&&<small>{eyebrow}</small>}<h1>{title}</h1></span>
</div>;

const Money=({value}:Readonly<{value:number}>)=><b className="money">${value}</b>;

export function MenuScreen({collection,onCollection,onOpenProduct,onBack}:Readonly<{
  collection:MenuCollection;
  onCollection:(value:MenuCollection)=>void;
  onOpenProduct:(id:string)=>void;
  onBack:()=>void;
}>){
  const products=useMemo(()=>PREVIEW_PRODUCTS.filter(product=>collection==='all'||product.tags.includes(collection)),[collection]);
  return <section className="app-screen menu-screen" aria-labelledby="menu-title">
    <BackTitle title="菜單" onBack={onBack}/>
    <div className="collection-hero">
      <small>今日手作</small>
      <h2 id="menu-title">{COLLECTION_LABELS[collection]}</h2>
      <p>{collection==='pickup'?'揀選可以較快準備嘅餐點':'由新鮮食材開始，揀一餐令自己開心嘅美味。'}</p>
    </div>
    <div className="chip-row" role="group" aria-label="菜單分類">
      {(Object.keys(COLLECTION_LABELS) as MenuCollection[]).map(value=><button
        type="button"
        className={value===collection?'selected':''}
        aria-pressed={value===collection}
        key={value}
        onClick={()=>onCollection(value)}
      >{COLLECTION_LABELS[value]}</button>)}
    </div>
    {products.length?<div className="product-list">
      {products.map((product,index)=><button className={index===0?'product-card featured-product':'product-card'} type="button" key={product.id} onClick={()=>onOpenProduct(product.id)}>
        <img src={product.image} alt="" loading={index===0?'eager':'lazy'} decoding="async"/>
        <span><small>{index===0?'主廚推薦':'手作輕食'}</small><strong>{product.name}</strong><em>{product.description}</em><span><Money value={product.price}/><i>約 {product.pickupMinutes} 分鐘可取</i></span></span>
        <b aria-hidden="true">›</b>
      </button>)}
    </div>:<div className="empty-state" role="status"><span>⌕</span><h2>暫時未有餐點</h2><p>試下其他分類，或者稍後再嚟睇。</p><button type="button" onClick={()=>onCollection('all')}>查看全部</button></div>}
  </section>;
}

export function ProductScreen({product,onBack,onAdd}:Readonly<{
  product:PreviewProduct;
  onBack:()=>void;
  onAdd:(item:JarItem)=>void;
}>){
  const [step,setStep]=useState(0);
  const [combo,setCombo]=useState<JarItem['combo']>('單點');
  const [options,setOptions]=useState<string[]>(['原味']);
  const [quantity,setQuantity]=useState(1);
  const deltas:Record<JarItem['combo'],number>={'單點':0,'配飲品':40,'配小食＋飲品':80};
  const toggleOption=(value:string)=>setOptions(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
  const total=(product.price+deltas[combo]+(options.includes('加蛋')?15:0)+(options.includes('加芝士')?20:0))*quantity;

  return <section className="app-screen product-screen" aria-labelledby="product-title">
    <BackTitle title={step===0?'餐點詳情':step===1?'升級組合':'選擇口味'} eyebrow={`${step+1} / 3`} onBack={()=>step?setStep(value=>value-1):onBack()}/>
    {step===0&&<>
      <div className="product-hero"><img src={product.image} alt=""/><button type="button" aria-label="收藏餐點">♡</button></div>
      <div className="product-copy"><small>手作推介</small><h2 id="product-title">{product.name}</h2><p>{product.description}</p><div><Money value={product.price}/><span>◷ 約 {product.pickupMinutes} 分鐘可取</span></div></div>
    </>}
    {step===1&&<div className="option-stack" role="radiogroup" aria-label="升級組合">
      <p>揀一個最啱今日心情嘅配搭。</p>
      {(['單點','配飲品','配小食＋飲品'] as JarItem['combo'][]).map(value=><button type="button" role="radio" aria-checked={combo===value} className={combo===value?'selected':''} key={value} onClick={()=>setCombo(value)}>
        <i/><span><strong>{value}</strong><small>{value==='單點'?'只要主餐':value==='配飲品'?'主餐＋精選飲品':'主餐＋小食＋精選飲品'}</small></span><Money value={deltas[value]}/>
      </button>)}
    </div>}
    {step===2&&<div className="option-stack taste-options">
      <h2>必須選擇</h2>
      <div className="choice-grid" role="radiogroup" aria-label="口味">
        {['原味','少飯'].map(value=><button type="button" role="radio" aria-checked={options.includes(value)} className={options.includes(value)?'selected':''} key={value} onClick={()=>setOptions(current=>[...current.filter(item=>item!=='原味'&&item!=='少飯'),value])}>{value}</button>)}
      </div>
      <h2>可以加配</h2>
      {['加蛋','加芝士'].map((value,index)=><button type="button" role="checkbox" aria-checked={options.includes(value)} className={options.includes(value)?'selected add-on-row':'add-on-row'} key={value} onClick={()=>toggleOption(value)}><i/><strong>{value}</strong><Money value={index?20:15}/></button>)}
      <label className="note-field">特別備註（選填）<textarea rows={2} placeholder="例如：不要蔥、少辣"/></label>
      <div className="quantity-row"><strong>數量</strong><span><button type="button" onClick={()=>setQuantity(value=>Math.max(1,value-1))} aria-label="減少數量">−</button><b>{quantity}</b><button type="button" onClick={()=>setQuantity(value=>value+1)} aria-label="增加數量">＋</button></span></div>
    </div>}
    <div className="sticky-action"><span><small>合計</small><Money value={total}/></span>{step<2?<button type="button" onClick={()=>setStep(value=>value+1)}>下一步 <b aria-hidden="true">›</b></button>:<button type="button" onClick={()=>onAdd({product,combo,options:Object.freeze([...options]),quantity})}>加入記憶罐</button>}</div>
  </section>;
}

export function JarScreen({item,onBack,onBrowse,onQuantity,onCheckout}:Readonly<{
  item:JarItem|null;
  onBack:()=>void;
  onBrowse:()=>void;
  onQuantity:(value:number)=>void;
  onCheckout:()=>void;
}>){
  return <section className="app-screen jar-screen" aria-labelledby="jar-title">
    <BackTitle title="記憶罐" onBack={onBack}/>
    <div className={item?'jar-heading has-items':'jar-heading is-empty'}><img src={item?A.memoryJarPartial:A.memoryJarEmpty} alt=""/><div><h2 id="jar-title">{item?'美味已收藏':'記憶罐空空的'}</h2><p>{item?'確認好餐點，就可以繼續落單。':'遇見想食嘅餐點，就放入記憶罐。'}</p></div></div>
    {item?<>
      <article className="jar-item"><img src={item.product.image} alt=""/><div><h3>{item.product.name}</h3><p>{item.combo}・{item.options.join('・')}</p><Money value={jarTotal(item)}/></div><div className="mini-stepper"><button type="button" onClick={()=>onQuantity(Math.max(1,item.quantity-1))} aria-label="減少數量">−</button><b>{item.quantity}</b><button type="button" onClick={()=>onQuantity(item.quantity+1)} aria-label="增加數量">＋</button></div></article>
      <label className="note-field">整張訂單備註（選填）<textarea rows={3} placeholder="有需要先話俾舖頭知"/></label>
      <div className="summary-card"><span>小計</span><Money value={jarTotal(item)}/><span>預計取餐</span><b>約 30 分鐘</b></div>
    </>:<div className="empty-state jar-empty-state"><img src={A.memoryJarEmpty} alt="空的記憶罐"/><h2>記憶罐仲係空嘅</h2><p>遇見想食嘅餐點，就收藏入嚟。</p><button type="button" onClick={onBrowse}>開始揀餐</button></div>}
    {item&&<div className="sticky-action"><span><small>合計</small><Money value={jarTotal(item)}/></span><button type="button" onClick={onCheckout}>繼續落單 <b aria-hidden="true">›</b></button></div>}
  </section>;
}

export function CheckoutScreen({item,onBack,onHome,onOrder}:Readonly<{
  item:JarItem;
  onBack:()=>void;
  onHome:()=>void;
  onOrder:()=>void;
}>){
  const [step,setStep]=useState(0);
  const [payment,setPayment]=useState<'cash'|'electronic'>('electronic');
  const [proofName,setProofName]=useState('');
  const titles=['取餐資料','付款方式','確認落單','等候舖頭確認'];
  const next=()=>setStep(value=>Math.min(3,value+1));
  return <section className="app-screen checkout-screen" aria-label={titles[step]}>
    <BackTitle title={titles[step]} eyebrow={step<3?`${step+1} / 3`:'訂單進度'} onBack={()=>step?setStep(value=>value-1):onBack()}/>
    {step<3&&<div className="progress-steps" aria-label="落單進度"><i className={step>=0?'done':''}>1</i><span/><i className={step>=1?'done':''}>2</i><span/><i className={step>=2?'done':''}>3</i></div>}
    {step===0&&<div className="checkout-stack">
      <label>稱呼<input defaultValue="陳先生" autoComplete="name"/></label>
      <label>電話<input defaultValue="9123 4567" inputMode="tel" autoComplete="tel"/></label>
      <div className="pickup-card"><small>取餐資料</small><h2>舖頭營業中</h2><p>中環皇后大道中 100 號</p><b>◷ 約 30 分鐘可取</b></div>
    </div>}
    {step===1&&<div className="checkout-stack payment-stack">
      <button type="button" aria-pressed={payment==='cash'} className={payment==='cash'?'selected':''} onClick={()=>setPayment('cash')}><span>▣</span><b>現金付款<small>到店自取時付款</small></b><i/></button>
      <button type="button" aria-pressed={payment==='electronic'} className={payment==='electronic'?'selected':''} onClick={()=>setPayment('electronic')}><span>▤</span><b>電子付款<small>轉帳後上載付款證明</small></b><i/></button>
      <button type="button" className="coupon-row"><span>◇</span><b>優惠券<small>查看可用優惠</small></b><em>未選擇 ›</em></button>
      {payment==='electronic'&&<div className="qr-preview"><small>預覽 QR</small><span aria-hidden="true"/><p>完成轉帳後，上載付款證明</p><label>上載付款證明<input type="file" accept="image/*" onChange={event=>setProofName(event.currentTarget.files?.[0]?.name??'')}/></label>{proofName&&<b role="status">已選擇：{proofName}</b>}</div>}
    </div>}
    {step===2&&<div className="checkout-stack review-stack">
      <div><small>餐點</small><b>{item.product.name}</b><span>{item.combo}・{item.options.join('・')} × {item.quantity}</span></div>
      <div><small>聯絡資料</small><b>陳先生・9123 4567</b></div>
      <div><small>付款方式</small><b>{payment==='cash'?'現金付款':'電子付款'}</b><span>{payment==='electronic'?'付款證明會交由舖頭核對':'到店自取時付款'}</span></div>
      <div><small>合計</small><Money value={jarTotal(item)}/></div>
      <p className="preview-boundary">預覽模式：確認後只會展示流程，不會建立正式訂單或扣款。</p>
    </div>}
    {step===3&&<div className="waiting-state">
      <div className="waiting-art"><img src={A.memoryJarFull} alt="裝滿美味回憶的記憶罐"/><span aria-hidden="true">♡</span></div>
      <small>付款證明已提交</small><h2>訂單已送出</h2><p>舖頭確認後會即時更新進度，請耐心等候。</p>
      <div className="pickup-code"><small>示意取餐編號</small><b>A128</b><span>已等候 2 分鐘</span></div>
      <article><img src={item.product.image} alt=""/><span><b>{item.product.name}</b><small>數量 {item.quantity}</small></span><Money value={jarTotal(item)}/></article>
      <button type="button" onClick={onOrder}>查看訂單詳情</button><button className="secondary" type="button" onClick={onHome}>返回首頁</button>
    </div>}
    {step<3&&<div className="sticky-action"><span><small>合計</small><Money value={jarTotal(item)}/></span><button type="button" onClick={next}>{step===2?'確認送出':'下一步'} <b aria-hidden="true">›</b></button></div>}
  </section>;
}
