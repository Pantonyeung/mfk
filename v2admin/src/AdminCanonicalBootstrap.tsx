import {useEffect,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {readActiveAdminRelease} from './admin-local-store.ts';
import {readAdminSyncStatus,installAdminSyncAutoFlush,reconcileAdminSyncStatusFromCanonical} from './admin-sync-client.ts';
import {installAdminProjectionLiveRead} from './admin-projection-client.ts';
import {
  hydrateAdminFromCanonical,
  loginAdminBrowser,
  readStoredAdminBrowserSession,
  refreshAdminBrowserSession,
} from './admin-browser-session.ts';
import {adminCanonicalPublisherQueryOptions,adminCanonicalSessionQueryOptions,adminQueryClient} from './admin-query-client.ts';

type BootstrapState='CHECKING'|'LOGIN'|'READY'|'ERROR';
type CanonicalReadMode='SESSION'|'PUBLISHER'|null;

export function adminCanonicalHydrationRequired(
  local:{version:number;createdAt:string;fingerprint:string}|null,
  active:{revision:number;publishedAt:string;adminFingerprint:string;fingerprint:string},
  sync:{state:string;fingerprint?:string;cloudPublishedAt?:string},
){
  if(!local)return true;
  if(sync.state==='ERROR')return true;
  if(local.createdAt!==active.publishedAt)return true;
  if(local.fingerprint!==active.adminFingerprint)return true;
  if(sync.fingerprint&&sync.fingerprint!==active.fingerprint)return true;
  if(sync.cloudPublishedAt&&sync.cloudPublishedAt!==active.publishedAt)return true;
  return false;
}

export function AdminCanonicalBootstrap({children}:{children:ReactNode}){
  const [state,setState]=useState<BootstrapState>('CHECKING');
  const [loginId,setLoginId]=useState('');
  const [pin,setPin]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [canonicalMode,setCanonicalMode]=useState<CanonicalReadMode>(null);

  const canonicalQuery=useQuery({
    ...(canonicalMode==='SESSION'?adminCanonicalSessionQueryOptions():adminCanonicalPublisherQueryOptions()),
    enabled:state==='READY'&&canonicalMode!==null,
  });

  const activate=(mode:Exclude<CanonicalReadMode,null>)=>{
    setCanonicalMode(mode);
    installAdminSyncAutoFlush();
    installAdminProjectionLiveRead();
    setState('READY');
  };

  useEffect(()=>{
    const active=canonicalQuery.data;
    if(state!=='READY'||!active)return;
    const local=readActiveAdminRelease();
    const sync=readAdminSyncStatus();
    if(adminCanonicalHydrationRequired(local,active,sync))hydrateAdminFromCanonical(active);
    reconcileAdminSyncStatusFromCanonical(active);
  },[canonicalQuery.data,state]);

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
            const active=await adminQueryClient.fetchQuery(adminCanonicalSessionQueryOptions());
            if(cancelled)return;
            if(adminCanonicalHydrationRequired(local,active,sync))hydrateAdminFromCanonical(active);
            reconcileAdminSyncStatusFromCanonical(active);
            activate('SESSION');
            return;
          }catch{
            if(cancelled)return;
          }
        }
      }

      const publisherActive=await adminQueryClient.fetchQuery(adminCanonicalPublisherQueryOptions()).catch(()=>null);
      if(cancelled)return;
      if(publisherActive){
        if(adminCanonicalHydrationRequired(local,publisherActive,sync))hydrateAdminFromCanonical(publisherActive);
        reconcileAdminSyncStatusFromCanonical(publisherActive);
        activate('PUBLISHER');
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
      const active=await adminQueryClient.fetchQuery(adminCanonicalSessionQueryOptions());
      hydrateAdminFromCanonical(active);
      reconcileAdminSyncStatusFromCanonical(active);
      setPin('');
      activate('SESSION');
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
        <strong>唔會建立第二份 Admin 資料；驗證成功後只會以雲端最新 Canonical 發佈作本機編輯基礎。</strong>
      </>:null}
    </form>
  </main>;
}
