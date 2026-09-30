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
    :state==='CONNECTING'?'正在接收'
    :state==='LOCAL_LKG'?'離線 · 使用最後已套用設定'
    :state==='OFFLINE'?'離線'
    :'接收異常';
}
function timeLabel(value?:string){
  if(!value||!Number.isFinite(Date.parse(value)))return '未有';
  return new Date(value).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false});
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
        <small>ADMIN 正式發佈 → SMT 自動套用</small>
        <h2>Admin 資料接收狀態</h2>
        <p>Admin 每次正式發佈，SMT 都接收同一份 Canonical 資料、驗證、原子切換本機設定，再回讀確認。Rxx 只保留作內部診斷，唔用嚟判斷邊份資料最新。</p>
      </div>
      <div className="local-admin-menu-version-pair">
        <div><span>ADMIN 發佈</span><b>{timeLabel(lkg?.publishedAt)}</b><small>SMT 已接收嘅 Canonical 發佈時間</small></div>
        <div><span>SMT</span><b>{stateLabel(status.state)}</b><small>{timeLabel(status.appliedAt??status.updatedAt)}</small></div>
      </div>
    </header>

    <section className="local-admin-a2-transfer">
      <header><div><small>自動接收</small><h3>Admin Canonical Data → SMT 本機設定</h3></div><span>零人手操作</span></header>
      <div className="local-admin-a2-proof match">
        <p><span>裝置</span><code>{readSmtDeviceId()}</code></p>
        <p><span>Admin 正式發佈時間</span><b>{timeLabel(lkg?.publishedAt)}</b></p>
        <p><span>Doorbell 收到時間</span><b>{timeLabel(status.receivedAt)}</b></p>
        <p><span>SMT 套用時間</span><b>{timeLabel(status.appliedAt)}</b></p>
        <p><span>ACK 時間</span><b>{timeLabel(status.ackAt)}</b></p>
        <p><span>Canonical 指紋</span><code>{lkg?.fingerprint??'—'}</code></p>
        <p><span>Admin 內容指紋</span><code>{lkg?.adminFingerprint??'—'}</code></p>
        <p><span>狀態</span><strong>{stateLabel(status.state)}</strong></p>
        {status.error?<p><span>最近錯誤</span><code>{status.error}</code></p>:null}
      </div>
      <small>每次 Admin 正式發佈都會通知 SMT，SMT 再重新讀同一個 Canonical endpoint。連續發佈亦唔以 Rxx 判新舊；只以正式發佈時間同 Canonical 指紋收斂。</small>
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
