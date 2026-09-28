import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {
  loginStaff,
  logoutStaff,
  readActiveStaffSession,
  readRuntimeStaff,
  staffAuthRequired,
  subscribeStaffSession,
} from '../runtime/staff-auth.ts';
import {readSmtAdminSyncStatus,subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';

function roleLabel(role:string){
  return role==='OWNER'?'老闆':role==='MANAGER'?'經理':role==='VIEWER'?'只讀':'員工';
}
function dateLabel(now:Date){
  return new Intl.DateTimeFormat('zh-HK',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(now);
}
function timeLabel(now:Date){
  return new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
}

export function StaffAuthGate({children}:{children:ReactNode}){
  const [revision,setRevision]=useState(0);
  const [staffId,setStaffId]=useState('');
  const [pin,setPin]=useState('');
  const [error,setError]=useState('');
  const [now,setNow]=useState(()=>new Date());

  useEffect(()=>{
    const update=()=>setRevision(value=>value+1);
    const a=subscribeStaffSession(update);
    const b=subscribeSmtAdminConfig(update);
    const timer=window.setInterval(()=>setNow(new Date()),30_000);
    return()=>{a();b();window.clearInterval(timer);};
  },[]);
  void revision;

  const staff=useMemo(()=>readRuntimeStaff().filter(row=>row.active),[revision]);
  const loginReady=staff.filter(row=>Boolean(row.pinVerifier));
  const session=readActiveStaffSession();
  const sync=readSmtAdminSyncStatus();

  useEffect(()=>{
    if(!staffId&&loginReady[0])setStaffId(loginReady[0].staffId);
  },[staffId,loginReady]);

  if(!staffAuthRequired())return <>{children}</>;
  if(session)return <>{children}</>;

  const submit=async()=>{
    setError('');
    const result=await loginStaff(staffId,pin);
    if(!result.ok){
      setError(result.code==='STAFF_PIN_INVALID'?'PIN 不正確。':'此員工未能登入。');
      setPin('');
    }
  };
  const press=(key:string)=>{
    if(key==='⌫'){setPin(value=>value.slice(0,-1));setError('');return;}
    if(/^\d$/.test(key)){setPin(value=>(value+key).slice(0,8));setError('');}
  };

  return <>
    <div className="smt-gated-underlay" aria-hidden="true">{children}</div>
    <div className="smt-stage0-overlay">
      <div className="smt-stage0-shell">
        <section className="smt-stage0-brand" aria-label="磨飯 More Fun 品牌">
          <div className="smt-stage0-brand-fallback">
            <span>More Fun</span><strong>磨飯</strong><small>手作 · 輕食</small>
          </div>
        </section>

        <section className="smt-stage0-login-card" aria-labelledby="staff-login-title">
          <header>
            <div><h1 id="staff-login-title">歡迎回來 👋</h1><p>登入以開始今日營運</p></div>
            <div className="smt-stage0-clock"><small>{dateLabel(now)}</small><strong>{timeLabel(now)}</strong></div>
          </header>

          <div className="smt-stage0-login-tabs" role="tablist" aria-label="登入方式">
            <button className="active" type="button" role="tab" aria-selected="true"><span>◎</span><b>員工登入</b><small>使用員工帳號</small></button>
            <button type="button" role="tab" aria-selected="false" disabled title="掃碼登入尚未接入"><span>⌗</span><b>掃碼登入</b><small>使用員工 QR Code</small></button>
          </div>

          <label className="smt-stage0-select">
            <span>員工</span>
            <select value={staffId} onChange={event=>{setStaffId(event.target.value);setPin('');setError('')}}>
              {loginReady.map(row=><option key={row.staffId} value={row.staffId}>{row.name} · {roleLabel(row.role)}</option>)}
            </select>
          </label>

          <div className="smt-stage0-pin-display" aria-label="PIN 輸入">
            <span>PIN</span><b>{pin?Array.from({length:pin.length},()=> '●').join(' '):'輸入 4–8 位數字'}</b>
            {pin?<button type="button" onClick={()=>setPin('')} aria-label="清除 PIN">×</button>:null}
          </div>

          <div className="smt-stage0-keypad" aria-label="數字鍵盤">
            {['1','2','3','4','5','6','7','8','9','⌫','0'].map(key=><button type="button" key={key} onClick={()=>press(key)}>{key}</button>)}
            <button type="button" className="go" disabled={!staffId||pin.length<4} onClick={()=>void submit()} aria-label="登入並繼續">→</button>
          </div>
          {error?<div className="smt-stage0-error" role="alert">{error}</div>:null}
          <p className="smt-stage0-login-help">輸入 PIN 後按 → 進入開更核對</p>
        </section>

        <aside className="smt-stage0-side">
          <section className="smt-stage0-greeting"><span>☀</span><div><h2>早晨！</h2><p>新一天 · 好味道 · 從磨飯開始</p></div></section>
          <section className="smt-stage0-opening-status">
            <div><span>◷</span><div><b>開更狀態</b><small>尚未開更</small></div></div>
            <button type="button" disabled>登入後開更　›</button>
          </section>
          <section className="smt-stage0-goal"><span>◎</span><div><b>今日小目標</b><p>好食物 · 讓更多人開心</p></div><i>More Fun</i></section>
          <section className="smt-stage0-brand-card"><div><b>手作 · 輕食 · 更美好</b><p>用新鮮食材，為每一天加一點快樂。</p></div><span>GOOD FOOD<br/>GOOD DAY</span></section>
          <div className="smt-stage0-tools">
            <button type="button" disabled><span>◉</span><b>需要協助？</b><small>聯絡店長或支援團隊</small></button>
            <button type="button" disabled><span>⚙</span><b>設定</b><small>登入後可使用</small></button>
            <button type="button" disabled className="danger"><span>⏻</span><b>關閉系統</b><small>安全退出</small></button>
          </div>
        </aside>

        <footer className="smt-stage0-footer">
          <div><b>磨飯</b><span>GOOD FOOD GOOD DAY</span></div>
          <div>v2.1.0　|　MFK SMT</div>
          <div><span className={sync.state==='SYNCED'?'ok':'warn'}>●</span> {sync.state==='SYNCED'?'線上':'本地可用'}　⌁</div>
        </footer>
      </div>
    </div>
  </>;
}

export function StaffSessionBadge(){
  const [revision,setRevision]=useState(0);
  useEffect(()=>subscribeStaffSession(()=>setRevision(value=>value+1)),[]);
  void revision;
  const session=readActiveStaffSession();
  if(!session)return null;
  return <button className="clean-staff-session" onClick={logoutStaff} title="切換員工">
    <b>{session.displayName}</b>
    <span>{roleLabel(session.role)} · 登出</span>
  </button>;
}
