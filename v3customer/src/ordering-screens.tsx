import {useEffect,useMemo,useRef,useState} from 'react';
import {CUSTOMER_V3_ASSETS as A} from './assets';
import {AppDialog} from './dialog';
import {
  DEFAULT_PAYMENT_METHOD_ID,
  PREVIEW_COUPON,
  PREVIEW_CUSTOMER_PHONE,
  PREVIEW_FALLBACK_REFERENCE,
  PREVIEW_MENU_CATEGORIES,
  PREVIEW_PAYMENT_METHODS,
  PREVIEW_PICKUP_CODE,
  PREVIEW_PRODUCTS,
  jarItemCount,
  jarItemsTotal,
  jarTotal,
  memoryJarLevel,
  previewPaymentMethod,
  pickupCodeFromPhone
} from './preview-data';
import type {JarItem,PaymentMethodId,PreviewProduct} from './preview-data';

const BackTitle=({title,onBack,eyebrow}:Readonly<{title:string;onBack:()=>void;eyebrow?:string}>)=><div className="screen-title">
  <button type="button" onClick={onBack} aria-label="返回">‹</button>
  <span>{eyebrow&&<small>{eyebrow}</small>}<h1>{title}</h1></span>
</div>;

const Money=({value}:Readonly<{value:number}>)=><b className="money">${value}</b>;

export type SubmittedOrder=Readonly<{
  pickupCode:string;
  payment:PaymentMethodId;
  proofSubmitted:boolean;
}>;

export function MenuScreen({onOpenProduct,onBack}:Readonly<{
  onOpenProduct:(id:string)=>void;
  onBack:()=>void;
}>){
  const [category,setCategory]=useState('all');
  const visibleProducts=category==='all'?PREVIEW_PRODUCTS:PREVIEW_PRODUCTS.filter(product=>product.categoryIds.includes(category));
  return <section className="app-screen menu-screen" aria-labelledby="menu-title">
    <BackTitle title="菜單" onBack={onBack}/>
    <div className="collection-hero">
      <div><small>今日手作</small><h2 id="menu-title">今日想食邊一款？</h2><p>按分類慢慢揀，加入後會留返喺菜單。</p></div>
      <img src={A.maleHeroR2} alt=""/>
    </div>
    <div className="menu-categories chip-row" role="group" aria-label="餐點分類">
      {PREVIEW_MENU_CATEGORIES.map(item=><button type="button" aria-pressed={category===item.id} className={category===item.id?'selected':''} key={item.id} onClick={()=>setCategory(item.id)}>{item.label}</button>)}
    </div>
    <div className="product-list">
      {visibleProducts.map((product,index)=><button className={product.id===PREVIEW_PRODUCTS[0].id?'product-card featured-product':'product-card'} type="button" key={product.id} onClick={()=>onOpenProduct(product.id)}>
        <img src={product.image} alt="" loading={index===0?'eager':'lazy'} decoding="async"/>
        <span><small>{product.id===PREVIEW_PRODUCTS[0].id?'主廚推薦':product.categoryIds.includes('sets')?'期間限定':'手作輕食'}</small><strong>{product.name}</strong><em>{product.description}</em><span><Money value={product.price}/><i>約 {product.pickupMinutes} 分鐘可取</i></span></span>
        <b aria-hidden="true">›</b>
      </button>)}
    </div>
  </section>;
}

export function ProductScreen({product,onBack,onAdd}:Readonly<{
  product:PreviewProduct;
  onBack:()=>void;
  onAdd:(item:JarItem,origin:Readonly<{left:number;top:number;width:number;height:number}>)=>void;
}>){
  const [combo,setCombo]=useState<JarItem['combo']>('單點');
  const [options,setOptions]=useState<string[]>(['原味']);
  const [quantity,setQuantity]=useState(1);
  const [note,setNote]=useState('');
  const heroRef=useRef<HTMLDivElement>(null);
  const deltas:Record<JarItem['combo'],number>={'單點':0,'配飲品':40,'配小食＋飲品':80};
  const toggleOption=(value:string)=>setOptions(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
  const total=(product.price+deltas[combo]+(options.includes('加蛋')?15:0)+(options.includes('加芝士')?20:0))*quantity;

  useEffect(()=>{
    const hero=heroRef.current;
    if(!hero)return;
    let frame=0;
    const update=()=>{
      frame=0;
      const progress=Math.min(Math.max((window.scrollY-40)/220,0),1);
      hero.style.setProperty('--product-hero-height',`${Math.round(270-progress*142)}px`);
      hero.style.setProperty('--product-hero-scale',(1-progress*.08).toFixed(3));
    };
    const onScroll=()=>{if(!frame)frame=window.requestAnimationFrame(update);};
    update();
    window.addEventListener('scroll',onScroll,{passive:true});
    return ()=>{
      window.removeEventListener('scroll',onScroll);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[product.id]);

  return <section className="app-screen product-screen product-single-page" aria-labelledby="product-title">
    <BackTitle title="餐點詳情" onBack={onBack}/>
    <div ref={heroRef} className="product-hero"><img src={product.image} alt=""/><button type="button" aria-label="收藏餐點">♡</button></div>
    <div className="product-copy"><small>手作推介</small><h2 id="product-title">{product.name}</h2><p>{product.description}</p><div><Money value={product.price}/><span>◷ 約 {product.pickupMinutes} 分鐘可取</span></div></div>

    <div className="option-section">
      <div className="option-heading"><span>1</span><div><h2>選擇組合</h2><p>揀一個最啱今日心情嘅配搭。</p></div></div>
      <div className="option-stack" role="radiogroup" aria-label="升級組合">
        {(['單點','配飲品','配小食＋飲品'] as JarItem['combo'][]).map(value=><button type="button" role="radio" aria-checked={combo===value} className={combo===value?'selected':''} key={value} onClick={()=>setCombo(value)}>
          <i/><span><strong>{value}</strong><small>{value==='單點'?'只要主餐':value==='配飲品'?'主餐＋精選飲品':'主餐＋小食＋精選飲品'}</small></span><Money value={deltas[value]}/>
        </button>)}
      </div>
    </div>

    <div className="option-section taste-options">
      <div className="option-heading"><span>2</span><div><h2>口味與加配</h2><p>口味必須揀一項，加配可以自由選擇。</p></div></div>
      <h3>口味</h3>
      <div className="choice-grid" role="radiogroup" aria-label="口味">
        {['原味','少飯'].map(value=><button type="button" role="radio" aria-checked={options.includes(value)} className={options.includes(value)?'selected':''} key={value} onClick={()=>setOptions(current=>[...current.filter(item=>item!=='原味'&&item!=='少飯'),value])}>{value}</button>)}
      </div>
      <h3>加配</h3>
      <div className="option-stack">
        {['加蛋','加芝士'].map((value,index)=><button type="button" role="checkbox" aria-checked={options.includes(value)} className={options.includes(value)?'selected add-on-row':'add-on-row'} key={value} onClick={()=>toggleOption(value)}><i/><strong>{value}</strong><Money value={index?20:15}/></button>)}
      </div>
    </div>

    <div className="option-section finishing-section">
      <div className="option-heading"><span>3</span><div><h2>數量與備註</h2><p>一次完成，再放入記憶罐。</p></div></div>
      <div className="quantity-row"><strong>數量</strong><span><button type="button" onClick={()=>setQuantity(value=>Math.max(1,value-1))} aria-label="減少數量">−</button><b>{quantity}</b><button type="button" onClick={()=>setQuantity(value=>value+1)} aria-label="增加數量">＋</button></span></div>
      <label className="note-field">特別備註（選填）<textarea rows={3} value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：不要蔥、少辣"/></label>
    </div>

    <div className="sticky-action"><span><small>合計</small><Money value={total}/></span><button type="button" onClick={event=>{
      const rect=heroRef.current?.getBoundingClientRect()??event.currentTarget.getBoundingClientRect();
      onAdd({product,combo,options:Object.freeze([...options]),quantity,note:note.trim()||undefined},{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    }}>加入記憶罐</button></div>
  </section>;
}

export function JarScreen({items,onBack,onBrowse,onQuantity,onRemove,onCheckout}:Readonly<{
  items:readonly JarItem[];
  onBack:()=>void;
  onBrowse:()=>void;
  onQuantity:(index:number,value:number)=>void;
  onRemove:(index:number)=>void;
  onCheckout:()=>void;
}>){
  const total=jarItemsTotal(items);
  const itemCount=jarItemCount(items);
  const jarLevel=memoryJarLevel(itemCount);
  const jarImage=jarLevel==='full'?A.memoryJarFull:jarLevel==='partial'?A.memoryJarPartial:A.memoryJarEmpty;
  return <section className="app-screen jar-screen" aria-labelledby="jar-title">
    <BackTitle title="記憶罐" onBack={onBack}/>
    <div className={items.length?`jar-heading has-items ${jarLevel}`:'jar-heading is-empty'}><img src={jarImage} alt=""/><div><small>{jarLevel==='full'?'滿滿好味':jarLevel==='partial'?'回憶收集中':'等緊第一份好味'}</small><h2 id="jar-title">{items.length?'美味已收藏':'記憶罐空空的'}</h2><p>{items.length?`記憶罐有 ${itemCount} 件產品；可以繼續揀，最後一次過結帳。`:'遇見想食嘅餐點，就放入記憶罐。'}</p></div></div>
    {items.length?<>
      <div className="jar-list">{items.map((item,index)=><article className="jar-item" key={`${item.product.id}-${index}`}>
        <img src={item.product.image} alt=""/>
        <div><h3>{item.product.name}</h3><p>{item.combo}・{item.options.join('・')}</p>{item.note&&<small>備註：{item.note}</small>}<Money value={jarTotal(item)}/></div>
        <button className="jar-remove" type="button" onClick={()=>onRemove(index)} aria-label={`移除${item.product.name}`}>移除</button>
        <div className="mini-stepper"><button type="button" onClick={()=>onQuantity(index,Math.max(1,item.quantity-1))} aria-label={`減少${item.product.name}數量`}>−</button><b>{item.quantity}</b><button type="button" onClick={()=>onQuantity(index,item.quantity+1)} aria-label={`增加${item.product.name}數量`}>＋</button></div>
      </article>)}</div>
      <button className="jar-add-more" type="button" onClick={onBrowse}>＋ 繼續揀餐</button>
      <label className="note-field">整張訂單備註（選填）<textarea rows={3} placeholder="有需要先話俾舖頭知"/></label>
      <div className="summary-card"><span>共 {items.length} 款餐點</span><Money value={total}/><span>預計取餐</span><b>約 30 分鐘</b></div>
    </>:<div className="empty-state jar-empty-state"><img src={A.memoryJarEmpty} alt="空的記憶罐"/><h2>記憶罐仲係空嘅</h2><p>遇見想食嘅餐點，就收藏入嚟。</p><button type="button" onClick={onBrowse}>開始揀餐</button></div>}
    {items.length>0&&<div className="sticky-action"><span><small>整張訂單合計</small><Money value={total}/></span><button type="button" onClick={onCheckout}>一次過結帳 <b aria-hidden="true">›</b></button></div>}
  </section>;
}

type FallbackMode='unpaid'|'paid';

function CouponFallbackDialog({mode,subtotal,discounted,onClose}:Readonly<{
  mode:FallbackMode;
  subtotal:number;
  discounted:number;
  onClose:()=>void;
}>){
  const [accepted,setAccepted]=useState(false);
  const [message,setMessage]=useState('');
  const continueToWhatsApp=()=>{
    if(mode==='unpaid'&&!accepted){setMessage(`請先確認今次以 $${subtotal} 無券價落單。`);return;}
    setMessage('預覽模式：尚未接駁正式 WhatsApp 聯絡入口，冇建立第二張訂單。');
  };
  return <AppDialog labelledBy="fallback-title" onClose={onClose} className="fallback-dialog">
    <button className="dialog-close" type="button" onClick={onClose} aria-label="關閉">×</button>
    <small>{mode==='unpaid'?'未付款後備':'已付款極端後備'}</small>
    <h2 id="fallback-title">{mode==='unpaid'?'轉到 WhatsApp 前確認':'已付款價錢會保留'}</h2>
    {mode==='unpaid'?<>
      <p>WhatsApp 落單暫時唔支援優惠券。今次會解除優惠，優惠券留返下次使用。</p>
      <div className="fallback-price"><span>今次無券價</span><Money value={subtotal}/><small>原本優惠價 ${discounted}</small></div>
      <label className="fallback-check"><input type="checkbox" checked={accepted} onChange={event=>{setAccepted(event.target.checked);setMessage('');}}/>我確認今次以 ${subtotal} 落單</label>
    </>:<>
      <p>舖頭未能自動收到訂單，但你已付款嘅優惠價會保留，唔需要再次付款。優惠券會暫時保留，等店員完成或取消後再更新。</p>
      <div className="fallback-price"><span>保留已付款價</span><Money value={discounted}/><small>等待店員人工跟進</small></div>
    </>}
    <div className="fallback-reference"><b>WhatsApp 參考：{PREVIEW_FALLBACK_REFERENCE}</b><small>只供對話查詢，唔係訂單編號。</small></div>
    {message&&<p className="inline-message" role="status">{message}</p>}
    <button className="primary-button" type="button" onClick={continueToWhatsApp}>{mode==='unpaid'?'確認無券價並聯絡店員':'聯絡店員跟進'}</button>
  </AppDialog>;
}

export function CheckoutScreen({items,onBack,onHome,onOrder}:Readonly<{
  items:readonly JarItem[];
  onBack:()=>void;
  onHome:()=>void;
  onOrder:(order:SubmittedOrder)=>void;
}>){
  const [step,setStep]=useState(0);
  const [name,setName]=useState('陳先生');
  const [phone,setPhone]=useState(PREVIEW_CUSTOMER_PHONE);
  const [contactError,setContactError]=useState('');
  const [paymentId,setPaymentId]=useState<PaymentMethodId>(DEFAULT_PAYMENT_METHOD_ID);
  const [proofName,setProofName]=useState('');
  const [proofError,setProofError]=useState('');
  const [couponOpen,setCouponOpen]=useState(false);
  const [couponApplied,setCouponApplied]=useState(false);
  const [fallbackMode,setFallbackMode]=useState<FallbackMode|null>(null);
  const paymentPickerRef=useRef<HTMLDetailsElement>(null);
  const payment=previewPaymentMethod(paymentId);
  const subtotal=useMemo(()=>jarItemsTotal(items),[items]);
  const total=Math.max(0,subtotal-(couponApplied?PREVIEW_COUPON.discount:0));
  const pickupCode=pickupCodeFromPhone(phone)||PREVIEW_PICKUP_CODE;
  const titles=['取餐資料','付款方式','確認落單','等候舖頭確認'];
  const next=()=>{
    if(step===0){
      if(!name.trim()||phone.replace(/\D/g,'').length<8){setContactError('請填寫稱呼及有效電話號碼。');return;}
      setContactError('');
    }
    if(step===1&&payment.requiresProof&&!proofName){setProofError(`請先上載${payment.label}付款憑證，再繼續確認訂單。`);return;}
    setProofError('');
    setStep(value=>Math.min(3,value+1));
  };

  return <section className="app-screen checkout-screen" aria-label={titles[step]}>
    <BackTitle title={titles[step]} eyebrow={step<3?`${step+1} / 3`:'訂單進度'} onBack={()=>step?setStep(value=>value-1):onBack()}/>
    {step<3&&<div className="progress-steps" aria-label="落單進度"><i className={step>=0?'done':''}>1</i><span/><i className={step>=1?'done':''}>2</i><span/><i className={step>=2?'done':''}>3</i></div>}
    {step===0&&<div className="checkout-stack">
      <label>稱呼<input name="name" value={name} onChange={event=>setName(event.target.value)} autoComplete="name"/></label>
      <label>電話<input name="tel" value={phone} onChange={event=>setPhone(event.target.value)} inputMode="tel" autoComplete="tel"/></label>
      {contactError&&<p className="form-error" role="alert">{contactError}</p>}
      <p className="member-note"><b>首次落單毋須先註冊</b><span>正式版本會建立未啟用會員記錄；之後可自行設定密碼。此預覽唔會儲存個人資料。</span></p>
      <div className="pickup-card"><small>取餐資料</small><h2>舖頭營業中</h2><p>中環皇后大道中 100 號</p><b>◷ 約 30 分鐘可取</b></div>
    </div>}
    {step===1&&<div className="checkout-stack payment-stack">
      <details className="payment-picker" ref={paymentPickerRef}>
        <summary><span>{payment.symbol}</span><b>付款方式<small>{payment.label}・{payment.description}</small></b><em>更改⌄</em></summary>
        <div className="payment-method-options" role="radiogroup" aria-label="可用付款方式">
          {PREVIEW_PAYMENT_METHODS.map(method=><button type="button" role="radio" aria-checked={paymentId===method.id} className={paymentId===method.id?'payment-method-option selected':'payment-method-option'} key={method.id} onClick={()=>{
            if(method.id!==paymentId)setProofName('');
            setPaymentId(method.id);
            setProofError('');
            paymentPickerRef.current?.removeAttribute('open');
          }}><span>{method.symbol}</span><b>{method.label}<small>{method.description}</small></b><i/></button>)}
        </div>
      </details>
      <button type="button" className="coupon-row" aria-expanded={couponOpen} onClick={()=>setCouponOpen(value=>!value)}><span>◇</span><b>優惠券<small>{couponApplied?PREVIEW_COUPON.title:'查看可用優惠'}</small></b><em>{couponApplied?'已套用':'未選擇'} ›</em></button>
      {couponOpen&&<div className="coupon-picker"><span>◇</span><div><b>{PREVIEW_COUPON.title}</b><small>{PREVIEW_COUPON.description}</small><code>{PREVIEW_COUPON.code}</code></div><button type="button" onClick={()=>{setCouponApplied(value=>!value);setCouponOpen(false);}}>{couponApplied?'移除':'套用'}</button></div>}
      {payment.requiresProof&&<div className="qr-preview"><small>{payment.label} QR 預覽</small><span aria-hidden="true"/><p>完成付款後，上載付款憑證。截圖只係核對證明，唔代表已確認收款。</p><label htmlFor="payment-proof">上載付款憑證<input id="payment-proof" type="file" accept="image/*" onChange={event=>{setProofName(event.currentTarget.files?.[0]?.name??'');setProofError('');}}/></label>{proofName&&<b role="status">已選擇：{proofName}</b>}{proofError&&<p className="form-error" role="alert">{proofError}</p>}</div>}
    </div>}
    {step===2&&<div className="checkout-stack review-stack">
      <div><small>餐點</small><b>{items.length} 款餐點</b><span>{items.map(item=>`${item.product.name} × ${item.quantity}`).join('・')}</span></div>
      <div><small>聯絡資料</small><b>{name}・{phone}</b></div>
      <div><small>付款方式</small><b>{payment.label}</b><span>{payment.requiresProof?'付款憑證只會交由舖頭核對，並非已付款確認':'到店自取時付款，唔會進入付款憑證流程'}</span></div>
      {couponApplied&&<div><small>優惠券</small><b>{PREVIEW_COUPON.title}</b><span>已減 ${PREVIEW_COUPON.discount}</span></div>}
      <div><small>整張訂單合計</small><Money value={total}/></div>
      <p className="preview-boundary">預覽模式：確認後只會展示流程，不會建立正式訂單或扣款。</p>
      {couponApplied&&<div className="fallback-preview"><small>預覽優惠券後備狀態</small><span>只用嚟檢查例外畫面；正常落單唔會顯示。</span><section><button type="button" onClick={()=>setFallbackMode('unpaid')}>未付款後備</button><button type="button" onClick={()=>setFallbackMode('paid')}>已付款後備</button></section></div>}
    </div>}
    {step===3&&<div className="waiting-state">
      <div className="waiting-art"><img src={A.memoryJarFull} alt="裝滿美味回憶的記憶罐"/><span aria-hidden="true">♡</span></div>
      <small>{payment.requiresProof?`${payment.label}付款憑證已提交・仍待核對`:`${payment.label}・到店付款`}</small><h2>訂單已送出</h2><p>{payment.requiresProof?'付款憑證唔等於已確認收款；舖頭核對後會更新進度。':'舖頭確認訂單後會更新進度，取餐時先付款。'}</p>
      <div className="pickup-code"><small>取餐碼・電話尾四位</small><b>{pickupCode}</b><span>訂單顯示編號 MF-NEW・已等候 2 分鐘</span></div>
      <div className="waiting-order-list">{items.map((item,index)=><article key={`${item.product.id}-${index}`}><img src={item.product.image} alt=""/><span><b>{item.product.name}</b><small>數量 {item.quantity}</small></span><Money value={jarTotal(item)}/></article>)}</div>
      <div className="waiting-total"><span>合計</span><Money value={total}/></div>
      <button type="button" onClick={()=>onOrder({pickupCode,payment:payment.id,proofSubmitted:payment.requiresProof})}>查看訂單詳情</button><button className="secondary" type="button" onClick={onHome}>返回首頁</button>
    </div>}
    {step<3&&<div className="sticky-action"><span><small>整張訂單合計</small><Money value={total}/></span><button type="button" onClick={next}>{step===2?'確認送出':'下一步'} <b aria-hidden="true">›</b></button></div>}
    {fallbackMode && (
      <CouponFallbackDialog
        mode={fallbackMode}
        subtotal={subtotal}
        discounted={total}
        onClose={() => setFallbackMode(null)}
      />
    )}
  </section>;
}
