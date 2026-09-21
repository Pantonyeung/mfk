import type {CheckoutWorkspaceActions, CheckoutWorkspaceViewModel} from './checkout-workspace-model.ts';
import './checkout-workspace.css';

const keypad=['1','2','3','4','5','6','7','8','9','0','00','⌫'] as const;

export function CheckoutWorkspace({view,actions}:{view:CheckoutWorkspaceViewModel;actions:CheckoutWorkspaceActions}){
  const failure=view.paymentState==='failure';
  const processing=view.paymentState==='processing';
  const success=view.paymentState==='success';
  return <main className="checkout-workspace" aria-label="結帳">
    <aside className="checkout-order-panel" aria-label="訂單明細">
      <header>
        <button type="button" onClick={actions.onBack}>返回訂單</button>
        <div><small>訂單</small><strong>#{view.order.orderId}</strong></div>
      </header>
      <div className="checkout-order-lines">
        {view.order.lines.map(line=><article key={line.id}>
          <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>
          <span>×{line.quantity}</span>
          <strong>{line.lineTotalLabel}</strong>
        </article>)}
      </div>
      <dl className="checkout-order-summary">
        <div><dt>小計</dt><dd>{view.order.subtotalLabel}</dd></div>
        <div><dt>包裝</dt><dd>{view.order.packagingLabel}</dd></div>
        <div><dt>折扣</dt><dd>{view.order.discountLabel}</dd></div>
      </dl>
      <div className="checkout-order-total"><span>訂單總額</span><strong>{view.order.totalLabel}</strong></div>
    </aside>

    <section className="checkout-payment-stage">
      <header className="checkout-channel-row" aria-label="訂單渠道">
        {view.channels.map(channel=><button type="button" key={channel.id} aria-pressed={channel.selected} className={channel.selected?'active':''} onClick={()=>actions.onSelectChannel(channel.id)}>
          <b>{channel.label}</b>{channel.helperLabel?<small>{channel.helperLabel}</small>:null}
        </button>)}
      </header>

      {(view.channelFields.showCustomerPhone||view.channelFields.showPlatformFields)?<section className="checkout-channel-fields">
        {view.channelFields.showCustomerPhone?<label><span>客戶電話</span><input inputMode="tel" value={view.channelFields.customerPhone} onChange={e=>actions.onChangeCustomerPhone(e.target.value)} placeholder="輸入 WhatsApp／電話"/></label>:null}
        {view.channelFields.showPlatformFields?<>
          <label><span>平台取餐碼</span><input value={view.channelFields.pickupCode} onChange={e=>actions.onChangePickupCode(e.target.value)} placeholder="例如 A123"/></label>
          <label><span>平台訂單號碼</span><input value={view.channelFields.platformOrderNo} onChange={e=>actions.onChangePlatformOrderNo(e.target.value)} placeholder="輸入平台單號"/></label>
        </>:null}
      </section>:null}

      <div className="checkout-payment-grid">
        <section className="checkout-method-panel" aria-label="付款方式">
          <div className="checkout-method-grid">
            {view.methods.map(method=><button type="button" key={method.id} disabled={!method.enabled||processing||success} aria-pressed={method.selected} className={method.selected?'active':''} onClick={()=>actions.onSelectMethod(method.id)}>{method.label}</button>)}
          </div>

          {view.comboMode?<section className="checkout-split-panel">
            <header><b>組合付款</b><span>各方式金額加總必須等於應收</span></header>
            <div>{view.splitTenders.map(tender=><label key={tender.id}><span>{tender.label}</span><input inputMode="decimal" value={tender.amount} onChange={e=>actions.onChangeSplitAmount(tender.id,e.target.value)} placeholder="0.00"/></label>)}</div>
          </section>:null}

          <div className="checkout-amount-cards">
            <article><small>應收</small><strong>{view.amount.dueLabel}</strong></article>
            <article><small>實收</small><strong>{view.amount.receivedLabel}</strong></article>
            <article><small>找續</small><strong>{view.amount.changeLabel}</strong></article>
          </div>
          {view.statusMessage?<div className="checkout-payment-state" role="status">{view.statusMessage}</div>:null}
          {view.validationMessage?<div className="checkout-payment-alert" role="status"><b>未可確認</b><span>{view.validationMessage}</span></div>:null}
          {failure?<div className="checkout-payment-alert" role="alert"><b>付款未完成</b><span>{view.failureMessage??'交易未取得成功結果，請重試或重新選擇付款方式。'}</span><button type="button" onClick={actions.onRetry}>重試付款</button></div>:null}
          {processing?<div className="checkout-payment-state" role="status">付款處理中…</div>:null}
          {success&&view.completionReview?<section className="checkout-payment-state success" role="status" aria-label="完成檢視">
            <strong>付款成功</strong>
            <dl>
              <div><dt>訂單號碼</dt><dd>{view.completionReview.displayOrderCode}</dd></div>
              <div><dt>付款方式</dt><dd>{view.completionReview.tenderLabel}</dd></div>
              <div><dt>應收</dt><dd>{view.completionReview.dueLabel}</dd></div>
              {view.completionReview.receivedLabel?<div><dt>實收</dt><dd>{view.completionReview.receivedLabel}</dd></div>:null}
              {view.completionReview.changeLabel?<div><dt>找續</dt><dd>{view.completionReview.changeLabel}</dd></div>:null}
              <div><dt>狀態</dt><dd>{view.completionReview.statusLabel}</dd></div>
            </dl>
          </section>:null}
        </section>

        <section className="checkout-cash-panel" aria-label="收款確認">
          <div className="checkout-cash-display"><small>{view.cashEntryVisible?'實收金額':'目前付款方式'}</small><strong>{view.cashEntryVisible?(view.cashInput||'0'):view.selectedMethodLabel}</strong></div>
          {view.cashEntryVisible?<div className="checkout-quick-cash">
            <button type="button" disabled={!view.exactCashEnabled||processing||success} onClick={actions.onExactCash}>剛好</button>
            {[50,100,200,500].map(amount=><button type="button" key={amount} disabled={processing||success} onClick={()=>actions.onQuickCash(amount)}>+{amount}</button>)}
          </div>:<div className="checkout-noncash-note">確認渠道資料同付款方式後即可完成收款。</div>}
          {view.cashEntryVisible?<div className="checkout-keypad">
            {keypad.map(key=><button type="button" key={key} aria-label={key} disabled={processing||success} onClick={()=>actions.onCashKey(key)}>{key}</button>)}
          </div>:<div className="checkout-confirm-spacer"/>}
          <button type="button" className="checkout-confirm" disabled={success?false:!view.confirmEnabled||processing} onClick={success?actions.onDone:actions.onConfirm}>{processing?'處理中…':success?'完成':'確認收款'}</button>
        </section>
      </div>
    </section>
  </main>;
}
