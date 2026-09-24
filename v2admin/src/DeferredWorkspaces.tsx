import {useMemo,useState} from 'react';
import {appendAdminAudit,usePersistentAdminState} from './admin-local-store.ts';
import {AdminResponsiveDataView} from './AdminResponsiveDataView.tsx';
import {AdminSearchField} from './AdminUiPrimitives.tsx';

function Header({title,description,badge='保留功能'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head"><div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div></header>;
}

interface InventoryItem{
  id:string;displayName:string;baseUnit:string;catalogRef:string;lowStockThreshold:string;active:boolean;quantity:number;revision:number;
}
interface InventoryMovement{id:string;itemId:string;action:'RECEIPT'|'ADJUST'|'WASTE'|'STOCKTAKE'|'OPENING';quantity:number;reason:string;at:string}
export function InventoryWorkspace(){
  const [items,setItems]=usePersistentAdminState<InventoryItem[]>('inventory-lite.v1',[]);
  const [movements,setMovements]=usePersistentAdminState<InventoryMovement[]>('inventory-movements.v1',[]);
  const [search,setSearch]=useState('');
  const [newName,setNewName]=useState('');
  const [newUnit,setNewUnit]=useState('');
  const [newCatalogRef,setNewCatalogRef]=useState('');
  const [newThreshold,setNewThreshold]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [action,setAction]=useState<InventoryMovement['action']>('RECEIPT');
  const [quantity,setQuantity]=useState('');
  const [reason,setReason]=useState('');
  const filtered=useMemo(()=>items.filter(row=>!search||[row.displayName,row.catalogRef].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search]);

  const create=()=>{
    if(!newName.trim()||!newUnit.trim())return;
    const row:InventoryItem={id:'inv-'+Date.now().toString(36),displayName:newName.trim(),baseUnit:newUnit.trim(),catalogRef:newCatalogRef.trim(),lowStockThreshold:newThreshold.trim(),active:true,quantity:0,revision:1};
    setItems(current=>[...current,row]);appendAdminAudit({action:'新增庫存統計項目',target:row.id,after:row});
    setNewName('');setNewUnit('');setNewCatalogRef('');setNewThreshold('');
  };
  const record=()=>{
    const amount=Number(quantity);
    if(!selectedId||!Number.isFinite(amount))return;
    setItems(current=>current.map(item=>{
      if(item.id!==selectedId)return item;
      const nextQuantity=action==='STOCKTAKE'||action==='OPENING'?amount:action==='WASTE'?item.quantity-Math.abs(amount):item.quantity+amount;
      return {...item,quantity:nextQuantity,revision:item.revision+1};
    }));
    const movement:InventoryMovement={id:'move-'+Date.now().toString(36),itemId:selectedId,action,quantity:amount,reason:reason.trim(),at:new Date().toISOString()};
    setMovements(current=>[movement,...current].slice(0,1000));appendAdminAudit({action:'記錄庫存數量變動',target:selectedId,reason:reason.trim(),after:movement});
    setQuantity('');setReason('');
  };

  return <section className="admin-editor-page">
    <Header title="庫存統計" description="Inventory Lite 用作原料／物料數量、收貨、損耗同實盤記錄。數量可以係 0 或負數，但唔會因此自動停售或阻交易。"/>
    <div className="admin-kpi-grid"><article><span>項目</span><strong>{items.length}</strong><small>統計項目</small></article><article><span>低庫存</span><strong>{items.filter(row=>row.lowStockThreshold!==''&&row.quantity<=Number(row.lowStockThreshold)).length}</strong><small>只作提示</small></article><article><span>負數</span><strong>{items.filter(row=>row.quantity<0).length}</strong><small>允許，待核對</small></article><article><span>變動記錄</span><strong>{movements.length}</strong><small>操作記錄</small></article></div>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>新增統計項目</h2><label><span>名稱</span><input value={newName} onChange={event=>setNewName(event.target.value)} placeholder="例如 紫米"/></label><label><span>基本單位</span><input value={newUnit} onChange={event=>setNewUnit(event.target.value)} placeholder="g / 件 / 包"/></label><label><span>商品 Ref（可選）</span><input value={newCatalogRef} onChange={event=>setNewCatalogRef(event.target.value)}/></label><label><span>低庫存提示值（可選）</span><input inputMode="decimal" value={newThreshold} onChange={event=>setNewThreshold(event.target.value)}/></label><button onClick={create}>新增項目</button></article>
      <article className="admin-policy-card"><h2>記錄數量變動</h2><label><span>項目</span><select value={selectedId} onChange={event=>setSelectedId(event.target.value)}><option value="">請選擇</option>{items.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label><span>動作</span><select value={action} onChange={event=>setAction(event.target.value as InventoryMovement['action'])}><option value="RECEIPT">收貨</option><option value="ADJUST">加減調整</option><option value="WASTE">損耗</option><option value="STOCKTAKE">實盤</option><option value="OPENING">期初數量</option></select></label><label><span>數量</span><input inputMode="decimal" value={quantity} onChange={event=>setQuantity(event.target.value)} placeholder={action==='ADJUST'?'可輸入 -2 或 3':'例如 5'}/></label><label><span>原因／備註（可選）</span><input value={reason} onChange={event=>setReason(event.target.value)}/></label><button onClick={record}>記錄變動</button></article>
    </div>
    <div className="admin-filterbar"><AdminSearchField label="搜尋庫存統計項目" value={search} onChange={setSearch} placeholder="搜尋原料／品項"/><span>{filtered.length} 項</span></div>
    <AdminResponsiveDataView
      label="庫存統計項目"
      rows={filtered}
      rowKey={row=>row.id}
      emptyTitle="未有庫存統計項目"
      emptyDescription="新增原料或品項後，數量同提示值會顯示喺呢度。"
      columns={[
        {key:'item',label:'品項',render:(row:InventoryItem)=>row.displayName},
        {key:'quantity',label:'目前數量',numeric:true,render:(row:InventoryItem)=>row.quantity},
        {key:'unit',label:'單位',render:(row:InventoryItem)=>row.baseUnit},
        {key:'threshold',label:'提示值',numeric:true,render:(row:InventoryItem)=>row.lowStockThreshold||'—'},
        {key:'revision',label:'版本',render:(row:InventoryItem)=>'R'+row.revision},
      ]}
    />
  </section>;
}

interface PresentationConfig{
  headline:string;eyebrow:string;body:string;ctaLabel:string;showPromos:boolean;showCategories:boolean;showImages:boolean;showDescriptions:boolean;tabletColumns:number;mobileColumns:number;quickProductIds:string[];
}
export function PresentationWorkspace({surface}:{surface:'CUSTOMER'|'OWNER'|'FRONTLINE'}){
  const key='presentation.'+surface.toLowerCase()+'.v1';
  const [customerChannel,setCustomerChannel]=usePersistentAdminState<{enabled:boolean}>('channel-policy.customer.v1',{enabled:true});
  const setCustomerChannelEnabled=(enabled:boolean)=>{
    const after={...customerChannel,enabled};
    appendAdminAudit({action:'修改自家落單渠道',target:'CUSTOMER',before:customerChannel,after});
    setCustomerChannel(after);
  };
  const [config,setConfig]=usePersistentAdminState<PresentationConfig>(key,{
    headline:'',eyebrow:'',body:'',ctaLabel:'',showPromos:true,showCategories:true,showImages:true,showDescriptions:true,tabletColumns:4,mobileColumns:2,quickProductIds:[],
  });
  const patch=(change:Partial<PresentationConfig>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改顯示設定',target:surface,before:current,after});return after;});
  const title=surface==='CUSTOMER'?'客戶端首頁':surface==='OWNER'?'老闆今日首頁':'前線點單版面';
  return <section className="admin-editor-page">
    <Header title={title} description="只管理受控顯示設定：顯示內容、區塊、欄數同快捷商品。商品名、價格、供應同訂單仍由正式資料決定。" badge="顯示設定"/>
    <div className="admin-policy-grid two">
      {surface==='CUSTOMER'?<article className="admin-policy-card"><h2>自家落單渠道</h2><label className="admin-toggle"><input type="checkbox" checked={customerChannel.enabled} onChange={event=>setCustomerChannelEnabled(event.target.checked)}/><span>{customerChannel.enabled?'接受自家落單':'暫停自家落單'}</span></label><p>關閉後客戶仍可睇已發布資料同已提交訂單，但新報價／新落單會停止。</p></article>:null}
      <article className="admin-policy-card"><h2>內容</h2><label><span>小標題</span><input value={config.eyebrow} onChange={event=>patch({eyebrow:event.target.value})}/></label><label><span>主標題</span><input value={config.headline} onChange={event=>patch({headline:event.target.value})}/></label><label><span>說明</span><textarea rows={4} value={config.body} onChange={event=>patch({body:event.target.value})}/></label><label><span>按鈕文字</span><input value={config.ctaLabel} onChange={event=>patch({ctaLabel:event.target.value})}/></label><label className="admin-toggle"><input type="checkbox" checked={config.showPromos} onChange={event=>patch({showPromos:event.target.checked})}/><span>顯示推廣區</span></label><label className="admin-toggle"><input type="checkbox" checked={config.showCategories} onChange={event=>patch({showCategories:event.target.checked})}/><span>顯示分類導覽</span></label></article>
      <article className="admin-policy-card"><h2>版面</h2><label className="admin-toggle"><input type="checkbox" checked={config.showImages} onChange={event=>patch({showImages:event.target.checked})}/><span>顯示商品圖片</span></label><label className="admin-toggle"><input type="checkbox" checked={config.showDescriptions} onChange={event=>patch({showDescriptions:event.target.checked})}/><span>顯示商品說明</span></label><label><span>平板每行欄數</span><input type="number" min={2} max={6} value={config.tabletColumns} onChange={event=>patch({tabletColumns:Number(event.target.value)||4})}/></label><label><span>手機每行欄數</span><input type="number" min={1} max={3} value={config.mobileColumns} onChange={event=>patch({mobileColumns:Number(event.target.value)||2})}/></label><label><span>快捷商品 ID（逗號分隔）</span><input value={config.quickProductIds.join(', ')} onChange={event=>patch({quickProductIds:event.target.value.split(',').map(value=>value.trim()).filter(Boolean)})}/></label></article>
    </div>
  </section>;
}

interface StoreBinding{provider:string;externalStoreId:string;mfkStoreId:string;displayName:string;active:boolean}
export function StoreBindingWorkspace(){
  const [rows,setRows]=usePersistentAdminState<StoreBinding[]>('store-bindings.v1',[]);
  const [provider,setProvider]=useState('KEETA');
  const [externalStore,setExternalStore]=useState('');
  const [mfkStore,setMfkStore]=useState('MF01');
  const [displayName,setDisplayName]=useState('');
  const add=()=>{if(!provider.trim()||!externalStore.trim()||!mfkStore.trim())return;const row:StoreBinding={provider:provider.trim(),externalStoreId:externalStore.trim(),mfkStoreId:mfkStore.trim(),displayName:displayName.trim(),active:true};setRows(current=>[...current.filter(item=>!(item.provider===row.provider&&item.externalStoreId===row.externalStoreId)),row]);appendAdminAudit({action:'保存平台門店對應',target:row.provider+':'+row.externalStoreId,after:row});setExternalStore('');setDisplayName('');};
  return <section className="admin-editor-page">
    <Header title="門店授權映射" description="管理平台門店身份同磨飯門店身份關係。呢度建立正式對應設定；未有平台回傳之前唔會顯示已接受。" badge="身份映射設定"/>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>新增對應</h2><label><span>平台</span><input value={provider} onChange={event=>setProvider(event.target.value)}/></label><label><span>平台門店編號</span><input value={externalStore} onChange={event=>setExternalStore(event.target.value)}/></label><label><span>磨飯門店編號</span><input value={mfkStore} onChange={event=>setMfkStore(event.target.value)}/></label><label><span>顯示名稱</span><input value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label><button onClick={add}>保存對應</button></article><article className="admin-policy-card"><h2>已設定對應</h2>{rows.length===0?<div className="admin-read-empty">未有門店對應設定。</div>:rows.map((row,index)=><p key={index}>{row.provider} · {row.externalStoreId} → {row.mfkStoreId} {row.displayName?'· '+row.displayName:''}</p>)}</article></div>
  </section>;
}

interface CustomerSnapshot{id:string;phone:string;displayName?:string;relationshipStatus?:string;orders:number;spendMinor:number;points?:number;tags?:string[];updatedAt:string}
export function Customer360Workspace(){
  const [rows]=usePersistentAdminState<CustomerSnapshot[]>('customer360-read.v1',[]);
  const [query,setQuery]=useState('');
  const found=rows.find(row=>[row.phone,row.id,row.displayName].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="admin-editor-page">
    <Header title="顧客資料" description="用電話／顧客編號查看正式顧客資料、消費摘要、會員積分同客戶標籤。電話唔等於顧客身份，會員資格亦唔等於聯絡同意。" badge="顧客資料"/>
    <div className="admin-filterbar"><AdminSearchField label="搜尋顧客資料" value={query} onChange={setQuery} placeholder="電話／顧客編號／名稱"/><span>{rows.length} 位顧客資料</span></div>
    {!query?<div className="admin-read-empty">輸入電話或顧客編號開始查詢。</div>:!found?<div className="admin-read-empty">目前正式 顧客資料 入面搵唔到呢位顧客。</div>:<div className="admin-policy-grid two"><section className="admin-read-card"><header><h2>{found.displayName||found.phone}</h2><span>{found.relationshipStatus||'未分類'}</span></header><p>顧客編號：{found.id}</p><p>電話：{found.phone}</p><p>標籤：{found.tags?.join('、')||'—'}</p></section><section className="admin-read-card"><header><h2>消費／會員</h2><span>{new Date(found.updatedAt).toLocaleString('zh-HK')}</span></header><p>訂單：{found.orders}</p><p>累計消費：{'HK$'+(found.spendMinor/100).toFixed(2)}</p><p>積分：{found.points??'—'}</p></section></div>}
  </section>;
}

interface LoyaltyTier{id:string;name:string;threshold:string;multiplier:string;active:boolean}
export function LoyaltyWorkspace(){
  const [tiers,setTiers]=usePersistentAdminState<LoyaltyTier[]>('loyalty.v1',[]);
  const [ledger]=usePersistentAdminState<Array<{customerId:string;delta:number;balance:number;reason:string;at:string}>>('loyalty-ledger-read.v1',[]);
  const add=()=>setTiers(current=>[...current,{id:'tier-'+Date.now().toString(36),name:'新等級',threshold:'0',multiplier:'1',active:true}]);
  const patch=(id:string,change:Partial<LoyaltyTier>)=>setTiers(current=>current.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>會員政策</small><h1>會員等級／積分</h1><p>管理會員等級同積分倍率；積分記錄只讀正式資料，唔會喺後台另外造第二本帳。</p></div><div className="admin-editor-actions"><button onClick={add}>新增會員等級</button></div></header>
    <div className="admin-policy-grid two"><article className="admin-policy-card"><h2>會員等級</h2>{tiers.length===0?<div className="admin-read-empty">未有會員等級設定。</div>:tiers.map(row=><div className="admin-sub-editor" key={row.id}><label><span>等級名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label><label><span>門檻</span><input inputMode="decimal" value={row.threshold} onChange={event=>patch(row.id,{threshold:event.target.value})}/></label><label><span>積分倍率</span><input inputMode="decimal" value={row.multiplier} onChange={event=>patch(row.id,{multiplier:event.target.value})}/></label><label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label></div>)}</article><article className="admin-policy-card"><h2>積分記錄</h2>{ledger.length===0?<div className="admin-read-empty">目前未有正式積分記錄。</div>:ledger.slice(0,20).map((row,index)=><p key={index}>{row.customerId} · {row.delta>0?'+':''}{row.delta} → {row.balance} · {row.reason}</p>)}</article></div>
  </section>;
}

interface Coupon{id:string;name:string;code:string;kind:'FIXED'|'PERCENT';value:string;active:boolean;startsAt:string;endsAt:string}
export function CouponsWorkspace(){
  const [rows,setRows]=usePersistentAdminState<Coupon[]>('coupons.v1',[]);
  const add=()=>setRows(current=>[...current,{id:'coupon-'+Date.now().toString(36),name:'新優惠券',code:'',kind:'FIXED',value:'',active:true,startsAt:'',endsAt:''}]);
  const patch=(id:string,change:Partial<Coupon>)=>setRows(current=>current.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>優惠政策</small><h1>優惠券</h1><p>管理優惠券名稱、Code、固定金額／百分比、有效期同啟用狀態；真正訂單計價由正式計價規則執行。</p></div><div className="admin-editor-actions"><button onClick={add}>新增優惠券</button></div></header>
    {rows.length===0?<div className="admin-read-empty">未有優惠券設定。</div>:<div className="admin-editor-grid">{rows.map(row=><article className="admin-policy-card" key={row.id}><label><span>名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label><label><span>優惠碼</span><input value={row.code} onChange={event=>patch(row.id,{code:event.target.value})}/></label><label><span>類型</span><select value={row.kind} onChange={event=>patch(row.id,{kind:event.target.value as Coupon['kind']})}><option value="FIXED">固定金額</option><option value="PERCENT">百分比</option></select></label><label><span>數值</span><input inputMode="decimal" value={row.value} onChange={event=>patch(row.id,{value:event.target.value})}/></label><label><span>開始</span><input type="datetime-local" value={row.startsAt} onChange={event=>patch(row.id,{startsAt:event.target.value})}/></label><label><span>結束</span><input type="datetime-local" value={row.endsAt} onChange={event=>patch(row.id,{endsAt:event.target.value})}/></label><label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label></article>)}</div>}
  </section>;
}

interface RfmSnapshot{metricVersion:string;generationId:string;updatedAt:string;recent:number;frequent:number;highValue:number;atRisk:number}
export function RfmWorkspace(){
  const [rows]=usePersistentAdminState<RfmSnapshot[]>('rfm-read.v1',[]);
  const latest=rows[0];
  return <section className="admin-editor-page">
    <Header title="客戶分群分析" description="只讀正式報表資料；客戶分群唔會自動改寫顧客標籤。" badge="顧客資料 報表"/>
    <div className="admin-kpi-grid"><article><span>近期消費</span><strong>{latest?.recent??'—'}</strong><small>{latest?.metricVersion??'未有資料'}</small></article><article><span>消費頻率</span><strong>{latest?.frequent??'—'}</strong><small>{latest?.generationId??'—'}</small></article><article><span>高價值顧客</span><strong>{latest?.highValue??'—'}</strong><small>只讀</small></article><article><span>可能流失</span><strong>{latest?.atRisk??'—'}</strong><small>{latest?.updatedAt?new Date(latest.updatedAt).toLocaleString('zh-HK'):'—'}</small></article></div>
    {!latest?<div className="admin-read-empty">目前未有正式客戶分群資料。</div>:null}
  </section>;
}

interface Announcement{id:string;title:string;body:string;audience:'ALL_STAFF'|'MANAGER'|'OWNER';active:boolean;createdAt:string}
export function AnnouncementsWorkspace(){
  const [rows,setRows]=usePersistentAdminState<Announcement[]>('announcements.v1',[]);
  const add=()=>setRows(current=>[...current,{id:'notice-'+Date.now().toString(36),title:'新公告',body:'',audience:'ALL_STAFF',active:true,createdAt:new Date().toISOString()}]);
  const patch=(id:string,change:Partial<Announcement>)=>setRows(current=>current.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>公告設定</small><h1>公告／通知</h1><p>管理公告內容、對象同啟用狀態。保存公告只代表後台已保存內容；未有正式送達證據前唔會顯示已送達。</p></div><div className="admin-editor-actions"><button onClick={add}>新增公告</button></div></header>
    {rows.length===0?<div className="admin-read-empty">未有公告。</div>:<div className="admin-editor-grid">{rows.map(row=><article className="admin-policy-card" key={row.id}><label><span>標題</span><input value={row.title} onChange={event=>patch(row.id,{title:event.target.value})}/></label><label><span>內容</span><textarea rows={6} value={row.body} onChange={event=>patch(row.id,{body:event.target.value})}/></label><label><span>對象</span><select value={row.audience} onChange={event=>patch(row.id,{audience:event.target.value as Announcement['audience']})}><option value="ALL_STAFF">全部員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option></select></label><label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label></article>)}</div>}
  </section>;
}

export function AdvancedWorkspace(){
  return <section className="admin-editor-page"><Header title="進階功能" description="低頻治理功能會由「系統」內各責任頁管理，唔喺呢度複製第二套設定。" badge="入口整合"/><div className="admin-read-empty">請使用「系統狀態」、「外部連接」同「進階設定」責任頁。</div></section>;
}
