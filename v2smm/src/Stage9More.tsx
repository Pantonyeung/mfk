import type {ReactNode} from 'react';

export type Stage9Tool='staff'|'connection'|'channels'|'business'|'printing'|'diagnostics'|'pending'|'capacity'|'reporting'|'refunds';

type Statuses=Partial<Record<Stage9Tool,string>>;

const TOOLS=[
  ['staff','員工帳戶','查看目前登入員工與切換帳戶','STAGE9_STAFF_ICON'],
  ['connection','連線','查看門店連線方式與狀態','STAGE9_CONNECTION_ICON'],
  ['channels','渠道健康','查看外賣平台與自家渠道','STAGE9_CHANNEL_ICON'],
  ['business','營業日','查看今日營業日記錄','STAGE9_BUSINESS_DAY_ICON'],
  ['capacity','產能','查看門店忙閒與接單狀態','STAGE9_CAPACITY_ICON'],
  ['reporting','營運報表','查看當日訂單、營業額與平均單','STAGE9_REPORTING_ICON'],
  ['refunds','退款要求','查看需要跟進嘅售後事項','STAGE9_REFUND_ICON'],
  ['printing','打印與設備','查看打印機及設備健康','STAGE9_DEVICE_ICON'],
  ['diagnostics','診斷','查看連線、資料更新與本機狀態','STAGE9_DIAGNOSTICS_ICON'],
] as const;

function Stage9ToolIcon({tool}:{tool:Stage9Tool}){
  const common={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  if(tool==='staff')return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M4 19c0-3 2-5 5-5s5 2 5 5M14 15c3 0 5 1.5 5 4"/></svg>;
  if(tool==='connection')return <svg {...common}><path d="M4 9c4.5-4 11.5-4 16 0M7 12c3-2.7 7-2.7 10 0M10 15c1.2-1 2.8-1 4 0"/><circle cx="12" cy="18" r="1"/></svg>;
  if(tool==='channels')return <svg {...common}><path d="M5 6h14v12H5zM8 9h8M8 13h5"/></svg>;
  if(tool==='business')return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>;
  if(tool==='capacity')return <svg {...common}><path d="M4 18a8 8 0 0 1 16 0M12 10l4-3"/><circle cx="12" cy="18" r="1"/></svg>;
  if(tool==='reporting')return <svg {...common}><path d="M5 20V10M10 20V5M15 20v-7M20 20V8"/></svg>;
  if(tool==='refunds')return <svg {...common}><path d="M7 7h10a4 4 0 0 1 0 8H9M7 7l3-3M7 7l3 3"/><path d="M12 11v5M10 13h4"/></svg>;
  if(tool==='printing')return <svg {...common}><path d="M7 8V3h10v5M7 17h10v4H7zM5 9h14a2 2 0 0 1 2 2v6h-4M7 17H3v-6a2 2 0 0 1 2-2z"/></svg>;
  if(tool==='diagnostics')return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="3"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
}

function title(tool:Stage9Tool){
  return tool==='staff'?'員工帳戶':tool==='connection'?'連線':tool==='channels'?'渠道健康':tool==='business'?'營業日':tool==='printing'?'打印與設備':tool==='capacity'?'產能':tool==='reporting'?'營運報表':tool==='refunds'?'退款要求':tool==='pending'?'提交結果確認':'診斷';
}

export function Stage9MoreView({tool,setTool,statuses,children}:{
  tool:Stage9Tool|null;
  setTool:(tool:Stage9Tool|null)=>void;
  statuses:Statuses;
  children?:ReactNode;
}){
  if(tool)return <section className="stage9-page stage9-tool-page" data-stage9-visual={'9.TOOL.'+tool.toUpperCase()}>
    <header className="stage9-tool-header">
      <button type="button" onClick={()=>setTool(null)} aria-label="返回更多">‹</button>
      <div><strong>{title(tool)}</strong><small>{tool==='pending'?'確認之前提交嘅原本結果':'門店工具'}</small></div>
      <span/>
    </header>
    <div className="stage9-tool-body">{children}</div>
  </section>;

  return <section className="stage9-page" data-stage9-visual="9.1_MORE_HUB">
    <header className="stage9-header">
      <div><span>更多</span><h1>店務工具</h1><small>常用店務資料集中一頁；需要更深入設定時再去管理後台。</small></div>
    </header>
    <div className="stage9-grid" aria-label="店務工具">
      {TOOLS.map(item=>{
        const key=item[0] as Stage9Tool;
        return <button type="button" className="stage9-card" key={key} onClick={()=>setTool(key)}>
          <span className="stage9-icon-slot" aria-hidden="true"><Stage9ToolIcon tool={key}/></span>
          <span className="stage9-card-copy"><strong>{item[1]}</strong><small>{item[2]}</small></span>
          <span className="stage9-card-state">{statuses[key]||'查看'}</span>
          <span className="stage9-chevron" aria-hidden="true">›</span>
        </button>;
      })}
    </div>
    <section className="stage9-boundary"><strong>手機只做前線店務</strong><span>商品供應更改、重印、深層設定等操作會留喺有正式權限嘅工作位置。</span></section>
  </section>;
}
