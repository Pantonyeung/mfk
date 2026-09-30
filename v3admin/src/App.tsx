import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readV3BackendHealth,v3QueryKeys} from './api.ts';
import {loginV3Admin,logoutV3Admin,type V3AdminSession} from './auth.ts';
import {readV3CanonicalAdminActive,summarizeV3Canonical,v3AdminCanonicalQueryKey} from './canonical.ts';
import {V3_ADMIN_STATE_AUTHORITY,useV3AdminUi} from './state-authority.ts';

function hkTime(value:string){
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):value;
}

export function V3AdminApp(){
  const {panel,setPanel}=useV3AdminUi();
  const queryClient=useQueryClient();
  const [session,setSession]=useState<V3AdminSession|null>(null);
  const [loginId,setLoginId]=useState('');
  const [pin,setPin]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState('');

  const health=useQuery({
    queryKey:v3QueryKeys.health,
    queryFn:readV3BackendHealth,
  });

  const canonical=useQuery({
    queryKey:v3AdminCanonicalQueryKey,
    queryFn:()=>readV3CanonicalAdminActive(session?.sessionToken??''),
    enabled:Boolean(session),
    staleTime:0,
    gcTime:0,
  });

  const signIn=async()=>{
    if(authBusy)return;
    setAuthBusy(true);
    setAuthError('');
    try{
      const next=await loginV3Admin(loginId,pin);
      setSession(next);
      setPin('');
    }catch(error){
      setAuthError(error instanceof Error?error.message:'V3_ADMIN_LOGIN_FAILED');
    }finally{
      setAuthBusy(false);
    }
  };

  const signOut=async()=>{
    const token=session?.sessionToken??'';
    setSession(null);
    setPin('');
    setAuthError('');
    queryClient.removeQueries({queryKey:v3AdminCanonicalQueryKey,exact:true});
    await logoutV3Admin(token);
  };

  const summary=canonical.data?summarizeV3Canonical(canonical.data):null;

  return <main className="v3-shell">
    <header className="v3-head">
      <div>
        <small>PARALLEL V3 · A1 READ ONLY · NO PRODUCTION ROUTING</small>
        <h1>MFK Admin V3</h1>
        <p>獨立新 Client。只讀現有 Cloud Canonical；現有 v2 Production 不受影響。</p>
      </div>
      <nav aria-label="V3 preview">
        <button type="button" data-active={panel==='OVERVIEW'} onClick={()=>setPanel('OVERVIEW')}>Canonical</button>
        <button type="button" data-active={panel==='AUTHORITY'} onClick={()=>setPanel('AUTHORITY')}>主權</button>
      </nav>
    </header>

    {panel==='OVERVIEW'?<>
      <section className="v3-grid">
        <article>
          <span>Backend</span>
          <strong>{health.isPending?'檢查中':health.isError?'未連接':'已連接'}</strong>
          <small>{health.data?health.data.service+' · '+health.data.sourceSha.slice(0,12):health.error instanceof Error?health.error.message:'TanStack Query health probe'}</small>
        </article>
        <article>
          <span>Auth</span>
          <strong>{session?'記憶體 Session':'未登入'}</strong>
          <small>{session?session.displayName+' · '+session.role:'A1 不會將 session token 寫入 browser storage'}</small>
        </article>
      </section>

      {!session?<section className="v3-login-card" aria-label="V3 Admin login">
        <div>
          <small>AUTHENTICATED CANONICAL READ</small>
          <h2>讀取正式 Admin</h2>
          <p>PIN 只喺瀏覽器內做 PBKDF2/HMAC proof；唔會直接送出 PIN，亦唔會持久化登入 token。</p>
        </div>
        <form onSubmit={event=>{event.preventDefault();void signIn();}}>
          <label><span>登入編號</span><input autoComplete="username" value={loginId} onChange={event=>setLoginId(event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64))} placeholder="例如 1111"/></label>
          <label><span>PIN</span><input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 位數字"/></label>
          {authError?<div className="v3-error" role="alert">{authError}</div>:null}
          <button type="submit" disabled={authBusy||!loginId||pin.length<4}>{authBusy?'驗證中…':'登入並讀取 Canonical'}</button>
        </form>
      </section>:<section className="v3-canonical-card" aria-live="polite">
        <header>
          <div><small>SERVER STATE · TANSTACK QUERY</small><h2>Canonical Admin</h2></div>
          <div className="v3-actions">
            <button type="button" onClick={()=>void canonical.refetch()} disabled={canonical.isFetching}>{canonical.isFetching?'讀取中…':'重新讀取'}</button>
            <button type="button" onClick={()=>void signOut()}>登出</button>
          </div>
        </header>
        {canonical.isPending?<p>正在讀取 Cloud Canonical…</p>:canonical.isError?<div className="v3-error" role="alert">{canonical.error instanceof Error?canonical.error.message:'V3_ADMIN_CANONICAL_READ_FAILED'}</div>:summary?<>
          <div className="v3-facts">
            <div><span>Store</span><strong>{summary.storeId}</strong></div>
            <div><span>Cloud 發佈時間</span><strong>{hkTime(summary.publishedAt)}</strong></div>
            <div><span>Fingerprint</span><strong><code>{summary.fingerprint}</code></strong></div>
            <div><span>Admin Fingerprint</span><strong><code>{summary.adminFingerprint}</code></strong></div>
            <div><span>Revision（診斷）</span><strong>{summary.revision}</strong></div>
            <div><span>Snapshot sections</span><strong>{summary.snapshotSections.length}</strong></div>
          </div>
          <div className="v3-grid">
            <article><span>分類</span><strong>{summary.categories}</strong><small>canonical catalog</small></article>
            <article><span>商品</span><strong>{summary.products}</strong><small>canonical catalog</small></article>
            <article><span>選項組</span><strong>{summary.modifierGroups}</strong><small>canonical catalog</small></article>
            <article><span>套餐</span><strong>{summary.combos}</strong><small>canonical catalog</small></article>
          </div>
          <div className="v3-sections"><b>Canonical sections</b><p>{summary.snapshotSections.join(' · ')}</p></div>
        </>:null}
      </section>}
    </>:<section className="v3-authority">
      <h2>V3 State Authority</h2>
      <dl>
        <div><dt>Cloud / Server</dt><dd>{V3_ADMIN_STATE_AUTHORITY.server}</dd></div>
        <div><dt>Outbox</dt><dd>{V3_ADMIN_STATE_AUTHORITY.outbox}</dd></div>
        <div><dt>Draft / UI</dt><dd>{V3_ADMIN_STATE_AUTHORITY.localDraft}</dd></div>
        <div><dt>Auth persistence</dt><dd>MEMORY ONLY</dd></div>
        <div><dt>Persist derived status</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted)}</dd></div>
        <div><dt>Import v2 state modules</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.v2StateModulesImported)}</dd></div>
      </dl>
    </section>}
  </main>;
}
