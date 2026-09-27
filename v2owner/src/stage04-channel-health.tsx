import {useMemo,useState} from 'react';
import type {OwnerChannelAction,OwnerChannelHealth,OwnerConnectionState} from './product-types';

const ACTION_LABEL:Record<OwnerChannelAction,string>={
  PAUSE:'暫停接單',
  RESUME:'恢復接單',
  SNOOZE:'暫停 30 分鐘',
  BUSY:'繁忙 +15 分鐘',
};

const CAUSE_LABEL:Record<OwnerChannelHealth['cause'],string>={
  manual:'人手設定',
  schedule:'營業時間',
  internet:'網絡',
  integration:'整合連線',
  provider:'平台狀態',
  platform_suspension:'平台暫停',
  policy:'系統規則',
  unknown:'原因未明',
};

const HEALTH_LABEL:Record<OwnerChannelHealth['health'],string>={
  HEALTHY:'運作正常',
  DEGRADED:'部分異常',
  OFFLINE:'未能連接',
  UNKNOWN:'狀態未明',
};

const MODE_LABEL:Record<OwnerChannelHealth['mode'],string>={
  NORMAL:'正常接單',
  BUSY:'繁忙',
  SNOOZED:'暫停至指定時間',
  PAUSED:'已暫停',
  CLOSED:'已關閉',
  UNKNOWN:'模式未明',
};

function acceptingLabel(value:boolean|null){
  return value===true?'接受新單':value===false?'不接受新單':'接單狀態未明';
}

function freshnessLabel(value:OwnerChannelHealth['freshness']){
  return value==='CURRENT'?'資料新鮮':value==='STALE'?'資料稍舊':value==='PARTIAL'?'部分資料':'新鮮度未明';
}

function humanTime(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK'):'未有讀回';
}

export function ChannelHealthWorkspace({
  channels,
  connection,
  onCommand,
}:{
  channels:readonly OwnerChannelHealth[];
  connection:OwnerConnectionState;
  onCommand:(label:string,target:string,impact:string)=>void;
}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=useMemo(()=>channels.find(row=>row.channelId===selectedId)??null,[channels,selectedId]);
  if(!channels.length){
    return <section className="card empty-state"><h2>渠道資料尚未連接</h2><p>未有正式渠道 readback 前唔會用一粒「正常」綠燈代替真實狀態。</p></section>;
  }

  if(selected){
    const canMutate=connection==='FRESH'&&(selected.availableActions?.length??0)>0;
    return <section className="channel-detail">
      <button className="text-back" type="button" onClick={()=>setSelectedId(null)}>‹ 返回渠道</button>
      <header className="channel-detail-head">
        <div><small>渠道詳情</small><h3>{selected.name}</h3><p>{acceptingLabel(selected.acceptingOrders)}</p></div>
        <span className={'channel-health health-'+selected.health.toLowerCase()}>{HEALTH_LABEL[selected.health]}</span>
      </header>
      <div className="channel-detail-grid">
        <div><span>目前模式</span><strong>{MODE_LABEL[selected.mode]}</strong></div>
        <div><span>原因</span><strong>{CAUSE_LABEL[selected.cause]}</strong></div>
        <div><span>期望狀態</span><strong>{selected.desiredState}</strong></div>
        <div><span>實際讀回</span><strong>{selected.observedState}</strong></div>
        <div><span>資料新鮮度</span><strong>{freshnessLabel(selected.freshness)}</strong></div>
        <div><span>最近讀回</span><strong>{humanTime(selected.observedAt)}</strong></div>
      </div>
      <section className="channel-proof-card">
        <div><span>最近指令</span><b>{selected.lastCommand??'未有遠端指令'}</b></div>
        <div><span>正式讀回</span><b>{selected.readback??'未有額外讀回資料'}</b></div>
      </section>
      <section className="channel-actions" aria-label="渠道安全操作">
        {(['PAUSE','SNOOZE','BUSY','RESUME'] as const).map(action=>{
          const supported=selected.availableActions?.includes(action)===true;
          return <button
            type="button"
            key={action}
            disabled={!canMutate||!supported}
            onClick={()=>onCommand(
              ACTION_LABEL[action],
              selected.channelId,
              action==='PAUSE'
                ?'只停止新單；不得取消、退款或改動已成立訂單。'
                :action==='RESUME'
                  ?'只恢復新單入口；必須等待渠道正式讀回。'
                  :action==='SNOOZE'
                    ?'只作有期限暫停；到期語義由渠道責任端執行。'
                    :'只調整接單容量／預計時間；不得等同暫停接單。'
            )}
          >{ACTION_LABEL[action]}</button>;
        })}
      </section>
      {!canMutate?<p className="callout">目前 Owner 遠端渠道操作未接通；本頁只顯示正式 projection，唔會假裝操作成功。</p>:null}
    </section>;
  }

  return <section className="channel-health-list">
    <p className="callout">渠道接單狀態、健康、模式同原因分開顯示。網絡正常唔代表平台正常；渠道暫停亦唔代表連線故障。</p>
    {channels.map(item=><button className="channel-health-row" type="button" key={item.channelId} onClick={()=>setSelectedId(item.channelId)}>
      <div className="channel-health-main">
        <strong>{item.name}</strong>
        <small>{acceptingLabel(item.acceptingOrders)} · {MODE_LABEL[item.mode]}</small>
        <small>期望 {item.desiredState} · 實際 {item.observedState}</small>
      </div>
      <div className="channel-health-meta">
        <span className={'channel-health health-'+item.health.toLowerCase()}>{HEALTH_LABEL[item.health]}</span>
        <small>{freshnessLabel(item.freshness)}</small>
      </div>
    </button>)}
  </section>;
}
