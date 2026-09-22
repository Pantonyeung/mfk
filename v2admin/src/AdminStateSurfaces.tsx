import type {ReactNode} from 'react';
import type {AdminTone} from './AdminUiPrimitives.tsx';

export function AdminEmptyState({
  title,description,action,
}:{
  title:string;
  description:string;
  action?:ReactNode;
}){
  return <section className="admin-empty-state">
    <b>{title}</b>
    <p>{description}</p>
    {action}
  </section>;
}

export function AdminTruthNotice({
  tone='neutral',title,children,live=false,
}:{
  tone?:AdminTone;
  title:string;
  children:ReactNode;
  live?:boolean;
}){
  return <section className="admin-truth-notice" data-tone={tone} role={tone==='danger'?'alert':undefined} aria-live={live&&tone!=='danger'?'polite':undefined}>
    <b>{title}</b>
    <span>{children}</span>
  </section>;
}
