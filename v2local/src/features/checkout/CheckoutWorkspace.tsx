import {useState} from 'react';
import type {CheckoutWorkspaceActions, CheckoutWorkspaceViewModel} from './checkout-workspace-model.ts';
import './checkout-workspace.css';

const keypad=['7','8','9','4','5','6','1','2','3','00','0','.'] as const;
const channelIcon:Record<string,string>={
  'walk-in':'▣','whatsapp':'◉','morefun-app':'▦','keeta':'K','foodpanda':'●'
};
const tenderIcon:Record<string,string>={
  CASH:'▤',FPS:'◌',PAYME:'P',ALIPAY:'支',WECHAT:'●',COMBO:'▦'
};

export function CheckoutWorkspace({view,actions}:{view:CheckoutWorkspaceViewModel;actions:CheckoutWorkspaceActions}){
  const [note,setNote]=useState('');
  const failure=view.paymentState==='failure';
  const processing=view.paymentState==='processing';
  const success=view.paymentState==='success';

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
      <section className="checkout-step">
        <header><span>1</span><b>選擇來源</b></header>
        <div className="checkout-source-grid">
          {view.channels.map(channel=><button type="button" key={channel.id} className={channel.selected?'active':''} onClick={()=>actions.onSelectChannel(channel.id)}>
            <i>{channelIcon[channel.id]??'•'}</i><b>{channel.label}</b>
          </button>)}
        </div>
        {(view.channelFields.showCustomerPhone||view.channelFields.showPlatformFields)?<div className="checkout-channel-fields">
          {view.channelFields.showCustomerPhone?<label><span>客戶電話</span><input inputMode="tel" value={view.channelFields.customerPhone} onChange={e=>actions.onChangeCustomerPhone(e.target.value)} placeholder="輸入電話／WhatsApp"/></label>:null}
          {view.channelFields.showPlatformFields?<>
            <label><span>平台取餐碼</span><input value={view.channelFields.pickupCode} onChange={e=>actions.onChangePickupCode(e.target.value)} placeholder="例如 A123"/></label>
            <label><span>平台訂單號碼</span><input value={view.channelFields.platformOrderNo} onChange={e=>actions.onChangePlatformOrderNo(e.target.value)} placeholder="輸入平台單號"/></label>
          </>:null}
        </div>:null}
      </section>

      <section className="checkout-step">
        <header><span>2</span><b>付款方式</b></header>
        <div className="checkout-method-grid">
          {view.methods.map(method=><button type="button" key={method.id} disabled={!method.enabled||processing||success} className={method.selected?'active':''} onClick={()=>actions.onSelectMethod(method.id)}>
            <i>{tenderIcon[method.id]??'•'}</i><b>{method.label}</b>
          </button>)}
        </div>
      </section>

      <section className="checkout-step settlement">
        <header><span>3</span><b>金額結算</b></header>
        <div className="checkout-settlement-grid">
          <article>
            <p><span>原價</span><b>{view.order.subtotalLabel}</b></p>
            <p><span>包裝</span><b>{view.order.packagingLabel}</b></p>
            <p><span>折扣</span><b>{view.order.discountLabel}</b></p>
            <p className="due"><span>應付金額</span><strong>{view.amount.dueLabel}</strong></p>
          </article>
          <article>
            <p><span>已收金額</span><b>{view.amount.receivedLabel}</b></p>
            <p className="change"><span>找續金額</span><strong>{view.amount.changeLabel}</strong></p>
          </article>
        </div>
      </section>

      {view.comboMode?<section className="checkout-step combo">
        <header><span>+</span><b>組合付款</b></header>
        <div className="checkout-split-grid">
          {view.splitTenders.map(tender=><label key={tender.id}><span>{tender.label}</span><input inputMode="decimal" value={tender.amount} onChange={e=>actions.onChangeSplitAmount(tender.id,e.target.value)} placeholder="0.00"/></label>)}
        </div>
      </section>:null}

      <section className="checkout-step amount-entry">
        <header><span>4</span><b>輸入金額</b></header>
        {view.cashEntryVisible?<div className="checkout-entry-grid">
          <div className="checkout-keypad">
            {keypad.map(key=><button type="button" key={key} disabled={processing||success} onClick={()=>actions.onCashKey(key==='.'?'00':key)}>{key}</button>)}
          </div>
          <div className="checkout-entry-side">
            <div className="checkout-quick-cash">
              <button type="button" onClick={actions.onExactCash} disabled={!view.exactCashEnabled||processing||success}>剛好</button>
              {[50,100,200,500].map(amount=><button type="button" key={amount} disabled={processing||success} onClick={()=>actions.onQuickCash(amount)}>+{amount}</button>)}
            </div>
            <button type="button" className="checkout-delete" onClick={()=>actions.onCashKey('⌫')} disabled={processing||success}>⌫ 刪除</button>
            <div className="checkout-cash-value"><span>實收</span><strong>{view.cashInput||'0'}</strong></div>
          </div>
        </div>:<div className="checkout-noncash-summary"><b>{view.selectedMethodLabel}</b><span>毋須輸入現金金額</span></div>}
      </section>

      <section className="checkout-step checkout-final-step">
        <header><span>5</span><b>備註</b><small>可不填</small></header>
        <div className="checkout-final-row">
          <input value={note} maxLength={80} onChange={e=>setNote(e.target.value)} placeholder="不辣、多醬、少蔥、五指拖鞋…"/>
          <span>{note.length}/80</span>
          <button type="button" disabled>儲存為草稿</button>
          <button type="button" className="checkout-confirm" disabled={success?false:!view.confirmEnabled||processing} onClick={success?actions.onDone:actions.onConfirm}>
            {processing?'處理中…':success?'完成':'✓ 確認結帳'}
          </button>
        </div>
      </section>

      {view.statusMessage?<div className="checkout-payment-state">{view.statusMessage}</div>:null}
      {view.validationMessage?<div className="checkout-payment-alert"><b>未可確認</b><span>{view.validationMessage}</span></div>:null}
      {failure?<div className="checkout-payment-alert"><b>付款未完成</b><span>{view.failureMessage??'請重試或重新選擇付款方式。'}</span><button type="button" onClick={actions.onRetry}>重試</button></div>:null}
      {success&&view.completionReview?<div className="checkout-payment-state success">付款成功 · {view.completionReview.displayOrderCode} · {view.completionReview.tenderLabel}</div>:null}
    </section>
  </main>;
}
