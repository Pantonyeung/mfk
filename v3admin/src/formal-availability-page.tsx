import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

type FormalAvailabilityRule={sellable:boolean;reason:string;updatedAt:string};
type FormalAvailabilityRecord={
  id:string;
  name:string;
  code:string;
  category:string;
  sellable:boolean;
  reason:string;
  updatedAt:string;
};

function row(value:unknown){
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function patchFormalAvailability(snapshot:Record<string,unknown>,productId:string,patch:Partial<FormalAvailabilityRule>){
  const availability=row(snapshot.availability);
  const current=row(availability[productId]);
  const next={sellable:current.sellable!==false,reason:typeof current.reason==='string'?current.reason:'',updatedAt:typeof current.updatedAt==='string'?current.updatedAt:'',...patch};
  return{...snapshot,availability:{...availability,[productId]:next}};
}
function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。請重新讀取。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  return error instanceof Error?error.message:'SAVE_AVAILABILITY_FAILED';
}

function FormalAvailabilityEditor({item,onClose}:{item:FormalAvailabilityRecord;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const [sellable,setSellable]=useState(item.sellable);
  const [reason,setReason]=useState(item.reason);
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>patchFormalAvailability(snapshot,item.id,{sellable,reason:reason.trim(),updatedAt:new Date().toISOString()}));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{item.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>售罄／供應</h3><p>儲存會寫 Formal Server Draft；正式 runtime 要等 Publish + SMT readback。</p></div><StatusBadge tone="warning">Saved ≠ Applied</StatusBadge></header>
          <label className="v3-functional-switch"><input type="checkbox" checked={sellable} onChange={event=>setSellable(event.target.checked)}/><span>{sellable?'可售':'停售'}</span></label>
          <label><span>原因／備註</span><textarea rows={4} value={reason} onChange={event=>setReason(event.target.value)} placeholder={sellable?'例如：恢復供應':'例如：原料不足'}/></label>
          {error?<div className="v3-error">{error}</div>:null}
        </section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalAvailabilityPage(){
  const formal=useV3FormalDraft();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const availability=useMemo(()=>row(formal.workingSnapshot.availability),[formal.workingSnapshot]);
  const categoryById=useMemo(()=>new Map(catalog.categories.map(category=>[category.id,category.name])),[catalog.categories]);
  const rows:FormalAvailabilityRecord[]=catalog.products.map(product=>{
    const rule=row(availability[product.id]);
    return{
      id:product.id,
      name:product.name,
      code:product.productCode,
      category:categoryById.get(product.categoryId)??'未分類',
      sellable:rule.sellable!==false,
      reason:typeof rule.reason==='string'?rule.reason:'',
      updatedAt:typeof rule.updatedAt==='string'?rule.updatedAt:'',
    };
  });
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'ALL'|'SELLABLE'|'STOPPED'>('ALL');
  const [selected,setSelected]=useState<FormalAvailabilityRecord|null>(null);
  const filtered=rows.filter(item=>{
    const needle=query.trim().toLocaleLowerCase();
    return (!needle||(item.name+' '+item.code+' '+item.category).toLocaleLowerCase().includes(needle))&&(filter==='ALL'||(filter==='SELLABLE'?item.sellable:!item.sellable));
  });
  return <div className="v3-functional-page">
    <PageHeader eyebrow="營運管理" title="售罄／供應" description="正式商品可售設定直接儲存 Server Draft；Publish 後先由 SMT / 渠道執行。" aside={<span className="v3-product-count">{filtered.length} / {rows.length} 件商品</span>}/>
    <section className="v3-product-toolbar">
      <div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱、商品編號"/></div>
      <div className="v3-product-selects"><label><span>狀態</span><select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="ALL">全部</option><option value="SELLABLE">可售</option><option value="STOPPED">停售</option></select></label></div>
    </section>
    <div className="v3-product-desktop-content"><div className="v3-product-table-wrap"><table className="v3-product-table"><thead><tr><th>商品</th><th>分類</th><th>狀態</th><th>原因／備註</th><th>草稿時間</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id} tabIndex={0} onClick={()=>setSelected(item)} onKeyDown={event=>{if(event.key==='Enter')setSelected(item);}}><td><strong>{item.name}</strong><small>{item.code}</small></td><td>{item.category}</td><td><StatusBadge tone={item.sellable?'good':'danger'}>{item.sellable?'可售':'停售'}</StatusBadge></td><td>{item.reason||'—'}</td><td>{item.updatedAt||'—'}</td></tr>)}</tbody></table></div></div>
    <div className="v3-product-mobile-groups"><MobileGroupedPager items={filtered.map(item=>({...item,group:item.category}))} pageSize={10} renderItem={item=><button key={item.id} type="button" className="v3-whole-mobile-record" onClick={()=>setSelected(item)}><span><strong>{item.name}</strong><small>{item.code}{item.reason?' · '+item.reason:''}</small></span><StatusBadge tone={item.sellable?'good':'danger'}>{item.sellable?'可售':'停售'}</StatusBadge></button>}/></div>
    {selected?<FormalAvailabilityEditor item={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
