import {useMemo,useRef,useState,useEffect} from 'react';
import type {
  SmmCartLine,
  SmmCommandResult,
  SmmConnectionState,
  SmmDineSession,
  SmmOptionGroup,
  SmmPendingIntent,
  SmmProduct,
  SmmQuoteSnapshot,
} from './product-types';
import type {SmmSelectionState} from './selection';
import {validateSmmSelections} from './selection';
import type {CommandPresentation,QuotePresentation} from './presentation';
import {dineStateLabel,formatObservedAt} from './presentation';
import {
  CompletedStep,
  EmptyState,
  FieldHint,
  GuidedProgress,
  ModalSheet,
  PageHeading,
  SectionHeading,
  StateMessage,
  StatusTag,
} from './ui';

type OrderMode='menu'|'dine';

export function OrderView({
  connection,
  mode,
  onMode,
  categories,
  activeCategoryId,
  onCategory,
  search,
  onSearch,
  products,
  menuObservedAt,
  cartCount,
  cartSummary,
  onProduct,
  onCart,
  dineSessions,
  dineConnected,
  onCreateDine,
}:{
  connection:SmmConnectionState;
  mode:OrderMode;
  onMode:(mode:OrderMode)=>void;
  categories:readonly {categoryId:string;name:string}[];
  activeCategoryId:string|null;
  onCategory:(categoryId:string|null)=>void;
  search:string;
  onSearch:(value:string)=>void;
  products:readonly SmmProduct[];
  menuObservedAt?:string;
  cartCount:number;
  cartSummary:string;
  onProduct:(product:SmmProduct)=>void;
  onCart:()=>void;
  dineSessions:readonly SmmDineSession[];
  dineConnected:boolean;
  onCreateDine:(tableLabel:string,covers:number)=>Promise<SmmCommandResult|null>;
}){
  return <section className="page order-page">
    <PageHeading
      eyebrow="點單"
      title={mode==='menu'?'開始點單':'堂食桌面'}
      detail={mode==='menu'?'先選分類或搜尋商品，系統會逐步帶你完成設定。':'查看正式桌面，或逐步建立新桌面。'}
      aside={menuObservedAt?<small className="last-updated">{formatObservedAt(menuObservedAt)}</small>:undefined}
    />

    <div className="task-switch" role="group" aria-label="點單工作">
      <button className={mode==='menu'?'active':''} aria-pressed={mode==='menu'} onClick={()=>onMode('menu')}>餐單點單</button>
      <button className={mode==='dine'?'active':''} aria-pressed={mode==='dine'} onClick={()=>onMode('dine')}>堂食桌面</button>
    </div>

    {mode==='menu'?<MenuBrowser
      connection={connection}
      categories={categories}
      activeCategoryId={activeCategoryId}
      onCategory={onCategory}
      search={search}
      onSearch={onSearch}
      products={products}
      onProduct={onProduct}
    />:<DinePanel sessions={dineSessions} connected={dineConnected} onCreate={onCreateDine}/>}

    {cartCount>0?<button className="cart-dock" onClick={onCart}>
      <span><b>{cartCount}</b><span>查看購物籃</span></span>
      <span><strong>{cartSummary}</strong><small>檢查商品及正式報價</small></span>
      <em>繼續</em>
    </button>:null}
  </section>;
}

function MenuBrowser({connection,categories,activeCategoryId,onCategory,search,onSearch,products,onProduct}:{
  connection:SmmConnectionState;
  categories:readonly {categoryId:string;name:string}[];
  activeCategoryId:string|null;
  onCategory:(categoryId:string|null)=>void;
  search:string;
  onSearch:(value:string)=>void;
  products:readonly SmmProduct[];
  onProduct:(product:SmmProduct)=>void;
}){
  const hasFilter=Boolean(activeCategoryId||search.trim());
  if(connection==='LOADING')return <div aria-busy="true"><EmptyState title="正在同步餐單" detail="正在讀取分類、商品及供應狀態。"/></div>;
  if(!categories.length)return <EmptyState
    title={connection==='NOT_CONNECTED'?'餐單服務尚未連接':'目前未有餐單'}
    detail={connection==='NOT_CONNECTED'?'連接後會顯示正式分類、商品、規格及供應狀態。':'門店目前未提供可售商品。'}
  />;

  return <div className="menu-browser">
    <label className="search-field" htmlFor="menu-search">
      <span>搜尋商品</span>
      <input id="menu-search" type="search" value={search} onChange={event=>onSearch(event.target.value)} placeholder="輸入商品名稱"/>
    </label>

    <section className="category-section">
      <SectionHeading title={activeCategoryId?'已選分類':'先選分類'} detail={activeCategoryId?'可以轉換分類，或直接搜尋其他商品。':'只會顯示你目前需要查看的商品。'}/>
      <div className="category-grid">
        {activeCategoryId?<button className="category-clear" onClick={()=>onCategory(null)}>重新選擇</button>:null}
        {categories.map(category=><button
          key={category.categoryId}
          className={activeCategoryId===category.categoryId?'active':''}
          aria-pressed={activeCategoryId===category.categoryId}
          onClick={()=>onCategory(category.categoryId)}
        >{category.name}</button>)}
      </div>
    </section>

    {!hasFilter?<EmptyState title="選擇一個分類" detail="選好分類後，相關商品會顯示在這裡。"/>:
      products.length?<section className="product-section">
        <SectionHeading title="選擇商品" detail={`目前顯示 ${products.length} 件商品`}/>
        <div className="product-grid">{products.map(product=><button
          key={product.productId}
          className="product-row"
          disabled={!product.available}
          onClick={()=>onProduct(product)}
        >
          <span className="product-initial" aria-hidden="true">{product.name.slice(0,1)}</span>
          <span><strong>{product.name}</strong><small>{product.description??(product.optionGroups.length||product.variations?.length?'需要設定規格或選項':'可直接加入')}</small></span>
          <StatusTag tone={product.available?'success':'danger'} label={product.available?'可供應':'暫停供應'}/>
        </button>)}</div>
      </section>:
      <EmptyState title={`找不到「${search.trim()||'這個分類'}」的商品`} detail="清除搜尋，或選擇其他分類。">
        <button className="secondary-button" onClick={()=>{onSearch('');onCategory(null)}}>清除篩選</button>
      </EmptyState>}
  </div>;
}

function DinePanel({sessions,connected,onCreate}:{
  sessions:readonly SmmDineSession[];
  connected:boolean;
  onCreate:(tableLabel:string,covers:number)=>Promise<SmmCommandResult|null>;
}){
  const [creating,setCreating]=useState(false);
  const [step,setStep]=useState<'table'|'covers'|'review'|'result'>('table');
  const [table,setTable]=useState('');
  const [covers,setCovers]=useState(2);
  const [result,setResult]=useState<SmmCommandResult|null>(null);
  const lockRef=useRef(false);

  const submit=async()=>{
    if(lockRef.current||!connected||!table.trim())return;
    lockRef.current=true;
    setCreating(true);
    const next=await onCreate(table.trim(),covers);
    setResult(next);
    setStep('result');
    setCreating(false);
    lockRef.current=false;
  };

  return <div className="dine-layout">
    <section className="dine-create surface-panel">
      <GuidedProgress current={step==='table'?1:step==='covers'?2:step==='review'?3:4} total={4} label={step==='table'?'輸入枱號':step==='covers'?'選擇人數':step==='review'?'檢查資料':'門店回覆'}/>
      {step==='table'?<>
        <label className="form-field">枱號<input value={table} onChange={event=>setTable(event.target.value)} placeholder="例如 A1" autoComplete="off"/></label>
        <button className="primary-button" disabled={!table.trim()} onClick={()=>setStep('covers')}>繼續</button>
        {!table.trim()?<FieldHint>請先輸入枱號。</FieldHint>:null}
      </>:null}
      {step==='covers'?<>
        <CompletedStep label="枱號" summary={table} onEdit={()=>setStep('table')}/>
        <label className="form-field">人數<input type="number" inputMode="numeric" min={1} max={30} value={covers} onChange={event=>setCovers(Math.max(1,Number(event.target.value)||1))}/></label>
        <div className="step-actions"><button className="secondary-button" onClick={()=>setStep('table')}>返回</button><button className="primary-button" onClick={()=>setStep('review')}>繼續</button></div>
      </>:null}
      {step==='review'?<>
        <CompletedStep label="枱號" summary={table} onEdit={()=>setStep('table')}/>
        <CompletedStep label="人數" summary={`${covers} 位`} onEdit={()=>setStep('covers')}/>
        {!connected?<StateMessage tone="warning" title="目前未連接" detail="堂食操作尚未接駁正式系統，因此不會建立門店桌面。"/>:null}
        <div className="step-actions"><button className="secondary-button" onClick={()=>setStep('covers')}>返回</button><button className="primary-button" disabled={!connected||creating} onClick={()=>void submit()}>{creating?'正在建立':'確認建立桌面'}</button></div>
        {!connected?<FieldHint>連接正式堂食服務後才可繼續。</FieldHint>:null}
      </>:null}
      {step==='result'?<DineResult result={result} onDone={()=>{setTable('');setCovers(2);setResult(null);setStep('table')}}/>:null}
    </section>

    <section className="dine-sessions surface-panel">
      <SectionHeading title="現有桌面" detail="只顯示門店服務提供的正式資料"/>
      {!sessions.length?<EmptyState title={connected?'目前沒有開啟中的桌面':'堂食服務尚未連接'} detail={connected?'建立新桌面後會在這裡顯示。':'連接後會顯示正式桌面、客數及狀態。'}/>:
        <div className="plain-list">{sessions.map(session=><article key={session.sessionId} className="plain-row"><div><strong>{session.tableLabel}</strong><small>{session.covers} 位 · {new Date(session.openedAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small></div><StatusTag tone="info" label={dineStateLabel(session.state)}/></article>)}</div>}
    </section>
  </div>;
}

function DineResult({result,onDone}:{result:SmmCommandResult|null;onDone:()=>void}){
  if(!result)return <StateMessage tone="warning" title="未收到門店回覆" detail="沒有建立任何本機桌面真相。" actionLabel="完成" onAction={onDone}/>;
  const confirmed=result.state==='CONFIRMED';
  const title=confirmed?'門店已建立桌面':result.state==='REJECTED'?'門店未接受今次操作':result.state==='FAILED'?'建立桌面未完成':result.state==='UNKNOWN'?'正在確認桌面結果':'目前未連接';
  return <StateMessage tone={confirmed?'success':result.state==='REJECTED'||result.state==='FAILED'?'danger':'warning'} title={title} detail={result.message} actionLabel="完成" onAction={onDone}/>;
}

interface ConfigStep {
  readonly id:string;
  readonly label:string;
  readonly kind:'variation'|'group'|'review';
  readonly group?:SmmOptionGroup;
}

export function ProductConfigurator({open,product,selections,selectedVariationId,onVariation,onToggle,onClose,onAdd}:{
  open:boolean;
  product:SmmProduct;
  selections:SmmSelectionState;
  selectedVariationId:string|null;
  onVariation:(variationId:string)=>void;
  onToggle:(groupId:string,optionId:string)=>void;
  onClose:()=>void;
  onAdd:()=>void;
}){
  const steps=useMemo<readonly ConfigStep[]>(()=>{
    const next:ConfigStep[]=[];
    if(product.variations?.length)next.push({id:'variation',label:'選擇規格',kind:'variation'});
    product.optionGroups.forEach(group=>next.push({id:group.optionGroupId,label:group.name,kind:'group',group}));
    next.push({id:'review',label:'檢查設定',kind:'review'});
    return next;
  },[product]);
  const [activeStep,setActiveStep]=useState(0);
  const [feedback,setFeedback]=useState<string|null>(null);
  const current=steps[activeStep]??steps[steps.length-1];

  const stepComplete=(step:ConfigStep):boolean=>{
    if(step.kind==='variation')return !product.variationRequired||Boolean(selectedVariationId);
    if(step.kind==='group'&&step.group){
      const selected=selections[step.group.optionGroupId]??[];
      return selected.length>=Math.max(step.group.required?1:0,step.group.minSelections);
    }
    const validation=validateSmmSelections(product,selections);
    return validation.ok&&(!product.variationRequired||Boolean(selectedVariationId));
  };

  const stepSummary=(step:ConfigStep):string=>{
    if(step.kind==='variation')return product.variations?.find(item=>item.variationId===selectedVariationId)?.name??'未選擇';
    if(step.kind==='group'&&step.group){
      const ids=selections[step.group.optionGroupId]??[];
      const names=step.group.options.filter(option=>ids.includes(option.optionId)).map(option=>option.name);
      return names.length?names.join('、'):'沒有加選';
    }
    return '已檢查';
  };

  const chooseOption=(group:SmmOptionGroup,optionId:string)=>{
    const selected=selections[group.optionGroupId]??[];
    const isSelected=selected.includes(optionId);
    if(!isSelected&&group.maxSelections>1&&selected.length>=group.maxSelections){
      setFeedback(`${group.name}最多可選 ${group.maxSelections} 項。`);
      return;
    }
    setFeedback(null);
    onToggle(group.optionGroupId,optionId);
  };

  const continueStep=()=>{
    if(!stepComplete(current)){
      const minimum=current.group?Math.max(current.group.required?1:0,current.group.minSelections):1;
      setFeedback(current.kind==='variation'?'請先選擇規格。':`請先完成${current.label}，最少選擇 ${minimum} 項。`);
      return;
    }
    setFeedback(null);
    setActiveStep(index=>Math.min(steps.length-1,index+1));
  };

  return <ModalSheet open={open} title={product.name} description={product.description??'逐步完成商品設定'} onClose={onClose}>
    <div className="guided-flow">
      <GuidedProgress current={activeStep+1} total={steps.length} label={current.label}/>
      <div className="completed-steps">{steps.slice(0,activeStep).map((step,index)=><CompletedStep key={step.id} label={step.label} summary={stepSummary(step)} onEdit={()=>{setFeedback(null);setActiveStep(index)}}/>)}</div>

      <section className="current-step" aria-live="polite">
        {current.kind==='variation'?<>
          <SectionHeading title="選擇規格" detail={product.variationRequired?'必須選擇一項才可繼續':'可以不選擇規格'}/>
          <div className="choice-list">{product.variations?.map(variation=><button
            key={variation.variationId}
            disabled={!variation.available}
            className={selectedVariationId===variation.variationId?'selected':''}
            aria-pressed={selectedVariationId===variation.variationId}
            onClick={()=>{setFeedback(null);onVariation(variation.variationId)}}
          ><span>{variation.name}</span><small>{variation.available?(selectedVariationId===variation.variationId?'已選擇':'選擇此規格'):'暫停供應'}</small></button>)}</div>
        </>:null}

        {current.kind==='group'&&current.group?<OptionStep group={current.group} selected={selections[current.group.optionGroupId]??[]} onChoose={optionId=>chooseOption(current.group!,optionId)}/>:null}

        {current.kind==='review'?<ProductReview product={product} selections={selections} selectedVariationId={selectedVariationId}/>:null}
      </section>

      {feedback?<FieldHint tone="danger">{feedback}</FieldHint>:null}
      <footer className="sheet-actions">
        {activeStep>0?<button className="secondary-button" onClick={()=>{setFeedback(null);setActiveStep(index=>Math.max(0,index-1))}}>返回</button>:<button className="secondary-button" onClick={onClose}>取消</button>}
        {current.kind==='review'?<button className="primary-button" disabled={!stepComplete(current)} onClick={onAdd}>加入購物籃</button>:<button className="primary-button" disabled={!stepComplete(current)} aria-describedby={!stepComplete(current)?'step-disabled-reason':undefined} onClick={continueStep}>繼續</button>}
      </footer>
      {!stepComplete(current)&&current.kind!=='review'?<p id="step-disabled-reason" className="disabled-reason">完成目前步驟後便可繼續。</p>:null}
    </div>
  </ModalSheet>;
}

function OptionStep({group,selected,onChoose}:{group:SmmOptionGroup;selected:readonly string[];onChoose:(optionId:string)=>void}){
  const minimum=Math.max(group.required?1:0,group.minSelections);
  return <>
    <SectionHeading title={group.name} detail={`${minimum>0?`最少選 ${minimum} 項`:'可略過'}，最多選 ${group.maxSelections} 項`}/>
    <div className="choice-list">{group.options.map(option=>{
      const active=selected.includes(option.optionId);
      return <button key={option.optionId} disabled={!option.available} className={active?'selected':''} aria-pressed={active} onClick={()=>onChoose(option.optionId)}>
        <span>{option.name}</span><small>{!option.available?'暫停供應':active?'已選擇':'選擇此項'}</small>
      </button>;
    })}</div>
    <FieldHint tone={selected.length>=minimum?'success':'neutral'}>{selected.length>=minimum?'目前步驟已完成':`尚欠 ${minimum-selected.length} 項`}</FieldHint>
  </>;
}

function ProductReview({product,selections,selectedVariationId}:{product:SmmProduct;selections:SmmSelectionState;selectedVariationId:string|null}){
  const variation=product.variations?.find(item=>item.variationId===selectedVariationId)?.name;
  return <>
    <SectionHeading title="檢查商品設定" detail="確認無誤後加入本機購物籃"/>
    <dl className="review-list">
      {variation?<div><dt>規格</dt><dd>{variation}</dd></div>:null}
      {product.optionGroups.map(group=>{
        const ids=selections[group.optionGroupId]??[];
        const names=group.options.filter(option=>ids.includes(option.optionId)).map(option=>option.name);
        return <div key={group.optionGroupId}><dt>{group.name}</dt><dd>{names.length?names.join('、'):'沒有加選'}</dd></div>;
      })}
    </dl>
  </>;
}

type CartStage='items'|'quote'|'confirm'|'result';

export function CartReview({open,cart,quote,quotePresentation,pending,command,busy,onClose,onQuantity,onRemove,onRetryQuote,onSubmit,onReadback}:{
  open:boolean;
  cart:readonly SmmCartLine[];
  quote:SmmQuoteSnapshot|null;
  quotePresentation:QuotePresentation;
  pending:SmmPendingIntent|null;
  command:CommandPresentation;
  busy:boolean;
  onClose:()=>void;
  onQuantity:(lineId:string,quantity:number)=>void;
  onRemove:(lineId:string)=>void;
  onRetryQuote:()=>void;
  onSubmit:()=>void;
  onReadback:(intent:SmmPendingIntent)=>void;
}){
  const blockedPending=pending?.state==='PENDING'||pending?.state==='UNKNOWN';
  const [stage,setStage]=useState<CartStage>(()=>blockedPending?'result':'items');
  const wasOpen=useRef(open);
  useEffect(()=>{
    if(open&&!wasOpen.current)setStage(blockedPending?'result':'items');
    wasOpen.current=open;
  },[open,blockedPending]);
  useEffect(()=>{
    if(command.state!=='idle'||blockedPending)setStage('result');
  },[command.state,blockedPending]);

  const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
  const currentNumber=stage==='items'?1:stage==='quote'?2:stage==='confirm'?3:4;
  const currentLabel=stage==='items'?'檢查購物籃':stage==='quote'?'取得正式報價':stage==='confirm'?'確認提交':'門店回覆';

  return <ModalSheet open={open} title="購物籃" description="本機只保存提交意圖，價錢以門店正式報價為準。" onClose={onClose}>
    <div className="guided-flow cart-flow">
      <GuidedProgress current={currentNumber} total={4} label={currentLabel}/>
      {stage!=='items'&&command.state!=='confirmed'?<CompletedStep label="購物籃" summary={`${cart.reduce((sum,line)=>sum+line.quantity,0)} 件商品`} onEdit={()=>{if(!busy&&!blockedPending)setStage('items')}}/>:null}
      {(stage==='confirm'||stage==='result')&&command.state!=='confirmed'?<CompletedStep label="正式報價" summary={quote?money(quote.currency,quote.totalMinor):'未有正式報價'} onEdit={()=>{if(!busy&&!blockedPending)setStage('quote')}}/>:null}

      {stage==='items'?<CartItems cart={cart} onQuantity={onQuantity} onRemove={onRemove} onContinue={()=>setStage('quote')}/>:null}
      {stage==='quote'?<QuoteStep quote={quote} presentation={quotePresentation} onRetry={onRetryQuote} onContinue={()=>setStage('confirm')}/>:null}
      {stage==='confirm'?<ConfirmStep cart={cart} quote={quote} busy={busy} blockedPending={blockedPending} onBack={()=>setStage('quote')} onSubmit={onSubmit}/>:null}
      {stage==='result'?<CommandResult command={command} pending={pending} busy={busy} onReadback={onReadback} onBack={()=>setStage('items')} onDone={onClose}/>:null}
    </div>
  </ModalSheet>;
}

function CartItems({cart,onQuantity,onRemove,onContinue}:{cart:readonly SmmCartLine[];onQuantity:(lineId:string,quantity:number)=>void;onRemove:(lineId:string)=>void;onContinue:()=>void}){
  if(!cart.length)return <EmptyState title="購物籃是空的" detail="返回餐單選擇商品。"/>;
  return <section>
    <SectionHeading title="檢查商品" detail="可以在取得正式報價前修改數量"/>
    <div className="cart-lines">{cart.map(line=><article className="cart-line" key={line.lineId}>
      <div><strong>{line.productName}</strong><small>{[line.selectedVariationName,...line.selections.map(item=>item.optionName)].filter(Boolean).join('、')||'沒有額外設定'}</small></div>
      <div className="quantity-control" aria-label={`${line.productName}數量`}>
        <button aria-label={`減少${line.productName}數量`} onClick={()=>onQuantity(line.lineId,line.quantity-1)}>−</button>
        <b>{line.quantity}</b>
        <button aria-label={`增加${line.productName}數量`} onClick={()=>onQuantity(line.lineId,line.quantity+1)}>＋</button>
      </div>
      <button className="text-danger" onClick={()=>onRemove(line.lineId)}>移除</button>
    </article>)}</div>
    <footer className="sheet-actions"><span/><button className="primary-button" onClick={onContinue}>取得正式報價</button></footer>
  </section>;
}

function QuoteStep({quote,presentation,onRetry,onContinue}:{quote:SmmQuoteSnapshot|null;presentation:QuotePresentation;onRetry:()=>void;onContinue:()=>void}){
  const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
  if(presentation.state==='loading')return <div aria-busy="true"><StateMessage tone="info" title="正在取得正式報價" detail="請稍候，不需要重複操作。"/></div>;
  if(presentation.state==='ready'&&quote)return <section className="quote-panel">
    <span>正式報價</span><strong>{money(quote.currency,quote.totalMinor)}</strong><small>版本 {quote.revision} · {formatObservedAt(quote.observedAt)}</small>
    <button className="primary-button" onClick={onContinue}>繼續確認</button>
  </section>;
  if(presentation.state==='error')return <>
    <StateMessage tone="danger" title="未能取得正式報價" detail={presentation.message} actionLabel="再次取得報價" onAction={onRetry}/>
    <button className="secondary-button full-width" onClick={onContinue}>仍然前往確認</button>
  </>;
  return <>
    <StateMessage tone="warning" title="目前未有正式報價" detail={presentation.state==='unavailable'?presentation.message:'本機不會自行估算價格。'}/>
    <button className="primary-button full-width" onClick={onContinue}>前往確認</button>
  </>;
}

function ConfirmStep({cart,quote,busy,blockedPending,onBack,onSubmit}:{cart:readonly SmmCartLine[];quote:SmmQuoteSnapshot|null;busy:boolean;blockedPending:boolean;onBack:()=>void;onSubmit:()=>void}){
  const count=cart.reduce((sum,line)=>sum+line.quantity,0);
  const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
  return <section>
    <SectionHeading title="確認提交意圖" detail="提交後會等待門店回覆；結果未明時不會自動重送。"/>
    <dl className="review-list"><div><dt>商品</dt><dd>{count} 件</dd></div><div><dt>正式報價</dt><dd>{quote?money(quote.currency,quote.totalMinor):'未有正式報價'}</dd></div></dl>
    {blockedPending?<StateMessage tone="warning" title="已有提交正在確認" detail="請先確認原有提交結果，禁止重複提交。"/>:null}
    <footer className="sheet-actions"><button className="secondary-button" disabled={busy} onClick={onBack}>返回</button><button className="primary-button" disabled={busy||blockedPending||!cart.length} onClick={onSubmit}>{busy?'正在提交':'確認提交'}</button></footer>
    {busy?<FieldHint tone="info">提交中，操作已鎖定。</FieldHint>:blockedPending?<FieldHint tone="warning">完成 readback 前不能再次提交。</FieldHint>:null}
  </section>;
}

function CommandResult({command,pending,busy,onReadback,onBack,onDone}:{command:CommandPresentation;pending:SmmPendingIntent|null;busy:boolean;onReadback:(intent:SmmPendingIntent)=>void;onBack:()=>void;onDone:()=>void}){
  if(command.state==='submitting')return <div aria-busy="true"><StateMessage tone="info" title="正在提交訂單意圖" detail="提交控制已鎖定，請勿重複操作。"/></div>;
  if(command.state==='readback')return <div aria-busy="true"><StateMessage tone="info" title="正在確認訂單結果" detail="只會查詢原有 submissionId，未有重新提交。"/></div>;
  if(command.state==='confirmed')return <StateMessage tone="success" title="門店已確認訂單" detail={command.message} actionLabel="完成" onAction={onDone}/>;
  if(command.state==='rejected')return <><StateMessage tone="danger" title="門店未接受今次提交" detail={command.message}/><button className="primary-button full-width" onClick={onBack}>返回檢查</button></>;
  if(command.state==='failed')return <><StateMessage tone="danger" title="提交未完成" detail={command.message}/><button className="primary-button full-width" onClick={onBack}>返回檢查</button></>;
  if(command.state==='not-connected')return <><StateMessage tone="warning" title="已保存本機草稿" detail={command.message}/><button className="primary-button full-width" onClick={onDone}>完成</button></>;

  const waiting=command.state==='unknown'||pending?.state==='UNKNOWN'||pending?.state==='PENDING';
  if(waiting&&pending)return <section>
    <StateMessage tone="warning" title="正在確認訂單結果" detail="結果未明並不代表失敗。系統保留同一提交身份，唔會自動重送。"/>
    <details className="technical-details"><summary>查看提交資料</summary><p>Submission ID：{pending.submissionId}</p><p>{pending.lastMessage??'等待門店讀回'}</p></details>
    <button className="primary-button full-width" disabled={busy} onClick={()=>onReadback(pending)}>{busy?'正在確認':'再次確認結果'}</button>
  </section>;

  return <StateMessage tone="neutral" title="等待下一步" detail="返回購物籃檢查內容。" actionLabel="返回檢查" onAction={onBack}/>;
}
