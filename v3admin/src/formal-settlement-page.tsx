import {useV3ReadModels} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function money(value:number|undefined,currency='HKD'){
  if(value===undefined)return '—';
  const symbol=currency==='HKD'?'HK$':currency+' ';
  return symbol+(Number(value||0)/100).toFixed(2);
}
function hkt(value:string|null|undefined){
  if(!value)return '—';
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}

export function FormalSettlementPage(){
  const read=useV3ReadModels();
  const rows=read.keetaCommercial;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="平台／渠道管理" title="平台對帳" description="直接讀 Keeta Provider commercial evidence；Provider 數字唔會改寫 MFK Order / Sales authority。" aside={<button type="button" disabled={read.keetaRefreshing} onClick={()=>void read.refresh()}>{read.keetaRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.keetaError?<div className="v3-error">{read.keetaError.message}</div>:null}
    {read.keetaPending?<div className="v3-refreshing">正在讀取 Keeta commercial evidence…</div>:null}
    {!read.keetaPending&&!rows.length?<section className="v3-product-empty"><h2>目前未有 Keeta commercial evidence</h2><p>收到並連結 Provider 訂單後先會出現。</p></section>:<div className="v3-price-edit-list">{rows.map(row=>{
      const snapshot=row.snapshot;
      return <article key={row.providerOrderId}>
        <div><strong>{row.canonicalDisplay??row.canonicalOrderId??'未連結'} · Keeta {row.providerOrderCode||row.providerOrderId}</strong><small>{snapshot.settlementAuthority} · 捕捉 {hkt(snapshot.capturedAt)}{row.providerConfirmedAt?' · Provider confirmed '+hkt(row.providerConfirmedAt):''}</small></div>
        <strong>{money(snapshot.merchantEarningsMinor,snapshot.currency)}</strong>
        <StatusBadge tone={row.state==='PROVIDER_CONFIRMED'?'good':'warning'}>{row.state==='PROVIDER_CONFIRMED'?'Provider 已確認':'Webhook Evidence'}</StatusBadge>
      </article>;
    })}</div>}
    {rows.length?<section className="v3-functional-section">
      <h3>Evidence 明細</h3>
      <div className="v3-action-list">{rows.slice(0,20).map(row=><article key={'detail-'+row.providerOrderId}><div><strong>{row.providerOrderCode||row.providerOrderId}</strong><small>{row.snapshot.providerEvidenceRef}</small></div><span>商品 {money(row.snapshot.merchandiseSubtotalMinor,row.snapshot.currency)} · 佣金 {money(row.snapshot.merchantCommissionMinor,row.snapshot.currency)} · 活動費 {money(row.snapshot.merchantActivityFeeMinor,row.snapshot.currency)}</span><StatusBadge tone="neutral">只讀</StatusBadge></article>)}</div>
    </section>:null}
  </div>;
}
