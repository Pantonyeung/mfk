import {useEffect,useId,useRef,type ReactNode} from 'react';
import type {FeedbackTone} from './presentation';

export type PrimaryView='order'|'work'|'orders'|'status'|'more';

interface NavigationItem {
  readonly view:PrimaryView;
  readonly label:string;
  readonly icon:PrimaryView;
  readonly badge?:string;
}

export function AppShell({
  view,
  onView,
  workBadge,
  statusBadge,
  draftBadge,
  brandDetail,
  connectionLabel,
  connectionTone,
  onRefresh,
  children,
}:{
  view:PrimaryView;
  onView:(view:PrimaryView)=>void;
  workBadge?:string;
  statusBadge?:string;
  draftBadge?:string;
  brandDetail:string;
  connectionLabel:string;
  connectionTone:FeedbackTone;
  onRefresh:()=>void;
  children:ReactNode;
}){
  const items:readonly NavigationItem[]=[
    {view:'order',label:'點單',icon:'order'},
    {view:'work',label:'工作',icon:'work',badge:workBadge},
    {view:'orders',label:'訂單',icon:'orders'},
    {view:'status',label:'狀態',icon:'status',badge:statusBadge},
    {view:'more',label:'更多',icon:'more',badge:draftBadge},
  ];

  return <main className="app-shell">
    <div className="app-frame">
      <aside className="desktop-rail">
        <Brand detail={brandDetail}/>
        <PrimaryNavigation items={items} view={view} onView={onView} mode="desktop"/>
        <button className={`rail-connection tone-${connectionTone}`} onClick={onRefresh}>
          <span aria-hidden="true"/>
          <span><strong>{connectionLabel}</strong><small>重新同步</small></span>
        </button>
      </aside>

      <section className="workspace">
        <header className="mobile-header">
          <Brand detail={brandDetail}/>
          <button className={`connection-button tone-${connectionTone}`} onClick={onRefresh} aria-label={`重新同步門店資料，目前${connectionLabel}`}>
            <span aria-hidden="true"/>
            <strong>{connectionLabel}</strong>
          </button>
        </header>
        <div className="workspace-content">{children}</div>
      </section>
    </div>
    <PrimaryNavigation items={items} view={view} onView={onView} mode="mobile"/>
  </main>;
}

function Brand({detail}:{detail:string}){
  return <div className="brand" aria-label="磨飯流動店務">
    <span className="brand-mark" aria-hidden="true">磨</span>
    <span className="brand-copy"><strong>磨飯流動店務</strong><small>{detail}</small></span>
  </div>;
}

function PrimaryNavigation({items,view,onView,mode}:{
  items:readonly NavigationItem[];
  view:PrimaryView;
  onView:(view:PrimaryView)=>void;
  mode:'desktop'|'mobile';
}){
  return <nav className={`${mode}-navigation primary-navigation`} aria-label="主要功能">
    {items.map(item=><button
      key={item.view}
      className={view===item.view?'active':''}
      aria-current={view===item.view?'page':undefined}
      onClick={()=>onView(item.view)}
    >
      <span className="nav-glyph" aria-hidden="true"><NavigationIcon name={item.icon}/></span>
      <span className="nav-label">{item.label}</span>
      {item.badge?<b aria-label={`${item.badge} 項需要留意`}>{item.badge}</b>:null}
    </button>)}
  </nav>;
}

function NavigationIcon({name}:{name:PrimaryView}){
  if(name==='order')return <svg viewBox="0 0 24 24"><circle className="ring" cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>;
  if(name==='work')return <svg viewBox="0 0 24 24"><path d="M9 6h10M9 12h10M9 18h10"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/></svg>;
  if(name==='orders')return <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>;
  if(name==='status')return <svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
}

export function PageHeading({eyebrow,title,detail,aside}:{
  eyebrow:string;
  title:string;
  detail:string;
  aside?:ReactNode;
}){
  return <header className="page-heading">
    <div><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
    {aside?<div className="page-heading-aside">{aside}</div>:null}
  </header>;
}

export function StateMessage({tone='neutral',title,detail,actionLabel,onAction,compact=false}:{
  tone?:FeedbackTone;
  title:string;
  detail?:string;
  actionLabel?:string;
  onAction?:()=>void;
  compact?:boolean;
}){
  return <section className={`state-message tone-${tone} ${compact?'compact':''}`} role={tone==='danger'?'alert':'status'}>
    <span className="state-symbol" aria-hidden="true"/>
    <div><strong>{title}</strong>{detail?<p>{detail}</p>:null}</div>
    {actionLabel&&onAction?<button onClick={onAction}>{actionLabel}</button>:null}
  </section>;
}

export function ActionNotice({tone='info',message,actionLabel,onAction,onDismiss}:{
  tone?:FeedbackTone;
  message:string;
  actionLabel?:string;
  onAction?:()=>void;
  onDismiss:()=>void;
}){
  return <div className={`action-notice tone-${tone}`} role={tone==='danger'?'alert':'status'} aria-live="polite">
    <span>{message}</span>
    <div>{actionLabel&&onAction?<button onClick={onAction}>{actionLabel}</button>:null}<button onClick={onDismiss}>收起</button></div>
  </div>;
}

export function EmptyState({title,detail,children}:{title:string;detail:string;children?:ReactNode}){
  return <section className="empty-state" role="status">
    <span className="empty-symbol" aria-hidden="true">○</span>
    <h2>{title}</h2>
    <p>{detail}</p>
    {children?<div className="empty-action">{children}</div>:null}
  </section>;
}

export function StatusTag({tone,label}:{tone:FeedbackTone;label:string}){
  return <span className={`status-tag tone-${tone}`}><span aria-hidden="true"/>{label}</span>;
}

export function GuidedProgress({current,total,label}:{current:number;total:number;label:string}){
  const value=Math.max(0,Math.min(100,(current/Math.max(1,total))*100));
  return <div className="guided-progress" aria-label={`第 ${current} 步，共 ${total} 步：${label}`}>
    <div><strong>{label}</strong><span>{current} / {total}</span></div>
    <div className="progress-track" aria-hidden="true"><i style={{width:`${value}%`}}/></div>
  </div>;
}

export function CompletedStep({label,summary,onEdit}:{label:string;summary:string;onEdit:()=>void}){
  return <button className="completed-step" onClick={onEdit}>
    <span className="complete-mark" aria-hidden="true">✓</span>
    <span><strong>{label}</strong><small>{summary}</small></span>
    <em>修改</em>
  </button>;
}

export function FieldHint({tone='neutral',children}:{tone?:FeedbackTone;children:ReactNode}){
  return <p className={`field-hint tone-${tone}`} role={tone==='danger'?'alert':'status'}>{children}</p>;
}

export function ModalSheet({open,title,description,onClose,children,size='wide'}:{
  open:boolean;
  title:string;
  description?:string;
  onClose:()=>void;
  children:ReactNode;
  size?:'narrow'|'wide';
}){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const previousFocusRef=useRef<HTMLElement|null>(null);
  const titleId=useId();
  const descriptionId=useId();

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!open||!dialog)return;
    previousFocusRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!dialog.open)dialog.showModal();
    closeRef.current?.focus();
    return()=>{
      if(dialog.open)dialog.close();
      previousFocusRef.current?.focus();
    };
  },[open]);

  if(!open)return null;
  return <dialog
    ref={dialogRef}
    className={`modal-sheet size-${size}`}
    aria-labelledby={titleId}
    aria-describedby={description?descriptionId:undefined}
    onCancel={event=>{event.preventDefault();onClose()}}
    onClick={event=>{if(event.target===event.currentTarget)onClose()}}
  >
    <section className="sheet-surface">
      <div className="sheet-grabber" aria-hidden="true"/>
      <header className="sheet-header">
        <div><h2 id={titleId}>{title}</h2>{description?<p id={descriptionId}>{description}</p>:null}</div>
        <button ref={closeRef} className="sheet-close" onClick={onClose} aria-label={`關閉${title}`}>關閉</button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  </dialog>;
}

export function SectionHeading({title,detail,aside}:{title:string;detail?:string;aside?:ReactNode}){
  return <header className="section-heading">
    <div><h2>{title}</h2>{detail?<p>{detail}</p>:null}</div>
    {aside}
  </header>;
}
