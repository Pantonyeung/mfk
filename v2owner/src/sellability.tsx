import {useMemo,useState} from 'react';
import type {OwnerConnectionState,OwnerSellabilityCommandInput,OwnerSellabilityItem} from './product-types';

function grainLabel(value:OwnerSellabilityItem['grain']){
  return value==='PRODUCT'?'商品':value==='OPTION'?'選項':value==='MODIFIER'?'配料／修改項':'套餐子項';
}
function scopeLabel(value:OwnerSellabilityItem['scope']){return value==='ONLINE_ONLY'?'只停網上':'全渠道';}

export function SellabilityPage({
  items,connection,busy,onCommand,onReload,onBack,
}:{
  items:readonly OwnerSellabilityItem[];
  connection:OwnerConnectionState;
  busy:boolean;
  onCommand:(input:OwnerSellabilityCommandInput)=>void;
  onReload:()=>void;
  onBack:()=>void;
}){
  const [query,setQuery]=useState('');
  const [grain,setGrain]=useState<'ALL'|OwnerSellabilityItem['grain']>('ALL');
  const [scope,setScope]=useState<'ALL'|'ONLINE_ONLY'>('ALL');
  const [temporary,setTemporary]=useState<'NONE'|'TODAY'|'TIME'>('NONE');
  const [restoreAt,setRestoreAt]=useState('');
  const rows=useMemo(()=>items.filter(item=>
    (grain==='ALL'||item.grain===grain)&&(!query.trim()||item.name.toLowerCase().includes(query.trim().toLowerCase())||item.targetId.toLowerCase().includes(query.trim().toLowerCase()))
  ),[items,grain,query]);
  const disabled=busy||connection==='OFFLINE_READONLY'||connection==='PERMISSION_DENIED';

  const command=(item:OwnerSellabilityItem,action:'SOLD_OUT'|'RESTORE')=>{
    const until=action==='SOLD_OUT'
      ?temporary==='TODAY'?'TODAY':temporary==='TIME'&&restoreAt?new Date(restoreAt).toISOString():undefined
      :undefined;
    onCommand({
      operationId:crypto.randomUUID(),
      action,
      scope,
      targets:[{targetId:item.targetId,grain:item.grain}],
      ...(until?{restoreAt:until}:{}),
      reason:'OWNER_OA_SEL_001',
    });
  };

  return <section className="page sellability-page">
    <header className="page-head secondary-head">
      <button className="back-link" onClick={onBack}>‹ 更多</button>
      <div><span>商品供應</span><h1>售罄／恢復</h1><small>即時停售或恢復商品；商品結構同價格設定仍留喺 Admin。</small></div>
    </header>

    <section className="card sellability-controls">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋商品／選項／套餐子項"/>
      <select value={grain} onChange={e=>setGrain(e.target.value as typeof grain)}>
        <option value="ALL">全部類型</option><option value="PRODUCT">商品</option><option value="OPTION">選項</option><option value="MODIFIER">配料／修改項</option><option value="COMBO_CHILD">套餐子項</option>
      </select>
      <select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}>
        <option value="ALL">全渠道</option><option value="ONLINE_ONLY">只停網上</option>
      </select>
      <select value={temporary} onChange={e=>setTemporary(e.target.value as typeof temporary)}>
        <option value="NONE">直至手動恢復</option><option value="TODAY">只停至今日</option><option value="TIME">停至指定時間</option>
      </select>
      {temporary==='TIME'?<input type="datetime-local" value={restoreAt} onChange={e=>setRestoreAt(e.target.value)}/>:null}
      <button type="button" onClick={onReload}>重新讀取</button>
    </section>

    {!rows.length?<section className="card empty-state"><h2>未有符合條件嘅商品</h2><p>可以調整搜尋或類型篩選再查看。</p></section>:
      <div className="sellability-list">{rows.map(item=><article className="card sellability-row" key={item.grain+':'+item.targetId}>
        <div className="sellability-media" data-grain={item.grain} aria-hidden="true"><span>{grainLabel(item.grain).slice(0,1)}</span></div>
        <div className="sellability-copy">
          <strong>{item.name}</strong>
          <small>{grainLabel(item.grain)} · {scopeLabel(item.scope)} · {item.readback==='CONFIRMED'?'已確認':item.readback==='PARTIAL'?'部分確認':'待確認'}</small>
          {item.restoreAt?<small>臨時停售至：{new Date(item.restoreAt).toLocaleString('zh-HK')}</small>:null}
          {item.quantity!==undefined?<small>數量資料：{item.quantity}（只展示，唔會自動阻交易）</small>:null}
        </div>
        <div className="sellability-action">
          <span className={'sellability-state '+item.state.toLowerCase()}>{item.state==='SELLABLE'?'可售':item.state==='SOLD_OUT'?'售罄':'未明'}</span>
          {item.state==='SOLD_OUT'
            ?<button disabled={disabled} onClick={()=>command(item,'RESTORE')}>恢復</button>
            :<button disabled={disabled||item.state==='UNKNOWN'} onClick={()=>command(item,'SOLD_OUT')}>售罄</button>}
        </div>
      </article>)}</div>}
    <p className="callout">改價、商品／套餐結構、平台對應同刪除商品仍然喺 Admin 處理；數量資料只供參考，唔會自動改成售罄。</p>
  </section>;
}
