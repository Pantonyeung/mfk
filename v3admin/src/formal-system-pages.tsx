import {useMemo} from 'react';
import {useV3FormalDraft} from './formal-draft.tsx';
import {useV3ReadModels} from './formal-read-model.tsx';
import {readFormalCatalog} from './formal-catalog.ts';
import {readFormalOptionCenter,validateFormalOptionCenter} from './formal-option-center.ts';
import {readFormalCombos,validateFormalComboData} from './formal-combo.ts';
import {readFormalKeetaMappings,readFormalKeetaPolicy,validateFormalKeetaMappings} from './formal-channel.ts';
import {readFormalLogicalPrinters,readFormalPrintTemplates,FORMAL_PRINT_ROUTING_GAP} from './formal-print.ts';
import {readFormalStaff,validateFormalStaff,FORMAL_STAFF_AUTH_GAP} from './formal-staff.ts';
import {readFormalCapacity,validateFormalCapacity,FORMAL_CAPACITY_RUNTIME_GAP} from './formal-capacity.ts';
import {readFormalBusinessDay,readFormalStoreSettings} from './formal-store.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

type QueueRow={id:string;title:string;detail:string;path:string;tone:'warning'|'danger'|'unknown'};

export function FormalActionQueuePage({onNavigate}:{onNavigate:(path:string)=>void}){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const rows=useMemo(()=>{
    const queue:QueueRow[]=[];
    if(formal.draft)queue.push({id:'draft',title:'有未發佈正式草稿',detail:'Draft R'+formal.draft.draftRevision+' · 最後更新 '+formal.draft.updatedAt,path:'/admin/publish/pending',tone:'warning'});
    const validators=[
      ['options',validateFormalOptionCenter(readFormalOptionCenter(formal.workingSnapshot)),'選項／口味資料需要修正','/admin/catalog/modifiers'],
      ['combos',validateFormalComboData(formal.workingSnapshot),'套餐／Pool 資料需要修正','/admin/catalog/combos'],
      ['staff',validateFormalStaff(formal.workingSnapshot),'員工／權限資料需要修正','/admin/staff'],
      ['capacity',validateFormalCapacity(formal.workingSnapshot),'產能 Pool 資料需要修正','/admin/operations/capacity'],
      ['mapping',validateFormalKeetaMappings(formal.workingSnapshot),'Keeta 商品映射需要修正','/admin/channels/mapping-failure'],
    ] as const;
    for(const [id,errors,title,path] of validators){
      if(errors.length)queue.push({id,title,detail:errors.slice(0,3).join('；')+(errors.length>3?'；…':''),path,tone:'danger'});
    }
    if(read.ordersError)queue.push({id:'orders-read',title:'訂單 Projection 讀取失敗',detail:read.ordersError.message,path:'/admin/orders/open',tone:'unknown'});
    if(read.reportsError)queue.push({id:'reports-read',title:'銷售 Projection 讀取失敗',detail:read.reportsError.message,path:'/admin/reports/sales',tone:'unknown'});
    if(read.refundsError)queue.push({id:'refunds-read',title:'退款 Evidence 讀取失敗',detail:read.refundsError.message,path:'/admin/reports/refunds',tone:'unknown'});
    return queue;
  },[formal.draft,formal.workingSnapshot,read.ordersError,read.reportsError,read.refundsError]);

  return <div className="v3-functional-page">
    <PageHeader eyebrow="今日" title="待處理事項" description="只聚合真正需要處理嘅 Formal Draft validation / authoritative read errors；唔建立第二 mutation center。" aside={<span className="v3-product-count">{rows.length} 項</span>}/>
    {!rows.length?<section className="v3-product-empty"><h2>目前冇需要處理嘅正式事項</h2><p>未發佈草稿、validation error 同 read-model error 都係 0。</p></section>:<div className="v3-action-list">{rows.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small></div><StatusBadge tone={item.tone}>需要處理</StatusBadge><button type="button" onClick={()=>onNavigate(item.path)}>前往責任頁</button></article>)}</div>}
  </div>;
}

export function FormalDiagnosticsPage(){
  const formal=useV3FormalDraft();
  const read=useV3ReadModels();
  const catalog=useMemo(()=>readFormalCatalog(formal.workingSnapshot),[formal.workingSnapshot]);
  const printers=useMemo(()=>readFormalLogicalPrinters(formal.workingSnapshot),[formal.workingSnapshot]);
  const rows=[
    ['Canonical Revision',String(formal.canonical.revision),'good' as const],
    ['Canonical Published',formal.canonical.publishedAt,'good' as const],
    ['Draft',formal.draft?'R'+formal.draft.draftRevision:'冇正式草稿',formal.draft?'warning' as const:'good' as const],
    ['Catalog',catalog.categories.length+' 分類 / '+catalog.products.length+' 商品','good' as const],
    ['Logical Printers',printers.length+' 個','good' as const],
    ['Orders Projection',read.ordersError?read.ordersError.message:read.ordersPending?'讀取中':read.orders.length+' 張','good' as const],
    ['Reports Projection',read.reportsError?read.reportsError.message:read.reportsPending?'讀取中':read.days.length+' 日','good' as const],
    ['Refund Evidence',read.refundsError?read.refundsError.message:read.refundsPending?'讀取中':read.refunds.length+' 筆','good' as const],
  ];
  return <div className="v3-functional-page">
    <PageHeader eyebrow="系統管理" title="系統診斷" description="集中睇 Formal Canonical / Draft / Projection evidence；未知就保持未知。"/>
    <div className="v3-action-list">{rows.map(([label,value,tone])=><article key={label}><div><strong>{label}</strong><small>{value}</small></div><StatusBadge tone={tone}>{String(value).includes('HTTP')||String(value).includes('FAILED')?'需要處理':'已讀取'}</StatusBadge></article>)}</div>
    <section className="v3-functional-section">
      <header><div><h3>已知正式 seam gaps</h3><p>呢啲係現時刻意 fail-closed，唔會用 Preview State 扮正式功能。</p></div><StatusBadge tone="warning">GAPS</StatusBadge></header>
      <div className="v3-action-list">
        <article><div><strong>Product Print Routing</strong><small>{FORMAL_PRINT_ROUTING_GAP.requiredV3Shape}</small></div><StatusBadge tone="warning">SCHEMA</StatusBadge></article>
        <article><div><strong>Capacity Runtime</strong><small>{FORMAL_CAPACITY_RUNTIME_GAP.missing}</small></div><StatusBadge tone="warning">SMT</StatusBadge></article>
        <article><div><strong>Session / Trusted Device</strong><small>{FORMAL_STAFF_AUTH_GAP.sessionManagement}</small></div><StatusBadge tone="warning">SECURITY</StatusBadge></article>
      </div>
    </section>
  </div>;
}

export function FormalIntegrationsPage(){
  const formal=useV3FormalDraft();
  const policy=useMemo(()=>readFormalKeetaPolicy(formal.workingSnapshot),[formal.workingSnapshot]);
  const mappings=useMemo(()=>readFormalKeetaMappings(formal.workingSnapshot),[formal.workingSnapshot]);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="系統管理" title="系統整合" description="顯示目前已正式接入嘅 Admin config authority，同未接嘅 runtime seam。"/>
    <div className="v3-functional-card-grid">
      <article className="v3-functional-card-static"><div><strong>Admin Canonical</strong><small>Formal config authority</small></div><b>R{formal.canonical.revision}</b><StatusBadge tone="good">已接</StatusBadge></article>
      <article className="v3-functional-card-static"><div><strong>Keeta Config</strong><small>{mappings.length} 個商品映射 · {policy.displayName}</small></div><b>{policy.enabled?'ON':'OFF'}</b><StatusBadge tone="good">Formal Draft 已接</StatusBadge></article>
      <article className="v3-functional-card-static"><div><strong>SMT Projection</strong><small>Orders / Sales / Refund evidence</small></div><b>Read Model</b><StatusBadge tone="good">已接</StatusBadge></article>
      <article className="v3-functional-card-static"><div><strong>Keeta Live Runtime</strong><small>OAuth / Provider command / readback</small></div><b>Runtime</b><StatusBadge tone="warning">未完整接 V3</StatusBadge></article>
    </div>
  </div>;
}

export function FormalEffectiveSettingsPage({onNavigate}:{onNavigate:(path:string)=>void}){
  const formal=useV3FormalDraft();
  const store=useMemo(()=>readFormalStoreSettings(formal.workingSnapshot),[formal.workingSnapshot]);
  const day=useMemo(()=>readFormalBusinessDay(formal.workingSnapshot),[formal.workingSnapshot]);
  const capacity=useMemo(()=>readFormalCapacity(formal.workingSnapshot),[formal.workingSnapshot]);
  const channel=useMemo(()=>readFormalKeetaPolicy(formal.workingSnapshot),[formal.workingSnapshot]);
  const templates=useMemo(()=>readFormalPrintTemplates(formal.workingSnapshot),[formal.workingSnapshot]);
  const rows=[
    ['門店名稱',store.storeName,'/admin/store/settings'],
    ['營業日分界',day.cutoff,'/admin/store/business-day'],
    ['Keeta 自動接單',channel.autoAccept?'開':'關','/admin/channels/accept-policy'],
    ['Keeta 售罄同步',channel.syncSellability?'開':'關','/admin/channels/sync-policy'],
    ['產能 Pools',String(capacity.pools.length),'/admin/operations/capacity'],
    ['Label Template',templates.label?'已設定':'未設定','/admin/print/templates'],
  ] as const;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="系統管理" title="進階／實際生效設定" description="Read-only effective view；修改要返回唯一 Primary Home，唔喺呢度另開第二 authority。"/>
    <div className="v3-action-list">{rows.map(([label,value,path])=><article key={label}><div><strong>{label}</strong><small>Formal working snapshot</small></div><strong>{value}</strong><button type="button" onClick={()=>onNavigate(path)}>前往原設定頁</button></article>)}</div>
  </div>;
}

export function FormalAuditGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="系統管理" title="操作記錄" description="V3 暫未驗證到 immutable server audit read endpoint；唔會將舊 localStorage audit 冒充正式記錄。"/>
    <section className="v3-functional-section"><header><div><h3>Server Audit Read Seam 未接</h3><p>正式操作記錄需要 server-side immutable evidence，包括 actor / action / target / before-after reference / timestamp。</p></div><StatusBadge tone="warning">READ SEAM REQUIRED</StatusBadge></header></section>
  </div>;
}
