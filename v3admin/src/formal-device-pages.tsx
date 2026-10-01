import {useV3FormalDraft} from './formal-draft.tsx';
import {useV3ReadModels} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function hkt(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}

export function FormalDevicesPage(){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const current=read.acks.filter(ack=>ack.fingerprint===formal.canonical.fingerprint&&ack.publishedAt===formal.canonical.publishedAt);
  const currentIds=new Set(current.map(ack=>ack.deviceId));
  return <div className="v3-functional-page">
    <PageHeader eyebrow="裝置管理" title="裝置狀態" description="目前 verified device evidence 來源係 SMT Config ACK；未有 device inventory / heartbeat endpoint 前唔會補假裝置。" aside={<button type="button" disabled={read.acksRefreshing} onClick={()=>void read.refresh()}>重新讀取 ACK</button>}/>
    {read.acksError?<div className="v3-error">{read.acksError.message}</div>:null}
    <div className="v3-mobile-form-note">Current Canonical：R{formal.canonical.revision} · {formal.canonical.fingerprint}</div>
    {read.acksPending?<div className="v3-refreshing">正在讀取裝置 ACK…</div>:!read.acks.length?<section className="v3-product-empty"><h2>目前未有裝置 ACK evidence</h2></section>:<div className="v3-functional-card-grid">{read.acks.map(ack=><article className="v3-functional-card-static" key={ack.deviceId}>
      <div><strong>{ack.deviceId}</strong><small>R{ack.revision} · {ack.disposition}</small></div>
      <b>{currentIds.has(ack.deviceId)?'Current':'Older'}</b>
      <StatusBadge tone={currentIds.has(ack.deviceId)?'good':'unknown'}>{currentIds.has(ack.deviceId)?'目標已套用':'非目前版本'}</StatusBadge>
      <small>{hkt(ack.appliedAt)}</small>
    </article>)}</div>}
    <section className="v3-functional-section">
      <header><div><h3>未有 verified device inventory</h3><p>OS version、App version、lastSeen、硬件型號、連線狀態需要獨立 device read model。</p></div><StatusBadge tone="warning">READ SEAM REQUIRED</StatusBadge></header>
    </section>
  </div>;
}

export function FormalOtaGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="裝置管理" title="OTA／版本" description="OTA 只可以對已批准 artifact 做正式命令；未有 verified OTA server seam 前保持鎖定。"/>
    <section className="v3-functional-section">
      <header><div><h3>OTA command seam 未接</h3><p>需要 artifact identity / approval / target device / command idempotency / progress / final readback。</p></div><StatusBadge tone="warning">COMMAND + READBACK REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">Preview 入面嘅「安裝版本」唔會被當正式 OTA；Production 真機完全冇被觸發。</div>
    </section>
  </div>;
}
