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

  useEffect(()=>{
    const update=()=>setRevision(value=>value+1);
    const a=subscribeStaffSession(update);
    const b=subscribeSmtAdminConfig(update);
    return()=>{a();b();};
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

  return <main className="smt-access-screen">
    <section className="smt-access-shell">
      <aside className="smt-access-brand-panel">
        <div className="smt-access-brand-mark">磨</div>
        <div className="smt-access-brand-copy">
          <span className="smt-access-kicker">MOREFUNOS SMT</span>
          <h1>員工登入</h1>
          <p>身份、角色同權限由 Admin 已生效版本提供。門店離線時，仍然使用本機最後有效設定驗證。</p>
        </div>
        <div className="smt-access-trust-list">
          <div><span>01</span><p><strong>本機驗證</strong><br/>登入唔依賴每次連雲端。</p></div>
          <div><span>02</span><p><strong>權限跟人</strong><br/>登入後使用該員工目前 Role / Permissions。</p></div>
          <div><span>03</span><p><strong>Session 唔持久</strong><br/>重新開 App 需要重新登入。</p></div>
        </div>
      </aside>
      <section className="smt-access-card smt-access-card--login">
        <span className="smt-access-section-label">STAFF ACCESS</span>
        <h2>選擇員工</h2>
        <p className="smt-access-lead">只有 Admin 已啟用而且已設定 PIN 嘅員工可以登入。</p>

        <label className="smt-access-field">
          <span>員工</span>
          <select value={staffId} onChange={event=>{setStaffId(event.target.value);setPin('');setError('')}}>
            {loginReady.map(row=><option key={row.staffId} value={row.staffId}>{row.name} · {roleLabel(row.role)}</option>)}
          </select>
        </label>

        <label className="smt-access-field">
          <span>PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,8))}
            onKeyDown={event=>{if(event.key==='Enter'&&pin.length>=4)void submit()}}
            placeholder="4–8 位數字"
          />
        </label>

        {error?<div className="smt-access-error" role="alert">{error}</div>:null}

        <button className="smt-access-primary" disabled={!staffId||pin.length<4} onClick={()=>void submit()}>登入 SMT</button>
        <p className="smt-access-help">Admin Config R{sync.revision||'—'} · {sync.state}</p>
      </section>
    </section>
  </main>;
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
