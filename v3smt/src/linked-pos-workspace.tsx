import {useEffect,useState,useSyncExternalStore} from 'react';
import {createLinkedPosController,type LinkedPosSnapshot} from './linked-pos.ts';

const amount=(minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'}).format(minor/100);
const publishedTime=(instant:string)=>new Intl.DateTimeFormat('zh-HK',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Hong_Kong'}).format(new Date(instant));

export function LinkedPosView({model,onRefresh,onReview}:{model:LinkedPosSnapshot;onRefresh:()=>void;onReview:(id:string,state:'SEEN'|'REJECTED')=>void}){
  return <main className="v3smt-shell linked-pos" data-mode="CONNECTED_TEST">
    <header className="mfp-app-head"><small>連線測試 · CONNECTED TEST</small><h1>MoreFun POS</h1><p>店員工作台 · TEST REQUEST</p></header>
    <section className="linked-pos-boundary" aria-label="連線測試狀態">
      <strong>測試驗收模式 · TEST REQUEST</strong>
      <p>只查看測試要求及標記處理狀態。標記已查看不代表接受正式訂單。</p>
      <div><span>結帳：尚未接通正式交易</span><span>付款：未確認收款</span><span>打印：尚未接通實體打印</span></div>
      <p>測試要求不會進入正式訂單、出餐顯示、錢箱或收據打印。</p>
    </section>
    <div className="linked-pos-toolbar"><span role="status">{model.loading?'正在讀取共用測試資料…':model.inbox?'已連接共用測試資料':'共用測試資料未可用'}</span><button type="button" onClick={onRefresh} disabled={model.loading}>重新讀取</button></div>
    {model.error&&<section className="linked-pos-error" role="alert"><strong>連線或回應未能驗證，請重新讀取。</strong><p>未確認的操作不會顯示為成功；重試前會先讀取伺服器狀態。</p><details><summary>技術資料</summary><code>{model.error}</code></details></section>}
    <div className="linked-pos-columns">
      <section className="linked-pos-inbox" aria-labelledby="linked-inbox-title"><h2 id="linked-inbox-title">TEST REQUEST 收件匣</h2><p>只提供「已查看」及「拒絕要求」。</p>
        {model.inbox===null?<p>等待已驗證的測試要求。</p>:model.inbox.length===0?<p>暫時沒有測試要求。</p>:model.inbox.map(row=>{
          const rejected=row.state==='REJECTED',seen=row.reviewState==='SEEN',busy=model.reviewing.includes(row.submissionId);
          return <article className="linked-pos-request" key={row.submissionId} data-state={row.state}>
            <div className="linked-pos-request-heading"><strong>{rejected?'已拒絕測試要求':seen?'已查看測試要求':'待查看測試要求'}</strong><small>TEST REQUEST</small></div>
            <p>{row.checkout.name||'測試客人'}{row.checkout.phone&&` · ${row.checkout.phone}`}</p>
            <p>送達：{publishedTime(row.receivedAt)}（香港時間）</p>
            <ul>{row.cart.map((line,index)=><li key={index}><strong>{line.quantity} × {line.productName}</strong>{line.selections.length>0&&<span>{line.selections.map(choice=>choice.optionName).join('、')}</span>}{line.note&&<span>備註：{line.note}</span>}</li>)}</ul>
            <p className="linked-pos-no-order">未建立正式訂單 · 未確認收款</p>
            <div className="linked-pos-actions"><button type="button" disabled={busy||rejected||seen||model.loading} onClick={()=>onReview(row.submissionId,'SEEN')}>{busy?'處理中…':seen?'已查看':'標記已查看'}</button><button type="button" className="linked-pos-reject" disabled={busy||rejected||model.loading} onClick={()=>onReview(row.submissionId,'REJECTED')}>{rejected?'已拒絕':'拒絕要求'}</button></div>
            <details><summary>測試要求識別碼</summary><code>{row.submissionId}</code>{row.reviewedAt&&<p>查看時間：{publishedTime(row.reviewedAt)}</p>}</details>
          </article>;
        })}
      </section>
      <section className="linked-pos-catalog" aria-labelledby="linked-catalog-title"><h2 id="linked-catalog-title">已發布菜單 · 連線測試</h2><p>價格、選項及預設均從 Admin 共用測試設定讀取，只供核對。</p>
        {model.catalog===null?<p>等待已驗證的已發布菜單。</p>:<>
          <p>發布時間：{publishedTime(model.catalog.publishedAt)}（香港時間）</p>
          {model.catalog.products.length===0&&<p>此測試菜單沒有商品。</p>}
          {model.catalog.categories.map(category=>{
            const products=model.catalog!.products.filter(product=>product.categoryId===category.id);
            return products.length>0&&<section key={category.id}><h3>{category.name}</h3>{products.map(product=><article className="linked-pos-product" key={product.id}>
              <div><strong>{product.name}</strong><b>{product.priceMinor===null?'價格未可用':amount(product.priceMinor)}</b></div>
              {product.description&&<p>{product.description}</p>}
              {!product.available&&<p className="linked-pos-unavailable">暫未可用：{product.unavailableReason}</p>}
              {product.options.map(group=><div className="linked-pos-options" key={group.id}><strong>{group.name}（選 {group.min}–{group.max}）</strong><ul>{group.choices.map(choice=><li key={choice.id}><span>{choice.name}{group.defaults.includes(choice.id)&&' · 預設'}</span><span>{choice.adjustmentMinor>=0?'+':''}{amount(choice.adjustmentMinor)}</span></li>)}</ul></div>)}
            </article>)}</section>;
          })}
          <details><summary>菜單完整性識別碼</summary><code>{model.catalog.fingerprint}</code></details>
        </>}
      </section>
    </div>
  </main>;
}

export function LinkedPosWorkspace(){
  const [controller]=useState(()=>createLinkedPosController({enabled:true}));
  const model=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  useEffect(()=>{controller.start();return()=>controller.stop();},[controller]);
  return <LinkedPosView model={model} onRefresh={()=>{void controller.refresh();}} onReview={(id,state)=>{void controller.review(id,state);}}/>;
}
