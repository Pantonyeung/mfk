import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {resolveSmmRuntimePort} from './runtime';
import {
  listSmmStaff,
  readSmmStaffSession,
  verifySmmStaff,
  type SmmStaffDirectoryItem,
  type SmmStaffSession,
} from './pwa-staff';
import type {SmmReadModelSnapshot} from './product-types';
import './stage0.css';

const SPLASH_MS=650;
const PROBE_TIMEOUT_MS=3500;

type ProbeState='CHECKING'|'READY'|'ERROR';

function withTimeout<T>(promise:Promise<T>,ms:number):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error('SMM_STAGE0_PROBE_TIMEOUT')),ms);
    promise.then(value=>{window.clearTimeout(timer);resolve(value)},reason=>{window.clearTimeout(timer);reject(reason)});
  });
}

export function StageZeroGate({children}:{children:ReactNode}){
  const initialSession=useMemo(()=>readSmmStaffSession(),[]);
  const [splashDone,setSplashDone]=useState(false);
  const [probeState,setProbeState]=useState<ProbeState>('CHECKING');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [probeError,setProbeError]=useState<string|null>(null);
  const [staffSession,setStaffSession]=useState<SmmStaffSession|null>(initialSession);
  const [offlineBypass,setOfflineBypass]=useState(false);

  const probe=async()=>{
    const port=resolveSmmRuntimePort();
    if(!port){
      setProbeState('ERROR');
      setProbeError('門店服務未準備好。');
      return;
    }
    setProbeState('CHECKING');
    setProbeError(null);
    try{
      const next=await withTimeout(port.readSnapshot(),PROBE_TIMEOUT_MS);
      setSnapshot(next);
      setProbeState('READY');
    }catch(reason){
      setProbeState('ERROR');
      setProbeError(reason instanceof Error?reason.message:'暫時未能連接門店服務');
    }
  };

  useEffect(()=>{
    const timer=window.setTimeout(()=>setSplashDone(true),SPLASH_MS);
    void probe();
    return()=>window.clearTimeout(timer);
  },[]);

  if(offlineBypass)return <>{children}</>;

  if(!splashDone){
    return <StageZeroSplash/>;
  }

  if(probeState==='CHECKING'){
    return <StageZeroConnectionChecking/>;
  }

  if(probeState==='ERROR'){
    return <StageZeroConnectionRecovery
      message={probeError??'暫時未能連接門店服務'}
      onRetry={()=>void probe()}
      onOffline={()=>setOfflineBypass(true)}
    />;
  }

  if(snapshot?.connectionPath!=='LAN'&&!staffSession){
    return <StageZeroStaffLogin onSuccess={setStaffSession}/>;
  }

  return <>{children}</>;
}

function BrandLockup(){
  return <div className="stage0-brand" aria-label="磨飯 SMM">
    <span className="stage0-morefun">More Fun</span>
    <strong>磨飯</strong>
    <small>手作 · 輕食</small>
    <b>SMM</b>
  </div>;
}

function StageZeroSplash(){
  return <main className="stage0-shell stage0-splash" aria-busy="true">
    <section className="stage0-center">
      <BrandLockup/>
      <div className="stage0-team-art" role="img" aria-label="磨飯前線店務夥伴"/>
      <div className="stage0-slogan">
        <strong>前線好幫手</strong>
        <span>令每一張訂單都更順暢</span>
      </div>
      <div className="stage0-progress" aria-label="啟動中"><i/></div>
      <small className="stage0-footnote">正在準備工作環境…</small>
    </section>
  </main>;
}

function StageZeroConnectionChecking(){
  return <main className="stage0-shell">
    <section className="stage0-card stage0-check-card">
      <BrandLockup/>
      <div className="stage0-orbit" aria-hidden="true"><span>●</span></div>
      <h1>正在連線</h1>
      <p>檢查門店服務同最新資料，完成後會自動進入工作區。</p>
      <div className="stage0-check-list" aria-live="polite">
        <div><i className="ok"/>網絡連線</div>
        <div><i className="loading"/>門店服務</div>
        <div><i/>同步最新資料</div>
      </div>
    </section>
  </main>;
}

function StageZeroConnectionRecovery({message,onRetry,onOffline}:{message:string;onRetry:()=>void;onOffline:()=>void}){
  return <main className="stage0-shell">
    <section className="stage0-card stage0-recovery-card">
      <BrandLockup/>
      <div className="stage0-status-icon error" aria-hidden="true">!</div>
      <h1>暫時未能連接門店</h1>
      <p>你仍然可以進入離線工作區處理本機草稿；正式餐單、訂單同營運狀態會保持空白，唔會顯示假資料。</p>
      <div className="stage0-inline-message" role="status">{message}</div>
      <button className="stage0-primary" onClick={onRetry}>重新連線</button>
      <button className="stage0-secondary" onClick={onOffline}>進入離線工作區</button>
    </section>
  </main>;
}

function StageZeroStaffLogin({onSuccess}:{onSuccess:(session:SmmStaffSession)=>void}){
  const [staff,setStaff]=useState<readonly SmmStaffDirectoryItem[]>([]);
  const [staffId,setStaffId]=useState('');
  const [pin,setPin]=useState('');
  const [loading,setLoading]=useState(false);
  const [directoryLoading,setDirectoryLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const loadDirectory=async()=>{
    setDirectoryLoading(true);
    setError(null);
    try{
      const rows=await listSmmStaff();
      setStaff(rows);
      if(!staffId&&rows[0])setStaffId(rows[0].staffId);
    }catch(reason){
      setError(reason instanceof Error?reason.message:'未能讀取員工名單；可以直接輸入員工編號。');
    }finally{
      setDirectoryLoading(false);
    }
  };

  useEffect(()=>{void loadDirectory()},[]);

  const submit=async()=>{
    if(!staffId.trim()){
      setError('請先選擇或輸入員工編號。');
      return;
    }
    setLoading(true);
    setError(null);
    try{
      const session=await verifySmmStaff(staffId.trim(),pin);
      onSuccess(session);
    }catch(reason){
      setError(reason instanceof Error?reason.message:'員工驗證失敗');
    }finally{
      setLoading(false);
    }
  };

  return <main className="stage0-shell">
    <section className="stage0-card stage0-login-card">
      <BrandLockup/>
      <div className="stage0-team-art compact" role="img" aria-label="磨飯前線店務夥伴"/>
      <header>
        <span>歡迎返嚟</span>
        <h1>員工登入</h1>
        <p>使用你嘅員工身份進入 SMM。</p>
      </header>

      {staff.length?<label className="stage0-field">
        <span>員工</span>
        <select value={staffId} onChange={event=>setStaffId(event.target.value)}>
          {staff.map(row=><option key={row.staffId} value={row.staffId}>{row.displayName} · {row.role||row.staffId}</option>)}
        </select>
      </label>:<label className="stage0-field">
        <span>員工編號</span>
        <input
          inputMode="text"
          autoComplete="username"
          value={staffId}
          onChange={event=>setStaffId(event.target.value)}
          placeholder={directoryLoading?'讀取員工名單中…':'輸入員工編號'}
        />
      </label>}

      <label className="stage0-field">
        <span>PIN</span>
        <input
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={8}
          value={pin}
          onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))}
          placeholder="4–8 位數字"
          type="password"
        />
      </label>

      {error?<div className="stage0-inline-message danger" role="alert">{error}</div>:null}

      <button className="stage0-primary" disabled={loading||pin.length<4} onClick={()=>void submit()}>
        {loading?'驗證中…':'登入 SMM'}
      </button>
      {!staff.length&&!directoryLoading?<button className="stage0-text-button" onClick={()=>void loadDirectory()}>重新讀取員工名單</button>:null}
      <small className="stage0-security">員工身份只會交畀現有 MFK 驗證流程；SMM 唔會建立第二套登入系統。</small>
    </section>
  </main>;
}
