import {useState} from 'react';
import {ActionFeedback,CompletedStep,DisabledReason,GuidedProgress,StatusTag} from '../../presentation/SmtUi.tsx';
import type {CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './checkout-workspace-model.ts';
import './checkout-workspace.css';

const keypad=['7','8','9','4','5','6','1','2','3','00','0','.'] as const;
const channelIcon:Record<string,string>={
  'walk-in':'店','whatsapp':'話','morefun-app':'磨','keeta':'K','foodpanda':'F'
};
const tenderIcon:Record<string,string>={
  CASH:'現',FPS:'轉',PAYME:'P',ALIPAY:'支',WECHAT:'微',COMBO:'合'
};

export function CheckoutWorkspace({view,actions}:{view:CheckoutWorkspaceViewModel;actions:CheckoutWorkspaceActions}){
  const [step,setStep]=useState(1);
  const processing=view.paymentState==='processing';
  const success=view.paymentState==='success';
  const failure=view.paymentState==='failure';
  const selectedChannel=view.channels.find(channel=>channel.selected)??view.channels[0];
  const totalSteps=4;
  const stepLabel=step===1?'訂單來源':step===2?'付款方式':step===3?'收款金額':'核對並提交';
  const amountReady=view.confirmEnabled;
  const amountReason=view.validationMessage??(!view.order.lines.length?'訂單未有商品，請返回點單。':view.cashEntryVisible?'請輸入足夠收款金額。':'請完成目前付款資料。');

  return <main className="checkout-workspace" aria-label="結帳">
    <aside className="checkout-order-panel">
      <header className="checkout-order-title">
        <div><span className="checkout-eyebrow">訂單核對</span><h1>結帳</h1><p>左邊餐點會保持可見；右邊每次只處理一步。</p></div>
        <strong>#{view.order.orderId}</strong>
      </header>

      <section className="checkout-order-count"><b>餐點明細</b><span>共 {view.order.lines.reduce((sum,line)=>sum+line.quantity,0)} 件</span></section>
      <div className="checkout-order-lines">
        {view.order.lines.map((line,index)=><article key={line.id}>
          <span className="checkout-line-thumb">{index+1}</span>
          <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:<small>一般設定</small>}</div>
          <span>×{line.quantity}</span>
          <strong>{line.lineTotalLabel}</strong>
        </article>)}
      </div>

      <section className="checkout-order-pricing">
        <div><span>小計</span><b>{view.order.subtotalLabel}</b></div>
        <div><span>包裝</span><b>{view.order.packagingLabel}</b></div>
        <div><span>折扣</span><b>{view.order.discountLabel}</b></div>
        <div className="total"><span>應付總額</span><strong>{view.order.totalLabel}</strong></div>
      </section>

      <footer className="checkout-order-footer">
        <button type="button" onClick={actions.onBack}>← 返回點單修改</button>
        <p>訂單未提交前，可以返回修改商品。</p>
      </footer>
    </aside>

    <section className="checkout-flow">
      <header className="checkout-flow-header">
        <div><span>安全結帳流程</span><h2>{stepLabel}</h2><p>{step===1?'先確認訂單由邊個渠道建立。':step===2?'選擇客人實際使用嘅付款方式。':step===3?'只輸入目前付款方式需要嘅資料。':'最後核對一次；提交後會建立正式本機訂單。'}</p></div>
        <GuidedProgress current={step} total={totalSteps} label={stepLabel}/>
      </header>

      <div className="checkout-completed-steps">
        {step>1?<CompletedStep label="訂單來源" summary={selectedChannel?.label??'未選擇'} onEdit={()=>setStep(1)}/>:null}
        {step>2?<CompletedStep label="付款方式" summary={view.selectedMethodLabel} onEdit={()=>setStep(2)}/>:null}
        {step>3?<CompletedStep label="收款金額" summary={`${view.amount.receivedLabel} · 找續 ${view.amount.changeLabel}`} onEdit={()=>setStep(3)}/>:null}
      </div>

      {step===1?<section className="checkout-step checkout-current-step" aria-labelledby="checkout-source-title">
        <header><div><small>第 1 步</small><h3 id="checkout-source-title">呢張單來自邊度？</h3></div><StatusTag tone="info">必須確認</StatusTag></header>
        <div className="checkout-source-grid">
          {view.channels.map(channel=><button type="button" key={channel.id} aria-pressed={channel.selected} className={channel.selected?'active':''} onClick={()=>actions.onSelectChannel(channel.id)}>
            <i aria-hidden="true">{channelIcon[channel.id]??'•'}</i><b>{channel.label}</b><span aria-hidden="true">{channel.selected?'✓':''}</span>
          </button>)}
        </div>
        {(view.channelFields.showCustomerPhone||view.channelFields.showPlatformFields)?<div className="checkout-channel-fields">
          {view.channelFields.showCustomerPhone?<label><span>客戶電話 <small>選填</small></span><input inputMode="tel" value={view.channelFields.customerPhone} onChange={event=>actions.onChangeCustomerPhone(event.target.value)} placeholder="輸入電話／WhatsApp"/></label>:null}
          {view.channelFields.showPlatformFields?<>
            <label><span>平台取餐碼 <small>選填</small></span><input value={view.channelFields.pickupCode} onChange={event=>actions.onChangePickupCode(event.target.value)} placeholder="例如 A123"/></label>
            <label><span>平台訂單號碼 <small>選填</small></span><input value={view.channelFields.platformOrderNo} onChange={event=>actions.onChangePlatformOrderNo(event.target.value)} placeholder="輸入平台單號"/></label>
          </>:null}
        </div>:null}
        <footer className="checkout-step-footer"><span>已選：<b>{selectedChannel?.label}</b></span><button type="button" onClick={()=>setStep(2)}>繼續：選付款方式</button></footer>
      </section>:null}

      {step===2?<section className="checkout-step checkout-current-step" aria-labelledby="checkout-method-title">
        <header><div><small>第 2 步</small><h3 id="checkout-method-title">客人用咩方式付款？</h3></div><StatusTag tone="info">選一項</StatusTag></header>
        <div className="checkout-method-grid">
          {view.methods.map(method=><button type="button" key={method.id} disabled={!method.enabled||processing||success} aria-pressed={method.selected} className={method.selected?'active':''} onClick={()=>actions.onSelectMethod(method.id)}>
            <i aria-hidden="true">{tenderIcon[method.id]??'•'}</i><b>{method.label}</b><span aria-hidden="true">{method.selected?'✓':''}</span>
          </button>)}
        </div>
        <footer className="checkout-step-footer"><button type="button" className="secondary" onClick={()=>setStep(1)}>上一步</button><span>已選：<b>{view.selectedMethodLabel}</b></span><button type="button" onClick={()=>setStep(3)}>繼續：輸入金額</button></footer>
      </section>:null}

      {step===3?<section className="checkout-step checkout-current-step" aria-labelledby="checkout-amount-title">
        <header><div><small>第 3 步</small><h3 id="checkout-amount-title">完成收款資料</h3></div><StatusTag tone={amountReady?'success':'warning'}>{amountReady?'金額已足夠':'尚未完成'}</StatusTag></header>
        <div className="checkout-settlement-grid">
          <article><span>應付金額</span><strong>{view.amount.dueLabel}</strong></article>
          <article><span>已收金額</span><strong>{view.amount.receivedLabel}</strong></article>
          <article className="change"><span>找續金額</span><strong>{view.amount.changeLabel}</strong></article>
        </div>

        {view.comboMode?<div className="checkout-split-grid">
          {view.splitTenders.map(tender=><label key={tender.id}><span>{tender.label}</span><input inputMode="decimal" value={tender.amount} onChange={event=>actions.onChangeSplitAmount(tender.id,event.target.value)} placeholder="0.00"/></label>)}
        </div>:null}

        {view.cashEntryVisible?<div className="checkout-entry-grid">
          <div className="checkout-keypad" aria-label="現金收款鍵盤">
            {keypad.map(key=><button type="button" key={key} disabled={processing||success} onClick={()=>actions.onCashKey(key==='.'?'00':key)}>{key}</button>)}
          </div>
          <div className="checkout-entry-side">
            <div className="checkout-cash-value"><span>實收現金</span><strong>{view.cashInput||'0'}</strong></div>
            <button type="button" className="checkout-exact" onClick={actions.onExactCash} disabled={!view.exactCashEnabled||processing||success}>剛好收取 {view.amount.dueLabel}</button>
            <div className="checkout-quick-cash">{[50,100,200,500].map(amount=><button type="button" key={amount} disabled={processing||success} onClick={()=>actions.onQuickCash(amount)}>+${amount}</button>)}</div>
            <button type="button" className="checkout-delete" onClick={()=>actions.onCashKey('⌫')} disabled={processing||success}>刪除最後一位</button>
          </div>
        </div>:view.comboMode?null:<div className="checkout-noncash-summary"><span aria-hidden="true">✓</span><div><b>{view.selectedMethodLabel}</b><p>目前付款方式毋須輸入現金金額。</p></div></div>}

        {!amountReady?<DisabledReason>{amountReason}</DisabledReason>:null}
        <footer className="checkout-step-footer"><button type="button" className="secondary" onClick={()=>setStep(2)}>上一步</button><span>{amountReady?'可以進入最後核對':'完成金額後先可以繼續'}</span><button type="button" disabled={!amountReady} onClick={()=>setStep(4)}>繼續：最後核對</button></footer>
      </section>:null}

      {step===4?<section className="checkout-step checkout-current-step checkout-review" aria-labelledby="checkout-review-title">
        <header><div><small>第 4 步</small><h3 id="checkout-review-title">確認後建立訂單</h3></div><StatusTag tone={success?'success':failure?'danger':processing?'warning':'info'}>{success?'訂單已建立':failure?'未完成':processing?'處理中':'等待確認'}</StatusTag></header>

        {!processing&&!success&&!failure?<>
          <div className="checkout-review-grid">
            <p><span>訂單來源</span><b>{selectedChannel?.label}</b></p>
            <p><span>付款方式</span><b>{view.selectedMethodLabel}</b></p>
            <p><span>應付金額</span><b>{view.amount.dueLabel}</b></p>
            <p><span>實收／找續</span><b>{view.amount.receivedLabel} / {view.amount.changeLabel}</b></p>
          </div>
          <ActionFeedback tone="info" title="確認後會建立正式本機訂單" detail="訂單建立成功後，系統會另外顯示打印結果；訂單成功不代表打印一定成功。"/>
        </>:null}

        {processing?<ActionFeedback tone="warning" title="正在建立訂單" detail="請勿重複操作。完成前會保持提交鎖定。"/>:null}
        {failure?<ActionFeedback tone="danger" title="訂單未完成" detail={view.failureMessage??'目前未建立訂單。請重試同一操作，或返回檢查付款資料。'} actionLabel="重試同一操作" onAction={actions.onRetry}/>:null}
        {success&&view.completionReview?<section className="checkout-completion" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span><div><small>訂單完成</small><h3>#{view.completionReview.displayOrderCode}</h3><p>{view.completionReview.tenderLabel} · {view.completionReview.dueLabel}</p></div>
        </section>:null}
        {view.statusMessage?<ActionFeedback tone={success?'info':'warning'} title={success?'打印狀態':'處理狀態'} detail={view.statusMessage}/>:null}

        <footer className="checkout-step-footer">
          {!processing&&!success?<button type="button" className="secondary" onClick={()=>setStep(3)}>上一步</button>:<span/>}
          <span>{processing?'正在處理，請稍候。':success?'可以返回開始下一張訂單。':'請核對左邊餐點同以上付款資料。'}</span>
          {success?<button type="button" onClick={actions.onDone}>完成並返回點單</button>:<button type="button" className="checkout-confirm" disabled={!view.confirmEnabled||processing||failure} onClick={actions.onConfirm}>{processing?'正在建立訂單…':'確認並建立訂單'}</button>}
        </footer>
      </section>:null}
    </section>
  </main>;
}
