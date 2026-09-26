import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {resolveSmmRuntimePort} from './runtime';
import {
  listSmmStaff,
  readSmmStaffSession,
  verifySmmStaff,
  type SmmStaffDirectoryItem,
  type SmmStaffSession,
} from './pwa-staff';
import {pairSmmLan,readSmmLanPwaConfig} from './pwa-lan';
import {APPROVED_LOGO_SRC,APPROVED_MALE_IP_SRC} from './approved-brand-assets';
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
function humanProbeMessage(){
  return navigator.onLine
    ?'暫時未能連接門店服務，請稍後再試。'
    :'目前裝置未連接網絡，請檢查 Wi‑Fi 或流動數據。';
}
function humanStaffMessage(){
  return '員工編號或 PIN 未能驗證，請檢查後再試一次。';
}
function humanDirectoryMessage(){
  return '暫時未能讀取員工名單，你仍可直接輸入員工編號。';
}
function formatObservedAt(value:string|null){
  if(!value)return '未有可確認記錄';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'未有可確認記錄':date.toLocaleString('zh-HK',{hour12:false});
}

export function StageZeroGate({children}:{children:ReactNode}){
  const initialSession=useMemo(()=>readSmmStaffSession(),[]);
  const [splashDone,setSplashDone]=useState(false);
  const [probeState,setProbeState]=useState<ProbeState>('CHECKING');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [lastObservedAt,setLastObservedAt]=useState<string|null>(null);
  const [staffSession,setStaffSession]=useState<SmmStaffSession|null>(initialSession);
  const [offlineBypass,setOfflineBypass]=useState(false);

  const probe=async()=>{
    const port=resolveSmmRuntimePort();
    if(!port){setProbeState('ERROR');return;}
    setProbeState('CHECKING');
    try{
      const next=await withTimeout(port.readSnapshot(),PROBE_TIMEOUT_MS);
      setSnapshot(next);
      setLastObservedAt(next.observedAt);
      setProbeState('READY');
    }catch(error){
      console.warn('SMM_STAGE0_PROBE_FAILED',error);
      setProbeState('ERROR');
    }
  };

  useEffect(()=>{
    const timer=window.setTimeout(()=>setSplashDone(true),SPLASH_MS);
    void probe();
    return()=>window.clearTimeout(timer);
  },[]);

  if(!splashDone)return <StageZeroSplash/>;

  if(offlineBypass&&staffSession)return <>{children}</>;

  if(probeState==='CHECKING')return <StageZeroConnectionChecking/>;

  if(probeState==='ERROR'){
    return <StageZeroConnectionRecovery
      hasTrustedStaff={Boolean(staffSession)}
      lastObservedAt={lastObservedAt}
      onRetry={()=>void probe()}
      onOffline={()=>{if(staffSession)setOfflineBypass(true)}}
    />;
  }

  if(snapshot?.connectionPath!=='LAN'&&!staffSession){
    return <StageZeroStaffLogin onSuccess={setStaffSession}/>;
  }

  return <>{children}</>;
}

function BrandLockup(){
  return <div className="stage0-brand">
    <img src={APPROVED_LOGO_SRC} alt="磨飯 More Fun"/>
    <b>SMM 流動店務</b>
  </div>;
}

function StageZeroSplash(){
  return <main className="stage0-shell stage0-splash" aria-busy="true">
    <section className="stage0-center">
      <BrandLockup/>
      <img className="stage0-approved-ip" src={APPROVED_MALE_IP_SRC} alt="磨飯前線店務角色"/>
      <div className="stage0-slogan"><strong>前線好幫手</strong><span>令每一張訂單都更順暢</span></div>
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

function StageZeroConnectionRecovery({hasTrustedStaff,lastObservedAt,onRetry,onOffline}:{
  hasTrustedStaff:boolean;
  lastObservedAt:string|null;
  onRetry:()=>void;
  onOffline:()=>void;
}){
  const config=readSmmLanPwaConfig();
  const [pairing,setPairing]=useState(false);
  const [pairMessage,setPairMessage]=useState<string|null>(null);

  const pair=async()=>{
    if(!config){setPairMessage('呢部裝置未有 LAN 配對設定。請先恢復網絡，再到「更多 > 連線」完成設定。');return;}
    setPairing(true);
    setPairMessage(null);
    try{
      await pairSmmLan(config);
      setPairMessage('LAN 已重新配對，可以再試連線。');
    }catch(error){
      console.warn('SMM_STAGE0_PAIR_FAILED',error);
      setPairMessage('未能完成 LAN 配對，請確認 SMT 已開啟配對後再試。');
    }finally{setPairing(false);}
  };

  return <main className="stage0-shell">
    <section className="stage0-card stage0-recovery-card">
      <BrandLockup/>
      <div className="stage0-status-icon error" aria-hidden="true">!</div>
      <h1>暫時未能連接門店</h1>
      <p>{humanProbeMessage()}</p>

      <div className="stage0-connection-grid" aria-label="連線狀態">
        <div><span>Internet</span><strong>{navigator.onLine?'裝置有網絡':'未連接'}</strong></div>
        <div><span>LAN</span><strong>{config?'已設定配對':'未設定'}</strong></div>
        <div className="wide"><span>最後觀察時間</span><strong>{formatObservedAt(lastObservedAt)}</strong></div>
      </div>

      {pairMessage?<div className="stage0-inline-message" role="status">{pairMessage}</div>:null}

      <div className="stage0-action-grid">
        <button className="stage0-primary" onClick={onRetry}>重新連線</button>
        <button className="stage0-secondary" disabled={pairing} onClick={()=>void pair()}>{pairing?'配對中…':config?'重新配對':'配對設定'}</button>
      </div>

      <button className="stage0-secondary" disabled={!hasTrustedStaff} onClick={onOffline}>
        {hasTrustedStaff?'進入離線工作區':'需先完成員工登入'}
      </button>
      {!hasTrustedStaff?<small className="stage0-security">離線模式唔會繞過員工身份驗證；請先恢復連線完成登入。</small>:null}
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
      console.warn('SMM_STAGE0_STAFF_DIRECTORY_FAILED',reason);
      setError(humanDirectoryMessage());
    }finally{setDirectoryLoading(false);}
  };

  useEffect(()=>{void loadDirectory()},[]);

  const submit=async()=>{
    if(!staffId.trim()){setError('請先選擇或輸入員工編號。');return;}
    setLoading(true);
    setError(null);
    try{
      const session=await verifySmmStaff(staffId.trim(),pin);
      onSuccess(session);
    }catch(reason){
      console.warn('SMM_STAGE0_STAFF_VERIFY_FAILED',reason);
      setError(humanStaffMessage());
    }finally{setLoading(false);}
  };

  return <main className="stage0-shell">
    <section className="stage0-card stage0-login-card">
      <BrandLockup/>
      <header><span>歡迎返嚟</span><h1>員工登入</h1><p>使用你嘅員工身份進入 SMM。</p></header>

      {staff.length?<label className="stage0-field">
        <span>員工</span>
        <select value={staffId} onChange={event=>setStaffId(event.target.value)}>
          {staff.map(row=><option key={row.staffId} value={row.staffId}>{row.displayName} · {row.role||row.staffId}</option>)}
        </select>
      </label>:<label className="stage0-field">
        <span>員工編號</span>
        <input inputMode="text" autoComplete="username" value={staffId} onChange={event=>setStaffId(event.target.value)} placeholder={directoryLoading?'讀取員工名單中…':'輸入員工編號'}/>
      </label>}

      <label className="stage0-field">
        <span>PIN</span>
        <input inputMode="numeric" autoComplete="current-password" maxLength={8} value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 位數字" type="password"/>
      </label>

      {error?<div className="stage0-inline-message danger" role="alert">{error}</div>:null}
      <button className="stage0-primary" disabled={loading||pin.length<4} onClick={()=>void submit()}>{loading?'驗證中…':'登入 SMM'}</button>
      {!staff.length&&!directoryLoading?<button className="stage0-text-button" onClick={()=>void loadDirectory()}>重新讀取員工名單</button>:null}
      <small className="stage0-security">員工身份沿用現有 MFK 驗證流程；一般畫面唔會顯示工程錯誤碼。</small>
    </section>
  </main>;
}
