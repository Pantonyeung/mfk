import {useEffect,useMemo,useRef,useState} from 'react';
import type {V3BusinessConfigurationExtract} from './business-config-extract.ts';
import {useV3FormalDraft,type V3FormalAdminVersionList} from './formal-draft.tsx';
import {useV3ReadModels} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function hkt(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}
function errorText(error:unknown){
  return error instanceof Error?error.message:'VERSION_READ_FAILED';
}

/** Preparing never downloads. The separate native link is an explicit user gesture. */
export function BusinessConfigurationExtractControl({sourceKey,prepare}:{sourceKey:string;prepare:()=>Promise<V3BusinessConfigurationExtract>}){
  const [prepared,setPrepared]=useState<{sourceKey:string;extract:V3BusinessConfigurationExtract;url:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const generation=useRef(0),pending=useRef(false),url=useRef<string|null>(null);
  const release=()=>{if(url.current){URL.revokeObjectURL(url.current);url.current=null;}};
  useEffect(()=>{
    setPrepared(null);setError('');setBusy(false);pending.current=false;
    return ()=>{generation.current++;pending.current=false;release();};
  },[sourceKey]);
  const prepareFile=async()=>{
    if(pending.current)return;
    pending.current=true;const request=++generation.current;
    release();setPrepared(null);setError('');setBusy(true);
    try{
      const extract=await prepare();
      if(request!==generation.current)return;
      const next=URL.createObjectURL(new Blob([JSON.stringify(extract,null,2)],{type:'application/json;charset=utf-8'}));
      url.current=next;setPrepared({sourceKey,extract,url:next});
    }catch(err){if(request===generation.current)setError(errorText(err));}
    finally{if(request===generation.current){pending.current=false;setBusy(false);}}
  };
  const ready=prepared?.sourceKey===sourceKey?prepared:null;
  const source=ready?.extract.source;
  return <section className="v3-functional-section">
    <header><div><h3>已選商業設定擷取</h3><p>selected business configuration extract。只讀取已發佈商品、套餐、選項及列印設定；不包含未發佈草稿、員工／登入資料、顧客個人記錄或交易歷史，並非完整系統備份。</p></div></header>
    <button type="button" disabled={busy} onClick={prepareFile}>{busy?'正在讀取及核對…':'準備商業設定擷取'}</button>
    {error?<div className="v3-error" role="alert">{error}</div>:null}
    {ready&&source?<div className="v3-mobile-form-note" role="status">
      <p>已準備，尚未確認檔案已儲存。請按下載並核對檔案；擷取只代表下列時間點。</p>
      <p>Store {source.storeId} · R{source.revision} · Published {hkt(source.publishedAt)}</p>
      <p>Admin fingerprint: {source.adminFingerprint}<br/>Canonical fingerprint: {source.canonicalFingerprint}</p>
      <p>Selected sections SHA-256: {ready.extract.selectedSectionsChecksum.value}</p>
      <p>包含：{ready.extract.selectedSections.join(', ')}。各區資料數量及排除項目已記錄於檔案。</p>
      {ready.extract.absentOptionalSections.length?<p>來源未提供：{ready.extract.absentOptionalSections.join(', ')}。檔案保留缺少欄位的狀態，不會補入空白或預設設定。</p>:null}
      <a href={ready.url} download={'selected-business-config-'+source.storeId.replace(/[^a-z0-9_-]/gi,'_')+'-R'+source.revision+'-'+ready.extract.capturedAt.replace(/[:.]/g,'-')+'.json'}>下載 selected business configuration extract (JSON)</a>
    </div>:null}
  </section>;
}

export function FormalVersionsReadbackPage(){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const [versions,setVersions]=useState<V3FormalAdminVersionList|null>(null);
  const [versionsLoading,setVersionsLoading]=useState(true);
  const [versionsError,setVersionsError]=useState('');
  const matching=read.acks.filter(ack=>ack.fingerprint===formal.canonical.fingerprint&&ack.publishedAt===formal.canonical.publishedAt);

  const loadVersions=async()=>{
    setVersionsLoading(true);setVersionsError('');
    try{setVersions(await formal.readVersions());}
    catch(error){setVersionsError(errorText(error));}
    finally{setVersionsLoading(false);}
  };

  useEffect(()=>{void loadVersions();},[formal.canonical.fingerprint]);

  const refreshAll=async()=>{
    await Promise.all([loadVersions(),read.refresh()]);
  };

  return <div className="v3-functional-page">
    <PageHeader
      eyebrow="發佈與版本"
      title="版本／回讀確認"
      description="Canonical 版本歷史、雲端 Published 同 SMT Applied 分開顯示；只有 authoritative evidence 先會變綠。"
      aside={<button type="button" disabled={versionsLoading||read.acksRefreshing} onClick={()=>void refreshAll()}>{versionsLoading||read.acksRefreshing?'更新中…':'重新讀取證據'}</button>}
    />
    {versionsError?<div className="v3-error">{versionsError}</div>:null}
    {read.acksError?<div className="v3-error">{read.acksError.message}</div>:null}
    <section className="v3-formal-draft-meta">
      <div><span>Revision</span><strong>R{formal.canonical.revision}</strong></div>
      <div><span>Canonical Fingerprint</span><strong>{formal.canonical.fingerprint}</strong></div>
      <div><span>雲端已發佈</span><strong>{hkt(formal.canonical.publishedAt)}</strong></div>
      <div><span>目前版本 SMT ACK</span><strong>{matching.length}</strong></div>
    </section>

    <BusinessConfigurationExtractControl sourceKey={JSON.stringify([formal.canonical.storeId,formal.canonical.revision,formal.canonical.publishedAt,formal.canonical.fingerprint,formal.canonical.adminFingerprint])} prepare={formal.prepareBusinessConfigurationExtract}/>

    <section className="v3-functional-section">
      <header><div><h3>SMT Readback</h3><p>只有 fingerprint + publishedAt 同目前 Canonical 一致先計做門店已套用。</p></div><StatusBadge tone={matching.length?'good':'warning'}>{matching.length?'Applied evidence 已存在':'Published ≠ Applied'}</StatusBadge></header>
      {read.acksPending?<div className="v3-refreshing">正在讀取 ACK…</div>:matching.length?<div className="v3-action-list">{matching.map(ack=><article key={ack.deviceId}><div><strong>{ack.deviceId}</strong><small>R{ack.revision} · {ack.disposition}</small></div><strong>{hkt(ack.appliedAt)}</strong><StatusBadge tone="good">目標已套用</StatusBadge></article>)}</div>:<div className="v3-product-empty"><h2>目前未見呢個 Canonical 版本嘅 SMT ACK</h2><p>雲端已發佈唔代表舖頭 Runtime 已套用。</p></div>}
    </section>

    <section className="v3-functional-section">
      <header><div><h3>Immutable 版本歷史</h3><p>版本 metadata 由正式 server read seam 提供；舊 snapshot 唔會送落 browser。</p></div><StatusBadge tone={versions?'good':'warning'}>{versions?versions.historyCompleteness:'讀取中'}</StatusBadge></header>
      {versionsLoading?<div className="v3-refreshing">正在讀取版本歷史…</div>:versions?.versions.length?<div className="v3-action-list">{versions.versions.map(version=><article key={version.fingerprint}>
        <div><strong>R{version.revision}</strong><small>{hkt(version.publishedAt)} · {version.fingerprint}</small></div>
        <strong>{version.state==='ACTIVE'?'目前正式版本':'歷史版本'}</strong>
        <StatusBadge tone={version.state==='ACTIVE'?'good':'neutral'}>{version.state}</StatusBadge>
      </article>)}</div>:<div className="v3-product-empty"><h2>未有可讀版本歷史</h2><p>唔會用 Preview history 補位。</p></div>}
      {versions?.historyCompleteness==='FORWARD_ONLY'?<div className="v3-mobile-form-note">呢條 history seam 只保證由正式上線之後向前完整；舊於 seam 嘅版本唔會假裝可以重建。</div>:null}
    </section>
  </div>;
}

export function FormalRollbackPage(){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const [versions,setVersions]=useState<V3FormalAdminVersionList|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState('');
  const [reason,setReason]=useState('');
  const [operation,setOperation]=useState<{id:string;target:string;reason:string}|null>(null);
  const [result,setResult]=useState<Record<string,unknown>|null>(null);

  const archived=useMemo(()=>versions?.versions.filter(version=>version.state==='ARCHIVED')??[],[versions]);

  const loadVersions=async()=>{
    setLoading(true);setError('');
    try{
      const next=await formal.readVersions();
      setVersions(next);
      setSelected(current=>next.versions.some(version=>version.state==='ARCHIVED'&&version.fingerprint===current)
        ?current
        :(next.versions.find(version=>version.state==='ARCHIVED')?.fingerprint??''));
    }catch(err){setError(errorText(err));}
    finally{setLoading(false);}
  };

  useEffect(()=>{void loadVersions();},[formal.canonical.fingerprint]);

  const submit=async()=>{
    if(!selected||!reason.trim()||formal.draft)return;
    setError('');setResult(null);
    const normalizedReason=reason.trim();
    const currentOperation=operation&&operation.target===selected&&operation.reason===normalizedReason
      ?operation
      :{id:crypto.randomUUID(),target:selected,reason:normalizedReason};
    setOperation(currentOperation);
    try{
      const next=await formal.rollbackVersion({
        targetFingerprint:selected,
        reason:normalizedReason,
        operationId:currentOperation.id,
      });
      setResult(next);
      await Promise.all([loadVersions(),read.refresh()]);
    }catch(err){setError(errorText(err));}
  };

  return <div className="v3-functional-page">
    <PageHeader eyebrow="發佈與版本" title="回復版本" description="Rollback 只會由 server 讀 immutable 歷史，再建立一個新正式版本；browser 唔會重砌舊 snapshot。"/>
    {error?<div className="v3-error">{error}</div>:null}
    {formal.draft?<section className="v3-functional-section"><header><div><h3>先處理未發佈草稿</h3><p>目前有 Formal Server Draft。Rollback 會令草稿 base 變 stale，所以正式 UI 先阻止操作，避免之後誤以為草稿仍可直接 Publish。</p></div><StatusBadge tone="warning">DRAFT BLOCKS ROLLBACK UI</StatusBadge></header></section>:null}

    <section className="v3-functional-section">
      <header><div><h3>揀歷史版本</h3><p>只列 server 證明存在、而且目前唔係 Active 嘅 archived version。</p></div><StatusBadge tone={archived.length?'neutral':'warning'}>{archived.length} 個可選</StatusBadge></header>
      {loading?<div className="v3-refreshing">正在讀取版本歷史…</div>:archived.length?<div className="v3-action-list">{archived.map(version=><article key={version.fingerprint}>
        <div><strong>R{version.revision}</strong><small>{hkt(version.publishedAt)} · {version.fingerprint}</small></div>
        <button type="button" className={selected===version.fingerprint?'v3-primary':''} onClick={()=>{setSelected(version.fingerprint);setOperation(null);setResult(null);}}>{selected===version.fingerprint?'已選擇':'選擇'}</button>
      </article>)}</div>:<div className="v3-product-empty"><h2>未有可 rollback 嘅歷史版本</h2><p>FORWARD_ONLY seam 唔會虛構 seam 上線前嘅舊 snapshot。</p></div>}
    </section>

    <section className="v3-functional-section">
      <header><div><h3>建立新版本</h3><p>會帶目前 Canonical fingerprint、publishedAt、revision 做 exact guard；任何 stale base 都 fail-closed。</p></div><StatusBadge tone="warning">高風險操作</StatusBadge></header>
      <label><span>原因 *</span><textarea rows={3} value={reason} maxLength={240} onChange={event=>{setReason(event.target.value);setOperation(null);setResult(null);}} placeholder="例：上一版本商品配置錯誤，需要回復到已確認版本"/></label>
      <div className="v3-mobile-form-note">目前正式版本：R{formal.canonical.revision} · {formal.canonical.fingerprint}</div>
      <button className="v3-primary" type="button" disabled={!selected||!reason.trim()||formal.isRollingBack||Boolean(formal.draft)} onClick={()=>void submit()}>{formal.isRollingBack?'建立新版本中…':'確認以歷史版本建立新正式版本'}</button>
    </section>

    {result?<section className="v3-functional-section">
      <header><div><h3>Server rollback result</h3><p>Server 已回覆 rollback operation；呢個結果只證明 Canonical publish path，唔等於 SMT 已 Applied。</p></div><StatusBadge tone="warning">等待 SMT Readback</StatusBadge></header>
      <pre className="v3-formal-result">{JSON.stringify(result,null,2)}</pre>
      <div className="v3-mobile-form-note">下一步由版本／回讀確認頁核對新 Canonical fingerprint + publishedAt 對應 SMT ACK；未有匹配 ACK 前唔會顯示「門店已套用」。</div>
    </section>:null}
  </div>;
}

// Backward-compatible export for older route imports while the formal page replaces the former gap surface.
export const FormalRollbackGapPage=FormalRollbackPage;
