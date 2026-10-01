import {useV3FormalDraft} from './formal-draft.tsx';
import {useV3ReadModels} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function hkt(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}

export function FormalVersionsReadbackPage(){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const matching=read.acks.filter(ack=>ack.fingerprint===formal.canonical.fingerprint&&ack.publishedAt===formal.canonical.publishedAt);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="發佈與版本" title="版本／回讀確認" description="顯示目前正式 Canonical 同 SMT ACK；Published 同 Applied 分開。" aside={<button type="button" disabled={read.acksRefreshing} onClick={()=>void read.refresh()}>{read.acksRefreshing?'更新中…':'重新讀取 ACK'}</button>}/>
    {read.acksError?<div className="v3-error">{read.acksError.message}</div>:null}
    <section className="v3-formal-draft-meta">
      <div><span>Revision</span><strong>R{formal.canonical.revision}</strong></div>
      <div><span>Canonical Fingerprint</span><strong>{formal.canonical.fingerprint}</strong></div>
      <div><span>雲端已發佈</span><strong>{hkt(formal.canonical.publishedAt)}</strong></div>
      <div><span>目標 ACK</span><strong>{matching.length}</strong></div>
    </section>
    <section className="v3-functional-section">
      <header><div><h3>SMT Readback</h3><p>只有 fingerprint + publishedAt 同目前 Canonical 一致先計做本版本套用確認。</p></div><StatusBadge tone={matching.length?'good':'warning'}>{matching.length?'有匹配 ACK':'未見匹配 ACK'}</StatusBadge></header>
      {read.acksPending?<div className="v3-refreshing">正在讀取 ACK…</div>:matching.length?<div className="v3-action-list">{matching.map(ack=><article key={ack.deviceId}><div><strong>{ack.deviceId}</strong><small>R{ack.revision} · {ack.disposition}</small></div><strong>{hkt(ack.appliedAt)}</strong><StatusBadge tone="good">目標已套用</StatusBadge></article>)}</div>:<div className="v3-product-empty"><h2>目前未見呢個 Canonical 版本嘅 SMT ACK</h2><p>雲端 Published 唔等於門店已 Applied。</p></div>}
    </section>
    <section className="v3-functional-section">
      <header><div><h3>版本歷史</h3><p>目前 verified backend 只提供 active Canonical + device ACK；未有 immutable version-list read endpoint。</p></div><StatusBadge tone="warning">HISTORY READ SEAM REQUIRED</StatusBadge></header>
    </section>
  </div>;
}

export function FormalRollbackGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="發佈與版本" title="回復版本" description="Rollback 必須建立一個新正式版本，唔可以直接倒帶 active Canonical。"/>
    <section className="v3-functional-section">
      <header><div><h3>Rollback seam 未接</h3><p>需要先有 immutable version history read + server-side rollback-as-new-version command + validation + publish readback。</p></div><StatusBadge tone="warning">COMMAND SEAM REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">未有呢個 seam 前唔會提供假「回復」按鈕，避免 browser 自己重砌舊 snapshot 成第二 authority。</div>
    </section>
  </div>;
}
