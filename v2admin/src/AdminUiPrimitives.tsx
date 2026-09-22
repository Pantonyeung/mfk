import type {ReactNode} from 'react';

export type AdminTone='neutral'|'info'|'success'|'warning'|'danger';

export interface AdminGuidedStep{
  id:string;
  label:string;
  summary:string;
}

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

export function AdminGuidedProgress({
  steps,currentStep,onStepChange,label='工作進度',
}:{
  steps:readonly AdminGuidedStep[];
  currentStep:string;
  onStepChange?:(stepId:string)=>void;
  label?:string;
}){
  const currentIndex=Math.max(0,steps.findIndex(step=>step.id===currentStep));
  return <nav className="admin-guided-progress" aria-label={label}>
    <ol>
      {steps.map((step,index)=>{
        const state=index<currentIndex?'complete':index===currentIndex?'current':'upcoming';
        const content=<><span className="admin-guided-index" aria-hidden="true">{state==='complete'?'✓':index+1}</span><span><b>{state==='upcoming'?'稍後步驟':step.label}</b><small>{state==='current'?step.summary:state==='complete'?'已完成，可返回修改':'完成目前步驟後解鎖'}</small></span></>;
        return <li key={step.id} data-state={state} aria-current={state==='current'?'step':undefined}>
          {state!=='complete'||!onStepChange?<div>{content}</div>:<button type="button" onClick={()=>onStepChange(step.id)}>{content}</button>}
        </li>;
      })}
    </ol>
  </nav>;
}

export function AdminGuidedPanel({
  eyebrow,title,instruction,tone='info',children,
}:{
  eyebrow:string;
  title:string;
  instruction:string;
  tone?:AdminTone;
  children:ReactNode;
}){
  return <section className="admin-guided-panel" data-tone={tone} aria-labelledby={'guided-'+title.replace(/\s+/g,'-')}>
    <header>
      <span>{eyebrow}</span>
      <h2 id={'guided-'+title.replace(/\s+/g,'-')}>{title}</h2>
      <p>{instruction}</p>
    </header>
    <div className="admin-guided-panel-body">{children}</div>
  </section>;
}

export function AdminStepActions({
  onBack,onNext,nextLabel='繼續',backLabel='上一步',disabledReason,secondaryAction,
}:{
  onBack?:()=>void;
  onNext:()=>void;
  nextLabel?:string;
  backLabel?:string;
  disabledReason?:string;
  secondaryAction?:ReactNode;
}){
  return <footer className="admin-step-actions">
    <div>{onBack?<button type="button" className="secondary" onClick={onBack}>← {backLabel}</button>:null}{secondaryAction}</div>
    <div>{disabledReason?<small role="status">{disabledReason}</small>:null}<button type="button" className="primary" disabled={Boolean(disabledReason)} onClick={onNext}>{nextLabel} →</button></div>
  </footer>;
}
