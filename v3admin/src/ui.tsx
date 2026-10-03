import {useEffect,useId,useRef,type ReactNode} from 'react';

export function PageHeader({eyebrow,title,description,aside}:{eyebrow:string;title:string;description:string;aside?:ReactNode}){
  return <header className="v3-page-header">
    <div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>
    {aside?<div className="v3-page-actions">{aside}</div>:null}
  </header>;
}

export function SearchField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
  return <label className="v3-search"><span className="v3-visually-hidden">搜尋</span><input type="search" placeholder="搜尋" value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}/></label>;
}

export function FilterBar({children}:{children:ReactNode}){
  return <div className="v3-filter-bar" aria-label="篩選條件">{children}</div>;
}

export type TableColumn={key:string;label:string};
export type TableRow=Record<string,ReactNode>;

export function DataTable({columns,rows,empty}:{columns:readonly TableColumn[];rows:readonly TableRow[];empty:ReactNode}){
  if(!rows.length)return <>{empty}</>;
  return <div className="v3-table-wrap"><table><thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{columns.map(column=><td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div>;
}

export function MobileRecordCards({columns,rows,empty}:{columns:readonly TableColumn[];rows:readonly TableRow[];empty:ReactNode}){
  if(!rows.length)return <>{empty}</>;
  return <div className="v3-record-cards">{rows.map((row,index)=><article key={index}>{columns.map(column=><div key={column.key}><span>{column.label}</span><strong>{row[column.key]}</strong></div>)}</article>)}</div>;
}

export function ResponsiveRecordList({columns,rows,empty}:{columns:readonly TableColumn[];rows:readonly TableRow[];empty:ReactNode}){
  if(!rows.length)return <>{empty}</>;
  return <><div className="v3-desktop-records"><DataTable columns={columns} rows={rows} empty={empty}/></div><div className="v3-mobile-records"><MobileRecordCards columns={columns} rows={rows} empty={empty}/></div></>;
}

export function StatusBadge({tone='neutral',children}:{tone?:'neutral'|'good'|'warning'|'danger'|'unknown';children:ReactNode}){
  return <span className="v3-status" data-tone={tone}>{children}</span>;
}

function StatePanel({kind,title,description,action}:{kind:string;title:string;description?:string;action?:ReactNode}){
  return <section className="v3-state-panel" data-kind={kind} role={kind==='error'?'alert':undefined}><div className="v3-state-mark" aria-hidden="true"/><div><h2>{title}</h2>{description?<p>{description}</p>:null}{action}</div></section>;
}

export function EmptyState({title='目前未有資料',description}:{title?:string;description?:string}){
  return <StatePanel kind="empty" title={title} description={description}/>;
}

export function ErrorState({title='暫時無法取得資料',description,action}:{title?:string;description?:string;action?:ReactNode}){
  return <StatePanel kind="error" title={title} description={description} action={action}/>;
}

export function UnknownState({description='系統會繼續以正式回讀確認結果。'}:{description?:string}){
  return <StatePanel kind="unknown" title="結果未明 · 正在重新確認" description={description}/>;
}

export function StaleBanner({onRefresh}:{onRefresh:()=>void}){
  return <div className="v3-stale" role="status"><span><strong>資料過期</strong> · 顯示上次成功資料</span><button type="button" onClick={onRefresh}>重新讀取</button></div>;
}

export function DraftBar({count,onReview}:{count:number;onReview:()=>void}){
  return <div className="v3-draft-bar" role="status"><span><strong>{count}</strong> 項未發佈變更</span><button type="button" onClick={onReview}>檢查並發佈</button></div>;
}

export function ConfirmDialog({open,title,description,confirmLabel,onConfirm,onClose}:{open:boolean;title:string;description?:string;confirmLabel:string;onConfirm:()=>void;onClose:()=>void}){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  const titleId=useId();
  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    if(open&&!dialog.open){previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal();}
    if(!open&&dialog.open){dialog.close();previousFocus.current?.focus();}
  },[open]);
  useEffect(()=>()=>{dialogRef.current?.close();previousFocus.current?.focus();},[]);
  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>
    <h2 id={titleId}>{title}</h2>{description?<p>{description}</p>:null}
    <div className="v3-dialog-actions"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}

export function ReadbackPanel({publishedAt,cloud,target}:{publishedAt:string;cloud:string;target:string}){
  return <section className="v3-readback"><div><span>正式發佈時間</span><strong>{publishedAt}</strong></div><div><span>雲端狀態</span><strong>{cloud}</strong></div><div><span>目標狀態</span><strong>{target}</strong></div></section>;
}

export function FormSection({title,description,children}:{title:string;description?:string;children:ReactNode}){
  return <fieldset className="v3-form-section"><legend>{title}</legend>{description?<p>{description}</p>:null}<div>{children}</div></fieldset>;
}

export function Timeline({items}:{items:readonly {title:string;time:string;description?:string}[]}){
  return <ol className="v3-timeline">{items.map((item,index)=><li key={`${item.time}-${index}`}><time>{item.time}</time><div><strong>{item.title}</strong>{item.description?<p>{item.description}</p>:null}</div></li>)}</ol>;
}

export function LoadingSkeleton(){
  return <div className="v3-skeleton" aria-label="正在讀取" aria-busy="true"><span/><span/><span/></div>;
}
