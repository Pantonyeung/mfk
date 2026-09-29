import type {ReactNode} from 'react';

export type SmmStageXKind='LOADING'|'EMPTY'|'OFFLINE'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';

const STAGE_X_ART:Record<SmmStageXKind,string>={
  LOADING:'/brand/stagex/loading.webp',
  EMPTY:'/brand/stagex/empty.webp',
  OFFLINE:'/brand/stagex/offline.webp',
  STALE:'/brand/stagex/stale.webp',
  PARTIAL:'/brand/stagex/partial.webp',
  UNKNOWN:'/brand/stagex/unknown.webp',
  ERROR:'/brand/stagex/error.webp',
};

const DEFAULT_COPY:Record<SmmStageXKind,{title:string;detail:string;action?:string}>={
  LOADING:{title:'載入中',detail:'正在準備最新資料，請稍候。'},
  EMPTY:{title:'暫時未有資料',detail:'有新內容時會喺呢度顯示。'},
  OFFLINE:{title:'目前處於離線模式',detail:'可用嘅本機功能會繼續運作；連線恢復後會自動更新。'},
  STALE:{title:'資料可能未更新',detail:'而家顯示最近一次資料，你可以重新整理。',action:'重新整理'},
  PARTIAL:{title:'部分資料暫時未能顯示',detail:'已成功載入嘅內容會保留，其餘內容可稍後再試。',action:'再試一次'},
  UNKNOWN:{title:'結果仍在確認',detail:'先確認原本結果，請勿重複執行同一操作。',action:'重新確認結果'},
  ERROR:{title:'暫時未能完成',detail:'請稍後再試；已完成嘅內容唔會因為重試而消失。',action:'再試一次'},
};

export function StageXState({
  kind,
  title,
  detail,
  compact=false,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}:{
  kind:SmmStageXKind;
  title?:string;
  detail?:string;
  compact?:boolean;
  primaryLabel?:string;
  onPrimary?:()=>void;
  secondaryLabel?:string;
  onSecondary?:()=>void;
  children?:ReactNode;
}){
  const copy=DEFAULT_COPY[kind];
  const action=primaryLabel??copy.action;
  return <section
    className={`stagex-state stagex-${kind.toLowerCase()} ${compact?'stagex-compact':''}`}
    data-stage-x-state={kind}
    role={kind==='ERROR'||kind==='UNKNOWN'?'alert':'status'}
    aria-live={kind==='ERROR'||kind==='UNKNOWN'?'assertive':'polite'}
  >
    <div className="stagex-art-slot" aria-hidden="true">
      <img src={STAGE_X_ART[kind]} alt=""/>
    </div>
    <div className="stagex-copy">
      <strong>{title??copy.title}</strong>
      <p>{detail??copy.detail}</p>
      {children}
    </div>
    {(action&&onPrimary)||secondaryLabel?<div className="stagex-actions">
      {secondaryLabel&&onSecondary?<button type="button" className="stagex-secondary" onClick={onSecondary}>{secondaryLabel}</button>:null}
      {action&&onPrimary?<button type="button" className="stagex-primary" onClick={onPrimary}>{action}</button>:null}
    </div>:null}
  </section>;
}

export const SMM_STAGE_X_KINDS=Object.freeze([
  'LOADING','EMPTY','OFFLINE','STALE','PARTIAL','UNKNOWN','ERROR',
] as const);
