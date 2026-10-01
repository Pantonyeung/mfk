import {useMemo,useState} from 'react';
import {PageHeader,ReadbackPanel,StatusBadge,Timeline} from './ui.tsx';
import {usePreviewAdmin} from './preview-admin-store.ts';

const AUDIT_ROWS=[
  {id:'audit-1',time:'10:18',actor:'老闆',action:'修改商品',target:'紫米飯糰・鹽麴雞',result:'草稿'},
  {id:'audit-2',time:'10:12',actor:'店長',action:'修改 Keeta 接單規則',target:'Keeta',result:'草稿'},
  {id:'audit-3',time:'09:42',actor:'老闆',action:'發佈設定',target:'R128',result:'已確認'},
  {id:'audit-4',time:'09:41',actor:'系統',action:'SMT 回讀',target:'SMT-01',result:'一致'},
] as const;

export function TodayPage({mode,onNavigate}:{mode:'overview'|'queue';onNavigate?:(path:string)=>void}){
  const drafts=usePreviewAdmin(state=>state.draftChanges);
  const devices=usePreviewAdmin(state=>state.devices);
  const channel=usePreviewAdmin(state=>state.channelConfig);
  if(mode==='queue'){
    const items=[
      ...drafts.map(item=>({id:item.id,title:item.object,domain:item.domain,impact:'未發佈變更',tone:'warning' as const,path:'/admin/publish/pending'})),
      ...devices.filter(item=>item.state!=='可用').map(item=>({id:item.id,title:item.name,domain:'裝置管理',impact:item.state,tone:'unknown' as const,path:'/admin/devices'})),
      ...(!channel.enabled?[{id:'channel-off',title:'Keeta',domain:'平台／渠道管理',impact:'平台設定停用',tone:'warning' as const,path:'/admin/channels'}]:[]),
    ];
    return <div className="v3-functional-page"><div className="v3-preview-banner"><strong>今日／待處理事項</strong><span>Action Queue 只分流去責任頁，唔喺呢度建立第二 mutation center。</span></div><PageHeader eyebrow="今日" title="待處理事項" description="按目前 Preview 狀態聚合需要處理嘅工作。" aside={<span className="v3-product-count">{items.length} 項</span>}/>
      <div className="v3-action-list">{items.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.domain}</small></div><StatusBadge tone={item.tone}>{item.impact}</StatusBadge><button type="button" onClick={()=>onNavigate?.(item.path)}>前往責任頁</button></article>)}</div>
    </div>;
  }
  const stale=devices.filter(item=>item.state==='資料過期').length;
  return <div className="v3-functional-page"><div className="v3-preview-banner"><strong>今日 Preview</strong><span>以下數字只供 UI／flow 驗收，唔係 Production 營業數據。</span></div><PageHeader eyebrow="今日" title="營運總覽" description="每日第一頁：營業額、訂單、重要異常、營業準備。" />
    <section className="v3-whole-kpi-grid"><article><span>今日有效營業額</span><strong>HK$8,642</strong><small>最後更新 10:18</small><StatusBadge tone="good">已確認</StatusBadge></article><article><span>訂單數</span><strong>126</strong><small>12 張進行中</small></article><article><span>平均客單價</span><strong>HK$68.59</strong></article><article><span>未發佈變更</span><strong>{drafts.length}</strong><StatusBadge tone={drafts.length?'warning':'good'}>{drafts.length?'需要處理':'已清空'}</StatusBadge></article></section>
    <section className="v3-functional-section"><h3>營運準備狀態</h3><div className="v3-readiness-stack"><div><span>Keeta 接單</span><StatusBadge tone={channel.enabled?'good':'warning'}>{channel.enabled?'接單設定啟用':'已停用'}</StatusBadge></div><div><span>裝置</span><StatusBadge tone={stale?'unknown':'good'}>{stale?stale+' 部資料過期':'全部可用'}</StatusBadge></div><div><span>菜單草稿</span><StatusBadge tone={drafts.length?'warning':'good'}>{drafts.length?drafts.length+' 項未發佈':'冇未發佈變更'}</StatusBadge></div></div></section>
  </div>;
}

export function AuditPage(){
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>AUDIT_ROWS.filter(item=>!query.trim()||(item.actor+' '+item.action+' '+item.target).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[query]);
  return <div className="v3-functional-page"><PageHeader eyebrow="系統管理" title="操作記錄" description="Immutable-style read-only Preview；冇 Edit / Delete。" /><section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋操作人、動作、物件"/></div></section><div className="v3-action-list">{rows.map(item=><article key={item.id}><div><strong>{item.action} · {item.target}</strong><small>{item.time} · {item.actor}</small></div><StatusBadge tone={item.result==='已確認'?'good':'warning'}>{item.result}</StatusBadge></article>)}</div></div>;
}

export function DiagnosticsPage(){
  const devices=usePreviewAdmin(state=>state.devices);
  const channel=usePreviewAdmin(state=>state.channelConfig);
  const drafts=usePreviewAdmin(state=>state.draftChanges);
  return <div className="v3-functional-page"><PageHeader eyebrow="系統管理" title="系統診斷" description="第一個異常點、Canonical、Target readback 同相關 domain evidence 集中顯示。" />
    <ReadbackPanel publishedAt="2026-10-01 09:42:18" cloud="Canonical R128" target="SMT R128"/>
    <section className="v3-functional-section"><h3>第一個異常點</h3><div className="v3-action-list"><article><div><strong>產品圖片 R2 Preview</strong><small>Cloudflare Preview Lab</small></div><StatusBadge tone="warning">R2 bucket 待 provision</StatusBadge></article><article><div><strong>Keeta</strong><small>Provider Shop {channel.providerShopId}</small></div><StatusBadge tone={channel.enabled?'good':'warning'}>{channel.enabled?'設定啟用':'設定停用'}</StatusBadge></article><article><div><strong>正式草稿</strong><small>Preview count</small></div><StatusBadge tone={drafts.length?'warning':'good'}>{drafts.length+' 項'}</StatusBadge></article>{devices.map(device=><article key={device.id}><div><strong>{device.name}</strong><small>{device.version} · {device.lastSeen}</small></div><StatusBadge tone={device.state==='可用'?'good':device.state==='資料過期'?'unknown':'warning'}>{device.state}</StatusBadge></article>)}</div></section>
  </div>;
}

export function IntegrationsPage(){
  const channel=usePreviewAdmin(state=>state.channelConfig);
  return <div className="v3-functional-page"><PageHeader eyebrow="系統管理" title="系統整合" description="連線、授權、資料責任同 freshness 概覽；正常修改返回各自 Primary Home。" />
    <div className="v3-functional-card-grid"><article className="v3-functional-card-static"><div><strong>Keeta</strong><small>Provider Shop {channel.providerShopId}</small></div><StatusBadge tone={channel.enabled?'good':'warning'}>{channel.enabled?'已連接':'未啟用'}</StatusBadge><small>管理位置：平台／渠道管理</small></article><article className="v3-functional-card-static"><div><strong>SMT Store Kernel</strong><small>正式 transaction authority</small></div><StatusBadge tone="good">回讀一致</StatusBadge><small>R128</small></article><article className="v3-functional-card-static"><div><strong>Customer</strong><small>公開菜單 projection</small></div><StatusBadge tone="good">已連接</StatusBadge><small>Canonical snapshot</small></article></div>
  </div>;
}

export function EffectiveSettingsPage({onNavigate}:{onNavigate?:(path:string)=>void}){
  const settings=usePreviewAdmin(state=>state.storeSettings);
  const channel=usePreviewAdmin(state=>state.channelConfig);
  const rows=[
    ['門店名稱',settings.storeName,'門店設定／門店資料','/admin/store/settings'],
    ['營業日分界',settings.businessDayCutoff,'門店設定／營業日分界','/admin/store/business-day'],
    ['Keeta 自動接單',channel.autoAccept?'開':'關','平台／渠道管理／接單規則','/admin/channels/accept-policy'],
    ['供應同步',channel.syncSellability?'開':'關','平台／渠道管理／供應同步','/admin/channels/sync-policy'],
    ['Keeta Shop ID',channel.providerShopId,'平台／渠道管理／門店綁定','/admin/channels/store-binding'],
  ];
  return <div className="v3-functional-page"><PageHeader eyebrow="系統管理" title="進階／實際生效設定" description="Read-mostly effective values；正常修改返回唯一 Primary Home。" /><div className="v3-action-list">{rows.map(([name,value,source,path])=><article key={name}><div><strong>{name}</strong><small>來源：{source}</small></div><strong>{value}</strong><button type="button" onClick={()=>onNavigate?.(path)}>前往原設定頁</button></article>)}</div></div>;
}
