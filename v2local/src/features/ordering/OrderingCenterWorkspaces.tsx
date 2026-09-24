import {useMemo,useState} from 'react';
import {CompletedStep,DisabledReason,GuidedProgress} from '../../presentation/SmtUi.tsx';
import type {SyncedCombo,SyncedComboPool,SyncedOptionSet} from '../../runtime/admin-config-projection.ts';
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
  const [choiceFeedback,setChoiceFeedback]=useState('');
  const optionSets=product.optionSets??[];
  const [activeStep,setActiveStep]=useState(0);
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
    if(set.selection==='SINGLE'){
      const index=optionSets.findIndex(row=>row.id===set.id);
      if(index>=0)window.setTimeout(()=>setActiveStep(current=>current===index?Math.min(optionSets.length,index+1):current),140);
    }
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
  const summaryFor=(set:SyncedOptionSet)=>{
    const ids=new Set(selected[set.id]??[]);
    const names=set.options.filter(option=>ids.has(option.id)).map(option=>option.name);
    return names.length?names.join('、'):'沒有選擇';
  };
  const reviewing=activeStep>=optionSets.length;
  const activeSet=optionSets[activeStep];
  const activeCount=activeSet?(selected[activeSet.id]??[]).length:0;
  const activeReady=!activeSet||(
    activeCount>=activeSet.min&&
    activeCount<=activeSet.max&&
    (!activeSet.required||activeCount>0)
  );
  const stepLabel=reviewing?'核對數量與備註':activeSet?.name??'核對商品';
  const editorReady=!invalid&&(reviewing||optionSets.length===0);

  return <div className="cfg-workspace">
    <header className="cfg-product-head">
      <div><small>{product.category}</small><h2>{product.name}</h2><p>{optionSets.length?`逐項完成 ${optionSets.length} 組設定；已完成步驟會自動收起。`:'此商品沒有已發布選項，確認數量即可加入。'}</p></div>
      <div className="cfg-live-total"><small>目前單價</small><strong>{money(product.priceMinor+delta)}</strong><span>由正式菜單與已選選項即時計算</span></div>
    </header>

    <section className="cfg-editor" aria-label="商品設定">
      <div className="cfg-editor-options">
        {optionSets.length?<div className="cfg-step-heading"><div><small>而家請完成</small><h3>{stepLabel}</h3><p>{reviewing?'所有必選已完成；核對右邊數量、備註同金額。':activeSet?.selection==='SINGLE'?'揀選一項後會自動進入下一步。':'只處理眼前呢一組，完成後再繼續。'}</p></div><GuidedProgress current={Math.min(activeStep+1,optionSets.length+1)} total={optionSets.length+1} label={stepLabel}/></div>:null}

        {optionSets.slice(0,Math.min(activeStep,optionSets.length)).map(set=><CompletedStep key={set.id} label={set.name} summary={summaryFor(set)} onEdit={()=>{setChoiceFeedback('');setActiveStep(optionSets.findIndex(row=>row.id===set.id))}}/>)}

        {optionSets.length===0?<p className="cfg-no-options">此商品沒有已發布選項；右邊確認數量同備註，就可以加入購物籃。</p>:!reviewing&&activeSet?<section className={`cfg-block cfg-current-option${activeReady?'':' is-missing'}`} key={activeSet.id} aria-live="polite">
          <header><div><small>{activeReady?'已選 '+summaryFor(activeSet):'尚欠選擇'}</small><b>{activeSet.name}</b></div><span>{activeSet.required?'必選':'可選'} · {activeSet.selection==='SINGLE'?'單選':'多選'} · {activeSet.min}–{activeSet.max}</span></header>
          <div className="cfg-choice-grid three">{activeSet.options.map(option=>{
            const active=(selected[activeSet.id]??[]).includes(option.id);
            const price=option.priceAdjustmentMinor;
            return <button type="button" key={option.id} aria-pressed={active} className={active?'active':''} onClick={()=>toggle(activeSet,option.id)}>
              <span className="cfg-choice-state" aria-hidden="true">{active?'✓':''}</span><b>{option.name}</b>{price!==0?<small>{price>0?'+':''}{money(price)}</small>:<small>不加價</small>}
            </button>;
          })}</div>
          {activeSet.selection==='MULTIPLE'?<footer className="cfg-step-action"><button type="button" disabled={!activeReady} onClick={()=>setActiveStep(Math.min(optionSets.length,activeStep+1))}>{activeStep===optionSets.length-1?'完成選項':'繼續下一項'} →</button></footer>:!activeSet.required&&activeCount===0?<footer className="cfg-step-action"><button type="button" onClick={()=>setActiveStep(Math.min(optionSets.length,activeStep+1))}>略過呢項，繼續 →</button></footer>:null}
        </section>:null}
        {reviewing&&optionSets.length?<section className="cfg-ready-card" role="status"><span aria-hidden="true">✓</span><div><small>選項已完成</small><h3>最後核對數量同備註</h3><p>需要改選項，可以撳上面任何一項返回修改。</p></div></section>:null}
        {choiceFeedback?<DisabledReason>{choiceFeedback}</DisabledReason>:null}
      </div>

      <aside className="cfg-editor-summary">
        <header><small>{invalid?'完成目前必選':'最後核對'}</small><h3>{invalid?'仲有設定未完成':'數量與備註'}</h3></header>
        <div className="cfg-qty"><span>數量</span><button type="button" onClick={()=>setQty(Math.max(1,qty-1))} aria-label="減少數量">−</button><b>{qty}</b><button type="button" onClick={()=>setQty(qty+1)} aria-label="增加數量">＋</button></div>
        <label className="cfg-note"><span>商品備註 <small>選填</small></span><input value={note} maxLength={60} onChange={event=>setNote(event.target.value)} placeholder="例如：不要蔥、醬分開"/><small>{note.length}/60</small></label>
        <div className="cfg-price-readback"><span>基價</span><b>{money(product.priceMinor)}</b><span>選項價差</span><b>{delta>0?'+':''}{money(delta)}</b><strong>合計</strong><strong>{money((product.priceMinor+delta)*qty)}</strong></div>
        {!editorReady?<DisabledReason>{invalid?'請先完成所有必選項目，先可以加入購物籃。':'請先完成或略過目前選項，再作最後核對。'}</DisabledReason>:null}
        <button type="button" className="cfg-save primary" disabled={!editorReady} onClick={()=>onAdd(detail,delta,qty)}>加入購物籃　{money((product.priceMinor+delta)*qty)}</button>
      </aside>
    </section>
  </div>;
}

export function OrganizeWorkspace({lines,onDone}:{lines:readonly WorkspaceCartLine[];onDone:()=>void}){
  const mealLines=lines.filter(line=>!line.productId.toLowerCase().includes('tea'));
  const drinkLines=lines.filter(line=>line.productId.toLowerCase().includes('tea'));
  const [selected,setSelected]=useState<Record<string,string>>({});
  return <div className="organize-workspace">
    <header className="organize-title"><h2>整理工作台</h2><div><span>未完成 {Math.max(0,mealLines.length-Object.keys(selected).length)}</span><span>可配對 {Math.ceil(mealLines.length/2)}</span><span>待補飲品 {drinkLines.length}</span></div></header>
    <section className="organize-section"><header><b><i>1</i> 必選</b><span>{mealLines.length}</span></header>
      <div className="organize-required">{mealLines.map((line,index)=><article key={line.id}><div><b>{index+1}　{line.name}</b><small>{line.detail??'請確認必選項'}</small></div><div className="organize-options">{['肉燥','咖喱','菜飯'].map(v=><button key={v} className={selected[line.id]===v?'active':''} onClick={()=>setSelected(s=>({...s,[line.id]:v}))}>{v}</button>)}</div></article>)}</div>
    </section>
    <section className="organize-section"><header><b><i>2</i> 配對／代補</b><span>{Math.ceil(mealLines.length/2)}</span></header>
      <div className="organize-pairs">{Array.from({length:Math.ceil(mealLines.length/2)},(_,idx)=>{const a=mealLines[idx*2],b=mealLines[idx*2+1];return <article key={idx}><strong>{idx+1} 組</strong><div>{a?<span>{a.name}</span>:null}{b?<span>{b.name}</span>:<em>＋ 未配對</em>}</div></article>})}</div>
    </section>
    <section className="organize-section"><header><b><i>3</i> 快捷飲品</b><span>{drinkLines.length}</span></header><div className="organize-drinks">{['凍檸茶','台式奶茶','手打檸檬茶','不用飲品'].map(v=><button key={v}>{v}</button>)}</div></section>
    <footer className="organize-footer"><button onClick={onDone}>完成整理</button></footer>
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

  if(!combo)return <div className="combo-workspace"><div className="ordering-empty">Admin 暫時未有已啟用套餐。</div></div>;

  return <div className="combo-workspace">
    <header className="combo-title"><div><h2>套餐</h2><p>套餐、Pool、價差同可選商品全部來自 Admin 已保存版本。</p></div><strong>{combo.name}　{money(total)}</strong></header>
    <div className="combo-tiers">{activeCombos.map(row=><button key={row.id} className={combo.id===row.id?'active':''} onClick={()=>{setComboId(row.id);setSelected({});}}><b>{row.name}</b><span>{money(row.basePriceMinor)}</span></button>)}</div>
    {groups.map(({pool,group},groupIndex)=><section className="combo-section" key={pool.id+':'+group.id}>
      <header><b>{groupIndex+1}　{group.name}</b><span>{group.required?'必選':'可選'} {group.min}–{group.max}</span></header>
      {group.subPools.map(subPool=><div key={subPool.id} className="combo-admin-subpool">
        <header><strong>{subPool.name}</strong><span>{subPool.priceAdjustmentMinor===0?'餐內':(subPool.priceAdjustmentMinor>0?'+':'')+money(subPool.priceAdjustmentMinor)}</span></header>
        <div className="combo-product-grid">{subPool.choices.map(choice=>{
          const label=choice.type==='PRODUCT'
            ?productById.get(choice.productId??'')?.name??choice.productId??'未命名商品'
            :choice.label;
          const product=choice.type==='PRODUCT'?productById.get(choice.productId??''):undefined;
          const active=selected[group.id]===choice.id;
          return <button key={choice.id} className={active?'active':''} onClick={()=>setSelected(current=>({...current,[group.id]:choice.id}))}>
            {product?.imageUrl?<img src={product.imageUrl} alt=""/>:null}
            <b>{label}</b>
            {product?.optionSets?.length?<small>{product.optionSets.length} 個商品選項</small>:null}
          </button>;
        })}</div>
      </div>)}
    </section>)}
    <section className="combo-summary"><div><span>已選</span><b>{detail||'請完成必選項目'}</b></div><strong>{money(total)}</strong></section>
    <footer className="combo-footer"><button disabled={requiredMissing} onClick={()=>onAdd(combo.id,combo.name,detail,total)}>加入購物車　{money(total)}</button></footer>
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

export function HoldListWorkspace({holds,currentCartCount=0,onRestore,onRemove}:{holds:readonly WorkspaceHoldDraft[];currentCartCount?:number;onRestore:(hold:WorkspaceHoldDraft)=>void;onRemove:(id:string)=>void}){
  const [restoreTarget,setRestoreTarget]=useState<WorkspaceHoldDraft|null>(null);
  const requestRestore=(hold:WorkspaceHoldDraft)=>{
    if(currentCartCount>0){setRestoreTarget(hold);return;}
    onRestore(hold);
  };
  return <div className="hold-list-workspace">
    <header><div><h2>暫存單</h2></div><strong>{holds.length} 張</strong></header>
    {currentCartCount>0?<p className="hold-current-warning">目前購物籃有 {currentCartCount} 件；取回暫存單前會先要求確認。</p>:null}
    <div className="hold-list">
      {holds.length?holds.map(hold=><article key={hold.id}>
        <div className="hold-list-head"><div><b>{hold.codeLabel}</b><span>{hold.kind==='dining'?'堂食／輪候':'暫存'}</span></div><strong>{money(hold.totalMinor)}</strong></div>
        <div className="hold-list-meta"><span>{new Date(hold.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</span><span>{hold.partySize} 位</span>{hold.assignedTable?<span>枱 {hold.assignedTable.replace('T','')}</span>:null}</div>
        <div className="hold-list-items">{hold.items.map((item,index)=><p key={hold.id+'-'+index}><span>{item.qty}×</span><b>{item.name}</b><strong>{money(item.qty*item.unitMinor)}</strong></p>)}</div>
        {hold.note?<small>備註：{hold.note}</small>:null}
        <footer><button type="button" className="danger" onClick={()=>onRemove(hold.id)}>刪除</button><button type="button" className="primary" onClick={()=>requestRestore(hold)}>取回</button></footer>
      </article>):<div className="hold-list-empty">未有暫存單</div>}
    </div>
    {restoreTarget?<div className="hold-restore-confirm" role="dialog" aria-modal="true" aria-label="確認取回暫存單">
      <section><h3>取回 {restoreTarget.codeLabel}？</h3><p>目前購物籃有 {currentCartCount} 件。繼續會以呢張暫存單取代目前購物籃。</p><div><button type="button" onClick={()=>setRestoreTarget(null)}>返回</button><button type="button" className="primary" onClick={()=>{const target=restoreTarget;setRestoreTarget(null);onRestore(target)}}>確認取回</button></div></section>
    </div>:null}
  </div>;
}
