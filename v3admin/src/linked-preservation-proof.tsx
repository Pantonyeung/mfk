import {useEffect,useRef,useState} from 'react';
import {linkedRequest} from '../../integrations/v3-linked-client.ts';
type Metadata={fingerprint:string;revision:number;publishedAt:string;observedAt:string};
type Counts={requestRecords:number;unseenPending:number;seenPending:number;rejected:number;other:number;adminOrderProjectionRecords:number};
type Proof={state:'MATCH'|'CHANGED'|'UNAVAILABLE';observedAt:string;original:Metadata|null;bootstrap:{fingerprint:string;publishedAt:string;revision:null}|null;linked:Metadata|null;isolatedCounts:Counts|null};
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('PROOF_INVALID');return value as Record<string,any>;};
const instant=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const fingerprint=(value:unknown)=>typeof value==='string'&&/^fnv1a32:[0-9a-f]{8}$/.test(value);
function metadata(value:unknown):Metadata|null{if(value===null)return null;const row=object(value);if(row.storeId!=='MF01'||!fingerprint(row.fingerprint)||!Number.isSafeInteger(row.revision)||row.revision<1||!instant(row.publishedAt)||!instant(row.observedAt))throw Error('PROOF_METADATA_INVALID');return {fingerprint:row.fingerprint,revision:row.revision,publishedAt:row.publishedAt,observedAt:row.observedAt};}
function parse(value:unknown):Proof{
 const response=object(value);for(const key of ['formalCheckoutConnected','physicalPrintConnected','formalOrderCreated','paymentConfirmed'])if(Object.hasOwn(response,key)&&response[key]!==false)throw Error('PROOF_FORMAL_CLAIM_INVALID');
 const row=object(response.preservationProof);if(row.scope!=='MFP_V3_LINKED_TEST_MF01_20261003'||row.evidenceKind!=='CANONICAL_IDENTITY_COMPARISON'||row.fingerprintAlgorithm!=='fnv1a32'||!['MATCH','CHANGED','UNAVAILABLE'].includes(row.state)||!instant(row.observedAt))throw Error('PROOF_INVALID');
 const original=metadata(row.original),linked=metadata(row.linked);let bootstrap:Proof['bootstrap']=null,isolatedCounts:Counts|null=null;
 if(row.bootstrap!==null){const old=object(row.bootstrap);if(!fingerprint(old.fingerprint)||!instant(old.publishedAt)||old.revision!==null)throw Error('PROOF_BASELINE_INVALID');bootstrap={fingerprint:old.fingerprint,publishedAt:old.publishedAt,revision:null};}
 if(row.isolatedCounts!==null){const raw=object(row.isolatedCounts),keys=['requestRecords','unseenPending','seenPending','rejected','other','adminOrderProjectionRecords'] as const;for(const key of keys)if(!Number.isSafeInteger(raw[key])||raw[key]<0)throw Error('PROOF_COUNTS_INVALID');if(raw.unseenPending+raw.seenPending+raw.rejected+raw.other!==raw.requestRecords)throw Error('PROOF_COUNTS_INVALID');isolatedCounts=Object.fromEntries(keys.map(key=>[key,raw[key]])) as Counts;}
 const matches=Boolean(original&&bootstrap&&original.fingerprint===bootstrap.fingerprint&&original.publishedAt===bootstrap.publishedAt);
 if(row.state!=='UNAVAILABLE'&&(!original||!bootstrap||!linked||!isolatedCounts||(row.state==='MATCH')!==matches))throw Error('PROOF_COMPARISON_INVALID');
 return {state:row.state,observedAt:row.observedAt,original,bootstrap,linked,isolatedCounts};
}
const readHealth=()=>linkedRequest<unknown>('/api/health');
/** Explicit evidence reads only. No mount/focus/doorbell/polling fetches or writes. */
export function LinkedPreservationDisclosure({read=readHealth}:{read?:()=>Promise<unknown>}){
 const [proof,setProof]=useState<Proof|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),ticket=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;ticket.current++;};},[]);
 async function refresh(){const current=++ticket.current;setBusy(true);setFailed(false);setProof(null);try{const next=parse(await read());if(mounted.current&&current===ticket.current)setProof(next);}catch{if(mounted.current&&current===ticket.current)setFailed(true);}finally{if(mounted.current&&current===ticket.current)setBusy(false);}}
 return <details className="v3-functional-section"><summary><strong>驗收資料</strong> · 原始設定及隔離測試讀回</summary>
  <p>只比較原始 MF01 已發佈設定身份。fnv1a32 並非加密雜湊；這不是全庫或實體交易審計。按下按鈕才讀取，不會儲存、發佈或初始化資料。</p>
  <button type="button" disabled={busy} onClick={refresh}>{busy?'讀取中…':'重新讀取驗收資料'}</button>
  {failed?<p role="alert">UNAVAILABLE · 未能取得可靠驗收資料；上一個結論已清除。</p>:!proof?<p>{busy?'正在讀取…':'尚未讀取；未有原始資料保全結論。'}</p>:<section aria-label="唯讀驗收證據">
   <p><strong>原始 MF01 身份比較：{proof.state}</strong> · 讀取時間 {proof.observedAt}</p>
   {proof.original?<p>原始 MF01 現值：{proof.original.fingerprint} · revision {proof.original.revision} · publishedAt {proof.original.publishedAt} · observedAt {proof.original.observedAt}</p>:<p>原始 MF01 現值：UNAVAILABLE</p>}
   {proof.bootstrap?<p>初始化時原始身份：{proof.bootstrap.fingerprint} · revision 未記錄 · publishedAt {proof.bootstrap.publishedAt}</p>:<p>初始化時原始身份：UNAVAILABLE</p>}
   {proof.linked?<p>現行隔離目錄：{proof.linked.fingerprint} · revision {proof.linked.revision} · publishedAt {proof.linked.publishedAt}</p>:<p>現行隔離目錄：UNAVAILABLE</p>}
   {proof.isolatedCounts?<p>隔離測試要求記錄：{proof.isolatedCounts.requestRecords} · 未查看待處理 {proof.isolatedCounts.unseenPending} · 已查看待處理 {proof.isolatedCounts.seenPending} · 已拒絕 {proof.isolatedCounts.rejected} · 其他狀態 {proof.isolatedCounts.other}。隔離 Admin 訂單投影記錄：{proof.isolatedCounts.adminOrderProjectionRecords}。</p>:<p>隔離記錄數目：UNAVAILABLE</p>}
  </section>}
  <p>正式成交／付款／結帳／實體打印：NOT CONNECTED。以上記錄數只屬隔離測試範圍，不是全域／原生正式交易數。</p>
 </details>;
}
