import type {OwnerChannelHealth,OwnerConnectionState} from './product-types';

function healthLabel(value:OwnerChannelHealth['health']){
  return value==='HEALTHY'?'健康':value==='DEGRADED'?'降級':value==='OFFLINE'?'離線':'狀態未明';
}
function modeLabel(value:OwnerChannelHealth['mode']){
  return value==='NORMAL'?'正常接單':value==='BUSY'?'繁忙':value==='SNOOZED'?'暫停至指定時間':value==='PAUSED'?'已暫停接單':'已關閉';
}
function causeLabel(value:OwnerChannelHealth['cause']){
  return value==='manual'?'人手控制':value==='schedule'?'營業時間':value==='internet'?'網絡':value==='integration'?'整合連線':value==='provider'?'平台狀態':value==='platform_suspension'?'平台暫停':'政策';
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
      <div><span>OA-CHN-001</span><h1>渠道健康與有限控制</h1><small>健康、接單狀態、模式分開顯示；所有操作以正式讀回為準。</small></div>
    </header>
    {!channels.length?<section className="card empty-state"><h2>渠道資料尚未連接</h2><p>未有 canonical readback 前唔會顯示假狀態。</p></section>:
      <div className="channel-grid">{channels.map(channel=>{
        const unknown=channel.readback==='UNKNOWN';
        return <article className="card channel-card" key={channel.channelId}>
          <header><div><strong>{channel.name}</strong><small>{modeLabel(channel.mode)}</small></div><span className={'health-chip '+channel.health.toLowerCase()}>{healthLabel(channel.health)}</span></header>
          <div className="channel-facts">
            <div><span>新單</span><b>{channel.acceptingOrders===true?'接受':channel.acceptingOrders===false?'停止':'未明'}</b></div>
            <div><span>Desired</span><b>{channel.desiredState}</b></div>
            <div><span>Observed</span><b>{channel.observedState}</b></div>
            <div><span>原因</span><b>{causeLabel(channel.cause)}</b></div>
          </div>
          <small className="muted">Freshness：{channel.freshness} · {new Date(channel.observedAt).toLocaleString('zh-HK')}</small>
          {channel.lastCommand?<p className="channel-readback">上次操作：{channel.lastCommand.action} · {channel.lastCommand.state}</p>:null}
          <p className="channel-readback">Readback：{channel.readback}</p>
          {unknown?<button className="primary wide" onClick={()=>onRecheck(channel.channelId)}>重新讀回正式狀態</button>:null}
          <div className="channel-actions">
            <button disabled>暫停接單</button><button disabled>恢復接單</button><button disabled>暫停至時間</button><button disabled>繁忙／加時</button>
          </div>
          <small className="unsupported-note">OA-CHN-001 目前只讀；未有正式 command seam，availableActions = []，所有操作保持停用。</small>
        </article>
      })}</div>}
  </section>;
}
