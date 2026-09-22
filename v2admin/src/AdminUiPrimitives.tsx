import type {ReactNode} from 'react';

export type AdminTone='neutral'|'info'|'success'|'warning'|'danger';

export function AdminStatusBadge({tone='neutral',children}:{tone?:AdminTone;children:ReactNode}){
  return <span className="admin-status-badge" data-tone={tone}>{children}</span>;
}

export function AdminSearchField({
  label,value,onChange,placeholder,
}:{
  label:string;
  value:string;
  onChange:(value:string)=>void;
  placeholder?:string;
}){
  return <label className="admin-search-field">
    <span className="admin-visually-hidden">{label}</span>
    <input
      type="search"
      value={value}
      onChange={event=>onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  </label>;
}

export function AdminPagination({
  page,pageCount,total,pageSize,noun,onPageChange,
}:{
  page:number;
  pageCount:number;
  total:number;
  pageSize:number;
  noun:string;
  onPageChange:(page:number)=>void;
}){
  const first=total===0?0:(page-1)*pageSize+1;
  const last=Math.min(page*pageSize,total);
  return <footer className="admin-product-pagination" aria-label={`${noun}分頁`}>
    <span>顯示 {first}–{last} / {total} {noun}</span>
    <div>
      <button type="button" disabled={page<=1} onClick={()=>onPageChange(Math.max(1,page-1))}>上一頁</button>
      <b aria-live="polite">{page} / {pageCount}</b>
      <button type="button" disabled={page>=pageCount} onClick={()=>onPageChange(Math.min(pageCount,page+1))}>下一頁</button>
    </div>
  </footer>;
}
