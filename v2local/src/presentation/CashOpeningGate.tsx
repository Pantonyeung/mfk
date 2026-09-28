import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {
  cashOpeningRequired,
  confirmCashOpening,
  readCurrentCashOpeningState,
  subscribeCashOpening,
} from '../runtime/cash-opening.ts';
import {readSmtAdminSyncStatus,subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';
import {readActiveStaffSession,subscribeStaffSession} from '../runtime/staff-auth.ts';

const money=(minor:number)=>'HK$ '+(Math.max(0,minor)/100).toFixed(2);

export function CashOpeningGate({children}:{children:ReactNode}){
  const [revision,setRevision]=useState(0);
  const state=useMemo(()=>{void revision;return readCurrentCashOpeningState();},[revision]);
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>{
    const update=()=>setRevision(value=>value+1);
    const a=subscribeCashOpening(update);
    const b=subscribeStaffSession(update);
    const c=subscribeSmtAdminConfig(update);
    return()=>{a();b();c();};
  },[]);

  useEffect(()=>{
    if(state.opening)return;
    if(state.suggestion)setAmount((state.suggestion.amountMinor/100).toFixed(2));
    else setAmount('');
    setNote('');
    setMessage('');
  },[state.businessDate,state.opening?.id,state.suggestion?.sourceCloseId]);

  if(!cashOpeningRequired())return <>{children}</>;

  const amountMinor=Math.max(0,Math.round(Number(amount||0)*100));
  const suggestion=state.suggestion;
  const changed=suggestion?amountMinor!==suggestion.amountMinor:false;
  const valid=amount.trim()!==''&&Number.isFinite(Number(amount))&&Number(amount)>=0;
  const session=readActiveStaffSession();
  const sync=readSmtAdminSyncStatus();

  const confirm=()=>{
    if(!valid){setMessage('請確認今日開更現金。');return;}
    confirmCashOpening({amountMinor,note});
  };

  return <>
    <div className="smt-gated-underlay" aria-hidden="true">{children}</div>
    <div className="smt-stage0-overlay">
      <div className="smt-stage0-shell smt-stage0-shell--opening">
        <section className="smt-stage0-brand" aria-label="磨飯 More Fun 品牌">
          <div className="smt-stage0-brand-fallback"><span>More Fun</span><strong>磨飯</strong><small>手作 · 輕食</small></div>
        </section>

        <section className="smt-stage0-opening-card" aria-labelledby="cash-opening-title">
          <header><div><span>今日開更</span><h1 id="cash-opening-title">確認開櫃現金</h1><p>{session?.displayName??'員工'}，請核對上一營業日留櫃，再確認今日實際開櫃金額。</p></div><strong>{state.businessDate}</strong></header>

          {suggestion?<section className="smt-stage0-retained">
            <div><small>上一營業日實點</small><b>{money(suggestion.previousCountedCashMinor)}</b></div>
            <div><small>上一營業日取走</small><b>− {money(suggestion.previousCashRemovedMinor)}</b></div>
            <div className="primary"><small>上一營業日留櫃</small><b>{money(suggestion.amountMinor)}</b></div>
          </section>:<section className="smt-stage0-no-retained"><b>未有可沿用留櫃記錄</b><p>系統唔會估數，請輸入今日實際開櫃現金。</p></section>}

          <label className="smt-stage0-money"><span>今日開櫃現金</span><div><b>HK$</b><input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value.replace(/[^0-9.]/g,''))} placeholder="0.00"/></div></label>
          {suggestion&&changed?<p className="smt-stage0-change">已由建議 {money(suggestion.amountMinor)} 改為 {money(amountMinor)}</p>:null}
          <label className="smt-stage0-note"><span>備註（選填）</span><input value={note} maxLength={80} onChange={event=>setNote(event.target.value)} placeholder="例如：補回散紙、昨晚額外取走"/></label>
          {message?<div className="smt-stage0-error" role="alert">{message}</div>:null}
          <button className="smt-stage0-confirm" disabled={!valid} onClick={confirm}>確認並開更　›</button>
          <p className="smt-stage0-login-help">確認後直接進入點單頁；同一 Business Date 不會重複開更。</p>
        </section>

        <aside className="smt-stage0-side">
          <section className="smt-stage0-greeting"><span>☀</span><div><h2>準備開工</h2><p>核對完成後直接進入點單</p></div></section>
          <section className="smt-stage0-opening-status ready"><div><span>◷</span><div><b>開更狀態</b><small>等待確認</small></div></div><strong>{valid?money(amountMinor):'—'}</strong></section>
          <section className="smt-stage0-goal"><span>◎</span><div><b>上一日留櫃 Readback</b><p>{suggestion?money(suggestion.amountMinor):'未有可沿用記錄'}</p></div><i>More Fun</i></section>
          <section className="smt-stage0-brand-card"><div><b>手作 · 輕食 · 更美好</b><p>開更只確認一次，正式記錄會留喺本機。</p></div><span>GOOD FOOD<br/>GOOD DAY</span></section>
          <div className="smt-stage0-system-strip">
            <div><span>●</span><b>Admin Config</b><small>R{sync.revision||'—'} · {sync.state}</small></div>
            <div><span>●</span><b>本地資料</b><small>可讀取</small></div>
            <div><span>●</span><b>下一步</b><small>點單</small></div>
          </div>
        </aside>

        <footer className="smt-stage0-footer">
          <div><b>磨飯</b><span>GOOD FOOD GOOD DAY</span></div>
          <div>v2.1.0　|　MFK SMT</div>
          <div><span className={sync.state==='READY'?'ok':'warn'}>●</span> {sync.state==='READY'?'線上':'本地可用'}　⌁</div>
        </footer>
      </div>
    </div>
  </>;
}
