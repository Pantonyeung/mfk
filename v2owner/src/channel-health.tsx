import {useMemo,useState} from 'react';
import type {OwnerChannelHealth,OwnerConnectionState} from './product-types';

function healthLabel(value:OwnerChannelHealth['health']){
  return value==='HEALTHY'?'正常':value==='DEGRADED'?'需留意':value==='OFFLINE'?'異常':'待確認';
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
function acceptingLabel(value:boolean|null){
  return value===true?'接受':value===false?'停止':'待確認';
}

export function ChannelHealthPage({
  channels,connection,onRecheck,onBack,
}:{
  channels:readonly OwnerChannelHealth[];
  connection:OwnerConnectionState;
  onRecheck:(channelId:string)=>void;
  onBack:()=>void;
}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=channels.find(channel=>channel.channelId===selectedId)??null;
  const observedAt=useMemo(()=>{
    const values=channels.map(channel=>channel.observedAt).filter(Boolean).sort();
    return values.at(-1)??null;
  },[channels]);

  return <section className="page channel-page">
    <header className="page-head secondary-head">
      <button className="back-link" onClick={onBack}>‹ 更多</button>
      <div><span>渠道</span><h1>渠道健康</h1><small>即時掌握各平台接單狀態；有需要先進入個別渠道處理。</small></div>
    </header>

    <section className="channel-overview-meta">
      <span>{channels.length} 個渠道</span>
      <small>{observedAt?'最後更新 '+new Date(observedAt).toLocaleString('zh-HK'):'未有更新時間'}</small>
    </section>

    {!channels.length?<section className="card empty-state"><h2>暫時未有渠道資料</h2><p>資料未更新完成前，呢度唔會顯示推算狀態。</p></section>:
      <div className="channel-overview-list">{channels.map(channel=><button className="channel-overview-row" key={channel.channelId} onClick={()=>setSelectedId(channel.channelId)}>
        <span className="channel-mark" aria-hidden="true">{channel.name.slice(0,1)}</span>
        <div className="channel-overview-copy">
          <div><strong>{channel.name}</strong><span className={'health-chip '+channel.health.toLowerCase()}>{healthLabel(channel.health)}</span></div>
          <small>{modeLabel(channel.mode)}</small>
          <div className="channel-inline-stats">
            <span><b>{acceptingLabel(channel.acceptingOrders)}</b><small>新單</small></span>
            <span><b>{businessStateLabel(channel.observedState)}</b><small>目前狀態</small></span>
            <span><b>{causeLabel(channel.cause)}</b><small>原因</small></span>
          </div>
        </div>
        <b className="channel-chevron" aria-hidden="true">›</b>
      </button>)}</div>}

    {selected?<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}>
      <section className="drawer channel-detail-drawer" role="dialog" aria-modal="true" aria-label={selected.name+' 渠道詳情'}>
        <header className="drawer-head">
          <div className="channel-detail-title"><span className="channel-mark" aria-hidden="true">{selected.name.slice(0,1)}</span><div><small>渠道詳情</small><h2>{selected.name}</h2><span className={'health-chip '+selected.health.toLowerCase()}>{healthLabel(selected.health)}</span></div></div>
          <button onClick={()=>setSelectedId(null)} aria-label="關閉">×</button>
        </header>

        <section className="channel-detail-status card">
          <div><span>接收新單</span><strong>{acceptingLabel(selected.acceptingOrders)}</strong></div>
          <div><span>營運模式</span><strong>{modeLabel(selected.mode)}</strong></div>
          <div><span>目前狀態</span><strong>{businessStateLabel(selected.observedState)}</strong></div>
          <div><span>原因</span><strong>{causeLabel(selected.cause)}</strong></div>
        </section>

        <section className="channel-detail-section">
          <h3>狀態資料</h3>
          <div className="channel-detail-grid">
            <div><span>設定狀態</span><strong>{businessStateLabel(selected.desiredState)}</strong></div>
            <div><span>資料更新</span><strong>{freshnessLabel(selected.freshness)}</strong></div>
            <div><span>最後更新</span><strong>{new Date(selected.observedAt).toLocaleString('zh-HK')}</strong></div>
            <div><span>狀態確認</span><strong>{selected.readback==='CONFIRMED'?'已確認':selected.readback==='PARTIAL'?'部分確認':'待確認'}</strong></div>
          </div>
          {selected.lastCommand?<p className="channel-last-action">最近操作：{commandLabel(selected.lastCommand.action)} · {commandStateLabel(selected.lastCommand.state)}</p>:null}
        </section>

        <section className="channel-detail-section">
          <h3>渠道控制</h3>
          <div className="channel-actions">
            <button disabled>暫停接單</button>
            <button disabled>恢復接單</button>
            <button disabled>暫停至時間</button>
            <button disabled>繁忙／加時</button>
          </div>
          {selected.readback==='UNKNOWN'?<button className="primary wide" onClick={()=>onRecheck(selected.channelId)}>重新確認狀態</button>:null}
          <small className="unsupported-note">{connection==='OFFLINE_READONLY'?'目前離線，只供查看。':'目前只供查看；可操作功能會喺完成連接後開放。'}</small>
        </section>
      </section>
    </div>:null}
  </section>;
}
