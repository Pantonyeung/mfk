import {useCallback,useEffect,useRef,useState} from 'react';
import type {LinkedCatalog,LinkedProduct} from '../../integrations/v3-linked-test.ts';
import {linkedRequest,subscribeLinked} from '../../integrations/v3-linked-client.ts';
import type {LinkedRequestStatus} from '../../integrations/v3-linked-client.ts';
import type {CustomerCloudCartLine} from '../../contracts/customer-cloud-v1.ts';
import {LinkedArchiveRead,LinkedSubmission,linkedDefaults,linkedLine,parseLinkedCatalog} from './linked-test-model';
import {CUSTOMER_V3_ASSETS as A} from './assets';
import {CUSTOMER_BUILD_IDENTITY} from './build-identity';
import './linked-test.css';

const amount=(minor:number)=>`$${(minor/100).toFixed(2)}`;
const canonicalLabel=(status:LinkedRequestStatus)=>status.state==='REJECTED'?'REJECTED · 店舖未能接受':status.reviewState==='SEEN'?'SEEN · POS 已查看':'PENDING · 等候 POS 查看';
const errorText=(error:unknown)=>error instanceof Error?error.message:'LINKED_CONNECTION_FAILED';
function ProductOptions({product,catalog,ready,onAdd,onClose}:Readonly<{product:LinkedProduct;catalog:LinkedCatalog;ready:boolean;onAdd:(line:CustomerCloudCartLine)=>void;onClose:()=>void}>){
  const [selected,setSelected]=useState(()=>linkedDefaults(product));
  const [quantity,setQuantity]=useState(1),[error,setError]=useState('');
  function choose(groupId:string,id:string,single:boolean,checked:boolean){setSelected(previous=>({...previous,[groupId]:single?(checked?[id]:[]):checked?[...(previous[groupId]??[]),id]:(previous[groupId]??[]).filter(value=>value!==id)}));}
  function add(){if(!ready)return;try{onAdd(linkedLine(catalog,product.id,quantity,selected));}catch(e){setError(errorText(e));}}
  return <section className="linked-product" aria-label={`${product.name} 選項`}>
    <div className="linked-section-title"><h2>{product.name}</h2><button type="button" onClick={onClose}>返回菜單</button></div>
    <p>已發布基本單價 {product.priceMinor===null?'未可用':amount(product.priceMinor)}；選項調整如下，未提供正式結算總額。</p>
    {product.options.map(group=><fieldset key={group.id} disabled={!ready}><legend>{group.name} · 選 {group.min} 至 {group.max} 項</legend>{group.min===0&&group.max===1&&<label><input type="radio" name={group.id} checked={(selected[group.id]??[]).length===0} onChange={()=>setSelected(previous=>({...previous,[group.id]:[]}))}/><span>不選擇{group.name}</span></label>}{group.choices.map(choice=><label key={choice.id}><input type={group.max===1?'radio':'checkbox'} name={group.id} checked={selected[group.id]?.includes(choice.id)??false} onChange={event=>choose(group.id,choice.id,group.max===1,event.target.checked)}/><span>{choice.name}</span><small>{choice.adjustmentMinor===0?'無調整':`${choice.adjustmentMinor>0?'+':''}${amount(choice.adjustmentMinor)}`}</small></label>)}</fieldset>)}
    <label className="linked-quantity">數量<input type="number" min="1" max="99" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label>
    {error&&<p role="alert">{error}</p>}
    <button type="button" className="linked-primary" disabled={!ready} onClick={add}>加入測試購物籃</button>
  </section>;
}

export function LinkedCustomerApp(){
  const [controller]=useState(()=>{try{return {model:new LinkedSubmission(window.localStorage,linkedRequest),error:''};}catch(error){return {model:null,error:errorText(error)};}});
  const model=controller.model;
  const [catalog,setCatalog]=useState<LinkedCatalog|null>(null),[catalogReady,setCatalogReady]=useState(false),[catalogError,setCatalogError]=useState(''),[notice,setNotice]=useState('');
  const [cart,setCart]=useState<CustomerCloudCartLine[]>([]),[productId,setProductId]=useState<string|null>(null);
  const [intent,setIntent]=useState(()=>model?.intent??null),[status,setStatus]=useState<LinkedRequestStatus|null>(null),[requestError,setRequestError]=useState('');
  const [archiveRead,setArchiveRead]=useState<{id:string;label:string}|null>(null);
  const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const archiveReads=useRef(new LinkedArchiveRead());
  const catalogSequence=useRef(0),requestSequence=useRef(0),fingerprint=useRef(''),mounted=useRef(true),busyRef=useRef(false),pendingStatusRefresh=useRef(false);
  const refreshCatalog=useCallback(async()=>{
    const sequence=++catalogSequence.current;setCatalogReady(false);setCatalogError('');
    try{const next=parseLinkedCatalog(await linkedRequest('/catalog'));if(!mounted.current||sequence!==catalogSequence.current)return;
      if(fingerprint.current&&fingerprint.current!==next.fingerprint){setCart([]);setProductId(null);setNotice('菜單已更新，請重新選擇商品。已送出的要求保留原本身份。');}
      fingerprint.current=next.fingerprint;setCatalog(next);setCatalogReady(true);
    }catch(error){if(mounted.current&&sequence===catalogSequence.current){setCatalog(null);setCatalogError(errorText(error));}}
  },[]);
  const refreshStatus=useCallback(async()=>{
    if(!model?.intent)return;
    if(busyRef.current){pendingStatusRefresh.current=true;return;}
    const sequence=++requestSequence.current;setRefreshing(true);setStatus(null);setRequestError('');
    try{const next=await model.readback();if(mounted.current&&sequence===requestSequence.current)setStatus(next);}
    catch(error){if(mounted.current&&sequence===requestSequence.current)setRequestError(errorText(error));}
    finally{if(mounted.current&&sequence===requestSequence.current)setRefreshing(false);}
  },[model]);
  useEffect(()=>{
    mounted.current=true;void refreshCatalog();void refreshStatus();
    const stopCatalog=subscribeLinked('catalog',()=>void refreshCatalog());
    const stopStatus=subscribeLinked('request',()=>void refreshStatus());
    return()=>{archiveReads.current.invalidate();mounted.current=false;catalogSequence.current++;requestSequence.current++;stopCatalog();stopStatus();};
  },[refreshCatalog,refreshStatus]);
  async function submit(){
    if(!model||busyRef.current)return;
    busyRef.current=true;setBusy(true);setRequestError('');setStatus(null);requestSequence.current++;
    try{
      if(!model.intent){if(!catalog||!catalogReady)throw Error('LINKED_CATALOG_UNAVAILABLE');model.prepare(catalog,cart);}
      setIntent(model.intent);await model.submit();
      // The POST is receipt of a test request; always read canonical status afterward.
      const next=await model.readback();if(mounted.current)setStatus(next);
    }catch(error){if(mounted.current)setRequestError(errorText(error));}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);setRefreshing(false);if(pendingStatusRefresh.current){pendingStatusRefresh.current=false;void refreshStatus();}}}
  }
  async function startNew(){
    if(!model||busyRef.current)return;
    archiveReads.current.invalidate();setArchiveRead(null);
    busyRef.current=true;setBusy(true);setStatus(null);setRequestError('');requestSequence.current++;
    try{await model.startNew();if(mounted.current){setIntent(null);setCart([]);setProductId(null);setArchiveRead(null);setNotice('上一個測試要求的身份及內容已保留，可以建立另一個測試要求。');void refreshCatalog();}}
    catch(error){if(mounted.current)setRequestError(errorText(error));}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);setRefreshing(false);if(pendingStatusRefresh.current){pendingStatusRefresh.current=false;void refreshStatus();}}}
  }
  async function readArchive(id:string){
    if(!model)return;setArchiveRead({id,label:'正在讀取先前要求…'});
    await archiveReads.current.run(id,key=>model.readArchived(key),
      (key,next)=>{if(mounted.current)setArchiveRead({id:key,label:`最近讀回：${canonicalLabel(next)}`});},
      (key,error)=>{if(mounted.current)setArchiveRead({id:key,label:`未核實：${errorText(error)}`});});
  }
  const product=catalog?.products.find(p=>p.id===productId);
  const statusLabel=status?canonicalLabel(status):refreshing?'正在讀取伺服器狀態':'未核實 · 請讀取狀態或以相同身份重試';
  return <div className="shell linked-shell" data-customer-mode="CONNECTED_TEST" data-customer-build={CUSTOMER_BUILD_IDENTITY.buildId}>
    <header className="linked-header"><img src={A.logo} alt="磨飯 More Fun"/><span>CONNECTED TEST</span><small>共用測試工作區</small></header>
    <main>
      <section className="linked-intro"><div><p className="linked-eyebrow">More Fun · 一齊試點餐</p><h1>揀好食的，<br/>送出測試要求。</h1><p>菜單由共用測試後台發布。只使用測試顧客資料；到店付款 PAY_AT_STORE。</p></div><img src={A.maleHeroR2} alt=""/></section>
      <aside className="linked-safety">正式結帳、收款及實體打印尚未接通。要求送達或 POS 已查看，均不代表正式訂單成立。</aside>
      {controller.error&&<p role="alert" className="linked-error">{controller.error}：本機未能保存重試身份，送出功能已停用。</p>}
      {notice&&<p role="status" className="linked-notice">{notice}</p>}
      {!intent&&<>
        <section className="linked-menu" aria-label="共用測試菜單"><div className="linked-section-title"><h2>今日菜單</h2><button type="button" onClick={()=>void refreshCatalog()}>重新讀取菜單</button></div>
          {catalogError?<p className="linked-error" role="alert">{catalogError} · 菜單暫時未可用</p>:!catalog?<p role="status">正在讀取已發布菜單…</p>:<>
            <p className="linked-time">後台發布時間：<time dateTime={catalog.publishedAt}>{new Date(catalog.publishedAt).toLocaleString('zh-HK')}</time></p>
            {catalog.products.length===0&&<p>共用測試菜單尚未有可顯示商品。</p>}
            {catalog.categories.map(category=><section key={category.id}><h3>{category.name}</h3><div className="linked-products">{catalog.products.filter(p=>p.categoryId===category.id).map(p=><button key={p.id} type="button" disabled={!p.available||!model||!catalogReady} aria-label={`選擇 ${p.name}`} onClick={()=>setProductId(p.id)}><span><strong>{p.name}</strong><small>{p.description||'按此選擇數量及選項'}</small>{!p.available&&<small>{p.unavailableReason}</small>}</span><b>{p.priceMinor===null?'未可用':amount(p.priceMinor)}</b></button>)}</div></section>)}
          </>}
        </section>
        {catalog&&product&&<ProductOptions key={`${catalog.fingerprint}:${product.id}`} product={product} catalog={catalog} ready={catalogReady} onClose={()=>setProductId(null)} onAdd={line=>{setCart(previous=>[...previous,line]);setProductId(null);}}/>}
        <section className="linked-cart" aria-label="測試購物籃"><h2>測試購物籃 <small>{cart.length} 款</small></h2>{cart.length===0?<p>先揀選商品及選項。</p>:cart.map(line=><div className="linked-cart-line" key={line.lineId}><div><strong>{line.productName} × {line.quantity}</strong><small>{line.selections.map(s=>s.optionName).join('、')||'沒有選項'}</small></div><button type="button" aria-label={`移除 ${line.productName}`} onClick={()=>setCart(previous=>previous.filter(item=>item.lineId!==line.lineId))}>移除</button></div>)}
          <p>測試名稱：測試顧客 · 測試電話：00000000<br/>到店付款 PAY_AT_STORE · 尚未收款</p>
          <button type="button" className="linked-primary" disabled={!model||!catalog||!catalogReady||!cart.length||busy} onClick={()=>void submit()}>{busy?'正在送出測試要求…':'送出測試要求'}</button>
        </section>
      </>}
      {intent&&<section className="linked-status" aria-label="測試要求進度"><span className="linked-eyebrow">要求進度</span><h2 data-testid="request-status">{busy?'正在送出及核實…':statusLabel}</h2><p>只有伺服器讀回的狀態會在此顯示。重試保留相同要求身份及內容。</p><small>要求身份</small><code>{intent.submissionId}</code><ul>{intent.cart.map(line=><li key={line.lineId}>{line.productName} × {line.quantity} {line.selections.map(s=>s.optionName).join('、')}</li>)}</ul><p>尚未成交、收款或打印。</p><div className="linked-actions"><button type="button" onClick={()=>void refreshStatus()} disabled={busy||refreshing}>重新讀取狀態</button><button type="button" onClick={()=>void submit()} disabled={busy||refreshing||status?.state==='REJECTED'}>以相同身份重試</button>{status&&(status.state==='REJECTED'||status.reviewState==='SEEN')&&<button type="button" disabled={busy||refreshing} onClick={()=>void startNew()}>建立新的測試要求</button>}</div></section>}
      {!!model?.archived.length&&<section className="linked-status" aria-label="先前測試要求"><h2>先前測試要求</h2><p>保留原本身份及內容供恢復。進度只在重新讀回後顯示，先前已查看的要求仍可被拒絕。</p>{model.archived.map(previous=><details key={previous.submissionId}><summary>{previous.cart.map(line=>`${line.productName} × ${line.quantity}`).join('、')}</summary><code>{previous.submissionId}</code><ul>{previous.cart.map(line=><li key={line.lineId}>{line.productName} × {line.quantity} {line.selections.map(choice=>choice.optionName).join('、')}</li>)}</ul><button type="button" disabled={busy} onClick={()=>void readArchive(previous.submissionId)}>讀取先前要求狀態</button>{archiveRead?.id===previous.submissionId&&<p role="status">{archiveRead.label}</p>}</details>)}</section>}
      {requestError&&<p role="alert" className="linked-error">{requestError} · 未能核實要求進度，請保留此頁並以相同身份重試。</p>}
    </main><footer className="linked-footer">MFP Customer V3 · CONNECTED TEST<br/>formalCheckoutConnected: false · physicalPrintConnected: false<br/>formalOrderCreated: false · paymentConfirmed: false</footer>
  </div>;
}
