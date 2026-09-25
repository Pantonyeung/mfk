// DINING_REAL_CHECKOUT_R3
import {useState} from 'react';
import type {CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './checkout-workspace-model.ts';
import './checkout-workspace.css';

const keypad=['7','8','9','4','5','6','1','2','3','00','0','.'] as const;
const channelIcon:Record<string,string>={
  'walk-in':'▣','whatsapp':'◉','morefun-app':'▦','keeta':'K','foodpanda':'●'
};
const tenderIcon:Record<string,string>={
  CASH:'▤',ALIPAY:'支',WECHAT:'●',FPS:'轉',PAYME:'P',COMBO:'▦'
};

export function CheckoutWorkspace({view,actions}:{view:CheckoutWorkspaceViewModel;actions:CheckoutWorkspaceActions}){
  const [note,setNote]=useState('');
  const failure=view.paymentState==='failure';
  const processing=view.paymentState==='processing';
  const success=view.paymentState==='success';
  const selectedChannel=view.channels.find(channel=>channel.selected);
  const keypadEnabled=view.settlementMode==='LOCAL_PAYMENT'&&view.cashEntryVisible&&!processing&&!success;

  return <main className="checkout-workspace" aria-label="結帳">
    <aside className="checkout-order-panel">
      <header className="checkout-order-title">
        <div><h1>結帳</h1><span>核對餐點，確認後結帳</span></div>
        <strong>#{view.order.orderId}</strong>
      </header>

      <section className="checkout-order-count"><b>餐點明細</b><span>共 {view.order.lines.reduce((sum,line)=>sum+line.quantity,0)} 件</span></section>
      <div className="checkout-order-lines">
        {view.order.lines.map((line,index)=><article key={line.id}>
          <span className="checkout-line-thumb">{index+1}</span>
          <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:<small>正常</small>}</div>
          <span>×{line.quantity}</span>
          <strong>{line.lineTotalLabel}</strong>
        </article>)}
      </div>

      <section className="checkout-order-pricing">
        <div><span>小計</span><b>{view.order.subtotalLabel}</b></div>
        <div><span>包裝</span><b>{view.order.packagingLabel}</b></div>
        <div><span>折扣</span><b>{view.order.discountLabel}</b></div>
        <div className="total"><span>總計</span><strong>{view.order.totalLabel}</strong></div>
      </section>

      <footer className="checkout-order-footer">
        <button type="button" onClick={actions.onBack}>← 返回訂單</button>
        <button type="button" disabled>學生優惠</button>
        <button type="button" disabled>店飯優惠券</button>
        <button type="button" disabled>整單折扣</button>
      </footer>
    </aside>

    <section className="checkout-flow">
      <div className="checkout-top-stages">
      <section className="checkout-source-stage">
        <header><div><small><i>01</i> ORDER SOURCE</small><b>訂單來源</b></div><strong>{selectedChannel?.label}</strong></header>
        <div className="checkout-source-grid">
          {view.channels.map(channel=><button type="button" key={channel.id} className={channel.selected?'active':''} disabled={processing||success||channel.enabled===false} onClick={()=>actions.onSelectChannel(channel.id)}>
            <i>{channelIcon[channel.id]??'•'}</i><b>{channel.label}</b>
          </button>)}
        </div>
      </section>

      {view.settlementMode==='LOCAL_PAYMENT'
        ?<section className="checkout-payment-stage">
          <header><div><small><i>02</i> PAYMENT</small><b>付款方式</b></div><strong>{view.amount.dueLabel}</strong></header>
          <div className="checkout-method-grid">
            {view.methods.map(method=><button type="button" key={method.id} disabled={!method.enabled||processing||success} className={method.selected?'active':''} onClick={()=>actions.onSelectMethod(method.id)}>
              <i>{tenderIcon[method.id]??'•'}</i><b>{method.label}</b>
            </button>)}
          </div>
        </section>
        :<section className="checkout-channel-stage">
        <header><div><small><i>02</i> CHANNEL INFORMATION</small><b>{view.channelInfo.title}</b>{view.channelInfo.helperLabel?<span>{view.channelInfo.helperLabel}</span>:null}</div><strong>{view.amount.dueLabel}</strong></header>
        <div className="checkout-channel-form">
          {view.channelInfo.fields.map(field=><label key={field.id} className={field.required?'required':''}>
            <span>{field.label}{field.required?<b>必填</b>:null}</span>
            <input value={field.value} inputMode={field.id==='customerPhone'?'tel':'text'} onChange={event=>actions.onChangeChannelInfo(field.id,event.target.value)} placeholder={field.placeholder}/>
          </label>)}
        </div>
      </section>}
      </div>

      {view.settlementMode==='LOCAL_PAYMENT'&&view.comboMode?<section className="checkout-combo-stage">
          <header><b>組合付款</b><span>合計必須等於 {view.amount.dueLabel}</span></header>
          <div className="checkout-split-grid">
            {view.splitTenders.map(tender=><label key={tender.id}><span>{tender.label}</span><input inputMode="decimal" value={tender.amount} onChange={e=>actions.onChangeSplitAmount(tender.id,e.target.value)} placeholder="0.00"/></label>)}
          </div>
        </section>:null}

      <section className={'checkout-payment-body'+(keypadEnabled?'':' keypad-disabled')}>
          <header className="checkout-stage-three"><small><i>03</i> COLLECTION</small><b>收款</b></header>
          <article className="checkout-settlement-card">
            <div><span>應付</span><strong>{view.amount.dueLabel}</strong></div>
            <div><span>已收</span><b>{view.amount.receivedLabel}</b></div>
            <div className="change"><span>找續</span><strong>{view.amount.changeLabel}</strong></div>
          </article>

          <div className="checkout-entry-grid">
            <div className="checkout-keypad">
              {keypad.map(key=><button type="button" key={key} disabled={!keypadEnabled} onClick={()=>actions.onCashKey(key)}>{key}</button>)}
            </div>
            <div className="checkout-entry-side">
              <div className="checkout-quick-cash">
                <button type="button" onClick={actions.onExactCash} disabled={!keypadEnabled||!view.exactCashEnabled}>剛好</button>
                {[20,50,100,200,500].map(amount=><button type="button" key={amount} disabled={!keypadEnabled} onClick={()=>actions.onQuickCash(amount)}>+{amount}</button>)}
              </div>
              <button type="button" className="checkout-delete" onClick={()=>actions.onCashKey('⌫')} disabled={!keypadEnabled}>⌫ 刪除</button>
              <div className="checkout-cash-value"><span>實收</span><strong>{view.cashInput||'0'}</strong></div>
            </div>
          </div>
        </section>

      {view.settlementMode==='CHANNEL_INFO'?<section className="checkout-channel-summary">
        <div><span>來源</span><b>{selectedChannel?.label}</b></div>
        <div><span>訂單總額</span><strong>{view.amount.dueLabel}</strong></div>
        <p>平台／外部來源資料已喺 02 記錄；03 鍵盤保留但鎖定，避免操作位置跳動。</p>
      </section>:null}

      <section className="checkout-final-stage">
        <div className="checkout-note-row">
          <label><span>備註 <small>可不填</small></span><input value={note} maxLength={80} onChange={e=>setNote(e.target.value)} placeholder="不辣、多醬、少蔥…"/></label>
          <span>{note.length}/80</span>
        </div>
        <button type="button" className="checkout-confirm" disabled={success?false:!view.confirmEnabled||processing} onClick={success?actions.onDone:actions.onConfirm}>
          {processing?'處理中…':success?'完成':'✓ 確認結帳'}
        </button>
      </section>

      {view.statusMessage?<div className="checkout-payment-state">{view.statusMessage}</div>:null}
      {view.validationMessage?<div className="checkout-payment-alert"><b>未可確認</b><span>{view.validationMessage}</span></div>:null}
      {failure?<div className="checkout-payment-alert"><b>未完成</b><span>{view.failureMessage??'請核對資料後重試。'}</span><button type="button" onClick={actions.onRetry}>重試</button></div>:null}
      {success&&view.completionReview?<div className="checkout-payment-state success">已完成 · {view.completionReview.displayOrderCode} · {view.completionReview.tenderLabel}</div>:null}
    </section>

    {view.completionReview?<div className="checkout-completion-backdrop" role="presentation">
      <section className="checkout-completion-modal" role="dialog" aria-modal="true" aria-label="交易完成核對">
        <header>
          <div><small>COMPLETION REVIEW</small><h2>{view.completionReview.heading??'交易已完成'}</h2><p>{view.completionReview.helperLabel??'正式交易已提交；打印／櫃桶狀態會喺下面更新。'}</p></div>
          <strong>#{view.completionReview.displayOrderCode}</strong>
        </header>

        <div className="checkout-completion-body">
          <section className="checkout-completion-summary">
            <article><span>來源</span><b>{view.completionReview.sourceLabel}</b></article>
            <article><span>付款方式</span><b>{view.completionReview.tenderLabel}</b></article>
            <article><span>總額</span><b>{view.completionReview.dueLabel}</b></article>
            {view.completionReview.receivedLabel?<article><span>實收</span><b>{view.completionReview.receivedLabel}</b></article>:null}
            {view.completionReview.changeLabel?<article><span>找續</span><b>{view.completionReview.changeLabel}</b></article>:null}
            <article><span>狀態</span><b>{view.completionReview.statusLabel}</b></article>
          </section>

          <section className="checkout-completion-ops">
            <div><span>打印</span><b>{view.completionReview.printStatusLabel}</b></div>
            <div><span>櫃桶</span><b>{view.completionReview.drawerStatusLabel}</b></div>
          </section>

          {view.completionReview.canCorrectPayment?<section className="checkout-payment-correction">
            <header><b>付款方式修正</b><span>只修正 SAME Order；不重新打印、不再開櫃桶。</span></header>
            <div>{view.completionReview.correctionMethods.map(method=><button
              type="button"
              key={method.id}
              className={method.selected?'active':''}
              disabled={!method.enabled}
              onClick={()=>actions.onCorrectPayment(method.id)}
            ><i>{tenderIcon[method.id]??'•'}</i><b>{method.label}</b></button>)}</div>
          </section>:null}
        </div>

        <footer>
          <button type="button" className="checkout-completion-done" onClick={actions.onDone}>完成</button>
        </footer>
      </section>
    </div>:null}
  </main>;
}
