import {useMemo,useState,type ReactNode} from 'react';
import {ADMIN_DESTINATIONS,destinationForPath,menuForDestination} from './navigation.ts';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {DraftBar,PageHeader,ReadbackPanel,StatusBadge,Timeline} from './ui.tsx';

type WorkspaceKind='overview'|'queue'|'orders'|'catalog'|'operations'|'channels'|'print'|'devices'|'people'|'reports'|'publish'|'store'|'system';

type DemoRow={
  id:string;
  title:string;
  meta:string;
  value:string;
  status:string;
  group?:string;
  tone?:'neutral'|'good'|'warning'|'danger'|'unknown';
};

const KIND_BY_PATH:Record<string,WorkspaceKind>={
  '/admin/overview':'overview',
  '/admin/action-queue':'queue',
  '/admin/orders/open':'orders',
  '/admin/orders/history':'orders',
  '/admin/orders/exceptions':'orders',
  '/admin/catalog/categories':'catalog',
  '/admin/catalog/modifiers':'catalog',
  '/admin/catalog/combos':'catalog',
  '/admin/catalog/pricing':'catalog',
  '/admin/catalog/menu-display':'catalog',
  '/admin/business-day':'operations',
  '/admin/cash-close':'operations',
  '/admin/operations/capacity':'operations',
  '/admin/channels':'channels',
  '/admin/channels/accept-policy':'channels',
  '/admin/channels/sync-policy':'channels',
  '/admin/channels/store-binding':'channels',
  '/admin/channels/product-mapping':'channels',
  '/admin/channels/mapping-failure':'channels',
  '/admin/channels/net-estimate':'channels',
  '/admin/channels/settlement':'channels',
  '/admin/print':'print',
  '/admin/print/printers':'print',
  '/admin/print/templates':'print',
  '/admin/print/rules':'print',
  '/admin/print/exceptions':'print',
  '/admin/devices':'devices',
  '/admin/ota':'devices',
  '/admin/staff':'people',
  '/admin/roles':'people',
  '/admin/permissions':'people',
  '/admin/access':'people',
  '/admin/reports/sales':'reports',
  '/admin/reports/products':'reports',
  '/admin/reports/channels':'reports',
  '/admin/reports/refunds':'reports',
  '/admin/reports/operations':'reports',
  '/admin/reports/export':'reports',
  '/admin/publish/pending':'publish',
  '/admin/publish':'publish',
  '/admin/publish/versions':'publish',
  '/admin/publish/rollback':'publish',
  '/admin/store/settings':'store',
  '/admin/store/hours':'store',
  '/admin/store/business-day':'store',
  '/admin/store/operations':'store',
  '/admin/store/quick-reasons':'store',
  '/admin/system/audit':'system',
  '/admin/system/diagnostics':'system',
  '/admin/system/integrations':'system',
  '/admin/system/advanced':'system',
};

export const IMPLEMENTED_ROUTE_PATHS=Object.freeze(Object.keys(KIND_BY_PATH));
const DEDICATED_PREVIEW_ROUTES=new Set(['/admin/catalog/products','/admin/catalog/modifiers','/admin/catalog/combos','/admin/availability','/admin/store/tables']);


const PREVIEW_ROWS:Record<WorkspaceKind,readonly DemoRow[]>={
  overview:[
    {id:'ov-1',title:'有效營業額',meta:'今日 05:00 至現在',value:'HK$8,642',status:'最後更新 10:18',tone:'good'},
    {id:'ov-2',title:'訂單數',meta:'所有渠道',value:'126',status:'12 張進行中',tone:'good'},
    {id:'ov-3',title:'平均客單價',meta:'有效營業額 ÷ 訂單數',value:'HK$68.59',status:'正常',tone:'neutral'},
    {id:'ov-4',title:'未發佈變更',meta:'正式 Server Draft',value:'4',status:'需要檢查',tone:'warning'},
  ],
  queue:[
    {id:'q-1',title:'4 項未發佈變更',meta:'菜單管理',value:'前往未發佈變更',status:'需要處理',tone:'warning'},
    {id:'q-2',title:'1 部裝置資料過期',meta:'裝置管理',value:'前往裝置狀態',status:'資料過期',tone:'unknown'},
    {id:'q-3',title:'Keeta 商品映射待確認',meta:'平台／渠道管理',value:'前往商品映射',status:'需要處理',tone:'warning'},
  ],
  orders:[
    {id:'MF-2601001',title:'MF-2601001',meta:'自家平台 · 外賣',value:'HK$86.00',status:'進行中',tone:'warning'},
    {id:'MF-2601002',title:'MF-2601002',meta:'Keeta · 自取',value:'HK$52.00',status:'可取餐',tone:'good'},
    {id:'MF-2600988',title:'MF-2600988',meta:'門店 · 堂食',value:'HK$124.00',status:'已完成',tone:'neutral'},
  ],
  catalog:[
    {id:'cat-1',title:'飯糰',meta:'12 件商品',value:'顯示次序 10',status:'已發佈',tone:'good',group:'商品分類'},
    {id:'cat-2',title:'飯類',meta:'8 件商品',value:'顯示次序 20',status:'已發佈',tone:'good',group:'商品分類'},
    {id:'cat-3',title:'茶飲',meta:'9 件商品',value:'顯示次序 30',status:'草稿',tone:'warning',group:'商品分類'},
    {id:'cat-4',title:'辣度選擇',meta:'單選 · 3 個選項',value:'必選',status:'已發佈',tone:'good',group:'選項／口味'},
    {id:'cat-5',title:'加配飲品套餐',meta:'主餐＋飲品',value:'HK$12 起',status:'草稿',tone:'warning',group:'套餐'},
  ],
  operations:[
    {id:'op-1',title:'今日營業日',meta:'2026-10-01 · 05:00 開始',value:'進行中',status:'最後確認 10:18',tone:'good'},
    {id:'op-2',title:'現金點算',meta:'預計 HK$2,840',value:'未開始',status:'收舖時處理',tone:'neutral'},
    {id:'op-3',title:'飯糰產能',meta:'每日 180 件',value:'剩餘 74',status:'正常',tone:'good'},
  ],
  channels:[
    {id:'ch-1',title:'Keeta',meta:'門店已綁定',value:'接單中',status:'最後同步 10:16',tone:'good'},
    {id:'ch-2',title:'自家平台',meta:'order.morefunos.com',value:'接單中',status:'最後確認 10:17',tone:'good'},
    {id:'ch-3',title:'商品映射',meta:'184 / 186 已確認',value:'2 項待處理',status:'需要處理',tone:'warning'},
    {id:'ch-4',title:'平台對帳',meta:'2026-09-30',value:'HK$6,428.20',status:'只讀',tone:'neutral'},
  ],
  print:[
    {id:'pr-1',title:'收據機',meta:'80mm 熱敏',value:'RECEIPT',status:'已啟用',tone:'good'},
    {id:'pr-2',title:'廚房製作單機',meta:'80mm 熱敏',value:'PRODUCTION',status:'已啟用',tone:'good'},
    {id:'pr-3',title:'飯糰標籤',meta:'50×40 Label',value:'LABEL',status:'已啟用',tone:'good'},
    {id:'pr-4',title:'打印異常',meta:'今日',value:'1 項',status:'需要檢查',tone:'warning'},
  ],
  devices:[
    {id:'dv-1',title:'SMM-01',meta:'櫃檯 Android',value:'v2.18.4',status:'可用',tone:'good'},
    {id:'dv-2',title:'SMT-01',meta:'Store Kernel',value:'v2.18.4',status:'可用',tone:'good'},
    {id:'dv-3',title:'KDS-02',meta:'廚房顯示',value:'v2.17.9',status:'資料過期',tone:'unknown'},
  ],
  people:[
    {id:'st-1',title:'老闆',meta:'OWNER · 全店',value:'Admin Login',status:'啟用',tone:'good'},
    {id:'st-2',title:'店長',meta:'MANAGER · 全店',value:'營運管理',status:'啟用',tone:'good'},
    {id:'st-3',title:'會計',meta:'VIEWER · 報表',value:'只讀',status:'啟用',tone:'neutral'},
  ],
  reports:[
    {id:'rp-1',title:'有效營業額',meta:'今日',value:'HK$8,642',status:'+8.2% 對上週',tone:'good'},
    {id:'rp-2',title:'訂單數',meta:'今日',value:'126',status:'+5.0%',tone:'good'},
    {id:'rp-3',title:'退款',meta:'今日',value:'HK$168',status:'3 筆',tone:'neutral'},
  ],
  publish:[
    {id:'pb-1',title:'菜單',meta:'2 個商品 + 1 個分類',value:'3 項變更',status:'已儲存草稿',tone:'warning'},
    {id:'pb-2',title:'門店設定',meta:'營業時間',value:'1 項變更',status:'已儲存草稿',tone:'warning'},
    {id:'pb-3',title:'最近正式版本',meta:'2026-10-01 09:42',value:'R128',status:'雲端已發佈',tone:'good'},
  ],
  store:[
    {id:'ss-1',title:'門店名稱',meta:'正式門店資料',value:'磨飯 More Fun',status:'已發佈',tone:'good'},
    {id:'ss-2',title:'營業時間',meta:'星期一至日',value:'11:00–20:00',status:'已發佈',tone:'good'},
    {id:'ss-3',title:'營業日分界',meta:'每日',value:'05:00',status:'已發佈',tone:'good'},
    {id:'ss-4',title:'快捷原因',meta:'售罄／退款／異常',value:'8 項',status:'已發佈',tone:'good'},
  ],
  system:[
    {id:'sy-1',title:'Admin Canonical',meta:'正式配置資料',value:'R128',status:'一致',tone:'good'},
    {id:'sy-2',title:'SMT 回讀',meta:'門店 Store Kernel',value:'R128',status:'目標已套用',tone:'good'},
    {id:'sy-3',title:'Keeta Integration',meta:'OAuth / Store Binding',value:'已連接',status:'最後確認 10:15',tone:'good'},
    {id:'sy-4',title:'Customer Integration',meta:'Order Channel',value:'已連接',status:'最後確認 10:17',tone:'good'},
  ],
};

function pathSpecificRows(path:string,kind:WorkspaceKind){
  const rows=[...PREVIEW_ROWS[kind]];
  if(path==='/admin/catalog/pricing')return [
    {id:'price-1',title:'紫米飯糰・照燒雞',meta:'飯糰',value:'HK$42.00',status:'已發佈',tone:'good' as const,group:'飯糰'},
    {id:'price-2',title:'紫米飯糰・吞拿魚',meta:'飯糰',value:'HK$40.00',status:'已發佈',tone:'good' as const,group:'飯糰'},
    {id:'price-3',title:'香煎雞扒紫米飯',meta:'飯類',value:'HK$52.00',status:'草稿',tone:'warning' as const,group:'飯類'},
  ];
  if(path==='/admin/channels/product-mapping')return [
    {id:'map-1',title:'紫米飯糰・照燒雞',meta:'PRD000123',value:'Keeta SKU 880123',status:'已確認',tone:'good' as const,group:'飯糰'},
    {id:'map-2',title:'紫米飯糰・吞拿魚',meta:'PRD000124',value:'Keeta SKU 880124',status:'已確認',tone:'good' as const,group:'飯糰'},
    {id:'map-3',title:'紫米飯糰・黑椒牛肉',meta:'PRD000133',value:'未映射',status:'需要處理',tone:'warning' as const,group:'飯糰'},
  ];
  return rows;
}

function KpiGrid({rows}:{rows:readonly DemoRow[]}){
  return <section className="v3-whole-kpi-grid">{rows.map(item=><article key={item.id}>
    <span>{item.title}</span><strong>{item.value}</strong><small>{item.meta}</small><StatusBadge tone={item.tone??'neutral'}>{item.status}</StatusBadge>
  </article>)}</section>;
}

function DenseList({rows,onOpen}:{rows:readonly DemoRow[];onOpen:(row:DemoRow)=>void}){
  return <section className="v3-whole-list">
    {rows.map(item=><button type="button" key={item.id} onClick={()=>onOpen(item)}>
      <span className="v3-whole-list-main"><strong>{item.title}</strong><small>{item.meta}</small></span>
      <span className="v3-whole-list-value">{item.value}</span>
      <StatusBadge tone={item.tone??'neutral'}>{item.status}</StatusBadge>
      <span aria-hidden="true">›</span>
    </button>)}
  </section>;
}

function MobileDenseGroups({rows,onOpen}:{rows:readonly DemoRow[];onOpen:(row:DemoRow)=>void}){
  return <div className="v3-whole-mobile-groups"><MobileGroupedPager
    items={rows.map(item=>({...item,group:item.group??'全部'}))}
    pageSize={10}
    renderItem={item=><button key={item.id} type="button" className="v3-whole-mobile-record" onClick={()=>onOpen(item)}>
      <span><strong>{item.title}</strong><small>{item.meta}</small></span>
      <span><b>{item.value}</b><StatusBadge tone={item.tone??'neutral'}>{item.status}</StatusBadge></span>
    </button>}
  /></div>;
}

function PreviewEditModal({title,row,onClose}:{title:string;row:DemoRow|null;onClose:()=>void}){
  if(!row)return null;
  return <div className="v3-mobile-product-modal v3-whole-modal" role="dialog" aria-modal="true" aria-label={title}>
    <button type="button" className="v3-mobile-modal-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-mobile-modal-sheet">
      <header><div><small>{title}</small><h2>{row.title}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <form onSubmit={event=>{event.preventDefault();onClose();}}>
        <label><span>名稱</span><input defaultValue={row.title}/></label>
        <label><span>目前資料</span><input defaultValue={row.value}/></label>
        <label><span>狀態</span><input defaultValue={row.status}/></label>
        <div className="v3-mobile-form-note">此公網只供 Admin V3 介面／流程驗收。呢次修改唔會寫入正式 Canonical 或 Production。</div>
        <footer><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="submit">儲存預覽</button></footer>
      </form>
    </section>
  </div>;
}

function WorkspacePreviewBanner(){
  return <div className="v3-preview-banner" role="status"><strong>Admin V3 全域公網實作</strong><span>目前展示已鎖 UI / workflow；示例資料非 Canonical，Production 完全不受影響。</span></div>;
}

function PrimaryAction({label,onClick,readOnly}:{label:string;onClick:()=>void;readOnly:boolean}){
  return <button className="v3-primary" type="button" onClick={onClick} disabled={readOnly&&/查看|重新/.test(label)===false}>{label}</button>;
}

function OverviewWorkspace({path}:{path:string}){
  const rows=pathSpecificRows(path,'overview');
  return <>
    <KpiGrid rows={rows}/>
    <section className="v3-whole-two-col">
      <article className="v3-whole-panel"><header><h2>今日重點</h2><span>按影響排序</span></header><DenseList rows={PREVIEW_ROWS.queue} onOpen={()=>{}}/></article>
      <article className="v3-whole-panel"><header><h2>系統準備狀態</h2><span>最後確認 10:18</span></header>
        <div className="v3-readiness-stack">
          {['菜單資料','打印用途','渠道接單','SMT 回讀'].map((label,index)=><div key={label}><span>{label}</span><StatusBadge tone={index===2?'warning':'good'}>{index===2?'需要留意':'已確認'}</StatusBadge></div>)}
        </div>
      </article>
    </section>
  </>;
}

function PublishWorkspace({path}:{path:string}){
  const rows=pathSpecificRows(path,'publish');
  if(path==='/admin/publish/versions')return <>
    <ReadbackPanel publishedAt="2026-10-01 09:42:18" cloud="雲端已發佈 · R128" target="SMT 已套用 · R128"/>
    <section className="v3-whole-panel"><header><h2>版本時間線</h2></header><Timeline items={[
      {title:'R128 目標已套用',time:'09:42',description:'SMT-01 回讀一致'},
      {title:'R128 雲端已發佈',time:'09:42',description:'Cloud canonical accepted'},
      {title:'R127',time:'昨日',description:'上一正式版本'},
    ]}/></section>
  </>;
  return <><DenseList rows={rows} onOpen={()=>{}}/><DraftBar count={4} onReview={()=>{}}/></>;
}

export function AdminWorkspace({path,previewMode=false}:{
  path:string;
  previewMode?:boolean;
}){
  const destination=destinationForPath(path);
  const menu=menuForDestination(destination);
  const kind=KIND_BY_PATH[path]??'system';
  const rows=pathSpecificRows(path,kind);
  const [openRow,setOpenRow]=useState<DemoRow|null>(null);
  const [notice,setNotice]=useState('');
  const readOnly=destination.authority==='read-only';

  const action=()=>{
    if(readOnly){setNotice('已重新讀取介面預覽。');return;}
    setOpenRow(rows[0]??{id:'new',title:destination.primaryAction,meta:'',value:'',status:'草稿',tone:'warning'});
  };

  const body:ReactNode=
    path==='/admin/overview'?<OverviewWorkspace path={path}/>:
    kind==='publish'?<PublishWorkspace path={path}/>:
    kind==='reports'?<><KpiGrid rows={rows}/><DenseList rows={rows} onOpen={setOpenRow}/></>:
    kind==='system'&&path==='/admin/system/diagnostics'?<><ReadbackPanel publishedAt="2026-10-01 09:42:18" cloud="Canonical R128" target="SMT R128"/><DenseList rows={rows} onOpen={setOpenRow}/></>:
    <><div className="v3-whole-desktop"><DenseList rows={rows} onOpen={setOpenRow}/></div><MobileDenseGroups rows={rows} onOpen={setOpenRow}/></>;

  return <div className="v3-whole-workspace" data-route={path}>
    {previewMode?<WorkspacePreviewBanner/>:null}
    {notice?<div className="v3-preview-notice" role="status">{notice}</div>:null}
    <PageHeader
      eyebrow={menu.label}
      title={destination.title}
      description={readOnly?'只讀正式資料工作區；不會喺 Admin 執行交易 mutation。':'設定／治理工作區；正式寫入會遵守 Draft → Validate → Impact → Publish → Readback。'}
      aside={<><StatusBadge tone={readOnly?'neutral':'warning'}>{readOnly?'只讀':'草稿工作流'}</StatusBadge><PrimaryAction label={destination.primaryAction} onClick={action} readOnly={readOnly}/></>}
    />
    <section className="v3-whole-meta-strip">
      <span>門店 <strong>MF01</strong></span>
      <span>最後確認 <strong>10:18</strong></span>
      <span>資料模式 <strong>{previewMode?'公網示例':'正式讀取'}</strong></span>
    </section>
    {body}
    {openRow?<PreviewEditModal title={destination.title} row={openRow} onClose={()=>setOpenRow(null)}/>:null}
  </div>;
}

export function adminWorkspaceCoverage(){
  const paths=ADMIN_DESTINATIONS.map(item=>item.path);
  const missing=paths.filter(path=>!DEDICATED_PREVIEW_ROUTES.has(path)&&!IMPLEMENTED_ROUTE_PATHS.includes(path));
  return Object.freeze({implemented:paths.length-missing.length,total:paths.length,missing});
}
