import {useMemo,useState} from 'react';
import {
  capacityPoolCanActivate,
  normalizeCapacityPool,
  type CapacityPoolDefinitionV1,
} from '../../contracts/capacity-pool-v1.ts';
import {readFormalCatalog} from './formal-catalog.ts';
import {
  FORMAL_CAPACITY_RUNTIME_GAP,
  addFormalCapacityPool,
  patchFormalCapacityConfig,
  readFormalCapacity,
  removeFormalCapacityPool,
  replaceFormalCapacityPool,
  validateFormalCapacity,
} from './formal-capacity.ts';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_CAPACITY_POOL_INVALID')return 'Pool 未符合啟用條件：名稱、商品、初始數量同停售門檻要完整。';
    return error.message;
  }
  return 'FORMAL_CAPACITY_SAVE_FAILED';
}

function PoolEditor({pool,onClose}:{pool:CapacityPoolDefinitionV1;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const [draft,setDraft]=useState<CapacityPoolDefinitionV1>(()=>normalizeCapacityPool(pool));
  const [error,setError]=useState('');
  const canActivate=capacityPoolCanActivate(draft);

  const update=(patch:Partial<CapacityPoolDefinitionV1>)=>setDraft(current=>normalizeCapacityPool({...current,...patch}));
  const toggleProduct=(productId:string,checked:boolean)=>setDraft(current=>{
    const ids=new Set(current.productIds);
    if(checked)ids.add(productId);else ids.delete(productId);
    return normalizeCapacityPool({...current,productIds:[...ids]});
  });
  const save=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>replaceFormalCapacityPool(snapshot,draft));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalCapacityPool(snapshot,draft.id));onClose();}
    catch(err){setError(errorCopy(err));}
  };

  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.name||draft.id}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>產能 Pool</h3><p>Admin 只定義規則；實際扣減／回補／停售執行仍然係 SMT Runtime authority。</p></div><StatusBadge tone="warning">Saved ≠ Applied</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>Pool 名稱 *</span><input value={draft.name} onChange={event=>update({name:event.target.value})}/></label>
            <label><span>Pool ID</span><input value={draft.id} disabled/></label>
            <label><span>初始數量 *</span><input type="number" min={0} step={1} value={draft.initialQty} onChange={event=>update({initialQty:Number(event.target.value)||0})}/></label>
            <label><span>自家平台停售門檻</span><input type="number" min={0} max={draft.initialQty} step={1} value={draft.firstPartyStopAt} onChange={event=>update({firstPartyStopAt:Number(event.target.value)||0})}/></label>
            <label><span>第三方平台停售門檻</span><input type="number" min={0} max={draft.initialQty} step={1} value={draft.thirdPartyStopAt} onChange={event=>update({thirdPartyStopAt:Number(event.target.value)||0})}/></label>
          </div>
          <label><span>備註</span><textarea rows={3} value={draft.note} onChange={event=>update({note:event.target.value})}/></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} disabled={!canActivate&&draft.active===false} onChange={event=>update({active:event.target.checked})}/><span>{draft.active?'啟用 Pool':'停用 Pool'}</span></label>
          {!canActivate?<div className="v3-mobile-form-note">啟用前：要有名稱、至少一件商品，而且兩個停售門檻都唔可以高過初始數量。</div>:null}
        </section>
        <section className="v3-functional-section">
          <h3>綁定商品</h3>
          <MobileGroupedPager
            items={catalog.products.filter(product=>product.active).map(product=>({...product,group:catalog.categories.find(category=>category.id===product.categoryId)?.name??'未分類'}))}
            pageSize={10}
            renderItem={product=><label key={product.id} className="v3-product-map-row"><input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={event=>toggleProduct(product.id,event.target.checked)}/><span><strong>{product.name}</strong><small>{product.productCode}</small></span></label>}
          />
        </section>
        <section className="v3-functional-section">
          <header><div><h3>Runtime 執行狀態</h3><p>呢一段唔會用 Preview 數字扮 runtime truth。</p></div><StatusBadge tone="warning">{FORMAL_CAPACITY_RUNTIME_GAP.status}</StatusBadge></header>
          <div className="v3-mobile-form-note">{FORMAL_CAPACITY_RUNTIME_GAP.missing}</div>
        </section>
        {error?<div className="v3-error">{error}</div>:null}
        <section className="v3-functional-danger"><div><strong>刪除 Pool</strong><small>只會由 Draft 移除設定；未發布之前唔影響 SMT。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>刪除 Pool</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving||!draft.name.trim()} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalCapacityPage(){
  const formal=useV3FormalDraft();
  const config=useMemo(()=>readFormalCapacity(formal.workingSnapshot),[formal.workingSnapshot]);
  const validation=useMemo(()=>validateFormalCapacity(formal.workingSnapshot),[formal.workingSnapshot]);
  const [legacy,setLegacy]=useState(()=>({dailyLimit:config.dailyLimit,warningAt:config.warningAt,hardStop:config.hardStop,note:config.note}));
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');

  const saveLegacy=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalCapacityConfig(snapshot,legacy));}
    catch(err){setError(errorCopy(err));}
  };
  const create=async()=>{
    setError('');
    try{
      let poolId='';
      await formal.mutateSnapshot(snapshot=>{const result=addFormalCapacityPool(snapshot);poolId=result.poolId;return result.snapshot;});
      setSelected(poolId);
    }catch(err){setError(errorCopy(err));}
  };
  const current=selected?config.pools.find(pool=>pool.id===selected):undefined;

  return <div className="v3-functional-page">
    <PageHeader eyebrow="營運管理" title="產能／原料額度" description="Capacity config 已接 Formal Server Draft；runtime 扣減／回補／渠道停止會另外接 SMT readback seam。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增產能 Pool</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    {validation.length?<div className="v3-error">{validation.join('；')}</div>:null}
    <section className="v3-functional-section">
      <header><div><h3>每日容量提示</h3><p>保留現有 canonical config；唔會無聲轉成 runtime hard-stop。</p></div><StatusBadge tone="warning">Formal Draft</StatusBadge></header>
      <div className="v3-functional-grid">
        <label><span>每日上限（空白＝無設定）</span><input inputMode="numeric" value={legacy.dailyLimit} onChange={event=>setLegacy(current=>({...current,dailyLimit:event.target.value.replace(/D/g,'')}))}/></label>
        <label><span>提醒門檻 %</span><input type="number" min={1} max={100} value={legacy.warningAt} onChange={event=>setLegacy(current=>({...current,warningAt:Math.min(100,Math.max(1,Number(event.target.value)||80))}))}/></label>
      </div>
      <label><span>備註</span><textarea rows={3} value={legacy.note} onChange={event=>setLegacy(current=>({...current,note:event.target.value}))}/></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={legacy.hardStop} onChange={event=>setLegacy(current=>({...current,hardStop:event.target.checked}))}/><span>Legacy hardStop config</span></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void saveLegacy()}>儲存正式草稿</button>
    </section>
    <div className="v3-functional-card-grid">{config.pools.map(pool=><button type="button" key={pool.id} onClick={()=>setSelected(pool.id)}>
      <div><strong>{pool.name||'未命名 Pool'}</strong><small>{pool.id} · {pool.productIds.length} 件商品</small></div>
      <b>{pool.initialQty}</b><span>初始數量</span>
      <StatusBadge tone={pool.active?'good':'neutral'}>{pool.active?'啟用':'停用'}</StatusBadge>
      <small>自家停 {pool.firstPartyStopAt} · 第三方停 {pool.thirdPartyStopAt}</small>
    </button>)}</div>
    {current?<PoolEditor pool={current} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
