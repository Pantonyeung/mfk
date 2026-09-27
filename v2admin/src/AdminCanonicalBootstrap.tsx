import {useEffect,useState,type ReactNode} from 'react';
import {readActiveAdminRelease} from './admin-local-store.ts';
import {readAdminSyncStatus,installAdminSyncAutoFlush,readCanonicalAdminActiveWithPublisherKey} from './admin-sync-client.ts';
import {installAdminProjectionLiveRead} from './admin-projection-client.ts';
import {
  hydrateAdminFromCanonical,
  loginAdminBrowser,
  readCanonicalAdminActive,
  readStoredAdminBrowserSession,
  refreshAdminBrowserSession,
} from './admin-browser-session.ts';

type BootstrapState='CHECKING'|'LOGIN'|'READY'|'ERROR';

export function AdminCanonicalBootstrap({children}:{children:ReactNode}){
  const [state,setState]=useState<BootstrapState>('CHECKING');
  const [loginId,setLoginId]=useState('');
  const [pin,setPin]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const activate=()=>{
    installAdminSyncAutoFlush();
    installAdminProjectionLiveRead();
    setState('READY');
  };

  useEffect(()=>{
    let cancelled=false;
    void(async()=>{
      const local=readActiveAdminRelease();
      const sync=readAdminSyncStatus();
      const stored=readStoredAdminBrowserSession();

      if(stored){
        const session=await refreshAdminBrowserSession();
        if(cancelled)return;
        if(session){
          try{
            const active=await readCanonicalAdminActive();
            if(cancelled)return;
            if(!local||local.version!==active.revision||sync.state==='ERROR')hydrateAdminFromCanonical(active);
            activate();
            return;
          }catch{
            if(cancelled)return;
          }
        }
      }

      const publisherActive=await readCanonicalAdminActiveWithPublisherKey();
      if(cancelled)return;
      if(publisherActive){
        if(!local||local.version!==publisherActive.revision||local.fingerprint!==publisherActive.adminFingerprint||sync.state==='ERROR'){
          hydrateAdminFromCanonical(publisherActive);
        }
        activate();
        return;
      }

      setState('LOGIN');
      setMessage(local?'呢個瀏覽器嘅本機設定未能同雲端 Canonical Admin 對上，請重新驗證身份。':'呢個瀏覽器未有 Canonical Admin 設定，請先驗證身份並讀取雲端版本。');
    })();
    return()=>{cancelled=true};
  },[]);

  const connect=async()=>{
    if(busy)return;
    setBusy(true);setMessage('正在驗證並讀取 Canonical Admin…');
    try{
      await loginAdminBrowser(loginId,pin);
      const active=await readCanonicalAdminActive();
      hydrateAdminFromCanonical(active);
      setPin('');
      activate();
    }catch(error){
      setState('LOGIN');
      setMessage(error instanceof Error?error.message:'未能連接 Canonical Admin');
    }finally{setBusy(false);}
  };

  if(state==='READY')return <>{children}</>;

  return <main className="admin-canonical-gate">
    <form className="admin-canonical-card" onSubmit={event=>{event.preventDefault();void connect();}}>
      <small>CANONICAL ADMIN</small>
      <h1>{state==='CHECKING'?'正在檢查雲端設定':'連接正式 Admin'}</h1>
      <p>{state==='CHECKING'?'正在確認呢個瀏覽器是否持有最新正式設定。':message}</p>
      {state!=='CHECKING'?<>
        <label><span>登入編號</span><input autoComplete="username" value={loginId} onChange={event=>setLoginId(event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64))} placeholder="例如 1111"/></label>
        <label><span>PIN</span><input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 位數字"/></label>
        <button type="submit" disabled={busy||!loginId||pin.length<4}>{busy?'連接中…':'驗證並載入正式設定'}</button>
        <strong>唔會建立第二份 Admin 資料；驗證成功後只會以雲端 Active Revision 作本機編輯基礎。</strong>
      </>:null}
    </form>
  </main>;
}
