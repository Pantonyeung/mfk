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
    if(/^\\d$/.test(key)){setPin(value=>(value+key).slice(0,8));setError('');}
  };
  const date=new Intl.DateTimeFormat('zh-HK',{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(now);
  const time=new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
  return <>
    <div className="smt-gated-underlay" aria-hidden="true">{children}</div>
    <div className="s0">
      <section className="s0-brand" aria-label="磨飯 More Fun">
        <img className="s0-formal-logo" src="/assets/smt/stage0/stage0-logo.jpg" alt="磨飯 More Fun" onError={event=>event.currentTarget.classList.add('asset-failed')}/>
        <p>好味 · 好心情</p>
        <img className="s0-formal-ip" src="/assets/smt/stage0/stage0-ip-boy.png" alt="" aria-hidden="true" onError={event=>event.currentTarget.classList.add('asset-failed')}/>
      </section>
      <main className="s0-login" aria-labelledby="staff-login-title">
        <header><div><h1 id="staff-login-title">歡迎回來 👋</h1><p>登入以開始今日營運</p></div><div className="s0-clock"><small>{date}</small><b>{time}</b></div></header>
        <div className="s0-login-methods">
          <button className="active" type="button"><b>◎</b><strong>員工登入</strong><small>使用員工帳號</small></button>
          
        </div>
        <label className="s0-staff"><span>員工</span><select value={staffId} onChange={event=>{setStaffId(event.target.value);setPin('');setError('')}}>{loginReady.map(row=><option key={row.staffId} value={row.staffId}>{row.name} · {roleLabel(row.role)}</option>)}</select></label>
        <div className="s0-pin" role="status" aria-label="員工 PIN"><span>PIN</span><strong>{pin?Array.from({length:pin.length},()=> '●').join(' '):'使用下方數字鍵輸入'}</strong>{pin?<button type="button" onClick={()=>setPin('')} aria-label="清除 PIN">×</button>:null}</div>
        <div className="s0-keypad">{['1','2','3','4','5','6','7','8','9','⌫','0'].map(key=><button type="button" key={key} onClick={()=>press(key)}>{key}</button>)}<button className="go" type="button" disabled={!staffId||pin.length<4} onClick={()=>void submit()}>→</button></div>
        {error?<div className="s0-error" role="alert">{error}</div>:null}
        <p className="s0-hint">Admin Config R{sync.revision||'—'} · {sync.state} · 離線可用最後有效設定驗證</p>
      </main>
      <aside className="s0-side">
        <article className="morning"><span>☀</span><div><h2>早晨！</h2><p>新一天 · 好味道 · 從磨飯開始</p></div></article>
        <article className="shift"><div><span>◷</span><div><b>開更狀態</b><small>登入成功後進入開更確認</small></div></div></article>
        <article className="goal"><span>◎</span><div><b>今日小目標</b><p>好食物 · 讓更多人開心</p></div><i>More Fun</i></article>
        <article className="brand-card"><div><b>手作 · 輕食 · 更美好</b><p>用新鮮食材，為每一天加一點快樂。</p></div></article>
        
      </aside>
      <footer className="s0-footer"><div><b>磨飯</b><span>GOOD FOOD GOOD DAY</span></div><span>v2.1.0　|　MFK SMT</span><span>Admin Config R{sync.revision||'—'} · {sync.state}</span></footer>
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
