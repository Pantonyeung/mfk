import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {
  cashOpeningRequired,
  confirmCashOpening,
  readCurrentCashOpeningState,
  subscribeCashOpening,
} from '../runtime/cash-opening.ts';
import {subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';
import {subscribeStaffSession} from '../runtime/staff-auth.ts';

const money=(minor:number)=>'$'+(Math.max(0,minor)/100).toFixed(2);

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

  const confirm=()=>{
    if(!valid){setMessage('請確認今日開更現金。');return;}
    confirmCashOpening({amountMinor,note});
  };

  return <>
    <div className="smt-gated-underlay" aria-hidden="true">{children}</div>
    <div className="smt-blocking-overlay">
      <section className="smt-opening-card" role="dialog" aria-modal="true" aria-labelledby="cash-opening-title">
        <header>
          <div>
            <span className="smt-access-section-label">DAILY CASH OPENING</span>
            <h2 id="cash-opening-title">確認今日開更現金</h2>
            <p>每日只確認一次。確認後會作為今日現金報表同日結嘅 opening float。</p>
          </div>
          <strong>{state.businessDate}</strong>
        </header>

        {suggestion?<section className="smt-opening-provenance">
          <span>昨日留櫃記錄</span>
          <div>
            <article><small>昨日實點</small><b>{money(suggestion.previousCountedCashMinor)}</b></article>
            <article><small>昨日取走</small><b>− {money(suggestion.previousCashRemovedMinor)}</b></article>
            <article className="retained"><small>昨日留櫃</small><b>{money(suggestion.amountMinor)}</b></article>
          </div>
          <p>所以今日建議開更現金係 <strong>{money(suggestion.amountMinor)}</strong>。如果實際唔同，可以直接更改。</p>
        </section>:<section className="smt-opening-provenance is-empty">
          <span>未有可沿用留櫃記錄</span>
          <p>舊日結如果冇明確記錄「取走現金／留櫃現金」，系統唔會估數。請輸入今日實際開更現金。</p>
        </section>}

        <label className="smt-access-field">
          <span>今日開更現金</span>
          <div className="smt-money-input"><b>$</b><input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value.replace(/[^0-9.]/g,''))} placeholder="0.00"/></div>
        </label>
        {suggestion&&changed?<p className="smt-opening-change">已由建議 {money(suggestion.amountMinor)} 改為 {money(amountMinor)}</p>:null}

        <label className="smt-access-field">
          <span>備註（選填）</span>
          <input value={note} maxLength={80} onChange={event=>setNote(event.target.value)} placeholder="例如：補回散紙、昨晚額外取走"/>
        </label>

        {message?<div className="smt-access-error" role="alert">{message}</div>:null}
        <button className="smt-access-primary" disabled={!valid} onClick={confirm}>確認今日開更現金 {valid?'· '+money(amountMinor):''}</button>
        <p className="smt-access-help">確認後今日唔會再彈出；重新開 App 仍然讀返同一個 Business Date 記錄。</p>
      </section>
    </div>
  </>;
}
