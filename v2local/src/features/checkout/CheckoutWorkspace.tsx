import {ActionFeedback,DisabledReason,StatusTag} from '../../presentation/SmtUi.tsx';
import type {CheckoutWorkspaceActions,CheckoutWorkspaceViewModel} from './checkout-workspace-model.ts';
import './checkout-workspace.css';

const keypad=['7','8','9','4','5','6','1','2','3','00','0','⌫'] as const;
const channelIcon:Record<string,string>={'walk-in':'店','whatsapp':'話','morefun-app':'磨','keeta':'K','foodpanda':'F'};
const tenderIcon:Record<string,string>={CASH:'現',FPS:'轉',PAYME:'P',ALIPAY:'支',WECHAT:'微',COMBO:'合'};

export function CheckoutWorkspace({view,actions}:{view:CheckoutWorkspaceViewModel;actions:CheckoutWorkspaceActions}){
  const processing=view.paymentState==='processing';
  const success=view.paymentState==='success';
  const failure=view.paymentState==='failure';
  const selectedChannel=view.channels.find(channel=>channel.selected)??view.channels[0];
  const amountReason=view.validationMessage??(!view.order.lines.length?'訂單未有商品，請返回點單。':view.cashEntryVisible?'輸入足夠收款金額就可以確認。':'請完成目前付款資料。');

  return <main className="checkout-workspace" aria-label="結帳">
    <aside className="checkout-order-panel">
      <header className="checkout-order-title"><div><span className="checkout-eyebrow">訂單核對</span><h1>#{view.order.orderId}</h1><p>餐點保持可見，收款資料喺右邊一次完成。</p></div><strong>{view.order.totalLabel}</strong></header>
      <section className="checkout-order-count"><b>餐點明細</b><span>共 {view.order.lines.reduce((sum,line)=>sum+line.quantity,0)} 件</span></section>
      <div className="checkout-order-lines">{view.order.lines.map((line,index)=><article key={line.id}><span className="checkout-line-thumb">{index+1}</span><div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:<small>一般設定</small>}</div><span>×{line.quantity}</span><strong>{line.lineTotalLabel}</strong></article>)}</div>
      <section className="checkout-order-pricing"><div><span>小計</span><b>{view.order.subtotalLabel}</b></div><div><span>包裝</span><b>{view.order.packagingLabel}</b></div><div><span>折扣</span><b>{view.order.discountLabel}</b></div><div className="total"><span>應付總額</span><strong>{view.order.totalLabel}</strong></div></section>
      <section className="checkout-benefits" aria-labelledby="checkout-benefits-title">
        <header><div><b id="checkout-benefits-title">優惠與會員</b><small>只套用正式計價結果</small></div><span>目前未接駁</span></header>
        <div>{['會員優惠','學生優惠','優惠券','整單折扣'].map(label=><button type="button" key={label} disabled title="正式優惠計價尚未接駁；目前不會改變訂單金額"><span>{label}</span><small>未接駁</small></button>)}</div>
      </section>
      <footer className="checkout-order-footer"><button type="button" onClick={actions.onBack}>← 返回修改商品</button><p>未提交前可以安全返回。</p></footer>
    </aside>

    <section className="checkout-fast-flow">
      <header className="checkout-fast-header"><div><span>快速結帳</span><h2>{success?'訂單已完成':'收款並建立訂單'}</h2><p>{success?'核對訂單編號同打印狀態，然後開始下一張。':'來源、付款同金額集中一頁；資料足夠就可以直接確認。'}</p></div><div className="checkout-header-status"><StatusTag tone={success?'success':failure?'danger':processing?'warning':view.confirmEnabled?'success':'info'}>{success?'完成':failure?'未完成':processing?'處理中':view.confirmEnabled?'可以確認':'等待輸入'}</StatusTag>{!success?<nav className="checkout-flow-map" aria-label="結帳進度"><span className="done">1 來源 ✓</span><span className="done">2 付款 ✓</span><span className={view.confirmEnabled?'done':'current'}>3 收款{view.confirmEnabled?' ✓':''}</span></nav>:null}</div></header>

      <div className="checkout-fast-body">
        {success&&view.completionReview?<section className="checkout-completion" role="status" aria-live="polite"><span aria-hidden="true">✓</span><div><small>訂單完成</small><h3>#{view.completionReview.displayOrderCode}</h3><p>{view.completionReview.tenderLabel} · {view.completionReview.dueLabel}</p></div></section>:<>
          <section className="checkout-fast-section checkout-source-section is-complete" aria-labelledby="checkout-source-title">
            <header><div><small>01</small><h3 id="checkout-source-title">訂單來源</h3></div><strong>{selectedChannel?.label}</strong></header>
            <div className="checkout-source-grid">{view.channels.map(channel=><button type="button" key={channel.id} aria-pressed={channel.selected} className={channel.selected?'active':''} onClick={()=>actions.onSelectChannel(channel.id)}><i aria-hidden="true">{channelIcon[channel.id]??'•'}</i><b>{channel.label}</b><span aria-hidden="true">{channel.selected?'✓':''}</span></button>)}</div>
            {(view.channelFields.showCustomerPhone||view.channelFields.showPlatformFields)?<div className="checkout-channel-fields">{view.channelFields.showCustomerPhone?<label><span>客戶電話 <small>選填</small></span><input inputMode="tel" value={view.channelFields.customerPhone} onChange={event=>actions.onChangeCustomerPhone(event.target.value)} placeholder="電話／WhatsApp"/></label>:null}{view.channelFields.showPlatformFields?<><label><span>取餐碼 <small>選填</small></span><input value={view.channelFields.pickupCode} onChange={event=>actions.onChangePickupCode(event.target.value)} placeholder="例如 A123"/></label><label><span>平台單號 <small>選填</small></span><input value={view.channelFields.platformOrderNo} onChange={event=>actions.onChangePlatformOrderNo(event.target.value)} placeholder="輸入平台單號"/></label></>:null}</div>:null}
          </section>

          <section className="checkout-fast-section checkout-payment-section is-complete" aria-labelledby="checkout-payment-title">
            <header><div><small>02</small><h3 id="checkout-payment-title">付款方式</h3></div><strong>{view.selectedMethodLabel}</strong></header>
            <div className="checkout-method-grid">{view.methods.map(method=><button type="button" key={method.id} disabled={!method.enabled||processing} aria-pressed={method.selected} className={method.selected?'active':''} onClick={()=>actions.onSelectMethod(method.id)}><i aria-hidden="true">{tenderIcon[method.id]??'•'}</i><b>{method.label}</b><span aria-hidden="true">{method.selected?'✓':''}</span></button>)}</div>
          </section>

          <section className={`checkout-fast-section checkout-amount-section${view.confirmEnabled?' is-complete':' is-current'}`} aria-labelledby="checkout-amount-title">
            <header><div><small>03</small><h3 id="checkout-amount-title">收款</h3></div><strong>{view.amount.receivedLabel}</strong></header>
            <div className="checkout-settlement-grid"><article><span>應付</span><strong>{view.amount.dueLabel}</strong></article><article><span>已收</span><strong>{view.amount.receivedLabel}</strong></article><article className="change"><span>找續</span><strong>{view.amount.changeLabel}</strong></article></div>
            {view.comboMode?<div className="checkout-split-grid">{view.splitTenders.map(tender=><label key={tender.id}><span>{tender.label}</span><input inputMode="decimal" value={tender.amount} onChange={event=>actions.onChangeSplitAmount(tender.id,event.target.value)} placeholder="0.00"/></label>)}</div>:null}
            {view.cashEntryVisible?<div className="checkout-entry-grid"><div className="checkout-keypad" aria-label="現金收款鍵盤">{keypad.map(key=><button type="button" key={key} disabled={processing} onClick={()=>actions.onCashKey(key)}>{key}</button>)}</div><div className="checkout-entry-side"><div className="checkout-cash-value"><span>實收現金</span><strong>{view.cashInput||'0'}</strong></div><button type="button" className="checkout-exact" onClick={actions.onExactCash} disabled={!view.exactCashEnabled||processing}>剛好收取 {view.amount.dueLabel}</button><div className="checkout-quick-cash">{[50,100,200,500].map(amount=><button type="button" key={amount} disabled={processing} onClick={()=>actions.onQuickCash(amount)}>${amount}</button>)}</div></div></div>:view.comboMode?null:<div className="checkout-noncash-summary"><span aria-hidden="true">✓</span><div><b>{view.selectedMethodLabel}</b><p>毋須再輸入金額，可以直接確認。</p></div></div>}
            {!view.confirmEnabled?<DisabledReason>{amountReason}</DisabledReason>:null}
          </section>
        </>}

        {processing?<ActionFeedback tone="warning" title="正在建立訂單" detail="提交已鎖定，請勿重複操作。"/>:null}
        {failure?<ActionFeedback tone="danger" title="訂單未完成" detail={view.failureMessage??'目前未建立訂單。請重試同一操作，或者返回檢查資料。'} actionLabel="重試同一操作" onAction={actions.onRetry}/>:null}
        {view.statusMessage?<ActionFeedback tone={success?'info':'warning'} title={success?'打印狀態':'處理狀態'} detail={view.statusMessage}/>:null}
      </div>

      <footer className="checkout-commit-bar">{success?<><div><span>已完成</span><strong>可以開始下一張訂單</strong></div><button type="button" onClick={actions.onDone}>完成並返回點單</button></>:<><div><span>{selectedChannel?.label} · {view.selectedMethodLabel}</span><strong>{view.amount.dueLabel}</strong><small>{view.confirmEnabled?'資料齊全，可以確認':'完成上面標示嘅資料'}</small></div><button type="button" className="checkout-confirm" disabled={!view.confirmEnabled||processing||failure} onClick={actions.onConfirm}>{processing?'正在建立訂單…':'確認收款並建立訂單'}</button></>}</footer>
    </section>
  </main>;
}
