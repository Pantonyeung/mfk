import {useMemo,useState} from 'react';
import type {SyncedCombo,SyncedComboPool,SyncedOptionSet} from '../../runtime/admin-config-projection.ts';
import {CompletedStep,DisabledReason,GuidedProgress} from '../../presentation/SmtUi.tsx';
import './ordering-center-workspaces.css';

export interface WorkspaceProduct{
  readonly id:string;
  readonly category:string;
  readonly name:string;
  readonly priceMinor:number;
  readonly priceLabel:string;
  readonly imageUrl?:string;
  readonly optionSets?:readonly SyncedOptionSet[];
}
export interface WorkspaceCartLine{
  readonly id:string;
  readonly productId:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly detail?:string;
}
export type OrderingPanelState=
  |{readonly type:'product';readonly productId:string}
  |{readonly type:'organize'}
  |{readonly type:'combo'}
  |{readonly type:'hold'}
  |{readonly type:'holds'}
  |null;

const money=(minor:number)=>(minor<0?'-':'')+String.fromCharCode(36)+(Math.abs(minor)/100).toFixed(2);

export function ProductConfigWorkspace({product,onAdd}:{product:WorkspaceProduct;onAdd:(detail:string,deltaMinor:number,qty:number)=>void}){
  const [qty,setQty]=useState(1);
  const [note,setNote]=useState('');
  const [activeStep,setActiveStep]=useState(0);
  const [choiceFeedback,setChoiceFeedback]=useState('');
  const optionSets=product.optionSets??[];
  const [selected,setSelected]=useState<Record<string,string[]>>(()=>Object.fromEntries(
    optionSets.map(set=>[
      set.id,
      set.options.filter(option=>option.defaultSelected).map(option=>option.id),
    ]),
  ));

  const toggle=(set:SyncedOptionSet,optionId:string)=>{
    setChoiceFeedback('');
    setSelected(current=>{
      const existing=current[set.id]??[];
      if(set.selection==='SINGLE')return {...current,[set.id]:[optionId]};
      const on=existing.includes(optionId);
      if(on)return {...current,[set.id]:existing.filter(id=>id!==optionId)};
      const maximum=Math.max(1,set.max||existing.length+1);
      if(existing.length>=maximum){
        setChoiceFeedback(`最多只可選 ${maximum} 項；請先取消一項。`);
        return current;
      }
      return {...current,[set.id]:[...existing,optionId]};
    });
  };
  const selectedOptions=optionSets.flatMap(set=>{
    const ids=new Set(selected[set.id]??[]);
    return set.options.filter(option=>ids.has(option.id));
  });
  const delta=selectedOptions.reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
  const invalid=optionSets.some(set=>{
    const count=(selected[set.id]??[]).length;
    return count<set.min||count>set.max||(set.required&&count<1);
  });
  const detail=[
    ...optionSets.flatMap(set=>{
      const ids=new Set(selected[set.id]??[]);
      const names=set.options.filter(option=>ids.has(option.id)).map(option=>option.name);
      return names.length?[set.name+'：'+names.join('、')]:[];
    }),
    note.trim(),
  ].filter(Boolean).join(' · ');
  const totalSteps=Math.max(1,optionSets.length+1);
  const reviewing=activeStep>=optionSets.length;
  const currentSet=optionSets[activeStep];
  const currentCount=currentSet?(selected[currentSet.id]??[]).length:0;
  const currentMissing=Boolean(currentSet&&(currentCount<currentSet.min||(currentSet.required&&currentCount<1)));
  const summaryFor=(set:SyncedOptionSet)=>{
    const ids=new Set(selected[set.id]??[]);
    const names=set.options.filter(option=>ids.has(option.id)).map(option=>option.name);
    return names.length?names.join('、'):'沒有選擇';
  };

  return <div className="cfg-workspace">
    <header className="cfg-product-head">
      <div className="cfg-product-hero">{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}</div>
      <div><small>{product.category}</small><h2>{product.name}</h2><strong>{money(product.priceMinor+delta)}</strong></div>
      <GuidedProgress current={Math.min(activeStep+1,totalSteps)} total={totalSteps} label={reviewing?'核對商品設定':currentSet?.name??'商品設定'}/>
    </header>

    {optionSets.slice(0,Math.min(activeStep,optionSets.length)).map(set=><CompletedStep key={set.id} label={set.name} summary={summaryFor(set)} onEdit={()=>{setActiveStep(optionSets.indexOf(set));setChoiceFeedback('')}}/>)}

    {!reviewing&&currentSet?<section className="cfg-block cfg-current-step" key={currentSet.id}>
      <header><div><small>而家請完成</small><b>{currentSet.name}</b></div><span>{currentSet.required?'必選':'可選'} · {currentSet.selection==='SINGLE'?'單選':'多選'} · {currentSet.min}–{currentSet.max}</span></header>
      <p className="cfg-step-instruction">選好後撳「繼續」。之後先會顯示下一組。</p>
      <div className="cfg-choice-grid three">{currentSet.options.map(option=>{
        const active=(selected[currentSet.id]??[]).includes(option.id);
        const price=option.priceAdjustmentMinor;
        return <button type="button" key={option.id} aria-pressed={active} className={active?'active':''} onClick={()=>toggle(currentSet,option.id)}>
          <span className="cfg-choice-state" aria-hidden="true">{active?'✓':''}</span><b>{option.name}</b>{price!==0?<small>{price>0?'+':''}{money(price)}</small>:null}
        </button>;
      })}</div>
      {choiceFeedback?<DisabledReason>{choiceFeedback}</DisabledReason>:null}
      {currentMissing?<DisabledReason>{currentSet.required?'請先完成必選項目。':`最少選擇 ${currentSet.min} 項。`}</DisabledReason>:null}
      <footer className="cfg-step-action"><button type="button" className="primary" disabled={currentMissing} onClick={()=>{setActiveStep(step=>step+1);setChoiceFeedback('')}}>繼續：{activeStep+1<optionSets.length?optionSets[activeStep+1]?.name:'核對商品'}</button></footer>
    </section>:null}

    {reviewing?<section className="cfg-review" aria-label="核對商品設定">
      <header><div><small>最後一步</small><h3>核對後加入購物籃</h3></div><strong>{money((product.priceMinor+delta)*qty)}</strong></header>
      {optionSets.length===0?<p className="cfg-no-options">此商品沒有已發布選項，可以直接設定數量。</p>:null}
      <div className="cfg-review-summary">{optionSets.map(set=><p key={set.id}><span>{set.name}</span><b>{summaryFor(set)}</b></p>)}</div>
      <div className="cfg-qty"><span>數量</span><button type="button" onClick={()=>setQty(Math.max(1,qty-1))} aria-label="減少數量">−</button><b>{qty}</b><button type="button" onClick={()=>setQty(qty+1)} aria-label="增加數量">＋</button></div>
      <label className="cfg-note"><span>商品備註 <small>選填</small></span><input value={note} maxLength={60} onChange={event=>setNote(event.target.value)} placeholder="例如：不要蔥、醬分開"/><small>{note.length}/60</small></label>
      <footer className="cfg-action"><div><span>單價</span><b>{money(product.priceMinor+delta)}</b></div><button type="button" className="primary" disabled={invalid} onClick={()=>onAdd(detail,delta,qty)}>加入購物籃　{money((product.priceMinor+delta)*qty)}</button></footer>
    </section>:null}
  </div>;
}

export function OrganizeWorkspace({lines,onDone}:{lines:readonly WorkspaceCartLine[];onDone:()=>void}){
  const mealLines=lines.filter(line=>!line.productId.toLowerCase().includes('tea'));
  const drinkLines=lines.filter(line=>line.productId.toLowerCase().includes('tea'));
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [step,setStep]=useState(0);
  const [drink,setDrink]=useState('');
  const requiredReady=mealLines.every(line=>Boolean(selected[line.id]));
  const totalSteps=3;
  return <div className="organize-workspace">
    <header className="organize-title"><div><small>逐步整理</small><h2>{step===0?'完成必選':step===1?'核對配對':'處理飲品'}</h2><p>每次只完成眼前一步；完成後先顯示下一步。</p></div><GuidedProgress current={step+1} total={totalSteps} label={step===0?'完成必選':step===1?'核對配對':'處理飲品'}/></header>
    {step>0?<CompletedStep label="完成必選" summary={`${mealLines.length} 件已處理`} onEdit={()=>setStep(0)}/>:null}
    {step>1?<CompletedStep label="核對配對" summary={`${Math.ceil(mealLines.length/2)} 組`} onEdit={()=>setStep(1)}/>:null}
    {step===0?<section className="organize-section cfg-current-step"><header><b><i>1</i> 完成每件餐點嘅必選</b><span>{Math.max(0,mealLines.length-Object.keys(selected).length)} 件未完成</span></header>
      <div className="organize-required">{mealLines.map((line,index)=><article key={line.id}><div><b>{index+1}　{line.name}</b><small>{line.detail??'請確認必選項'}</small></div><div className="organize-options">{['肉燥','咖喱','菜飯'].map(v=><button key={v} className={selected[line.id]===v?'active':''} onClick={()=>setSelected(s=>({...s,[line.id]:v}))}>{v}</button>)}</div></article>)}</div>
      {!requiredReady?<DisabledReason>仲有 {Math.max(0,mealLines.length-Object.keys(selected).length)} 件餐點未完成必選。</DisabledReason>:null}
      <footer className="cfg-step-action"><button type="button" disabled={!requiredReady} onClick={()=>setStep(1)}>繼續：核對配對</button></footer>
    </section>:null}
    {step===1?<section className="organize-section cfg-current-step"><header><b><i>2</i> 核對配對／代補</b><span>{Math.ceil(mealLines.length/2)} 組</span></header>
      <div className="organize-pairs">{Array.from({length:Math.ceil(mealLines.length/2)},(_,idx)=>{const a=mealLines[idx*2],b=mealLines[idx*2+1];return <article key={idx}><strong>{idx+1} 組</strong><div>{a?<span>{a.name}</span>:null}{b?<span>{b.name}</span>:<em>＋ 未配對</em>}</div></article>})}</div>
      <footer className="cfg-step-action"><button type="button" onClick={()=>setStep(2)}>繼續：處理飲品</button></footer>
    </section>:null}
    {step===2?<section className="organize-section cfg-current-step"><header><b><i>3</i> 快捷飲品</b><span>{drinkLines.length} 杯已在單內</span></header><div className="organize-drinks">{['凍檸茶','台式奶茶','手打檸檬茶','不用飲品'].map(v=><button type="button" aria-pressed={drink===v} className={drink===v?'active':''} key={v} onClick={()=>setDrink(v)}>{v}</button>)}</div><footer className="organize-footer"><button type="button" onClick={onDone}>完成整理</button></footer></section>:null}
  </div>;
}

export function ComboWorkspace({
  products,combos,pools,onAdd,
}:{
  products:readonly WorkspaceProduct[];
  combos:readonly SyncedCombo[];
  pools:readonly SyncedComboPool[];
  onAdd:(comboId:string,comboName:string,detail:string,unitMinor:number)=>void;
}){
  const activeCombos=combos.filter(combo=>combo.active);
  const [comboId,setComboId]=useState(activeCombos[0]?.id??'');
  const [selected,setSelected]=useState<Record<string,string>>({});
  const [activeStep,setActiveStep]=useState(0);
  const combo=activeCombos.find(row=>row.id===comboId)??activeCombos[0];
  const poolById=useMemo(()=>new Map(pools.map(pool=>[pool.id,pool] as const)),[pools]);
  const productById=useMemo(()=>new Map(products.map(product=>[product.id,product] as const)),[products]);
  const selectedPools=combo
    ?[combo.mainPoolId,...combo.addonPoolIds].filter(Boolean).map(id=>poolById.get(id!)).filter((pool):pool is SyncedComboPool=>Boolean(pool))
    :[];
  const groups=selectedPools.flatMap(pool=>pool.groups.map(group=>({pool,group})));

  const resolveChoice=(groupId:string)=>{
    const choiceId=selected[groupId];
    if(!choiceId)return null;
    for(const {group} of groups){
      if(group.id!==groupId)continue;
      for(const subPool of group.subPools){
        const choice=subPool.choices.find(row=>row.id===choiceId);
        if(choice)return {subPool,choice};
      }
    }
    return null;
  };
  const requiredMissing=groups.some(({group})=>group.required&&!resolveChoice(group.id));
  const additions=groups.reduce((sum,{group})=>{
    const resolved=resolveChoice(group.id);
    return sum+(resolved?.subPool.priceAdjustmentMinor??0)+(resolved?.choice.priceAdjustmentMinor??0);
  },0);
  const total=(combo?.basePriceMinor??0)+additions;
  const detail=groups.flatMap(({group})=>{
    const resolved=resolveChoice(group.id);
    if(!resolved)return [];
    const choice=resolved.choice;
    const label=choice.type==='PRODUCT'
      ?productById.get(choice.productId??'')?.name??choice.productId??''
      :choice.label;
    return [group.name+'：'+label+(resolved.subPool.priceAdjustmentMinor!==0?' ('+(resolved.subPool.priceAdjustmentMinor>0?'+':'')+money(resolved.subPool.priceAdjustmentMinor)+')':'')];
  }).join(' · ');
  const currentGroup=groups[activeStep];
  const reviewing=activeStep>=groups.length;
  const currentGroupMissing=Boolean(currentGroup?.group.required&&!resolveChoice(currentGroup.group.id));
  const groupSummary=(groupId:string)=>{
    const resolved=resolveChoice(groupId);
    if(!resolved)return '沒有選擇';
    return resolved.choice.type==='PRODUCT'
      ?productById.get(resolved.choice.productId??'')?.name??resolved.choice.productId??'未命名商品'
      :resolved.choice.label;
  };

  if(!combo)return <div className="combo-workspace"><div className="ordering-empty">管理端暫時未有已啟用套餐。</div></div>;

  return <div className="combo-workspace">
    <header className="combo-title"><div><small>套餐設定</small><h2>{combo.name}</h2><p>每次只處理一組，完成後再進入下一組。</p></div><GuidedProgress current={Math.min(activeStep+1,Math.max(1,groups.length+1))} total={Math.max(1,groups.length+1)} label={reviewing?'核對套餐':currentGroup?.group.name??'核對套餐'}/></header>
    <section className="combo-tier-section"><header><b>先選套餐</b><span>管理端已發布</span></header><div className="combo-tiers">{activeCombos.map(row=><button type="button" key={row.id} aria-pressed={combo.id===row.id} className={combo.id===row.id?'active':''} onClick={()=>{setComboId(row.id);setSelected({});setActiveStep(0)}}><b>{row.name}</b><span>{money(row.basePriceMinor)}</span></button>)}</div></section>

    {groups.slice(0,Math.min(activeStep,groups.length)).map(({pool,group})=><CompletedStep key={pool.id+':'+group.id} label={group.name} summary={groupSummary(group.id)} onEdit={()=>setActiveStep(groups.findIndex(row=>row.group.id===group.id))}/>)}

    {!reviewing&&currentGroup?<section className="combo-section combo-current-step" key={currentGroup.pool.id+':'+currentGroup.group.id}>
      <header><div><small>而家請完成</small><b>{currentGroup.group.name}</b></div><span>{currentGroup.group.required?'必選':'可選'} {currentGroup.group.min}–{currentGroup.group.max}</span></header>
      <p>選好後撳「繼續」。未到嘅組別唔會預先展開。</p>
      {currentGroup.group.subPools.map(subPool=><div key={subPool.id} className="combo-admin-subpool">
        <header><strong>{subPool.name}</strong><span>{subPool.priceAdjustmentMinor===0?'餐內':(subPool.priceAdjustmentMinor>0?'+':'')+money(subPool.priceAdjustmentMinor)}</span></header>
        <div className="combo-product-grid">{subPool.choices.map(choice=>{
          const label=choice.type==='PRODUCT'
            ?productById.get(choice.productId??'')?.name??choice.productId??'未命名商品'
            :choice.label;
          const product=choice.type==='PRODUCT'?productById.get(choice.productId??''):undefined;
          const active=selected[currentGroup.group.id]===choice.id;
          return <button type="button" key={choice.id} aria-pressed={active} className={active?'active':''} onClick={()=>setSelected(current=>({...current,[currentGroup.group.id]:choice.id}))}>
            {product?.imageUrl?<img src={product.imageUrl} alt=""/>:null}
            <span className="cfg-choice-state" aria-hidden="true">{active?'✓':''}</span><b>{label}</b>
            {product?.optionSets?.length?<small>{product.optionSets.length} 個商品選項</small>:null}
          </button>;
        })}</div>
      </div>)}
      {currentGroupMissing?<DisabledReason>請先完成「{currentGroup.group.name}」必選項目。</DisabledReason>:null}
      <footer className="cfg-step-action"><button type="button" disabled={currentGroupMissing} onClick={()=>setActiveStep(step=>step+1)}>繼續：{activeStep+1<groups.length?groups[activeStep+1]?.group.name:'核對套餐'}</button></footer>
    </section>:null}

    {reviewing?<section className="combo-review"><header><div><small>最後一步</small><h3>核對套餐內容</h3></div><strong>{money(total)}</strong></header><div>{groups.map(({group})=><p key={group.id}><span>{group.name}</span><b>{groupSummary(group.id)}</b></p>)}</div><footer className="combo-footer"><button type="button" disabled={requiredMissing} onClick={()=>onAdd(combo.id,combo.name,detail,total)}>加入購物籃　{money(total)}</button></footer></section>:null}
  </div>;
}

export interface HoldPlacementTable{
  readonly id:string;
  readonly label:string;
  readonly occupied:boolean;
  readonly codeLabel?:string;
}

export function HoldCartWorkspace({
  lines,totalMinor,tables,onHoldWaiting,onHoldQueue,onHoldTable
}:{
  lines:readonly WorkspaceCartLine[];
  totalMinor:number;
  tables:readonly HoldPlacementTable[];
  onHoldWaiting:(partySize:number,note:string)=>void;
  onHoldQueue:(partySize:number,note:string)=>void;
  onHoldTable:(tableId:string,partySize:number,note:string)=>void;
}){
  const [mode,setMode]=useState<'cart'|'dining'>('cart');
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');

  return <div className="hold-cart-workspace">
    <header>
      <div><h2>暫存工作台</h2><p>同一頁完成：暫存待客，或者掛入堂食／輪候。</p></div>
      <strong>{money(totalMinor)}</strong>
    </header>

    <section className="hold-kind-grid">
      <button className="waiting" onClick={()=>onHoldWaiting(partySize,note)}>
        <b>暫存待客</b>
        <span>客人未確認；保存呢張 Cart，之後由「取回訂單」直接攞返。</span>
      </button>
      <button className={mode==='dining'?'active dining':'dining'} onClick={()=>setMode('dining')}>
        <b>掛入堂食</b>
        <span>唔跳頁；下面「購物車內容」即場轉成加入輪候＋1–9 號枱。</span>
      </button>
    </section>

    {mode==='cart'?<section className="hold-cart-summary">
      <header><b>購物車內容</b><span>{lines.reduce((sum,line)=>sum+line.qty,0)} 件</span></header>
      {lines.map(line=><article key={line.id}>
        <span>{line.qty}×</span>
        <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>
        <strong>{money(line.qty*line.unitMinor)}</strong>
      </article>)}
    </section>:<section className="hold-inline-dining">
      <aside className="hold-inline-left">
        <div className="hold-party">
          <span>人數</span>
          <div><button onClick={()=>setPartySize(Math.max(1,partySize-1))}>−</button><b>{partySize}</b><button onClick={()=>setPartySize(partySize+1)}>＋</button></div>
        </div>
        <button className="hold-queue-button" onClick={()=>onHoldQueue(partySize,note)}>
          <b>加入輪候</b>
          <span>直接放入堂食輪候，唔使再跳堂食頁揀第二次。</span>
        </button>
        <label className="hold-note"><span>備註</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：等 10 分鐘"/></label>
        <button className="hold-back-cart" onClick={()=>setMode('cart')}>返回購物車內容</button>
      </aside>
      <div className="hold-nine-grid">
        {tables.map(table=><button key={table.id} className={table.occupied?'occupied':'available'} disabled={table.occupied} onClick={()=>onHoldTable(table.id,partySize,note)}>
          <b>{table.label}</b>
          <span>{table.occupied?(table.codeLabel??'使用中'):'空枱'}</span>
        </button>)}
      </div>
    </section>}
  </div>;
}


export interface WorkspaceHoldDraft{
  readonly id:string;
  readonly codeLabel:string;
  readonly kind:'dining'|'waiting';
  readonly createdAt:string;
  readonly partySize:number;
  readonly note:string;
  readonly totalMinor:number;
  readonly assignedTable?:string;
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number}[];
}

export function HoldListWorkspace({holds,onRestore,onRemove}:{holds:readonly WorkspaceHoldDraft[];onRestore:(hold:WorkspaceHoldDraft)=>void;onRemove:(id:string)=>void}){
  return <div className="hold-list-workspace">
    <header><div><h2>暫存單</h2><p>未完成付款／未正式提交嘅 Cart 全部喺呢度取回。</p></div><strong>{holds.length} 張</strong></header>
    <div className="hold-list">
      {holds.length?holds.map(hold=><article key={hold.id}>
        <div className="hold-list-head"><div><b>{hold.codeLabel}</b><span>{hold.kind==='dining'?'堂食／輪候':'暫存待客'}</span></div><strong>{money(hold.totalMinor)}</strong></div>
        <div className="hold-list-meta"><span>{new Date(hold.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</span><span>{hold.partySize} 位</span>{hold.assignedTable?<span>枱 {hold.assignedTable.replace('T','')}</span>:null}</div>
        <div className="hold-list-items">{hold.items.map((item,index)=><p key={hold.id+'-'+index}><span>{item.qty}×</span><b>{item.name}</b><strong>{money(item.qty*item.unitMinor)}</strong></p>)}</div>
        {hold.note?<small>備註：{hold.note}</small>:null}
        <footer><button type="button" className="danger" onClick={()=>onRemove(hold.id)}>刪除暫存</button><button type="button" className="primary" onClick={()=>onRestore(hold)}>取回購物車</button></footer>
      </article>):<div className="hold-list-empty">而家未有暫存單。</div>}
    </div>
  </div>;
}
