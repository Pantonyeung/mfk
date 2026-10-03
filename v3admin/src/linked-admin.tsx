import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AdminShell} from './admin-shell.tsx';
import {V3FormalDraftProvider,useV3FormalDraft,v3FormalDraftQueryKey} from './formal-draft.tsx';
import {V3ReadModelProvider} from './formal-read-model.tsx';
import {readV3CanonicalAdminActive,v3AdminCanonicalQueryKey} from './canonical.ts';
import type {V3AdminSession} from './auth.ts';
import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {V3_CLIENT_RELEASE} from './release.ts';
import {linkedRequest,subscribeLinked,type LinkedInboxRow} from '../../integrations/v3-linked-client.ts';
let sessionRequest:Promise<V3AdminSession>|null=null;
function session(){return sessionRequest??=(linkedRequest<V3AdminSession>('/session','POST',{}).catch(e=>{sessionRequest=null;throw e;}));}
function RequestInbox(){
  const client=useQueryClient();const query=useQuery({queryKey:['v3-linked','requests'],queryFn:()=>linkedRequest<{requests:LinkedInboxRow[]}>('/requests'),refetchOnWindowFocus:true,retry:1});
  useEffect(()=>subscribeLinked('request',()=>{void client.invalidateQueries({queryKey:['v3-linked','requests']});}),[client]);
  return <details className="v3-functional-section" open><summary><strong>客戶待處理單 · {query.data?.requests.length??0}</strong>（要求記錄，未計作成交）</summary>{query.error?<p role="alert">{query.error.message}</p>:null}<button type="button" onClick={()=>void query.refetch()}>重新讀取待處理單</button>
    {query.data?.requests.map(r=><article key={r.submissionId} style={{padding:'12px 0',borderBottom:'1px solid #ddd'}}><strong>{r.cart.map(l=>l.productName+' × '+l.quantity).join('、')}</strong><p>{r.checkout.name} · {r.checkout.phone} · {r.state==='REJECTED'?'已拒絕':r.reviewState==='SEEN'?'POS 已查看':'待 POS 查看'}</p><small>{r.message}</small></article>)}
  </details>;
}
function Workspace({session,canonical,onRefresh}:{session:V3AdminSession;canonical:MfkAdminConfigEnvelope;onRefresh:()=>void}){
  const draft=useV3FormalDraft();
  return <AdminShell storeId="MF01 · 共用測試資料" displayName="免登入連線測試" releaseStatus={<section className="v3-preview-release"><strong>商品設定及客戶待處理單已接駁</strong><p>修改後先儲存草稿，再到「發佈中心」發佈，客戶端同 POS 先會更新。原有員工身份及平台憑證唔喺呢個工作區。收款及實體打印仍未接通。</p><small>{V3_CLIENT_RELEASE.releaseId} · 已發佈 {canonical.publishedAt}</small><RequestInbox/></section>} canonicalState="fresh" canonicalSnapshot={draft.workingSnapshot} formalDraftEnabled initialPath="/admin/catalog/products" onRefresh={onRefresh} onDiagnostics={onRefresh} onSignOut={()=>window.location.reload()}/>;
}
export function LinkedAdminApp(){
  const client=useQueryClient();const [auth,setAuth]=useState<V3AdminSession|null>(null);const [error,setError]=useState('');const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;void session().then(s=>{if(mounted.current)setAuth(s);}).catch(e=>{if(mounted.current)setError(e.message);});return()=>{mounted.current=false;};},[]);
  const canonical=useQuery({queryKey:v3AdminCanonicalQueryKey('MF01'),queryFn:()=>readV3CanonicalAdminActive({storeId:'MF01',sessionToken:auth!.sessionToken}),enabled:Boolean(auth),staleTime:0,refetchOnWindowFocus:true,retry:1});
  useEffect(()=>subscribeLinked('catalog',()=>{void client.invalidateQueries({queryKey:v3AdminCanonicalQueryKey('MF01')});void client.invalidateQueries({queryKey:v3FormalDraftQueryKey('MF01')});}),[client]);
  if(error||canonical.error)return <main className="v3-auth-shell"><h1>共用測試資料未能載入</h1><p role="alert">{error||canonical.error?.message}</p><button onClick={()=>window.location.reload()}>重新連線</button></main>;
  if(!auth||!canonical.data)return <main className="v3-auth-shell"><h1>正在連接共用測試資料…</h1></main>;
  return <V3FormalDraftProvider storeId="MF01" sessionToken={auth.sessionToken} canonical={canonical.data}><V3ReadModelProvider storeId="MF01" sessionToken={auth.sessionToken}><Workspace session={auth} canonical={canonical.data} onRefresh={()=>void canonical.refetch()}/></V3ReadModelProvider></V3FormalDraftProvider>;
}
