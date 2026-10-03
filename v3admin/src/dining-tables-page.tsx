import {useState} from 'react';
import {PageHeader,StatusBadge} from './ui.tsx';
import {usePreviewCatalog,type PreviewDiningTable} from './preview-catalog-store.ts';

function TableEditor({table,onClose}:{table:PreviewDiningTable;onClose:()=>void}){
  const update=usePreviewCatalog(state=>state.updateDiningTable);
  const remove=usePreviewCatalog(state=>state.removeDiningTable);
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>餐桌管理</small><h2>{table.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-functional-grid">
            <label><span>餐桌名稱 *</span><input value={table.name} onChange={event=>update(table.id,{name:event.target.value})}/></label>
            <label><span>餐桌編號</span><input value={table.id} disabled/></label>
            <label><span>座位數</span><input type="number" min={1} max={20} value={table.seats} onChange={event=>update(table.id,{seats:Math.max(1,Number(event.target.value)||1)})}/></label>
            <label><span>區域</span><input value={table.area} onChange={event=>update(table.id,{area:event.target.value})} placeholder="例如：前場／後場"/></label>
            <label><span>顯示次序</span><input type="number" min={0} value={table.sortOrder} onChange={event=>update(table.id,{sortOrder:Number(event.target.value)||0})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={table.active} onChange={event=>update(table.id,{active:event.target.checked})}/><span>{table.active?'啟用餐桌':'停用餐桌'}</span></label>
        </section>
        <section className="v3-functional-danger">
          <div><strong>刪除餐桌</strong><small>正常情況建議先停用；Preview 可直接刪除。</small></div>
          <button type="button" onClick={()=>{remove(table.id);onClose();}}>刪除餐桌</button>
        </section>
      </div>
    </section>
  </div>;
}

export function DiningTablesPage(){
  const tables=usePreviewCatalog(state=>state.diningTables);
  const createTable=usePreviewCatalog(state=>state.createDiningTable);
  const [selected,setSelected]=useState<string|null>(null);
  const sorted=[...tables].sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));
  const selectedTable=selected?tables.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="門店設定" title="餐桌管理" description="管理堂食餐桌身份、座位數、區域、顯示次序同啟用狀態。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=createTable();setSelected(next.id);}}>＋ 新增餐桌</button>}/>
    <div className="v3-functional-card-grid">
      {sorted.map(table=><button type="button" key={table.id} onClick={()=>setSelected(table.id)}>
        <div><strong>{table.name}</strong><small>{table.id} · {table.area}</small></div>
        <b>{table.seats}</b><span>座位</span>
        <StatusBadge tone={table.active?'good':'neutral'}>{table.active?'啟用':'停用'}</StatusBadge>
        <small>次序 {table.sortOrder}</small>
      </button>)}
    </div>
    {selectedTable?<TableEditor table={selectedTable} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
