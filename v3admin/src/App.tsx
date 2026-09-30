import {useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readV3BackendHealth,v3QueryKeys} from './api.ts';
import {loginV3Admin,logoutV3Admin,type V3AdminSession} from './auth.ts';
import {readV3CanonicalAdminActive,summarizeV3Canonical,v3AdminCanonicalQueryKey} from './canonical.ts';
import {readServingRelease,releaseIdentityMatches,V3_CLIENT_RELEASE} from './release.ts';
import {scopeFromSession} from './scope.ts';
import {V3_ADMIN_STATE_AUTHORITY,useV3AdminUi} from './state-authority.ts';

function hkTime(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)
    ?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false})
    :value;
}

export function V3AdminApp(){
  const queryClient=useQueryClient();
  const {diagnosticsOpen,setDiagnosticsOpen}=useV3AdminUi();
  const [session,setSession]=useState<V3AdminSession|null>(null);
  const [loginId,setLoginId]=useState('');
  const [pin,setPin]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');

  const health=useQuery({
    queryKey:v3QueryKeys.health,
    queryFn:readV3BackendHealth,
  });

  const servingRelease=useQuery({
    queryKey:['mfk','admin-v3','client-release','serving'],
    queryFn:readServingRelease,
    staleTime:0,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
    retry:1,
  });

  const scope=useMemo(()=>session?scopeFromSession(session):null,[session]);
  const canonical=useQuery({
    queryKey:scope?v3AdminCanonicalQueryKey(scope.storeId):['mfk','admin-v3','canonical','disabled'],
    queryFn:()=>readV3CanonicalAdminActive({storeId:scope?.storeId??'',sessionToken:session?.sessionToken??''}),
    enabled:Boolean(session&&scope),
    staleTime:0,
    gcTime:0,
  });

  const releaseMatch=servingRelease.data?releaseIdentityMatches(V3_CLIENT_RELEASE,servingRelease.data):null;
  const writeBlocked=releaseMatch!==true;
  const summary=canonical.data?summarizeV3Canonical(canonical.data):null;

  const signIn=async()=>{
    if(authBusy)return;
    setAuthBusy(true);
    setAuthError('');
    try{
      const next=await loginV3Admin(loginId,pin);
      setSession(next);
      setPin('');
    }catch(error){
      setAuthError(error instanceof Error?error.message:'登入失敗');
    }finally{
      setAuthBusy(false);
    }
  };

  const signOut=async()=>{
    const token=session?.sessionToken??'';
    setSession(null);
    setPin('');
    setAuthError('');
    queryClient.removeQueries({queryKey:['mfk','admin-v3'],exact:false});
    await logoutV3Admin(token);
  };

  return <main className="v3-shell">
    <header className="v3-head">
      <div>
        <small>V3 PREVIEW · ZERO PRODUCTION ROUTING</small>
        <h1>MFK Admin V3</h1>
        <p>先確認版本，再讀正式雲端資料。瀏覽器唔保存正式 Server Truth。</p>
      </div>
      <div className="v3-head-actions">
        <button type="button" onClick={()=>setDiagnosticsOpen(!diagnosticsOpen)}>
          {diagnosticsOpen?'收起系統資訊':'系統資訊'}
        </button>
        {session?<button type="button" onClick={()=>void signOut()}>登出</button>:null}
      </div>
    </header>

    <section className="v3-release-strip" data-state={releaseMatch===true?'ok':releaseMatch===false?'danger':'pending'} aria-live="polite">
      <div>
        <span>目前介面版本</span>
        <strong>{V3_CLIENT_RELEASE.releaseId}</strong>
      </div>
      <div>
        <span>伺服器版本</span>
        <strong>{servingRelease.isPending?'正在確認…':servingRelease.isError?'暫時無法確認':servingRelease.data?.releaseId}</strong>
      </div>
      <div>
        <span>狀態</span>
        <strong>{releaseMatch===true?'版本一致':releaseMatch===false?'版本不一致 · 禁止正式寫入':'正在確認版本'}</strong>
      </div>
      {releaseMatch===false?<button type="button" onClick={()=>window.location.reload()}>載入最新版本</button>:null}
    </section>

    {!session?<section className="v3-login-card" aria-label="Admin 登入">
      <div>
        <small>正式登入</small>
        <h2>登入 Admin</h2>
        <p>登入資料只保留喺目前記憶體；登出會清除已認證查詢資料。</p>
      </div>
      <form onSubmit={event=>{event.preventDefault();void signIn();}}>
        <label><span>登入編號</span><input autoComplete="username" value={loginId} onChange={event=>setLoginId(event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64))}/></label>
        <label><span>PIN</span><input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))}/></label>
        {authError?<div className="v3-error" role="alert">{authError}</div>:null}
        <button className="v3-primary" type="submit" disabled={authBusy||!loginId||pin.length<4}>{authBusy?'正在登入…':'登入'}</button>
      </form>
    </section>:<section className="v3-workspace">
      <div className="v3-page-head">
        <div>
          <small>{scope?.storeId} · {session.displayName}</small>
          <h2>正式雲端設定</h2>
          <p>呢一頁只做 Gate 1 驗證：版本、登入、管理範圍、Canonical Freshness。</p>
        </div>
        <button type="button" onClick={()=>void canonical.refetch()} disabled={canonical.isFetching}>
          {canonical.isFetching?'更新中':'重新讀取'}
        </button>
      </div>

      {writeBlocked?<div className="v3-warning" role="alert">
        目前 Client Release 未確認一致。正式寫入功能保持鎖定。
      </div>:null}

      {canonical.isPending?<div className="v3-state">正在讀取…</div>:canonical.isError?<div className="v3-error" role="alert">暫時無法取得正式雲端設定</div>:summary?<>
        <div className="v3-hero">
          <span>最後發佈時間</span>
          <strong>{hkTime(summary.publishedAt)}</strong>
          <small>正式 freshness 以 canonical publishedAt 為準。</small>
        </div>
        <div className="v3-grid">
          <article><span>分類</span><strong>{summary.categories}</strong></article>
          <article><span>商品</span><strong>{summary.products}</strong></article>
          <article><span>選項／口味組</span><strong>{summary.modifierGroups}</strong></article>
          <article><span>套餐</span><strong>{summary.combos}</strong></article>
        </div>
      </>:null}
    </section>}

    {diagnosticsOpen?<section className="v3-diagnostics">
      <h2>系統資訊</h2>
      <dl>
        <div><dt>Client Source</dt><dd>{V3_CLIENT_RELEASE.sourceSha}</dd></div>
        <div><dt>Client Build</dt><dd>{V3_CLIENT_RELEASE.buildTime}</dd></div>
        <div><dt>Backend</dt><dd>{health.data?health.data.sourceSha:'—'}</dd></div>
        <div><dt>Server State</dt><dd>{V3_ADMIN_STATE_AUTHORITY.server}</dd></div>
        <div><dt>正式 Outbox</dt><dd>{V3_ADMIN_STATE_AUTHORITY.outbox}</dd></div>
        <div><dt>V2 LocalStorage</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.v2LocalStorageRead)}</dd></div>
        {summary?<><div><dt>Canonical Fingerprint</dt><dd>{summary.fingerprint}</dd></div><div><dt>診斷 Revision</dt><dd>{summary.revision}</dd></div></>:null}
      </dl>
    </section>:null}
  </main>;
}
