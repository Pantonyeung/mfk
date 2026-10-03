import {useState} from 'react';
import {PageHeader,ReadbackPanel,StatusBadge,Timeline} from './ui.tsx';
import {usePreviewCatalog} from './preview-catalog-store.ts';
import {usePreviewAdmin,type PreviewCapacityPool} from './preview-admin-store.ts';

function PreviewNotice(){
  return <div className="v3-preview-banner"><strong>功能 Preview</strong><span>只驗收流程同操作手感；唔會執行 Production mutation。</span></div>;
}
function money(minor:number){return 'HK$'+(minor/100).toFixed(2);}

function CapacityEditor({pool,onClose}:{pool:PreviewCapacityPool;onClose:()=>void}){
  const products=usePreviewCatalog(state=>state.products);
  const update=usePreviewAdmin(state=>state.updateCapacityPool);
  const remove=usePreviewAdmin(state=>state.removeCapacityPool);
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet"><header><div><small>產能／原料額度</small><h2>{pool.name}</h2></div><button onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <div className="v3-functional-grid">
            <label><span>Pool 名稱</span><input value={pool.name} onChange={event=>update(pool.id,{name:event.target.value})}/></label>
            <label><span>初始數量</span><input type="number" min={0} value={pool.initialQty} onChange={event=>update(pool.id,{initialQty:Number(event.target.value)||0})}/></label>
            <label><span>目前剩餘</span><input type="number" min={0} value={pool.remainingQty} onChange={event=>update(pool.id,{remainingQty:Number(event.target.value)||0})}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={pool.active} onChange={event=>update(pool.id,{active:event.target.checked})}/><span>{pool.active?'啟用 Pool':'停用 Pool'}</span></label>
        </section>
        <section className="v3-functional-section"><h3>綁定商品</h3><div className="v3-option-link-grid">{products.map(product=><label key={product.id}><input type="checkbox" checked={pool.productIds.includes(product.id)} onChange={event=>{const ids=new Set(pool.productIds);if(event.target.checked)ids.add(product.id);else ids.delete(product.id);update(pool.id,{productIds:[...ids]});}}/><span><strong>{product.name}</strong><small>{product.code}</small></span></label>)}</div></section>
        <section className="v3-functional-danger"><div><strong>刪除 Pool</strong></div><button onClick={()=>{remove(pool.id);onClose();}}>刪除</button></section>
      </div>
    </section>
  </div>;
}

export function BusinessDayPage(){
  const open=usePreviewAdmin(state=>state.businessDayOpen);
  const setOpen=usePreviewAdmin(state=>state.setBusinessDayOpen);
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="營運管理" title="營業日" description="Preview 可以完整走開始營業／準備收舖狀態，但唔會觸發正式門店 runtime。" aside={<button className="v3-primary" onClick={()=>setOpen(!open)}>{open?'準備收舖':'開始今日營業'}</button>}/>
    <section className="v3-whole-kpi-grid">
      <article><span>目前營業日</span><strong>2026-10-01</strong><small>分界 05:00</small><StatusBadge tone={open?'good':'neutral'}>{open?'營業中':'已收舖'}</StatusBadge></article>
      <article><span>開始時間</span><strong>{open?'05:00':'—'}</strong><small>Asia/Hong_Kong</small></article>
      <article><span>進行中訂單</span><strong>12</strong><small>只讀 Preview</small></article>
      <article><span>收舖準備</span><strong>{open?'未開始':'完成'}</strong><small>現金／打印／渠道獨立核對</small></article>
    </section>
  </div>;
}

export function CashClosePage(){
  const expected=usePreviewAdmin(state=>state.cashExpectedMinor);
  const counted=usePreviewAdmin(state=>state.cashCountedMinor);
  const note=usePreviewAdmin(state=>state.cashNote);
  const update=usePreviewAdmin(state=>state.updateCash);
  const variance=counted===null?null:counted-expected;
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="營運管理" title="現金／收舖" description="Preview 實際計算點算差額同備註；唔會關閉正式營業日。" />
    <section className="v3-functional-section">
      <div className="v3-whole-kpi-grid">
        <article><span>系統預計現金</span><strong>{money(expected)}</strong><small>Preview projection</small></article>
        <article><span>實際點算</span><strong>{counted===null?'未點算':money(counted)}</strong><small>由下方輸入</small></article>
        <article><span>差額</span><strong>{variance===null?'—':money(variance)}</strong><small>{variance===0?'一致':variance===null?'未有結果':'需要核對'}</small></article>
      </div>
      <label><span>實際點算 HK$</span><input inputMode="decimal" value={counted===null?'':String(counted/100)} onChange={event=>update({countedMinor:event.target.value===''?null:Math.round((Number(event.target.value)||0)*100)})}/></label>
      <label><span>交更／差額備註</span><textarea rows={4} value={note} onChange={event=>update({note:event.target.value})}/></label>
    </section>
  </div>;
}

export function CapacityPage(){
  const pools=usePreviewAdmin(state=>state.capacityPools);
  const add=usePreviewAdmin(state=>state.addCapacityPool);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?pools.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="營運管理" title="產能／原料額度" description="建立 Pool、數量同商品關係；Preview 唔會自動停售 Production 商品。" aside={<button className="v3-primary" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增額度</button>}/>
    <div className="v3-functional-card-grid">{pools.map(pool=><button type="button" key={pool.id} onClick={()=>setSelected(pool.id)}><div><strong>{pool.name}</strong><small>{pool.productIds.length} 件商品</small></div><b>{pool.remainingQty}/{pool.initialQty}</b><span>剩餘</span><StatusBadge tone={pool.active?'good':'neutral'}>{pool.active?'啟用':'停用'}</StatusBadge></button>)}</div>
    {row?<CapacityEditor pool={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function DevicesPage(){
  const devices=usePreviewAdmin(state=>state.devices);
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="裝置管理" title="裝置狀態" description="裝置資料保持 read-mostly；Preview 只展示可操作診斷入口。" />
    <div className="v3-functional-card-grid">{devices.map(device=><article className="v3-functional-card-static" key={device.id}><div><strong>{device.name}</strong><small>{device.id} · {device.kind}</small></div><b>{device.version}</b><StatusBadge tone={device.state==='可用'?'good':device.state==='資料過期'?'unknown':'warning'}>{device.state}</StatusBadge><small>{device.lastSeen}</small></article>)}</div>
  </div>;
}

export function OtaPage(){
  const releases=usePreviewAdmin(state=>state.otaReleases);
  const update=usePreviewAdmin(state=>state.updateOtaRelease);
  const [selected,setSelected]=useState<string|null>(null);
  const release=selected?releases.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="裝置管理" title="OTA／版本" description="只容許已批准 artifact 進安裝流程；Preview 唔會向真機 OTA。" />
    <div className="v3-functional-card-grid">{releases.map(item=><button type="button" key={item.id} onClick={()=>setSelected(item.id)}><div><strong>{item.version}</strong><small>{item.label}</small></div><b>{item.approved?'已批准':'未批准'}</b><StatusBadge tone={item.state==='已安裝'?'good':'warning'}>{item.state}</StatusBadge></button>)}</div>
    {release?<div className="v3-functional-editor"><button className="v3-functional-backdrop" onClick={()=>setSelected(null)}/><section className="v3-functional-sheet"><header><div><small>OTA／版本</small><h2>{release.version}</h2></div><button onClick={()=>setSelected(null)}>關閉</button></header><div className="v3-functional-body"><section className="v3-functional-section"><p>{release.label}</p><StatusBadge tone={release.approved?'good':'warning'}>{release.approved?'已批准':'未批准'}</StatusBadge><button className="v3-primary" disabled={!release.approved||release.state==='已安裝'} onClick={()=>update(release.id,{state:'已安裝'})}>Preview 安裝已批准版本</button></section></div></section></div>:null}
  </div>;
}

export function AccessPage(){
  const sessions=usePreviewAdmin(state=>state.sessions);
  const trusted=usePreviewAdmin(state=>state.trustedDevices);
  const revoke=usePreviewAdmin(state=>state.revokeSession);
  const setTrusted=usePreviewAdmin(state=>state.setTrustedDevice);
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="人員與權限" title="登入／工作階段／受信任裝置" description="Preview 實際支援撤銷工作階段同取消信任裝置；正式 server authz 未由 Preview 執行。" />
    <section className="v3-functional-section"><h3>登入工作階段</h3><div className="v3-action-list">{sessions.map(session=><article key={session.id}><div><strong>{session.staffName}</strong><small>{session.device} · {session.lastSeen}</small></div><StatusBadge tone={session.active?'good':'neutral'}>{session.active?'有效':'已撤銷'}</StatusBadge><button disabled={!session.active} onClick={()=>revoke(session.id)}>撤銷登入工作階段</button></article>)}</div></section>
    <section className="v3-functional-section"><h3>受信任裝置</h3><div className="v3-action-list">{trusted.map(device=><article key={device.id}><div><strong>{device.name}</strong><small>{device.lastSeen}</small></div><StatusBadge tone={device.trusted?'good':'neutral'}>{device.trusted?'受信任':'未信任'}</StatusBadge><button onClick={()=>setTrusted(device.id,!device.trusted)}>{device.trusted?'取消信任':'設為受信任'}</button></article>)}</div></section>
  </div>;
}

const PUBLISH_STEPS=['DRAFT','VALIDATED','IMPACT','PUBLISHED','READBACK'] as const;
const PUBLISH_LABELS:Record<(typeof PUBLISH_STEPS)[number],string>={
  DRAFT:'草稿',
  VALIDATED:'完整性已檢查',
  IMPACT:'影響已確認',
  PUBLISHED:'雲端已發佈',
  READBACK:'回讀確認完成',
};

export function PublishFlowPage({mode}:{mode:'pending'|'publish'|'versions'|'rollback'}){
  const changes=usePreviewAdmin(state=>state.draftChanges);
  const stage=usePreviewAdmin(state=>state.previewPublishStage);
  const discard=usePreviewAdmin(state=>state.discardDraftChange);
  const advance=usePreviewAdmin(state=>state.advancePreviewPublish);

  if(mode==='versions')return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="發佈與版本" title="版本／回讀確認" description="Published 同 Applied 分開顯示。" /><ReadbackPanel publishedAt="2026-10-01 09:42:18" cloud="雲端已發佈 · R128" target="目標已套用 · R128"/><Timeline items={[{title:'R128 回讀一致',time:'09:42',description:'SMT-01 observed R128'},{title:'R128 雲端已發佈',time:'09:42',description:'Cloud canonical'},{title:'R127',time:'昨日',description:'上一正式版本'}]}/></div>;
  if(mode==='rollback')return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="發佈與版本" title="回復版本" description="Rollback 永遠建立新版本；Preview 唔會改 Production。" /><div className="v3-functional-card-grid">{['R127','R126','R125'].map((version,index)=><article className="v3-functional-card-static" key={version}><div><strong>{version}</strong><small>{index===0?'昨日 18:10':'歷史版本'}</small></div><b>{index===0?'目前上一版':'可回復'}</b><button>查看影響</button></article>)}</div></div>;

  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="發佈與版本" title={mode==='pending'?'未發佈變更':'發佈中心'} description="Preview 實際走 Draft → Validate → Impact → Publish → Readback，但唔會寫 Production。" aside={mode==='publish'?<button className="v3-primary" disabled={stage==='READBACK'||changes.length===0} onClick={advance}>{stage==='DRAFT'?'檢查完整性':stage==='VALIDATED'?'查看影響':stage==='IMPACT'?'確認發佈':stage==='PUBLISHED'?'重新確認狀態':'已完成'}</button>:undefined}/>
    {mode==='publish'?<div className="v3-publish-stepper">{PUBLISH_STEPS.map(step=><div key={step} data-active={step===stage?'true':'false'}><span>{PUBLISH_STEPS.indexOf(step)+1}</span><strong>{PUBLISH_LABELS[step]}</strong></div>)}</div>:null}
    <div className="v3-action-list">{changes.map(change=><article key={change.id}><div><strong>{change.object}</strong><small>{change.domain} · {change.changeType}</small></div><StatusBadge tone={change.valid?'good':'danger'}>{change.valid?'完整':'需要修正'}</StatusBadge>{mode==='pending'?<button onClick={()=>discard(change.id)}>放棄此變更</button>:null}</article>)}</div>
    {changes.length===0?<div className="v3-product-empty"><h2>目前未有未發佈變更</h2></div>:null}
  </div>;
}
