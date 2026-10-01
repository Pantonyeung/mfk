import {useMemo,useState} from 'react';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {MOBILE_PRODUCT_PAGE_SIZE,PREVIEW_PRODUCTS,productRecordsFromSnapshot,type ProductListRecord} from './product-list.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

type AvailabilityRule={
  sellable:boolean;
  reason:string;
  updatedAt:string;
};

type AvailabilityRecord=ProductListRecord&{
  sellable:boolean;
  reason:string;
};

function row(value:unknown){
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function availabilityRules(snapshot:unknown){
  const root=row(snapshot);
  const raw=row(root.availability);
  const out:Record<string,AvailabilityRule>={};
  for(const [id,value] of Object.entries(raw)){
    const item=row(value);
    out[id]={
      sellable:item.sellable!==false,
      reason:typeof item.reason==='string'?item.reason:'',
      updatedAt:typeof item.updatedAt==='string'?item.updatedAt:'',
    };
  }
  return out;
}

function buildRows(snapshot:unknown,previewMode:boolean):AvailabilityRecord[]{
  const products=previewMode?[...PREVIEW_PRODUCTS]:productRecordsFromSnapshot(snapshot);
  const rules=availabilityRules(snapshot);
  return products.map(product=>{
    const rule=rules[product.id];
    return{
      ...product,
      sellable:rule?rule.sellable:product.status!=='已停用',
      reason:rule?.reason??'',
    };
  });
}

function AvailabilityMobileModal({
  item,
  previewMode,
  onClose,
  onSave,
}:{
  item:AvailabilityRecord;
  previewMode:boolean;
  onClose:()=>void;
  onSave:(next:{sellable:boolean;reason:string})=>void;
}){
  const [sellable,setSellable]=useState(item.sellable);
  const [reason,setReason]=useState(item.reason);
  return <div className="v3-mobile-product-modal" role="dialog" aria-modal="true" aria-label={'供應設定 '+item.name}>
    <button type="button" className="v3-mobile-modal-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-mobile-modal-sheet">
      <header><div><small>售罄／供應</small><h2>{item.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <form onSubmit={event=>{event.preventDefault();if(previewMode)onSave({sellable,reason:reason.trim()});}}>
        <div className="v3-mobile-object-summary"><span>{item.category}</span><code>{item.code}</code><strong>{'HK$'+(item.priceMinor/100).toFixed(2)}</strong></div>
        <label className="v3-mobile-switch-row"><span><strong>{sellable?'目前可售':'目前停售'}</strong><small>改動只會喺正式 Draft / Runtime contract 接駁後成為正式操作。</small></span><input type="checkbox" checked={sellable} onChange={event=>setSellable(event.target.checked)}/></label>
        <label><span>原因／備註</span><textarea rows={4} value={reason} onChange={event=>setReason(event.target.value)} placeholder={sellable?'例如：恢復供應':'例如：原料不足'}/></label>
        {!previewMode?<div className="v3-mobile-form-note">此 Preview Lab 不會直接執行正式售罄／恢復供應。</div>:null}
        <footer><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="submit" disabled={!previewMode}>儲存預覽</button></footer>
      </form>
    </section>
  </div>;
}

export function AvailabilityPage({canonicalSnapshot,previewMode=false}:{
  canonicalSnapshot?:unknown;
  previewMode?:boolean;
}){
  const initial=useMemo(()=>buildRows(canonicalSnapshot,previewMode),[canonicalSnapshot,previewMode]);
  const [previewRows,setPreviewRows]=useState(initial);
  const sourceRows=previewMode?previewRows:initial;
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'ALL'|'SELLABLE'|'STOPPED'>('ALL');
  const [selected,setSelected]=useState<AvailabilityRecord|null>(null);
  const [notice,setNotice]=useState('');

  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase();
    return sourceRows.filter(item=>{
      const queryMatch=!needle||[item.name,item.code,item.category].some(value=>value.toLocaleLowerCase().includes(needle));
      const stateMatch=filter==='ALL'||(filter==='SELLABLE'?item.sellable:!item.sellable);
      return queryMatch&&stateMatch;
    });
  },[sourceRows,query,filter]);

  const savePreview=(next:{sellable:boolean;reason:string})=>{
    if(!previewMode||!selected)return;
    setPreviewRows(current=>current.map(item=>item.id===selected.id?{...item,...next,updatedAt:'剛剛'}:item));
    setNotice('介面預覽已更新；重新載入會清除預覽修改。');
    setSelected(null);
  };

  return <div className="v3-availability-page">
    {previewMode?<div className="v3-preview-banner" role="status"><strong>售罄／供應公網預覽</strong><span>手機版沿用分類收納＋每頁 10 件＋即時彈窗。所有改動只係介面預覽。</span></div>:null}
    {notice?<div className="v3-preview-notice" role="status">{notice}</div>:null}
    <PageHeader
      eyebrow="營運管理"
      title="售罄／供應"
      description="快速查看商品可售狀態；手機版大量商品按分類收納。"
      aside={<span className="v3-product-count">{filtered.length} / {sourceRows.length} 件商品</span>}
    />

    <section className="v3-product-toolbar" aria-label="售罄供應搜尋與篩選">
      <div className="v3-product-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱、商品編號"/></div>
      <div className="v3-product-selects">
        <label><span>狀態</span><select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="ALL">全部</option><option value="SELLABLE">可售</option><option value="STOPPED">停售</option></select></label>
      </div>
    </section>

    <div className="v3-product-desktop-content">
      <div className="v3-product-table-wrap">
        <table className="v3-product-table">
          <thead><tr><th>商品</th><th>分類</th><th>狀態</th><th>原因／備註</th><th>最近更新</th></tr></thead>
          <tbody>{filtered.map(item=><tr key={item.id} tabIndex={0} onClick={()=>setSelected(item)} onKeyDown={event=>{if(event.key==='Enter')setSelected(item);}}>
            <td><div className="v3-product-identity"><div className="v3-product-thumb" aria-hidden="true">{item.name.slice(0,2)}</div><div><strong>{item.name}</strong><small>{item.code}</small></div></div></td>
            <td>{item.category}</td>
            <td><StatusBadge tone={item.sellable?'good':'danger'}>{item.sellable?'可售':'停售'}</StatusBadge></td>
            <td>{item.reason||'—'}</td>
            <td>{item.updatedAt}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <div className="v3-product-mobile-groups">
      <MobileGroupedPager
        items={filtered.map(item=>({...item,group:item.category}))}
        pageSize={MOBILE_PRODUCT_PAGE_SIZE}
        emptyLabel="目前未有商品"
        renderItem={item=><article key={item.id} className="v3-product-mobile-card" tabIndex={0} onClick={()=>setSelected(item)} onKeyDown={event=>{if(event.key==='Enter')setSelected(item);}}>
          <div className="v3-product-thumb" aria-hidden="true">{item.name.slice(0,2)}</div>
          <div className="v3-product-mobile-main">
            <div><strong>{item.name}</strong><StatusBadge tone={item.sellable?'good':'danger'}>{item.sellable?'可售':'停售'}</StatusBadge></div>
            <span>{item.code}{item.reason?' · '+item.reason:''}</span>
            <footer><b>{item.category}</b><small>{item.updatedAt}</small></footer>
          </div>
        </article>}
      />
    </div>

    {selected?<AvailabilityMobileModal item={selected} previewMode={previewMode} onClose={()=>setSelected(null)} onSave={savePreview}/>:null}
  </div>;
}
