import type {SmmPendingIntent} from './product-types';
import {smmStage5RepairPath,smmStage5SubmissionShortRef} from './stage5-submit.mjs';

export type SmmStage5State='DRAFT'|'PENDING'|'CONFIRMED'|'REJECTED'|'UNKNOWN';

export interface SmmStage5Session{
  readonly intent:SmmPendingIntent;
  readonly state:SmmStage5State;
  readonly displayCode?:string;
  readonly message?:string;
}

export function Stage5SubmitView({
  session,
  submitting,
  reading,
  onReadback,
  onRepair,
  onDone,
}:{
  session:SmmStage5Session;
  submitting:boolean;
  reading:boolean;
  onReadback:()=>void;
  onRepair:()=>void;
  onDone:()=>void;
}){
  const shortRef=smmStage5SubmissionShortRef(session.intent.submissionId);
  const repair=smmStage5RepairPath(session.message);

  return <div className="overlay stage5-overlay">
    <section className="stage5-sheet" role="dialog" aria-modal="true" aria-label="正式提交狀態" data-stage5-state={session.state}>
      <header className="stage5-header">
        <span>第 5 階段 · 正式提交</span>
        <h2>{
          session.state==='CONFIRMED'?'訂單已確認':
          session.state==='REJECTED'?'訂單未被接受':
          session.state==='UNKNOWN'?'提交結果未明':
          session.state==='PENDING'?'正在正式提交':
          '準備正式提交'
        }</h2>
        <p>{
          session.state==='CONFIRMED'?'SMT 已建立正式訂單。':
          session.state==='REJECTED'?'今次結果已確定，請按下方路徑修正。':
          session.state==='UNKNOWN'?'只會查詢原本提交身份；唔會建立第二張單。':
          '同一個提交身份只會送出一次；請勿重複點擊。'
        }</p>
      </header>

      {session.state==='DRAFT'||session.state==='PENDING'?<section className="stage5-pending" aria-live="polite">
        <div className="stage5-orbit" aria-hidden="true"><i/><i/><i/></div>
        <span>{session.state==='PENDING'?'PENDING':'DRAFT'}</span>
        <strong>{session.state==='PENDING'?'等待 SMT 正式確認':'正在鎖定提交身份'}</strong>
        <div className="stage5-short-ref"><small>提交參考</small><b>{shortRef}</b></div>
        <p>{session.message??'正式結果未返；購物草稿仍然保留。'}</p>
        {submitting?<small>同一 submission identity 已鎖定。</small>:null}
      </section>:null}

      {session.state==='CONFIRMED'?<section className="stage5-confirmed" aria-live="polite">
        <div className="stage5-check" aria-hidden="true">✓</div>
        <span>CONFIRMED</span>
        <small>流水號</small>
        <strong className="stage5-display-code">{session.displayCode}</strong>
        <p>前線只顯示正式流水號；技術識別碼不會出現。</p>
        <button className="primary stage5-primary" type="button" onClick={onDone}>完成</button>
      </section>:null}

      {session.state==='REJECTED'?<section className="stage5-rejected" role="alert">
        <span>REJECTED</span>
        <h3>{repair.title}</h3>
        <p>{repair.detail}</p>
        {session.message?<small>{session.message}</small>:null}
        <button className="primary stage5-primary" type="button" onClick={onRepair}>返回修改</button>
      </section>:null}

      {session.state==='UNKNOWN'?<section className="stage5-unknown" role="alert">
        <span>UNKNOWN</span>
        <h3>只確認原本結果</h3>
        <p>{session.message??'原本要求可能已到達 SMT；而家只讀回同一個 submission identity。'}</p>
        <button className="primary stage5-primary" type="button" disabled={reading} onClick={onReadback}>
          {reading?'正在確認原結果':'重新確認結果'}
        </button>
      </section>:null}
    </section>
  </div>;
}
