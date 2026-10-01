import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {
  addFormalCombo,
  addFormalComboPool,
  readFormalCombos,
  removeFormalCombo,
  removeFormalComboPool,
  replaceFormalCombo,
  replaceFormalComboPool,
  validateFormalComboData,
  type FormalCombo,
  type FormalComboChoice,
  type FormalComboPool,
  type FormalComboPoolGroup,
} from './formal-combo.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

function money(value:string){
  const n=Number(value);
  return Number.isFinite(n)?'HK$'+n.toFixed(2):'未填';
}
function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_COMBO_POOL_IN_USE')return '仍有套餐引用呢個 Pool，未可以刪除。';
    return error.message;
  }
  return 'FORMAL_COMBO_SAVE_FAILED';
}
function cloneCombo(combo:FormalCombo):FormalCombo{return{...combo,addonPoolIds:[...combo.addonPoolIds]};}
function clonePool(pool:FormalComboPool):FormalComboPool{
  return{
    ...pool,
    groups:pool.groups.map(group=>({
      ...group,
      bands:group.bands.map(band=>({...band})),
      choices:group.choices.map(choice=>({...choice})),
    })),
  };
}
function uuid(prefix:string){return prefix+'-'+crypto.randomUUID();}

function FormalComboEditor({comboId,onClose}:{comboId:string;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const data=useMemo(()=>readFormalCombos(formal.workingSnapshot),[formal.workingSnapshot]);
  const source=data.combos.find(item=>item.id===comboId);
  const [draft,setDraft]=useState<FormalCombo>(()=>source?cloneCombo(source):{id:comboId,name:'',active:true,basePrice:'',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,addonPoolIds:[]});
  const [error,setError]=useState('');
  if(!source)return <div className="v3-error">搵唔到正式套餐。</div>;
  const mainPools=data.pools.filter(pool=>pool.kind==='MAIN_COURSE'&&pool.active);
  const addonPools=data.pools.filter(pool=>pool.kind==='ADDON'&&pool.active);

  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>{
        const next=replaceFormalCombo(snapshot,draft);
        const errors=validateFormalComboData(next);
        if(errors.length)throw new Error('FORMAL_COMBO_INVALID: '+errors.join('；'));
        return next;
      });
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalCombo(snapshot,comboId));onClose();}
    catch(err){setError(errorCopy(err));}
  };

  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.name||'新套餐'}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>套餐資料</h3><p>套餐只引用 Reusable Pools，唔複製商品定義。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>套餐名稱 *</span><input value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>
            <label><span>基本價格 HK$</span><input inputMode="decimal" value={draft.basePrice} onChange={event=>setDraft(current=>({...current,basePrice:event.target.value.replace(/[^0-9.]/g,'')}))}/></label>
            <label><span>其他外賣調整 HK$</span><input inputMode="decimal" value={draft.takeawayAdjustment} onChange={event=>setDraft(current=>({...current,takeawayAdjustment:event.target.value.replace(/[^0-9.-]/g,'')}))}/></label>
            <label><span>主食 Pool</span><select value={draft.mainPoolId??''} onChange={event=>setDraft(current=>({...current,mainPoolId:event.target.value||undefined}))}><option value="">未設定</option>{mainPools.map(pool=><option key={pool.id} value={pool.id}>{pool.name}</option>)}</select></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.takeawaySurchargeEnabled} onChange={event=>setDraft(current=>({...current,takeawaySurchargeEnabled:event.target.checked}))}/><span>外賣 +$1</span></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} onChange={event=>setDraft(current=>({...current,active:event.target.checked}))}/><span>{draft.active?'啟用套餐':'停用套餐'}</span></label>
        </section>
        <section className="v3-functional-section">
          <h3>加配 Pools</h3>
          <div className="v3-option-link-grid">{addonPools.map(pool=><label key={pool.id}><input type="checkbox" checked={draft.addonPoolIds.includes(pool.id)} onChange={event=>setDraft(current=>{const ids=new Set(current.addonPoolIds);if(event.target.checked)ids.add(pool.id);else ids.delete(pool.id);return{...current,addonPoolIds:[...ids]};})}/><span><strong>{pool.name}</strong><small>{pool.addonKind==='DRINK'?'飲品':'小食'} · {pool.groups.length} 個分組</small></span></label>)}</div>
        </section>
        {error?<div className="v3-error">{error}</div>:null}
        <section className="v3-functional-danger"><div><strong>刪除套餐</strong><small>只刪除套餐本身，Reusable Pools 保留。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>刪除套餐</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!draft.name.trim()||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

function addGroup(pool:FormalComboPool):FormalComboPool{
  const group:FormalComboPoolGroup={id:uuid('group'),name:'新分組',required:true,min:1,max:1,position:(pool.groups.length+1)*10,bands:[],choices:[]};
  return{...pool,groups:[...pool.groups,group]};
}
function updateGroup(pool:FormalComboPool,groupId:string,patch:Partial<FormalComboPoolGroup>):FormalComboPool{
  return{...pool,groups:pool.groups.map(group=>group.id===groupId?{...group,...patch}:group)};
}
function removeGroup(pool:FormalComboPool,groupId:string):FormalComboPool{
  return{...pool,groups:pool.groups.filter(group=>group.id!==groupId).map((group,index)=>({...group,position:(index+1)*10}))};
}
function addBand(pool:FormalComboPool,groupId:string):FormalComboPool{
  return updateGroup(pool,groupId,{bands:(pool.groups.find(group=>group.id===groupId)?.bands??[]).concat({
    id:uuid('band'),name:'新價格帶',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:((pool.groups.find(group=>group.id===groupId)?.bands.length??0)+1)*10,
  })});
}
function updateBand(pool:FormalComboPool,groupId:string,bandId:string,patch:Record<string,unknown>):FormalComboPool{
  const group=pool.groups.find(item=>item.id===groupId);if(!group)return pool;
  return updateGroup(pool,groupId,{bands:group.bands.map(band=>band.id===bandId?{...band,...patch}:band)});
}
function removeBand(pool:FormalComboPool,groupId:string,bandId:string):FormalComboPool{
  const group=pool.groups.find(item=>item.id===groupId);if(!group)return pool;
  return updateGroup(pool,groupId,{bands:group.bands.filter(band=>band.id!==bandId).map((band,index)=>({...band,position:(index+1)*10})),choices:group.choices.filter(choice=>choice.bandId!==bandId)});
}
function addChoice(pool:FormalComboPool,groupId:string):FormalComboPool{
  const group=pool.groups.find(item=>item.id===groupId);if(!group)return pool;
  const bandId=group.bands[0]?.id??'';
  const choice:FormalComboChoice={id:uuid('choice'),choiceType:'PRODUCT',productId:undefined,label:'',bandId,priceAdjustment:'0.00',priceStatus:'READY',active:true,position:(group.choices.length+1)*10};
  return updateGroup(pool,groupId,{choices:[...group.choices,choice]});
}
function updateChoice(pool:FormalComboPool,groupId:string,choiceId:string,patch:Partial<FormalComboChoice>):FormalComboPool{
  const group=pool.groups.find(item=>item.id===groupId);if(!group)return pool;
  return updateGroup(pool,groupId,{choices:group.choices.map(choice=>choice.id===choiceId?{...choice,...patch}:choice)});
}
function removeChoice(pool:FormalComboPool,groupId:string,choiceId:string):FormalComboPool{
  const group=pool.groups.find(item=>item.id===groupId);if(!group)return pool;
  return updateGroup(pool,groupId,{choices:group.choices.filter(choice=>choice.id!==choiceId).map((choice,index)=>({...choice,position:(index+1)*10}))});
}

function FormalPoolEditor({poolId,onClose}:{poolId:string;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const data=useMemo(()=>readFormalCombos(formal.workingSnapshot),[formal.workingSnapshot]);
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const source=data.pools.find(item=>item.id===poolId);
  const [draft,setDraft]=useState<FormalComboPool>(()=>source?clonePool(source):{id:poolId,name:'',kind:'MAIN_COURSE',active:true,position:10,groups:[]});
  const [error,setError]=useState('');
  if(!source)return <div className="v3-error">搵唔到正式 Combo Pool。</div>;

  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>{
        const next=replaceFormalComboPool(snapshot,draft);
        const errors=validateFormalComboData(next);
        if(errors.length)throw new Error('FORMAL_COMBO_POOL_INVALID: '+errors.join('；'));
        return next;
      });
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalComboPool(snapshot,poolId));onClose();}
    catch(err){setError(errorCopy(err));}
  };

  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet v3-combo-formal-sheet">
      <header><div><small>Formal Reusable Pool</small><h2>{draft.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-functional-grid">
            <label><span>Pool 名稱 *</span><input value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>
            <label><span>Pool 類型</span><select value={draft.kind} onChange={event=>{const kind=event.target.value as FormalComboPool['kind'];setDraft(current=>({...current,kind,addonKind:kind==='ADDON'?(current.addonKind??'SNACK'):undefined}));}}><option value="MAIN_COURSE">主食</option><option value="ADDON">加配</option></select></label>
            {draft.kind==='ADDON'?<label><span>加配類型</span><select value={draft.addonKind??'SNACK'} onChange={event=>setDraft(current=>({...current,addonKind:event.target.value as FormalComboPool['addonKind']}))}><option value="SNACK">小食</option><option value="DRINK">飲品</option></select></label>:null}
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} onChange={event=>setDraft(current=>({...current,active:event.target.checked}))}/><span>{draft.active?'啟用 Pool':'停用 Pool'}</span></label>
        </section>
        <section className="v3-functional-section">
          <header><div><h3>Pool 分組</h3><p>每個分組有自己價格帶同商品／虛擬選擇。</p></div><button type="button" onClick={()=>setDraft(current=>addGroup(current))}>＋ 新增分組</button></header>
          <div className="v3-combo-groups">{draft.groups.map(group=><article key={group.id}>
            <div className="v3-functional-grid">
              <label><span>分組名稱 *</span><input value={group.name} onChange={event=>setDraft(current=>updateGroup(current,group.id,{name:event.target.value}))}/></label>
              <label><span>最少</span><input type="number" min={0} value={group.min} onChange={event=>setDraft(current=>updateGroup(current,group.id,{min:Number(event.target.value)||0}))}/></label>
              <label><span>最多</span><input type="number" min={0} value={group.max} onChange={event=>setDraft(current=>updateGroup(current,group.id,{max:Number(event.target.value)||0}))}/></label>
            </div>
            <label className="v3-functional-switch"><input type="checkbox" checked={group.required} onChange={event=>setDraft(current=>updateGroup(current,group.id,{required:event.target.checked,min:event.target.checked?Math.max(1,group.min):0}))}/><span>必選</span></label>

            <section className="v3-combo-nested-block">
              <header><strong>價格帶</strong><button type="button" onClick={()=>setDraft(current=>addBand(current,group.id))}>＋ 價格帶</button></header>
              {group.bands.map(band=><div className="v3-combo-band-row" key={band.id}>
                <input value={band.name} onChange={event=>setDraft(current=>updateBand(current,group.id,band.id,{name:event.target.value}))} placeholder="價格帶名稱"/>
                <input inputMode="decimal" value={band.priceAdjustment} onChange={event=>setDraft(current=>updateBand(current,group.id,band.id,{priceAdjustment:event.target.value.replace(/[^0-9.-]/g,'')}))} placeholder="0.00"/>
                <label className="v3-functional-switch"><input type="checkbox" checked={band.active} onChange={event=>setDraft(current=>updateBand(current,group.id,band.id,{active:event.target.checked}))}/><span>啟用</span></label>
                <button type="button" onClick={()=>setDraft(current=>removeBand(current,group.id,band.id))}>刪除</button>
              </div>)}
            </section>

            <section className="v3-combo-nested-block">
              <header><strong>可選成員</strong><button type="button" disabled={!group.bands.length} onClick={()=>setDraft(current=>addChoice(current,group.id))}>＋ 商品／選擇</button></header>
              {group.choices.map(choice=><div className="v3-combo-choice-list-row" key={choice.id}>
                <select value={choice.choiceType} onChange={event=>{const choiceType=event.target.value as FormalComboChoice['choiceType'];setDraft(current=>updateChoice(current,group.id,choice.id,{choiceType,productId:choiceType==='PRODUCT'?choice.productId:undefined,label:choiceType==='PRODUCT'?'':choice.label}));}}><option value="PRODUCT">商品</option><option value="NONE">不要／空選擇</option><option value="LABEL">文字選擇</option></select>
                {choice.choiceType==='PRODUCT'?<select value={choice.productId??''} onChange={event=>setDraft(current=>updateChoice(current,group.id,choice.id,{productId:event.target.value||undefined}))}><option value="">揀商品</option>{catalog.products.filter(product=>product.active).map(product=><option key={product.id} value={product.id}>{product.name} · {product.productCode}</option>)}</select>:<input value={choice.label} onChange={event=>setDraft(current=>updateChoice(current,group.id,choice.id,{label:event.target.value}))} placeholder="例如：唔要飲品"/>}
                <select value={choice.bandId} onChange={event=>setDraft(current=>updateChoice(current,group.id,choice.id,{bandId:event.target.value}))}>{group.bands.map(band=><option key={band.id} value={band.id}>{band.name}</option>)}</select>
                <input inputMode="decimal" value={choice.priceAdjustment} onChange={event=>setDraft(current=>updateChoice(current,group.id,choice.id,{priceAdjustment:event.target.value.replace(/[^0-9.-]/g,'')}))} placeholder="額外差價"/>
                <button type="button" onClick={()=>setDraft(current=>removeChoice(current,group.id,choice.id))}>刪除</button>
              </div>)}
            </section>

            <button type="button" onClick={()=>setDraft(current=>removeGroup(current,group.id))}>刪除分組</button>
          </article>)}</div>
        </section>
        {error?<div className="v3-error">{error}</div>:null}
        <section className="v3-functional-danger"><div><strong>刪除 Reusable Pool</strong><small>有套餐引用時會被正式 guard 擋住。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>刪除 Pool</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!draft.name.trim()||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalCombosPage(){
  const formal=useV3FormalDraft();
  const data=useMemo(()=>readFormalCombos(formal.workingSnapshot),[formal.workingSnapshot]);
  const [tab,setTab]=useState<'COMBOS'|'POOLS'>('COMBOS');
  const [comboId,setComboId]=useState<string|null>(null);
  const [poolId,setPoolId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const createCombo=async()=>{
    const id=uuid('combo');setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalCombo(snapshot,id));setComboId(id);}
    catch(err){setError(errorCopy(err));}
  };
  const createPool=async(kind:FormalComboPool['kind'],addonKind?:FormalComboPool['addonKind'])=>{
    const id=uuid('pool');setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalComboPool(snapshot,id,kind,addonKind));setPoolId(id);}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="菜單管理" title="套餐管理" description="套餐、主食 Pool、小食 Pool、飲品 Pool、價格帶同商品成員直接寫 Formal Server Draft。" aside={tab==='COMBOS'?<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void createCombo()}>＋ 新增套餐</button>:<div className="v3-inline-order-buttons"><button type="button" disabled={formal.isSaving} onClick={()=>void createPool('MAIN_COURSE')}>＋ 主食 Pool</button><button type="button" disabled={formal.isSaving} onClick={()=>void createPool('ADDON','SNACK')}>＋ 小食 Pool</button><button type="button" disabled={formal.isSaving} onClick={()=>void createPool('ADDON','DRINK')}>＋ 飲品 Pool</button></div>}/>
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-pricing-tabs"><button className={tab==='COMBOS'?'is-active':''} onClick={()=>setTab('COMBOS')}>套餐</button><button className={tab==='POOLS'?'is-active':''} onClick={()=>setTab('POOLS')}>Reusable Pools</button></div>
    {tab==='COMBOS'?<div className="v3-functional-card-grid">{data.combos.map(combo=><button type="button" key={combo.id} onClick={()=>setComboId(combo.id)}>
      <div><strong>{combo.name}</strong><small>{combo.mainPoolId?'主食 Pool 已設定':'未設定主食 Pool'} · {combo.addonPoolIds.length} 個加配 Pool</small></div>
      <b>{money(combo.basePrice)}</b><span>基本價格</span><StatusBadge tone={combo.active?'good':'neutral'}>{combo.active?'啟用':'停用'}</StatusBadge>
    </button>)}</div>:<div className="v3-functional-card-grid">{data.pools.map(pool=><button type="button" key={pool.id} onClick={()=>setPoolId(pool.id)}>
      <div><strong>{pool.name}</strong><small>{pool.kind==='MAIN_COURSE'?'主食':pool.addonKind==='DRINK'?'飲品':'小食'} · {pool.id}</small></div>
      <b>{pool.groups.length}</b><span>個分組</span><StatusBadge tone={pool.active?'good':'neutral'}>{pool.active?'啟用':'停用'}</StatusBadge>
      <small>{pool.groups.reduce((sum,group)=>sum+group.choices.length,0)} 個可選成員</small>
    </button>)}</div>}
    {comboId?<FormalComboEditor comboId={comboId} onClose={()=>setComboId(null)}/>:null}
    {poolId?<FormalPoolEditor poolId={poolId} onClose={()=>setPoolId(null)}/>:null}
  </div>;
}
