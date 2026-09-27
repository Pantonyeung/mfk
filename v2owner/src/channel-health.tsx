import type {OwnerChannelHealth,OwnerConnectionState} from './product-types';

function healthLabel(value:OwnerChannelHealth['health']){
  return value==='HEALTHY'?'健康':value==='DEGRADED'?'降級':value==='OFFLINE'?'離線':'狀態未明';
}
function modeLabel(value:OwnerChannelHealth['mode']){
  return value==='NORMAL'?'正常接單':value==='BUSY'?'繁忙':value==='SNOOZED'?'暫停至指定時間':value==='PAUSED'?'已暫停接單':'已關閉';
}
function causeLabel(value:OwnerChannelHealth['cause']){
  return value==='manual'?'人手暫停':value==='schedule'?'營業時間':value==='internet'?'網絡連線':value==='integration'?'平台連接':value==='provider'?'平台狀態':value==='platform_suspension'?'平台暫停':'營運設定';
}
function businessStateLabel(value:string){
  const key=String(value||'').trim().toUpperCase();
  if(!key||key==='UNKNOWN'||key==='UNAVAILABLE')return '未有資料';
  if(['OPEN','ON','ONLINE','ACTIVE','ACCEPTING','AVAILABLE','ENABLED','NORMAL'].includes(key))return '接受新單';
  if(['PAUSED','OFF','CLOSED','DISABLED','NOT_ACCEPTING'].includes(key))return '暫停接單';
  if(key==='SNOOZED')return '暫停至指定時間';
  if(key==='BUSY')return '繁忙';
  return value;
}
function freshnessLabel(value:OwnerChannelHealth['freshness']){
  return value==='CURRENT'?'已更新':value==='STALE'?'資料稍舊':value==='PARTIAL'?'部分資料':'未有資料';
}
function commandLabel(value:NonNullable<OwnerChannelHealth['lastCommand']>['action']){
  return value==='PAUSE'?'暫停接單':value==='RESUME'?'恢復接單':value==='SNOOZE'?'暫停至時間':'繁忙／加時';
}
function commandStateLabel(value:NonNullable<OwnerChannelHealth['lastCommand']>['state']){
  return value==='CONFIRMED'||value==='IDEMPOTENT'?'已完成':value==='REJECTED'?'未獲接受':value==='FAILED'?'未完成':'待確認';
}

export function ChannelHealthPage({
  channels,connection,onRecheck,onBack,
}:{
  channels:readonly OwnerChannelHealth[];
  connection:OwnerConnectionState;
  onRecheck:(channelId:string)=>void;
  onBack:()=>void;
}){
  return <section className="page channel-page">
    <header className="page-head secondary-head">
      <button className="back-link" onClick={onBack}>‹ 更多</button>
      <div><span>渠道</span><h1>渠道健康</h1><small>即時掌握每個接單渠道嘅狀態，需要時再進一步處理。</small></div>
    </header>
    {!channels.length?<section className="card empty-state"><h2>暫時未有渠道資料</h2><p>資料未更新完成前，呢度唔會顯示推算狀態。</p></section>:
      <div className="channel-grid">{channels.map(channel=>{
        const unknown=channel.readback==='UNKNOWN';
        return <article className="card channel-card" key={channel.channelId}>
          <header><div className="channel-identity"><span className="channel-mark" aria-hidden="true">{channel.name.slice(0,1)}</span><div><strong>{channel.name}</strong><small>{modeLabel(channel.mode)}</small></div></div><span className={'health-chip '+channel.health.toLowerCase()}>{healthLabel(channel.health)}</span></header>
          <div className="channel-facts">
            <div><span>新單</span><b>{channel.acceptingOrders===true?'接受':channel.acceptingOrders===false?'停止':'未明'}</b></div>
            <div><span>設定狀態</span><b>{businessStateLabel(channel.desiredState)}</b></div>
            <div><span>目前狀態</span><b>{businessStateLabel(channel.observedState)}</b></div>
            <div><span>原因</span><b>{causeLabel(channel.cause)}</b></div>
          </div>
          <small className="muted">{freshnessLabel(channel.freshness)} · {new Date(channel.observedAt).toLocaleString('zh-HK')}</small>
          {channel.lastCommand?<p className="channel-readback">最近操作：{commandLabel(channel.lastCommand.action)} · {commandStateLabel(channel.lastCommand.state)}</p>:null}
          <p className="channel-readback">狀態確認：{channel.readback==='CONFIRMED'?'已確認':channel.readback==='PARTIAL'?'部分確認':'待確認'}</p>
          {unknown?<button className="primary wide" onClick={()=>onRecheck(channel.channelId)}>重新確認狀態</button>:null}
          <div className="channel-actions">
            <button disabled>暫停接單</button><button disabled>恢復接單</button><button disabled>暫停至時間</button><button disabled>繁忙／加時</button>
          </div>
          <small className="unsupported-note">目前只供查看；可操作功能會喺完成連接後開放。</small>
        </article>
      })}</div>}
  </section>;
}
