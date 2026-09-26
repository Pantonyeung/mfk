import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {resolveSmmRuntimePort} from './runtime';
import {
  pairSmmLan,
  probeSmmLan,
  readSmmLanPwaConfig,
  saveSmmLanPwaConfig,
  type SmmLanPwaConfig,
} from './pwa-lan';
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
const LAN_PROBE_TIMEOUT_MS=2200;
const LAST_OBSERVED_KEY='mfk.smm.stage0.last-observed.v1';

type ProbeState='CHECKING'|'READY'|'ERROR';
type LanState='UNCONFIGURED'|'CHECKING'|'READY'|'ERROR';

function withTimeout<T>(promise:Promise<T>,ms:number):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error('SMM_STAGE0_PROBE_TIMEOUT')),ms);
    promise.then(value=>{window.clearTimeout(timer);resolve(value)},reason=>{window.clearTimeout(timer);reject(reason)});
  });
}

function readLastObservedAt():string|null{
  try{return localStorage.getItem(LAST_OBSERVED_KEY)}catch{return null}
}

function rememberLastObservedAt(value:string){
  try{localStorage.setItem(LAST_OBSERVED_KEY,value)}catch{}
}

function formatObservedAt(value:string|null){
  if(!value)return '未有成功同步紀錄';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '未有成功同步紀錄';
  return new Intl.DateTimeFormat('zh-HK',{
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    hour12:false,
  }).format(date);
}

function initialLanForm(){
  const current=readSmmLanPwaConfig();
  return {
    host:current?.host??'',
    port:String(current?.port??17831),
    deviceId:current?.deviceId??'',
    pairingToken:'',
  };
}

export function StageZeroGate({children}:{children:ReactNode}){
  const initialSession=useMemo(()=>readSmmStaffSession(),[]);
  const [splashDone,setSplashDone]=useState(false);
  const [probeState,setProbeState]=useState<ProbeState>('CHECKING');
  const [snapshot,setSnapshot]=useState<SmmReadModelSnapshot|null>(null);
  const [probeMessage,setProbeMessage]=useState('暫時未能連接門店服務，請檢查網絡後再試。');
  const [staffSession,setStaffSession]=useState<SmmStaffSession|null>(initialSession);
  const [offlineBypass,setOfflineBypass]=useState(false);
  const [lastObservedAt,setLastObservedAt]=useState<string|null>(()=>readLastObservedAt());

  const probe=async()=>{
    const port=resolveSmmRuntimePort();
    if(!port){
      console.warn('SMM_STAGE0_PROBE_DIAGNOSTIC','runtime port unavailable');
      setProbeState('ERROR');
      setProbeMessage('門店服務暫時未準備好，請稍後再試。');
      return;
    }
    setProbeState('CHECKING');
    setProbeMessage('暫時未能連接門店服務，請檢查網絡後再試。');
    try{
      const next=await withTimeout(port.readSnapshot(),PROBE_TIMEOUT_MS);
      setSnapshot(next);
      setLastObservedAt(next.observedAt);
      rememberLastObservedAt(next.observedAt);
      setProbeState('READY');
    }catch(reason){
      console.warn('SMM_STAGE0_PROBE_DIAGNOSTIC',reason);
      setProbeState('ERROR');
      setProbeMessage(navigator.onLine
        ?'門店服務暫時未有回應，請重新連線。'
        :'目前裝置未連接網絡；恢復網絡後可重新連線。');
    }
  };

  useEffect(()=>{
    const timer=window.setTimeout(()=>setSplashDone(true),SPLASH_MS);
    void probe();
    return()=>window.clearTimeout(timer);
  },[]);

  if(offlineBypass&&staffSession)return <>{children}</>;

  if(!splashDone)return <StageZeroSplash/>;

  if(probeState==='CHECKING')return <StageZeroConnectionChecking/>;

  if(probeState==='ERROR'){
    return <StageZeroConnectionRecovery
      message={probeMessage}
      lastObservedAt={lastObservedAt??snapshot?.observedAt??null}
      canEnterOffline={Boolean(staffSession)}
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
    <img className="stage0-brand-logo" src="/brand/morefun-logo.webp" alt="磨飯 More Fun"/>
    <span className="stage0-product-label">SMM</span>
  </div>;
}

function StageZeroSplash(){
  return <main className="stage0-shell stage0-splash" aria-busy="true">
    <section className="stage0-center">
      <BrandLockup/>
      <img className="stage0-ip stage0-ip-splash" src="/brand/ip-male.webp" alt="磨飯男店員角色"/>
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
        <div><i className="ok"/>Internet 狀態</div>
        <div><i className="loading"/>門店服務</div>
        <div><i/>同步最新資料</div>
      </div>
    </section>
  </main>;
}

function StageZeroConnectionRecovery({
  message,
  lastObservedAt,
  canEnterOffline,
  onRetry,
  onOffline,
}:{
  message:string;
  lastObservedAt:string|null;
  canEnterOffline:boolean;
  onRetry:()=>void;
  onOffline:()=>void;
}){
  const [internetOnline,setInternetOnline]=useState(()=>navigator.onLine);
  const [lanState,setLanState]=useState<LanState>(()=>readSmmLanPwaConfig()?'CHECKING':'UNCONFIGURED');
  const [lanMessage,setLanMessage]=useState(readSmmLanPwaConfig()?'檢查中':'未設定');
  const [pairOpen,setPairOpen]=useState(false);
  const [pairing,setPairing]=useState(false);
  const [pairMessage,setPairMessage]=useState<string|null>(null);
  const [lanForm,setLanForm]=useState(initialLanForm);

  const checkLan=async(config:SmmLanPwaConfig)=>{
    setLanState('CHECKING');
    setLanMessage('檢查中');
    try{
      await withTimeout(probeSmmLan(config),LAN_PROBE_TIMEOUT_MS);
      setLanState('READY');
      setLanMessage('可連線');
    }catch(reason){
      console.warn('SMM_STAGE0_LAN_DIAGNOSTIC',reason);
      setLanState('ERROR');
      setLanMessage('未能連線');
    }
  };

  useEffect(()=>{
    const online=()=>setInternetOnline(true);
    const offline=()=>setInternetOnline(false);
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);
    const config=readSmmLanPwaConfig();
    if(config)void checkLan(config);
    return()=>{
      window.removeEventListener('online',online);
      window.removeEventListener('offline',offline);
    };
  },[]);

  const pairLan=async()=>{
    const port=Number(lanForm.port);
    if(!lanForm.host.trim()||!lanForm.deviceId.trim()||!Number.isSafeInteger(port)||port<1||port>65535){
      setPairMessage('請完整輸入門店主機、Port 同裝置 ID。');
      return;
    }
    setPairing(true);
    setPairMessage(null);
    const config:SmmLanPwaConfig={
      host:lanForm.host.trim(),
      port,
      deviceId:lanForm.deviceId.trim(),
      ...(lanForm.pairingToken.trim()?{pairingToken:lanForm.pairingToken.trim()}:{}),
    };
    try{
      saveSmmLanPwaConfig(config);
      await withTimeout(pairSmmLan(config),LAN_PROBE_TIMEOUT_MS);
      setLanForm(current=>({...current,pairingToken:''}));
      setPairMessage('LAN 配對完成。');
      setPairOpen(false);
      await checkLan(config);
      onRetry();
    }catch(reason){
      console.warn('SMM_STAGE0_PAIR_DIAGNOSTIC',reason);
      setPairMessage('LAN 配對未完成，請檢查主機、裝置 ID 同配對碼後再試。');
      setLanState('ERROR');
      setLanMessage('未配對');
    }finally{
      setPairing(false);
    }
  };

  return <main className="stage0-shell">
    <section className="stage0-card stage0-recovery-card">
      <BrandLockup/>
      <div className="stage0-status-icon error" aria-hidden="true">!</div>
      <h1>暫時未能連接門店</h1>
      <p>{message}</p>

      <div className="stage0-connection-grid" aria-label="連線狀態">
        <div>
          <span>Internet</span>
          <strong className={internetOnline?'ok':'bad'}>{internetOnline?'裝置在線':'裝置離線'}</strong>
        </div>
        <div>
          <span>LAN</span>
          <strong className={lanState==='READY'?'ok':lanState==='CHECKING'?'pending':'bad'}>{lanMessage}</strong>
        </div>
        <div className="wide">
          <span>最後觀察時間</span>
          <strong>{formatObservedAt(lastObservedAt)}</strong>
        </div>
      </div>

      <button className="stage0-primary" onClick={onRetry}>重新連線</button>
      <button className="stage0-secondary" onClick={()=>setPairOpen(open=>!open)}>
        {readSmmLanPwaConfig()?'重新配對 LAN':'設定 LAN 配對'}
      </button>

      {pairOpen?<section className="stage0-pair-panel">
        <label className="stage0-field"><span>門店主機</span><input value={lanForm.host} onChange={event=>setLanForm(current=>({...current,host:event.target.value}))} placeholder="例如 192.168.1.20"/></label>
        <label className="stage0-field"><span>Port</span><input inputMode="numeric" value={lanForm.port} onChange={event=>setLanForm(current=>({...current,port:event.target.value.replace(/\D/g,'').slice(0,5)}))}/></label>
        <label className="stage0-field"><span>裝置 ID</span><input value={lanForm.deviceId} onChange={event=>setLanForm(current=>({...current,deviceId:event.target.value}))} placeholder="此手機嘅 SMM 裝置 ID"/></label>
        <label className="stage0-field"><span>配對碼</span><input type="password" autoComplete="one-time-code" value={lanForm.pairingToken} onChange={event=>setLanForm(current=>({...current,pairingToken:event.target.value}))} placeholder="輸入 SMT 顯示嘅配對碼"/></label>
        {pairMessage?<div className="stage0-inline-message" role="status">{pairMessage}</div>:null}
        <button className="stage0-primary" disabled={pairing} onClick={()=>void pairLan()}>{pairing?'配對中…':'儲存並配對'}</button>
      </section>:null}

      <button className="stage0-secondary" disabled={!canEnterOffline} onClick={onOffline}>進入離線工作區</button>
      <small className="stage0-security">
        {canEnterOffline
          ?'離線工作區只使用此裝置已驗證員工 Session；正式門店資料會保持降級狀態。'
          :'此裝置未有可信員工 Session，離線模式唔會繞過員工登入。請恢復連線後先登入。'}
      </small>
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
      console.warn('SMM_STAGE0_STAFF_DIRECTORY_DIAGNOSTIC',reason);
      setError('暫時未能讀取員工名單；可以直接輸入員工編號。');
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
      console.warn('SMM_STAGE0_STAFF_VERIFY_DIAGNOSTIC',reason);
      setError('員工編號或 PIN 未能驗證，請確認後再試。');
    }finally{
      setLoading(false);
    }
  };

  return <main className="stage0-shell">
    <section className="stage0-card stage0-login-card">
      <BrandLockup/>
      <img className="stage0-ip stage0-ip-login" src="/brand/ip-female.webp" alt="磨飯女店員角色"/>
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
      <small className="stage0-security">員工身份沿用現有 MFK 驗證流程；工程錯誤只會留喺診斷記錄，唔會直接顯示畀前線員工。</small>
    </section>
  </main>;
}
