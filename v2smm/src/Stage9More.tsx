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
          <span className="stage9-icon-slot" data-final-art-pending={item[3]} aria-hidden="true"/>
          <span className="stage9-card-copy"><strong>{item[1]}</strong><small>{item[2]}</small></span>
          <span className="stage9-card-state">{statuses[key]||'查看'}</span>
          <span className="stage9-chevron" aria-hidden="true">›</span>
        </button>;
      })}
    </div>
    <section className="stage9-boundary"><strong>手機只做前線店務</strong><span>商品供應更改、重印、深層設定等操作會留喺有正式權限嘅工作位置。</span></section>
  </section>;
}
