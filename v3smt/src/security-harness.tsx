import {useQuery} from '@tanstack/react-query';
import {useState,type FormEvent} from 'react';
import type {MfpSecurityPort} from './security-port.ts';

function errorCode(error:unknown){return error instanceof Error?error.message:'MFP_SECURITY_ACTION_FAILED';}

export function MfpSecurityHarness({security}:{security:MfpSecurityPort}){
  const [staffId,setStaffId]=useState('');
  const [proof,setProof]=useState('');
  const [feedback,setFeedback]=useState('');
  const [,render]=useState(0);
  const snapshot=security.getSnapshot();
  const deviceQuery=useQuery({
    queryKey:['mfp-security','device'],
    queryFn:async()=>{await security.loadDevice();return security.refreshDeviceAuthorization();},
    refetchInterval:false,
    refetchOnWindowFocus:false,
    retry:false,
  });
  const sessionQuery=useQuery({
    queryKey:['mfp-security','session',snapshot.session?.staffSessionRef??'none'],
    queryFn:()=>security.refreshStaffSession(),
    enabled:Boolean(snapshot.session),
    refetchInterval:false,
    refetchOnWindowFocus:false,
    retry:false,
  });
  const current=security.getSnapshot();
  const device=current.device??deviceQuery.data??null;
  const queryError=deviceQuery.error??sessionQuery.error;

  const login=async(event:FormEvent)=>{
    event.preventDefault();
    const submittedProof=proof;
    setProof('');
    try{
      const result=await security.loginStaff(staffId,submittedProof);
      setFeedback(result.state==='AUTHENTICATED'?'AUTHENTICATED':result.state);
    }catch(error){setFeedback(errorCode(error));}
    render(value=>value+1);
  };

  const logout=async()=>{
    try{await security.logoutStaff();setFeedback('UNAUTHORIZED');}
    catch(error){setFeedback(errorCode(error));}
    render(value=>value+1);
  };

  const checkPermission=()=>{
    try{security.precheckAction('ORDER_CREATE');setFeedback('ORDER_CREATE · ALLOWED');}
    catch(error){setFeedback('ORDER_CREATE · '+errorCode(error));}
  };

  return <section className="mfp-security" aria-labelledby="mfp-security-title">
    <div className="mfp-security-heading">
      <div><small>A2 VERIFICATION HARNESS</small><h2 id="mfp-security-title">Device + Staff Security</h2></div>
      <button type="button" onClick={()=>void deviceQuery.refetch()}>Refresh Authorization</button>
    </div>
    <div className="mfp-security-grid">
      <article>
        <h3>Device Identity / Status</h3>
        <dl>
          <div><dt>Device</dt><dd>{device?.deviceId??'LOADING'}</dd></div>
          <div><dt>Installation</dt><dd>{device?.installationId??'LOADING'}</dd></div>
          <div><dt>Class</dt><dd>{device?.deviceClass??'UNKNOWN'}</dd></div>
          <div><dt>Status</dt><dd>{device?.status??'UNKNOWN'}</dd></div>
        </dl>
      </article>
      <article>
        <h3>Staff Login</h3>
        <form onSubmit={login}>
          <label>Staff ID<input value={staffId} onChange={event=>setStaffId(event.target.value)} autoComplete="username"/></label>
          <label>PIN / Proof<input type="password" value={proof} onChange={event=>setProof(event.target.value)} autoComplete="current-password"/></label>
          <button type="submit" disabled={device?.status!=='AUTHORIZED'}>Login</button>
        </form>
      </article>
      <article>
        <h3>Current Staff</h3>
        <strong>{current.session?.displayName??'未登入'}</strong>
        <p>{current.session?`${current.session.role} · ${current.session.scope}`:'Formal session required'}</p>
        <p>Session · {current.sessionState}</p>
        <p>Expires · {current.session?.expiresAt??'—'}</p>
        <div className="mfp-security-actions">
          <button type="button" disabled={!current.session} onClick={()=>void sessionQuery.refetch()}>Readback</button>
          <button type="button" disabled={!current.session} onClick={()=>void logout()}>Logout</button>
        </div>
      </article>
      <article>
        <h3>Permission Check</h3>
        <p>Action-time UX precheck; Store Kernel admission remains definitive.</p>
        <button type="button" onClick={checkPermission}>Check ORDER_CREATE</button>
        <output aria-live="polite">{feedback||(queryError?errorCode(queryError):'')}</output>
      </article>
    </div>
  </section>;
}
