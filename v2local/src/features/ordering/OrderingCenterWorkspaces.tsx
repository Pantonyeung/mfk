import {useMemo,useState} from 'react';
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
  |{readonly type:'product';readonly productId:string;readonly lineId?:string}
  |{readonly type:'required'}
  |{readonly type:'drink-config';readonly choiceId:string;readonly qty:number;readonly targetLineId?:string}
  |{readonly type:'organize'}
  |{readonly type:'combo'}
  |{readonly type:'hold'}
  |{readonly type:'holds'}
  |null;

const money=(minor:number)=>(minor<0?'-':'')+String.fromCharCode(36)+(Math.abs(minor)/100).toFixed(2);

export function quickConfigurationForProduct(product:WorkspaceProduct){
  const sets=product.optionSets??[];
  // Owner A3b: Quick mode may admit Required groups into Cart unresolved.
  // forceShow-only groups still use the full editor unless separately decided.
  if(sets.some(set=>set.forceShow&&!set.required&&set.min<=0))return Object.freeze({eligible:false,detail:'',deltaMinor:0});
  const chosen=sets.map(set=>({
    set,
    options:(set.required||set.min>0)?[]:set.options.filter(option=>option.defaultSelected),
  }));
  const invalid=chosen.some(({set,options})=>(set.required||set.min>0)?false:options.length<set.min||options.length>set.max);
  if(invalid)return Object.freeze({eligible:false,detail:'',deltaMinor:0});
  const deltaMinor=chosen.reduce((sum,row)=>sum+row.options.reduce((value,option)=>value+option.priceAdjustmentMinor,0),0);
  const detail=chosen.flatMap(({set,options})=>{
    const names=options.map(option=>option.name);
    return names.length?[set.name+'：'+names.join('、')]:[];
  }).join(' · ');
  return Object.freeze({eligible:true,detail,deltaMinor});
}

export const DRINK_SUPPLEMENT_PRODUCT_PREFIX='drink-supplement:' as const;

export interface WorkspaceDrinkSupplementChoice{
  readonly id:string;
  readonly label:string;
  readonly adjustmentMinor:number;
  readonly kind:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
  readonly enabled:boolean;
  readonly requiresConfiguration:boolean;
}

export function isDrinkSupplementProductId(productId:string){
  return productId.startsWith(DRINK_SUPPLEMENT_PRODUCT_PREFIX);
}

export function projectDrinkSupplementChoices(
  products:readonly WorkspaceProduct[],
  pools:readonly SyncedComboPool[],
):WorkspaceDrinkSupplementChoice[]{
  const byProduct=new Map(products.map(product=>[product.id,product] as const));
  const rows:WorkspaceDrinkSupplementChoice[]=[];
  for(const pool of pools){
    if(pool.kind!=='ADDON'||pool.addonKind!=='DRINK')continue;
    for(const group of pool.groups){
      for(const subPool of group.subPools){
        for(const choice of subPool.choices){
          const product=choice.type==='PRODUCT'&&choice.productId?byProduct.get(choice.productId):undefined;
          rows.push(Object.freeze({
            id:[pool.id,group.id,subPool.id,choice.id].join('::'),
            label:choice.type==='PRODUCT'
              ?(product?.name??choice.label??choice.productId??'未命名飲品')
              :choice.label,
            adjustmentMinor:subPool.priceAdjustmentMinor+choice.priceAdjustmentMinor,
            kind:choice.type,
            ...(choice.productId?{productId:choice.productId}:{}),
            enabled:choice.type!=='PRODUCT'||Boolean(product),
            requiresConfiguration:Boolean(product?.optionSets?.length),
          }));
        }
      }
    }
  }
  return rows;
}

export interface WorkspaceRequiredTask{
  readonly id:string;
  readonly lineId:string;
  readonly lineName:string;
  readonly groupId:string;
  readonly groupName:string;
  readonly selection:'SINGLE'|'MULTI';
  readonly min:number;
  readonly max:number;
  readonly missingCount:number;
  readonly selectedOptionIds:readonly string[];
  readonly options:readonly {id:string;name:string;priceAdjustmentMinor:number}[];
}

function explicitConfigurationFromDetail(product:WorkspaceProduct,detail?:string){
  const sets=product.optionSets??[];
  const selected:Record<string,string[]>={};
  const noteParts:string[]=[];
  const parts=String(detail??'').split(' · ').map(part=>part.trim()).filter(Boolean);
  for(const part of parts){
    const set=sets.find(row=>part.startsWith(row.name+'：'));
    if(!set){noteParts.push(part);continue;}
    const labels=part.slice(set.name.length+1).split('、').map(label=>label.trim()).filter(Boolean);
    const ids=set.options.filter(option=>labels.includes(option.name)).map(option=>option.id);
    if(labels.length&&ids.length===labels.length)selected[set.id]=ids;
    else noteParts.push(part);
  }
  return {selected,note:noteParts.join(' · ')};
}

export function requiredTasksForCart(lines:readonly WorkspaceCartLine[],products:readonly WorkspaceProduct[]):WorkspaceRequiredTask[]{
  const byProduct=new Map(products.map(product=>[product.id,product] as const));
  const tasks:WorkspaceRequiredTask[]=[];
  for(const line of lines){
    const product=byProduct.get(line.productId);
    if(!product)continue;
    const current=explicitConfigurationFromDetail(product,line.detail).selected;
    for(const set of product.optionSets??[]){
      const min=Math.max(set.required?1:0,set.min);
      if(min<=0)continue;
      const max=Math.max(min,set.max||min);
      const ids=(current[set.id]??[]).filter(id=>set.options.some(option=>option.id===id));
      if(ids.length>=min&&ids.length<=max)continue;
      tasks.push({
        id:line.id+'::'+set.id,
        lineId:line.id,
        lineName:line.name,
        groupId:set.id,
        groupName:set.name,
        selection:set.selection,
        min,
        max,
        missingCount:Math.max(0,min-ids.length),
        selectedOptionIds:ids,
        options:set.options.map(option=>({id:option.id,name:option.name,priceAdjustmentMinor:option.priceAdjustmentMinor})),
      });
    }
  }
  return tasks;
}

export function applyRequiredSelectionToCart<T extends WorkspaceCartLine>(
  lines:readonly T[],
  products:readonly WorkspaceProduct[],
  lineId:string,
  groupId:string,
  optionIds:readonly string[],
):T[]{
  const byProduct=new Map(products.map(product=>[product.id,product] as const));
  return lines.map(line=>{
    if(line.id!==lineId)return line;
    const product=byProduct.get(line.productId);
    if(!product)throw new Error('REQUIRED_FAST_LANE_PRODUCT_NOT_FOUND');
    const set=(product.optionSets??[]).find(row=>row.id===groupId);
    if(!set)throw new Error('REQUIRED_FAST_LANE_GROUP_NOT_FOUND');
    const allowed=new Set(set.options.map(option=>option.id));
    const unique=[...new Set(optionIds)].filter(id=>allowed.has(id));
    const min=Math.max(set.required?1:0,set.min);
    const max=Math.max(min,set.max||min||1);
    const normalized=set.selection==='SINGLE'?unique.slice(0,1):unique.slice(0,max);
    if(normalized.length<min||normalized.length>max)throw new Error('REQUIRED_FAST_LANE_SELECTION_INVALID');

    const configuration=explicitConfigurationFromDetail(product,line.detail);
    const selected:Record<string,string[]>={...configuration.selected,[groupId]:normalized};
    let deltaMinor=0;
    const detailParts:string[]=[];
    for(const optionSet of product.optionSets??[]){
      const ids=selected[optionSet.id]??[];
      const idSet=new Set(ids);
      const options=optionSet.options.filter(option=>idSet.has(option.id));
      if(options.length){
        detailParts.push(optionSet.name+'：'+options.map(option=>option.name).join('、'));
        deltaMinor+=options.reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
      }
    }
    if(configuration.note)detailParts.push(configuration.note);
    return {
      ...line,
      unitMinor:product.priceMinor+deltaMinor,
      detail:detailParts.join(' · ')||undefined,
    } as T;
  });
}

export function productEditorInitialFromDetail(product:WorkspaceProduct,detail?:string){
  const sets=product.optionSets??[];
  const selected:Record<string,string[]>=Object.fromEntries(
    sets.map(set=>[set.id,set.options.filter(option=>option.defaultSelected).map(option=>option.id)]),
  );
  const noteParts:string[]=[];
  const parts=String(detail??'').split(' · ').map(part=>part.trim()).filter(Boolean);
  for(const part of parts){
    const set=sets.find(row=>part.startsWith(row.name+'：'));
    if(!set){noteParts.push(part);continue;}
    const labels=part.slice(set.name.length+1).split('、').map(label=>label.trim()).filter(Boolean);
    const ids=set.options.filter(option=>labels.includes(option.name)).map(option=>option.id);
    if(labels.length&&ids.length===labels.length)selected[set.id]=ids;
    else noteParts.push(part);
  }
  return Object.freeze({selected:Object.freeze(selected),note:noteParts.join(' · ')});
}

export function ProductConfigWorkspace({
  product,initial,mode='add',pricingBaseMinor,onAdd
}:{
  product:WorkspaceProduct;
  initial?:{readonly qty:number;readonly detail?:string};
  mode?:'add'|'edit';
  pricingBaseMinor?:number;
  onAdd:(detail:string,deltaMinor:number,qty:number)=>void;
}){
  const initialState=useMemo(()=>productEditorInitialFromDetail(product,initial?.detail),[product,initial?.detail]);
  const priceBase=pricingBaseMinor??product.priceMinor;
  const [qty,setQty]=useState(initial?.qty??1);
  const [note,setNote]=useState(initialState.note);
  const [selected,setSelected]=useState<Record<string,string[]>>(()=>Object.fromEntries(
    Object.entries(initialState.selected).map(([id,ids])=>[id,[...ids]]),
  ));

  const toggle=(set:SyncedOptionSet,optionId:string)=>{
    setSelected(current=>{
      const existing=current[set.id]??[];
      if(set.selection==='SINGLE')return {...current,[set.id]:[optionId]};
      const on=existing.includes(optionId);
      const next=on?existing.filter(id=>id!==optionId):[...existing,optionId];
      return {...current,[set.id]:next.slice(0,Math.max(1,set.max||next.length))};
    });
  };
  const selectedOptions=(product.optionSets??[]).flatMap(set=>{
    const ids=new Set(selected[set.id]??[]);
    return set.options.filter(option=>ids.has(option.id));
  });
  const delta=selectedOptions.reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
  const invalid=(product.optionSets??[]).some(set=>{
    const count=(selected[set.id]??[]).length;
    return count<set.min||count>set.max||(set.required&&count<1);
  });
  const detail=[
    ...(product.optionSets??[]).flatMap(set=>{
      const ids=new Set(selected[set.id]??[]);
      const names=set.options.filter(option=>ids.has(option.id)).map(option=>option.name);
      return names.length?[set.name+'：'+names.join('、')]:[];
    }),
    note.trim(),
  ].filter(Boolean).join(' · ');

  return <div className="cfg-workspace">
    <header className="cfg-product-head">
      <div className="cfg-product-hero">{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}</div>
      <div><small>{product.category}</small><h2>{product.name}</h2><strong>{money(priceBase+delta)}</strong></div>
      <div className="cfg-qty"><span>數量</span><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><b>{qty}</b><button onClick={()=>setQty(qty+1)}>＋</button></div>
    </header>

    {(product.optionSets??[]).length
      ?(product.optionSets??[]).map(set=><section className="cfg-block" key={set.id}>
        <header><b>{set.name}</b><span>{set.required?'必選':'可選'} · {set.selection==='SINGLE'?'單選':'多選'} · {set.min}–{set.max}</span></header>
        <div className="cfg-choice-grid three">{set.options.map(option=>{
          const active=(selected[set.id]??[]).includes(option.id);
          const price=option.priceAdjustmentMinor;
          return <button key={option.id} className={active?'active':''} onClick={()=>toggle(set,option.id)}>
            <b>{option.name}</b>{price!==0?<small>{price>0?'+':''}{money(price)}</small>:null}
          </button>;
        })}</div>
      </section>)
      :<section className="cfg-block"><header><b>商品選項</b><span>Admin</span></header><p>此商品目前冇已發布選項組。</p></section>}

    <label className="cfg-note"><span>備註</span><input value={note} maxLength={60} onChange={event=>setNote(event.target.value)} placeholder="例如：不要蔥、醬分開"/><small>{note.length}/60</small></label>
    <footer className="cfg-action"><div><span>單價</span><b>{money(priceBase+delta)}</b></div><button className="primary" disabled={invalid} onClick={()=>onAdd(detail,delta,qty)}>{mode==='edit'?'儲存修改':'加入訂單'}　{money((priceBase+delta)*qty)}</button></footer>
  </div>;
}

export function DrinkSupplementWorkspace({
  cart,choices,onAdd,onConfigure,
}:{
  cart:readonly WorkspaceCartLine[];
  choices:readonly WorkspaceDrinkSupplementChoice[];
  onAdd:(choiceId:string,qty:number,targetLineId?:string)=>void;
  onConfigure:(choiceId:string,qty:number,targetLineId?:string)=>void;
}){
  const targets=cart.filter(line=>!isDrinkSupplementProductId(line.productId));
  const [qty,setQty]=useState(1);
  const [targetLineId,setTargetLineId]=useState('');
  return <section className="drink-supplement-workspace" aria-label="飲品補選">
    <header>
      <div><small>OPTIONAL DRINK</small><h3>飲品補選</h3><p>可跳過，唔阻結帳。只有明確揀「唔飲嘢」先按 Admin 價差扣減；留空唔會自動扣錢。</p></div>
      <span>Admin 飲品 Pool</span>
    </header>
    <div className="drink-supplement-controls">
      <div className="drink-targets">
        <b>配餐</b>
        <button type="button" className={targetLineId===''?'active':''} onClick={()=>setTargetLineId('')}>未指定（按落單次序）</button>
        {targets.map((line,index)=><button type="button" key={line.id} className={targetLineId===line.id?'active':''} onClick={()=>setTargetLineId(line.id)}>
          {index+1}　{line.name}
        </button>)}
      </div>
      <div className="drink-qty"><span>數量</span><button type="button" onClick={()=>setQty(Math.max(1,qty-1))}>−</button><b>{qty}</b><button type="button" onClick={()=>setQty(qty+1)}>＋</button></div>
    </div>
    <div className="drink-supplement-grid">
      {choices.length?choices.map(choice=><button
        type="button"
        key={choice.id}
        disabled={!choice.enabled}
        onClick={()=>choice.requiresConfiguration
          ?onConfigure(choice.id,qty,targetLineId||undefined)
          :onAdd(choice.id,qty,targetLineId||undefined)}
      >
        <b>{choice.label}</b>
        <small>{choice.adjustmentMinor===0?'餐內':(choice.adjustmentMinor>0?'+':'')+money(choice.adjustmentMinor)}</small>
        {choice.requiresConfiguration?<em>有選項</em>:null}
      </button>):<p>Admin 暫時未有已發布 DRINK Pool。</p>}
    </div>
  </section>;
}

export function RequiredFastLaneWorkspace({
  cart,products,onApply,drinkChoices=[],onAddDrink,onConfigureDrink,
}:{
  cart:readonly WorkspaceCartLine[];
  products:readonly WorkspaceProduct[];
  onApply:(lineId:string,groupId:string,optionIds:readonly string[])=>void;
  drinkChoices?:readonly WorkspaceDrinkSupplementChoice[];
  onAddDrink?:(choiceId:string,qty:number,targetLineId?:string)=>void;
  onConfigureDrink?:(choiceId:string,qty:number,targetLineId?:string)=>void;
}){
  const tasks=useMemo(()=>requiredTasksForCart(cart,products),[cart,products]);
  const [draft,setDraft]=useState<Record<string,string[]>>({});
  const toggle=(task:WorkspaceRequiredTask,optionId:string)=>{
    const current=draft[task.id]??[...task.selectedOptionIds];
    if(task.selection==='SINGLE'){
      setDraft(value=>({...value,[task.id]:[optionId]}));
      return;
    }
    const next=current.includes(optionId)?current.filter(id=>id!==optionId):[...current,optionId];
    setDraft(value=>({...value,[task.id]:next.slice(0,task.max)}));
  };

  return <div className="required-fast-lane">
    <header className="required-fast-title">
      <div><small>ADMIN REQUIRED + OPTIONAL</small><h2>必選／補選</h2><p>真正 Required 仍然會阻結帳；飲品補選只係快捷處理，留空亦可以照常結帳。</p></div>
      <strong>{tasks.length} 項</strong>
    </header>
    {tasks.length?<div className="required-fast-list">{tasks.map((task,index)=>{
      const chosen=draft[task.id]??task.selectedOptionIds;
      const ready=chosen.length>=task.min&&chosen.length<=task.max;
      return <article key={task.id} className={index===0?'current':''}>
        <header><span>{index+1}</span><div><b>{task.lineName}</b><small>{task.groupName} · 最少 {task.min} / 最多 {task.max}</small></div><em>{task.missingCount>0?'欠 '+task.missingCount:'需修正'}</em></header>
        <div className="required-fast-options">{task.options.map(option=>{
          const active=chosen.includes(option.id);
          return <button type="button" key={option.id} className={active?'active':''} onClick={()=>toggle(task,option.id)}>
            <b>{option.name}</b>{option.priceAdjustmentMinor!==0?<small>{option.priceAdjustmentMinor>0?'+':''}{money(option.priceAdjustmentMinor)}</small>:null}
          </button>;
        })}</div>
        <footer><span>{task.selection==='SINGLE'?'單選':'多選'} · 已選 {chosen.length}</span><button type="button" disabled={!ready} onClick={()=>onApply(task.lineId,task.groupId,chosen)}>套用到呢件商品</button></footer>
      </article>;
    })}</div>:<div className="required-fast-empty"><b>必選已齊</b><span>目前購物車冇未完成必選。</span></div>}
    {onAddDrink&&onConfigureDrink?<DrinkSupplementWorkspace cart={cart} choices={drinkChoices} onAdd={onAddDrink} onConfigure={onConfigureDrink}/>:null}
  </div>;
}

export function OrganizeWorkspace({lines,onDone}:{lines:readonly WorkspaceCartLine[];onDone:()=>void}){
  const mealLines=lines.filter(line=>!isDrinkSupplementProductId(line.productId));
  const [selected,setSelected]=useState<Record<string,string>>({});
  return <div className="organize-workspace">
    <header className="organize-title"><h2>整理工作台</h2><div><span>未完成 {Math.max(0,mealLines.length-Object.keys(selected).length)}</span><span>可配對 {Math.ceil(mealLines.length/2)}</span><span>飲品改用補選區</span></div></header>
    <section className="organize-section"><header><b><i>1</i> 必選</b><span>{mealLines.length}</span></header>
      <div className="organize-required">{mealLines.map((line,index)=><article key={line.id}><div><b>{index+1}　{line.name}</b><small>{line.detail??'請確認必選項'}</small></div><div className="organize-options">{['肉燥','咖喱','菜飯'].map(v=><button key={v} className={selected[line.id]===v?'active':''} onClick={()=>setSelected(s=>({...s,[line.id]:v}))}>{v}</button>)}</div></article>)}</div>
    </section>
    <section className="organize-section"><header><b><i>2</i> 配對／代補</b><span>{Math.ceil(mealLines.length/2)}</span></header>
      <div className="organize-pairs">{Array.from({length:Math.ceil(mealLines.length/2)},(_,idx)=>{const a=mealLines[idx*2],b=mealLines[idx*2+1];return <article key={idx}><strong>{idx+1} 組</strong><div>{a?<span>{a.name}</span>:null}{b?<span>{b.name}</span>:<em>＋ 未配對</em>}</div></article>})}</div>
    </section>
    <section className="organize-section"><header><b><i>3</i> 飲品補選</b><span>可跳過</span></header><p className="organize-drink-note">飲品選擇已統一移到「必選／補選」區，直接讀 Admin DRINK Pool；整理工作台唔再寫死飲品。</p></section>
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

export function initialHoldModeForLines(lines:readonly {readonly serviceMode:ServiceMode}[]):'cart'|'dining'{
  return lines.some(line=>line.serviceMode==='dine-in')?'dining':'cart';
}

export function HoldCartWorkspace({
  lines,totalMinor,tables,initialMode='cart',onHoldWaiting,onHoldQueue,onHoldTable
}:{
  lines:readonly WorkspaceCartLine[];
  totalMinor:number;
  tables:readonly HoldPlacementTable[];
  initialMode?:'cart'|'dining';
  onHoldWaiting:(partySize:number,note:string)=>void;
  onHoldQueue:(partySize:number,note:string)=>void;
  onHoldTable:(tableId:string,partySize:number,note:string)=>void;
}){
  const [mode,setMode]=useState<'cart'|'dining'>(initialMode);
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');

  return <div className="hold-cart-workspace">
    <header>
      <div><h2>暫存工作台</h2><p>同一頁完成：暫存待客，或者掛入堂食／輪候。</p></div>
      <strong>{money(totalMinor)}</strong>
    </header>

    <section className="hold-kind-grid" role="tablist" aria-label="暫存或堂食">
      <button type="button" role="tab" aria-selected={mode==='cart'} className={mode==='cart'?'active waiting':'waiting'} onClick={()=>setMode('cart')}>
        <b>暫存</b>
        <span>保存目前 Cart，之後由「取回訂單」直接攞返。</span>
      </button>
      <button type="button" role="tab" aria-selected={mode==='dining'} className={mode==='dining'?'active dining':'dining'} onClick={()=>setMode('dining')}>
        <b>堂食</b>
        <span>加入輪候或者直接掛入枱號；之後仍然可以切返暫存。</span>
      </button>
    </section>

    {mode==='cart'?<section className="hold-cart-summary">
      <header><b>購物車內容</b><span>{lines.reduce((sum,line)=>sum+line.qty,0)} 件</span></header>
      {lines.map(line=><article key={line.id}>
        <span>{line.qty}×</span>
        <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>
        <strong>{money(line.qty*line.unitMinor)}</strong>
      </article>)}
      <button type="button" className="hold-confirm-waiting" onClick={()=>onHoldWaiting(partySize,note)}>確認暫存</button>
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
        <button type="button" className="hold-back-cart" onClick={()=>setMode('cart')}>切換到暫存</button>
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
