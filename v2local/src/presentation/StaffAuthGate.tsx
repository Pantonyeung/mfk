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

function stateLabelForStaff(state:string){
  return state==='SYNCED'?'已同步':state==='CONNECTING'?'連線中':state==='LOCAL_LKG'?'使用本機最後版本':state==='OFFLINE'?'離線':'同步異常';
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
      setError(result.code==='STAFF_PIN_INVALID'?'個人密碼不正確。':'此員工未能登入。');
      setPin('');
    }
  };

  return <>
    <div className="smt-gated-underlay" aria-hidden="true">{children}</div>
    <div className="smt-blocking-overlay">
      <section className="smt-access-card smt-access-card--compact" role="dialog" aria-modal="true" aria-labelledby="staff-login-title">
        <span className="smt-access-section-label">員工權限</span>
        <h2 id="staff-login-title">員工登入</h2>
        <p className="smt-access-lead">選擇員工，再輸入個人密碼。登入後先可以操作收銀端；背景畫面只作參考，未登入前唔可以操作。</p>

        <label className="smt-access-field">
          <span>員工</span>
          <select value={staffId} onChange={event=>{setStaffId(event.target.value);setPin('');setError('')}}>
            {loginReady.map(row=><option key={row.staffId} value={row.staffId}>{row.name} · {roleLabel(row.role)}</option>)}
          </select>
        </label>

        <label className="smt-access-field">
          <span>個人密碼</span>
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

        <button className="smt-access-primary" disabled={!staffId||pin.length<4} onClick={()=>void submit()}>登入收銀端</button>
        <p className="smt-access-help">管理端設定版本 {sync.revision||'—'} · {stateLabelForStaff(sync.state)} · 離線時會使用最後有效設定驗證</p>
      </section>
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
