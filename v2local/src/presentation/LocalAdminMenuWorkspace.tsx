import {useEffect,useMemo,useState} from 'react';
import {
  readSmtAdminConfigLkg,
  readSmtAdminSyncStatus,
  readSmtDeviceId,
  subscribeSmtAdminConfig,
} from '../runtime/admin-config-sync.ts';
import './local-admin-menu-workspace.css';

type CatalogSnapshot={
  categories?:readonly unknown[];
  products?:readonly unknown[];
  combos?:readonly unknown[];
  comboPools?:readonly unknown[];
};
type OptionCenterSnapshot={
  sets?:readonly unknown[];
  productLinks?:readonly unknown[];
};

function stateLabel(state:string){
  return state==='SYNCED'?'已套用'
    :state==='CONNECTING'?'同步中'
    :state==='LOCAL_LKG'?'離線 · 使用最後已套用資料'
    :state==='OFFLINE'?'離線'
    :'同步異常';
}
function hkTime(value?:string){
  if(!value)return '未有';
  const at=Date.parse(value);
  return Number.isFinite(at)?new Date(at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):'時間無效';
}

export function LocalAdminMenuWorkspace(){
  const [version,setVersion]=useState(0);
  useEffect(()=>subscribeSmtAdminConfig(()=>setVersion(value=>value+1)),[]);
  void version;

  const status=readSmtAdminSyncStatus();
  const lkg=readSmtAdminConfigLkg();
  const catalog=(lkg?.snapshot.catalog??{}) as CatalogSnapshot;
  const optionCenter=(lkg?.snapshot.optionCenter??{}) as OptionCenterSnapshot;

  const summary=useMemo(()=>({
    categories:Array.isArray(catalog.categories)?catalog.categories.length:0,
    products:Array.isArray(catalog.products)?catalog.products.length:0,
    optionSets:Array.isArray(optionCenter.sets)?optionCenter.sets.length:0,
    optionLinks:Array.isArray(optionCenter.productLinks)?optionCenter.productLinks.length:0,
    combos:Array.isArray(catalog.combos)?catalog.combos.length:0,
    comboPools:Array.isArray(catalog.comboPools)?catalog.comboPools.length:0,
  }),[lkg?.fingerprint]);

  return <section className="local-admin-menu">
    <header className="local-admin-menu-head">
      <div>
        <small>ADMIN → SMT AUTO SYNC</small>
        <h2>Admin 同步狀態</h2>
        <p>SMT 只接受 Admin 正式發佈資料。每次發佈都按香港日期時間接收、套用及回讀；唔比較 R 號，亦唔會用 R 號拒絕任何正式發佈。</p>
      </div>
      <div className="local-admin-menu-version-pair">
        <div><span>ADMIN 發佈</span><b>{hkTime(lkg?.publishedAt)}</b><small>香港時間</small></div>
        <div><span>SMT</span><b>{stateLabel(status.state)}</b><small>{status.appliedAt?hkTime(status.appliedAt):hkTime(status.updatedAt)}</small></div>
      </div>
    </header>

    <section className="local-admin-a2-transfer">
      <header><div><small>自動同步</small><h3>Canonical Admin Config → SMT Local LKG</h3></div><span>ZERO MANUAL ACTION</span></header>
      <div className="local-admin-a2-proof match">
        <p><span>Device</span><code>{readSmtDeviceId()}</code></p>
        <p><span>正式發佈時間</span><b>{hkTime(lkg?.publishedAt)}</b></p>
        <p><span>收到通知時間</span><b>{hkTime(status.receivedAt)}</b></p>
        <p><span>SMT 套用時間</span><b>{hkTime(status.appliedAt)}</b></p>
        <p><span>回讀時間</span><b>{hkTime(status.ackAt)}</b></p>
        <p><span>Fingerprint</span><code>{lkg?.fingerprint??'—'}</code></p>
        <p><span>State</span><strong>{stateLabel(status.state)}</strong></p>
        {status.error?<p><span>Last error</span><code>{status.error}</code></p>:null}
      </div>
      <small>斷網時只保留最後已套用資料；網絡恢復後重新讀 Admin canonical endpoint。每次正式發佈以 Cloud 香港發佈時間為準；R 號只可作內部診斷，唔參與新舊判斷。</small>
    </section>

    <div className="admin-kpi-grid">
      <article><span>分類</span><strong>{summary.categories}</strong><small>Admin snapshot</small></article>
      <article><span>商品</span><strong>{summary.products}</strong><small>含價格資料</small></article>
      <article><span>選項組</span><strong>{summary.optionSets}</strong><small>{summary.optionLinks} 個商品連結</small></article>
      <article><span>套餐</span><strong>{summary.combos}</strong><small>{summary.comboPools} 個 Pool</small></article>
    </div>

    <section className="local-admin-a2-transfer">
      <header><div><small>已收到完整設定</small><h3>SMT 本機 LKG 內容</h3></div><span>READ ONLY</span></header>
      <div className="local-admin-a2-proof match">
        {[
          ['菜單／商品／價格','catalog'],
          ['商品選項／預設','optionCenter'],
          ['售罄／供應','availability'],
          ['營業日','businessDay'],
          ['Logical Printers','logicalPrinters'],
          ['打印模板','printTemplates'],
          ['商品打印規則','printRules'],
          ['商品媒體','productMedia'],
          ['門店設定','storeSettings'],
          ['快捷原因','quickReasons'],
          ['員工／權限設定','staffAuth'],
          ['平台政策','channelPolicy'],
          ['平台映射','channelMapping'],
          ['容量','capacity'],
          ['顯示設定','presentation'],
          ['Inventory Lite','inventory'],
          ['Loyalty','loyalty'],
          ['Coupons','coupons'],
          ['Announcements','announcements'],
        ].map(([label,key])=><p key={key}><span>{label}</span><b>{lkg&&Object.prototype.hasOwnProperty.call(lkg.snapshot,key)?'已接收':'未提供'}</b></p>)}
      </div>
    </section>
  </section>;
}
