import type {SmmConnectionState,SmmPendingIntent} from './product-types';
import {
  smmStage5ConfirmedDisplayCode,
  smmStage5DisplaySuffix,
  smmStage5RepairPath,
  smmStage5SharedState,
  smmStage5SubmissionShortRef,
} from './stage5-submit.mjs';

export type SmmStage5State='DRAFT'|'PENDING'|'CONFIRMED'|'REJECTED'|'UNKNOWN';

export interface SmmStage5Session{
  readonly intent:SmmPendingIntent;
  readonly state:SmmStage5State;
  readonly displayCode?:string;
  readonly message?:string;
}

function Stage5SharedState({connection}:{connection:SmmConnectionState}){
  const shared=smmStage5SharedState(connection,true);
  if(!shared||shared.kind==='EMPTY')return null;
  return <section className={`stage5-shared stage5-shared-${shared.kind.toLowerCase()}`} data-stage5-shared-state={shared.kind} role="status">
    <span className="stage5-shared-icon" aria-hidden="true">{shared.icon}</span>
    <div><strong>{shared.label}</strong><small>{shared.detail}</small></div>
  </section>;
}

function Stage5TopBar({title,onBack}:{title:string;onBack:()=>void}){
  return <header className="stage5-topbar">
    <button type="button" className="stage5-back" onClick={onBack} aria-label="返回">‹</button>
    <strong>{title}</strong>
    <span className="stage5-topbar-spacer" aria-hidden="true"/>
  </header>;
}

const STAGE5_ART=Object.freeze({
  submitting:'/brand/stage5/stage5-submitting.webp',
  pending:'/brand/stage5/stage5-pending.webp',
  confirmed:'/brand/stage5/stage5-confirmed.webp',
  rejected:'/brand/stage5/stage5-rejected.webp',
  unknown:'/brand/stage5/stage5-unknown.webp',
});

function Stage5Artwork({name,alt}:{name:keyof typeof STAGE5_ART;alt:string}){
  return <img className={`stage5-art stage5-art-${name}`} src={STAGE5_ART[name]} alt={alt}/>;
}

function Stage5Submitting({session}:{session:SmmStage5Session}){
  const shortRef=smmStage5SubmissionShortRef(session.intent.submissionId);
  return <section className="stage5-state stage5-submitting" data-stage5-visual="5.2_SUBMITTING">
    <p className="stage5-kicker">正在處理您的訂單...</p>
    <Stage5Artwork name="submitting" alt="磨飯角色正在處理訂單"/>
    <div className="stage5-progress-list" aria-live="polite">
      <div className="done"><i>✓</i><span>驗證訂單內容</span><small>已完成</small></div>
      <div className="done"><i>✓</i><span>鎖定提交身份</span><small>已完成</small></div>
      <div className="active"><i/><span>提交至系統</span><small>進行中</small></div>
      <div className="waiting"><i/><span>等待確認結果</span><small>下一步</small></div>
    </div>
    <div className="stage5-info-note"><b>i</b><span>請勿關閉應用程式</span></div>
    <small className="stage5-foot-ref">提交參考 {shortRef}</small>
  </section>;
}

function Stage5Pending({session,onPendingDetails,onHome}:{session:SmmStage5Session;onPendingDetails:()=>void;onHome:()=>void}){
  const shortRef=smmStage5SubmissionShortRef(session.intent.submissionId);
  const submittedAt=new Date(session.intent.updatedAt);
  const time=Number.isFinite(submittedAt.getTime())
    ?submittedAt.toLocaleString('zh-HK',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
    :'剛剛';
  return <section className="stage5-state stage5-pending" data-stage5-visual="5.3_PENDING">
    <span className="stage5-badge pending">等待門店確認</span>
    <Stage5Artwork name="pending" alt="訂單已提交"/>
    <h1>訂單已提交！</h1>
    <p>我們已收到您的訂單，<br/>正在等待門店確認。</p>
    <div className="stage5-fact-card">
      <div><span>提交時間</span><strong>{time}</strong></div>
      <div><span>來源</span><strong>SMM</strong></div>
      <div><span>訂單號</span><strong>{shortRef}</strong></div>
    </div>
    <div className="stage5-actions">
      <button className="primary stage5-primary" type="button" onClick={onPendingDetails}>查看訂單詳情</button>
      <button className="stage5-secondary" type="button" onClick={onHome}>返回主頁</button>
    </div>
  </section>;
}

function Stage5Confirmed({session,onViewOrder,onContinue}:{session:SmmStage5Session;onViewOrder:()=>void;onContinue:()=>void}){
  const displayCode=smmStage5ConfirmedDisplayCode(session.displayCode)??'—';
  const suffix=smmStage5DisplaySuffix(displayCode);
  const target=session.intent.checkout.diningTarget;
  const dining=session.intent.checkout.serviceMode==='DINE_IN'
    ?target?.kind==='TABLE'?`${target.tableId??'餐枱'}（堂食）`:'輪候（堂食）'
    :'外賣（自取）';
  return <section className="stage5-state stage5-confirmed" data-stage5-visual="5.4_CONFIRMED">
    <span className="stage5-badge confirmed">已確認</span>
    <Stage5Artwork name="confirmed" alt="訂單已確認"/>
    <h1>訂單已確認！</h1>
    <p>餐廳已開始準備您的餐點。<br/>感謝您的訂購！</p>
    <div className="stage5-confirm-card">
      <div className="stage5-code-row"><span>取餐碼</span><strong>{displayCode}</strong></div>
      <div><span>顯示號</span><strong>{suffix}</strong></div>
      <div><span>{session.intent.checkout.serviceMode==='DINE_IN'?'餐枱':'方式'}</span><strong>{dining}</strong></div>
    </div>
    <div className="stage5-actions">
      <button className="primary stage5-primary" type="button" onClick={onViewOrder}>查看詳情</button>
      <button className="stage5-secondary" type="button" onClick={onContinue}>繼續點單</button>
    </div>
  </section>;
}

function Stage5Rejected({session,onRepair,onBack}:{session:SmmStage5Session;onRepair:()=>void;onBack:()=>void}){
  const repair=smmStage5RepairPath(session.message);
  return <section className="stage5-state stage5-rejected" data-stage5-visual="5.5_REJECTED">
    <Stage5Artwork name="rejected" alt="訂單未能提交"/>
    <h1>未能提交訂單</h1>
    <p>由於餐單已更新，請返回檢查。</p>
    <div className="stage5-reason-card" role="alert">
      <strong>原因</strong>
      <ul><li>{repair.title}</li><li>{repair.detail}</li></ul>
    </div>
    <div className="stage5-actions">
      <button className="stage5-danger" type="button" onClick={onRepair}>返回修改</button>
      <button className="stage5-secondary" type="button" onClick={onBack}>查看餐單版本</button>
    </div>
  </section>;
}

function Stage5Unknown({session,reading,onReadback,onBack}:{session:SmmStage5Session;reading:boolean;onReadback:()=>void;onBack:()=>void}){
  return <section className="stage5-state stage5-unknown" data-stage5-visual="5.6_UNKNOWN">
    <span className="stage5-badge unknown">結果未確認</span>
    <Stage5Artwork name="unknown" alt="提交結果未確認"/>
    <h1>提交結果未確認</h1>
    <p>請稍候，或重新確認結果。</p>
    <div className="stage5-recommend-card" role="alert">
      <strong>建議操作</strong>
      <button className="primary stage5-primary" type="button" disabled={reading} onClick={onReadback}>
        {reading?'正在確認原結果':'重新確認結果'}
      </button>
      <button className="stage5-secondary" type="button" disabled={reading} onClick={onBack}>聯絡店員</button>
    </div>
    <button className="stage5-text-action" type="button" disabled={reading} onClick={onBack}>查看處理紀錄</button>
  </section>;
}

export function Stage5SubmitView({
  session,
  submitting,
  reading,
  connection,
  onReadback,
  onRepair,
  onBack,
  onViewOrder,
  onContinue,
  onPendingDetails,
  onHome,
}:{
  session:SmmStage5Session;
  submitting:boolean;
  reading:boolean;
  connection:SmmConnectionState;
  onReadback:()=>void;
  onRepair:()=>void;
  onBack:()=>void;
  onViewOrder:()=>void;
  onContinue:()=>void;
  onPendingDetails:()=>void;
  onHome:()=>void;
}){
  const title=
    session.state==='DRAFT'&&submitting?'提交中':
    session.state==='DRAFT'?'尚未送出':
    session.state==='PENDING'?'已提交':
    session.state==='CONFIRMED'?'訂單確認':
    session.state==='REJECTED'?'提交失敗':
    '狀態未明';
  const sharedState=smmStage5SharedState(connection,true);

  return <div
    className="stage5-screen"
    data-stage5-state={session.state}
    data-stage5-transport-state={sharedState?.kind??'READY'}
    aria-label="正式提交訂單"
  >
    <Stage5TopBar title={title} onBack={onBack}/>
    <Stage5SharedState connection={connection}/>
    <main className="stage5-body">
      {session.state==='DRAFT'&&submitting?<Stage5Submitting session={session}/>:null}
      {session.state==='PENDING'?<Stage5Pending session={session} onPendingDetails={onPendingDetails} onHome={onHome}/>:null}
      {session.state==='CONFIRMED'?<Stage5Confirmed session={session} onViewOrder={onViewOrder} onContinue={onContinue}/>:null}
      {session.state==='REJECTED'?<Stage5Rejected session={session} onRepair={onRepair} onBack={onBack}/>:null}
      {session.state==='UNKNOWN'?<Stage5Unknown session={session} reading={reading} onReadback={onReadback} onBack={onBack}/>:null}
    </main>
  </div>;
}
