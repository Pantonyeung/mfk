import {useEffect,useId,useRef,type ReactNode} from 'react';
import './smt-ui.css';

export type SmtTone='neutral'|'info'|'success'|'warning'|'danger';

export function GuidedProgress({current,total,label}:{current:number;total:number;label:string}){
  const value=Math.max(0,Math.min(100,current/Math.max(1,total)*100));
  return <div className="smt-guided-progress" aria-label={`第 ${current} 步，共 ${total} 步：${label}`}>
    <div><strong>{label}</strong><span>{current} / {total}</span></div>
    <div className="smt-progress-track" aria-hidden="true"><i style={{width:`${value}%`}}/></div>
  </div>;
}

export function CompletedStep({label,summary,onEdit}:{label:string;summary:string;onEdit:()=>void}){
  return <button type="button" className="smt-completed-step" onClick={onEdit}>
    <span className="smt-complete-mark" aria-hidden="true">✓</span>
    <span><strong>{label}</strong><small>{summary}</small></span>
    <em>修改</em>
  </button>;
}

export function ActionFeedback({tone='info',title,detail,actionLabel,onAction,onDismiss}:{
  tone?:SmtTone;
  title:string;
  detail?:string;
  actionLabel?:string;
  onAction?:()=>void;
  onDismiss?:()=>void;
}){
  return <section className={`smt-action-feedback tone-${tone}`} role={tone==='danger'?'alert':'status'} aria-live="polite">
    <span className="smt-feedback-symbol" aria-hidden="true"/>
    <div><strong>{title}</strong>{detail?<p>{detail}</p>:null}</div>
    <div className="smt-feedback-actions">
      {actionLabel&&onAction?<button type="button" onClick={onAction}>{actionLabel}</button>:null}
      {onDismiss?<button type="button" onClick={onDismiss}>收起</button>:null}
    </div>
  </section>;
}

export function DisabledReason({children}:{children:ReactNode}){
  return <p className="smt-disabled-reason" role="status"><span aria-hidden="true">i</span>{children}</p>;
}

export function StatusTag({tone='neutral',children}:{tone?:SmtTone;children:ReactNode}){
  return <span className={`smt-status-tag tone-${tone}`}><span aria-hidden="true"/>{children}</span>;
}

export function EmptyState({icon='○',title,detail,actionLabel,onAction,children}:{icon?:string;title:string;detail:string;actionLabel?:string;onAction?:()=>void;children?:ReactNode}){
  return <section className="smt-empty-state" role="status">
    <span aria-hidden="true">{icon}</span>
    <div><h2>{title}</h2><p>{detail}</p></div>
    {actionLabel&&onAction?<button type="button" onClick={onAction}>{actionLabel}</button>:null}
    {children?<div>{children}</div>:null}
  </section>;
}

export function ConfirmDialog({open,title,description,confirmLabel,tone='danger',onConfirm,onClose}:{
  open:boolean;
  title:string;
  description:string;
  confirmLabel:string;
  tone?:SmtTone;
  onConfirm:()=>void;
  onClose:()=>void;
}){
  const dialogRef=useRef<HTMLDialogElement>(null);
  const cancelRef=useRef<HTMLButtonElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  const titleId=useId();
  const descriptionId=useId();

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!open||!dialog)return;
    previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!dialog.open)dialog.showModal();
    cancelRef.current?.focus();
    return()=>{
      if(dialog.open)dialog.close();
      previousFocus.current?.focus();
    };
  },[open]);

  if(!open)return null;
  return <dialog
    ref={dialogRef}
    className="smt-confirm-dialog"
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={event=>{event.preventDefault();onClose()}}
    onClick={event=>{if(event.target===event.currentTarget)onClose()}}
  >
    <section>
      <header><span className={`tone-${tone}`} aria-hidden="true">!</span><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div></header>
      <footer><button ref={cancelRef} type="button" onClick={onClose}>返回</button><button type="button" className={`tone-${tone}`} onClick={onConfirm}>{confirmLabel}</button></footer>
    </section>
  </dialog>;
}
