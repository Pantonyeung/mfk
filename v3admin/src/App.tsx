import {useMemo,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AdminShell} from './admin-shell.tsx';
import {readV3BackendHealth,v3QueryKeys} from './api.ts';
import {loginV3Admin,logoutV3Admin,type V3AdminSession} from './auth.ts';
import {readV3CanonicalAdminActive,summarizeV3Canonical,v3AdminCanonicalQueryKey} from './canonical.ts';
import {
  readServingRelease,
  releaseVerificationMatches,
  V3_CLIENT_RELEASE,
  V3_RELEASE_REFETCH_INTERVAL_MS,
} from './release.ts';
import {scopeFromSession} from './scope.ts';
import {V3_ADMIN_STATE_AUTHORITY,useV3AdminUi} from './state-authority.ts';
import {V3FormalDraftProvider,useV3FormalDraft} from './formal-draft.tsx';
import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {V3ReadModelProvider} from './formal-read-model.tsx';

function hkTime(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}
function previewRequested(){
  const envPreview=(import.meta.env.VITE_MFK_V3_PREVIEW_MODE as string|undefined)==='1';
  if(envPreview)return true;
  if(typeof window==='undefined')return false;
  return new URLSearchParams(window.location.search).get('preview')==='ui-01';
}

function ReleaseStatus({match,pending,error,servingId}:{match:boolean|null;pending:boolean;error:boolean;servingId?:string}){
  return <section className="v3-release-strip" data-state={match===true?'ok':match===false?'danger':'pending'} aria-live="polite">
    <div><span>目前介面版本</span><strong>{V3_CLIENT_RELEASE.releaseId}</strong></div>
    <div><span>伺服器版本</span><strong>{pending?'正在確認…':error?'暫時無法確認':servingId}</strong></div>
    <div><span>狀態</span><strong>{match===true?'版本一致':match===false?'版本不一致 · 禁止正式寫入':'正在確認版本'}</strong></div>
    {match===false?<button type="button" onClick={()=>window.location.reload()}>載入最新版本</button>:null}
  </section>;
}

function PreviewReleaseStatus(){
  return <section className="v3-preview-release" role="status">
    <div><span>預覽 Slice</span><strong>UI-01｜產品管理 Default List</strong></div>
    <div><span>資料模式</span><strong>介面示例 · 非 Canonical</strong></div>
    <div><span>Production</span><strong>v2 完全不受影響</strong></div>
  </section>;
}

function Diagnostics({backendSha,summary}:{backendSha?:string;summary:ReturnType<typeof summarizeV3Canonical>|null}){
  return <section className="v3-diagnostics">
    <h2>系統資訊</h2>
    <dl>
      <div><dt>Client Source</dt><dd>{V3_CLIENT_RELEASE.sourceSha}</dd></div>
      <div><dt>Client Build</dt><dd>{V3_CLIENT_RELEASE.buildTime}</dd></div>
      <div><dt>Backend</dt><dd>{backendSha??'—'}</dd></div>
      <div><dt>Server State</dt><dd>{V3_ADMIN_STATE_AUTHORITY.server}</dd></div>
      <div><dt>正式 Outbox</dt><dd>{V3_ADMIN_STATE_AUTHORITY.outbox}</dd></div>
      <div><dt>V2 LocalStorage</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.v2LocalStorageRead)}</dd></div>
      {summary?<><div><dt>正式發佈時間</dt><dd>{hkTime(summary.publishedAt)}</dd></div><div><dt>Canonical Fingerprint</dt><dd>{summary.fingerprint}</dd></div><div><dt>診斷 Revision</dt><dd>{summary.revision}</dd></div></>:null}
    </dl>
  </section>;
}

function AuthenticatedAdminShell({
  storeId,
  session,
  canonical,
  canonicalState,
  releaseStatus,
  backendSha,
  diagnosticsOpen,
  onRefresh,
  onDiagnostics,
  onSignOut,
}:{
  storeId:string;
  session:V3AdminSession;
  canonical:MfkAdminConfigEnvelope;
  canonicalState:'pending'|'error'|'fresh'|'refreshing'|'stale';
  releaseStatus:ReactNode;
  backendSha?:string;
  diagnosticsOpen:boolean;
  onRefresh:()=>void;
  onDiagnostics:()=>void;
  onSignOut:()=>void;
}){
  const formalDraft=useV3FormalDraft();
  return <AdminShell
    storeId={storeId}
    displayName={session.displayName}
    releaseStatus={releaseStatus}
    canonicalState={canonicalState}
    canonicalSnapshot={formalDraft.workingSnapshot}
    formalDraftEnabled
    onRefresh={onRefresh}
    onDiagnostics={onDiagnostics}
    onSignOut={onSignOut}
  >
    {diagnosticsOpen?<Diagnostics backendSha={backendSha} summary={summarizeV3Canonical(canonical)}/>:null}
  </AdminShell>;
}

export function V3AdminApp(){
  const queryClient=useQueryClient();
  const {diagnosticsOpen,setDiagnosticsOpen}=useV3AdminUi();
  const [session,setSession]=useState<V3AdminSession|null>(null);
  const [loginId,setLoginId]=useState('');
  const [pin,setPin]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');
  const uiPreview=previewRequested();

  const health=useQuery({queryKey:v3QueryKeys.health,queryFn:readV3BackendHealth,enabled:!uiPreview});
  const servingRelease=useQuery({
    queryKey:['mfk','admin-v3','client-release','serving'],queryFn:readServingRelease,staleTime:0,
    refetchInterval:V3_RELEASE_REFETCH_INTERVAL_MS,refetchOnMount:'always',refetchOnWindowFocus:true,refetchOnReconnect:true,retry:1,
    enabled:!uiPreview,
  });
  const scope=useMemo(()=>session?scopeFromSession(session):null,[session]);
  const canonical=useQuery({
    queryKey:scope?v3AdminCanonicalQueryKey(scope.storeId):['mfk','admin-v3','canonical','disabled'],
    queryFn:()=>readV3CanonicalAdminActive({storeId:scope?.storeId??'',sessionToken:session?.sessionToken??''}),
    enabled:Boolean(!uiPreview&&session&&scope),staleTime:0,gcTime:0,
  });

  const releaseMatch=uiPreview?true:releaseVerificationMatches(V3_CLIENT_RELEASE,servingRelease.data,servingRelease.isSuccess&&!servingRelease.isFetching&&!servingRelease.isRefetchError&&!servingRelease.isPaused);
  const summary=canonical.data?summarizeV3Canonical(canonical.data):null;
  const releaseStatus=<ReleaseStatus match={releaseMatch} pending={servingRelease.isPending} error={servingRelease.isError} servingId={servingRelease.data?.releaseId}/>;

  const signIn=async()=>{
    if(authBusy)return;
    setAuthBusy(true);setAuthError('');
    try{const next=await loginV3Admin(loginId,pin);setSession(next);setPin('');}
    catch(error){setAuthError(error instanceof Error?error.message:'登入失敗');}
    finally{setAuthBusy(false);}
  };
  const signOut=async()=>{
    const token=session?.sessionToken??'';
    setSession(null);setPin('');setAuthError('');
    queryClient.removeQueries({queryKey:['mfk','admin-v3'],exact:false});
    await logoutV3Admin(token);
  };

  if(uiPreview)return <AdminShell
    storeId="PREVIEW"
    displayName="介面驗收"
    releaseStatus={<PreviewReleaseStatus/>}
    canonicalState="fresh"
    previewMode
    initialPath="/admin/catalog/products"
    onRefresh={()=>{}}
    onDiagnostics={()=>{}}
    onSignOut={()=>{}}
  />;

  if(!session)return <main className="v3-auth-shell">
    <header className="v3-auth-head"><div><small>V3 預覽 · 未連接正式站點</small><h1>MFK Admin V3</h1><p>先確認版本，再讀正式雲端資料。瀏覽器唔會保存正式伺服器資料作為真相。</p></div><button type="button" onClick={()=>setDiagnosticsOpen(!diagnosticsOpen)}>{diagnosticsOpen?'收起系統資訊':'系統資訊'}</button></header>
    {releaseStatus}
    <section className="v3-login-card" aria-label="Admin 登入">
      <div><small>正式登入</small><h2>登入 Admin</h2><p>登入資料只保留喺目前記憶體；登出會清除已認證查詢資料。</p></div>
      <form onSubmit={event=>{event.preventDefault();void signIn();}}>
        <label><span>登入編號</span><input autoComplete="username" value={loginId} onChange={event=>setLoginId(event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64))}/></label>
        <label><span>PIN</span><input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))}/></label>
        {authError?<div className="v3-error" role="alert">{authError}</div>:null}
        <button className="v3-primary" type="submit" disabled={authBusy||!loginId||pin.length<4}>{authBusy?'正在登入…':'登入'}</button>
      </form>
    </section>
    {diagnosticsOpen?<Diagnostics backendSha={health.data?.sourceSha} summary={null}/>:null}
  </main>;

  const canonicalState=canonical.data?(canonical.isRefetchError?'stale':canonical.isFetching?'refreshing':'fresh'):canonical.isError?'error':'pending';
  const shellReleaseStatus=<>{releaseStatus}{releaseMatch!==true?<div className="v3-warning v3-release-warning" role="alert">目前 Client Release 未確認一致。正式寫入功能保持鎖定。</div>:null}</>;
  if(!scope||!canonical.data){
    return <AdminShell
      storeId={scope?.storeId??''}
      displayName={session.displayName}
      releaseStatus={shellReleaseStatus}
      canonicalState={canonicalState}
      canonicalSnapshot={canonical.data?.snapshot}
      onRefresh={()=>void canonical.refetch()}
      onDiagnostics={()=>setDiagnosticsOpen(!diagnosticsOpen)}
      onSignOut={()=>void signOut()}
    >
      {diagnosticsOpen?<Diagnostics backendSha={health.data?.sourceSha} summary={summary}/>:null}
    </AdminShell>;
  }
  return <V3FormalDraftProvider
    storeId={scope.storeId}
    sessionToken={session.sessionToken}
    canonical={canonical.data}
  >
    <V3ReadModelProvider storeId={scope.storeId} sessionToken={session.sessionToken}>
      <AuthenticatedAdminShell
        storeId={scope.storeId}
        session={session}
        canonical={canonical.data}
        canonicalState={canonicalState}
        releaseStatus={shellReleaseStatus}
        backendSha={health.data?.sourceSha}
        diagnosticsOpen={diagnosticsOpen}
        onRefresh={()=>void canonical.refetch()}
        onDiagnostics={()=>setDiagnosticsOpen(!diagnosticsOpen)}
        onSignOut={()=>void signOut()}
      />
    </V3ReadModelProvider>
  </V3FormalDraftProvider>;
}
