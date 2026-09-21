import {useMemo,useState} from 'react';

function UpgradeHeader({title,description,kicker='ADMIN WORKFLOW UPGRADE · NOT_WIRED'}:{title:string;description:string;kicker?:string}){
  return <header className="admin-editor-head">
    <div><small>{kicker}</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" disabled>Live Read / Write 未接駁</button></div>
  </header>;
}

const StateChip=({children}:{children:string})=><span className="admin-not-wired-chip">{children}</span>;

export function ActionQueueWorkspace(){
  const [domain,setDomain]=useState('ALL');
  const [state,setState]=useState('OPEN');
  const sample=useMemo(()=>[
    {id:'AQ-DEMO-001',kind:'Publish mismatch',owner:'Admin Config',state:'UNKNOWN',route:'/admin/publish'},
    {id:'AQ-DEMO-002',kind:'Channel mapping',owner:'Channel',state:'PARTIAL',route:'/admin/channels/mapping-failure'},
    {id:'AQ-DEMO-003',kind:'Printer health',owner:'Device / Print',state:'STALE',route:'/admin/devices'},
  ],[]);
  return <section className="admin-editor-page">
    <UpgradeHeader title="Unified Action Queue" description="只做異常聚合、dedupe presentation 同責任頁 deep-link；Action Queue 永遠唔持有 mutation authority。"/>
    <div className="admin-filterbar">
      <select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部 Domain</option><option value="CONFIG">Config</option><option value="CHANNEL">Channel</option><option value="DEVICE">Device / Print</option><option value="ORDER">Order</option></select>
      <select value={state} onChange={event=>setState(event.target.value)}><option value="OPEN">Open / Attention</option><option value="UNKNOWN">UNKNOWN</option><option value="PARTIAL">PARTIAL</option><option value="STALE">STALE</option></select>
      <button type="button" disabled>Refresh 未接駁</button>
    </div>
    <section className="admin-read-table">
      <header><span>Incident</span><span>Owner Domain</span><span>State</span><span>Deep-link</span><span>Authority</span></header>
      {sample.map(row=><div className="admin-policy-row" key={row.id}><span>{row.kind}<small>{row.id}</small></span><span>{row.owner}</span><span>{row.state}</span><a href={row.route}>前往責任頁</a><StateChip>ROUTING ONLY</StateChip></div>)}
    </section>
    <section className="admin-rule-card"><h2>Recovery Rule</h2><p>未有 canonical readback proof，一律保持 UNKNOWN / PARTIAL / STALE；唔可以喺 Queue 入面扮 Resolved。</p></section>
  </section>;
}

export function DeviceHealthWorkspace(){
  const [profile,setProfile]=useState('STORE-FRONTLINE');
  return <section className="admin-editor-page">
    <UpgradeHeader title="裝置管理" description="Device profile / trust / version / config drift presentation。今輪只建立管理面，唔接裝置 runtime。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Desired Profile</h2><label><span>Profile</span><select value={profile} onChange={e=>setProfile(e.target.value)}><option>STORE-FRONTLINE</option><option>MANAGER-MOBILE</option><option>BACKOFFICE</option></select></label><StateChip>SESSION DRAFT</StateChip></article>
      <article className="admin-policy-card"><h2>Observed Device State</h2><div className="admin-read-empty">DEVICE_HEALTH_READBACK_NOT_WIRED</div></article>
      <article className="admin-policy-card"><h2>Config Drift</h2><p>Desired vs observed version / profile / trust state。</p><StateChip>READBACK REQUIRED</StateChip></article>
      <article className="admin-policy-card"><h2>Revoke / Trust</h2><button disabled>Revoke Device 未接駁</button><small>真正 revoke 必須由 Auth authority 執行。</small></article>
    </div>
  </section>;
}

export function OtaWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="OTA / 版本管理" description="Approved artifact → install → observed runtime → rollback evidence 嘅治理表面；唔包含任何真實安裝。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Approved Artifact</h2><label><span>Artifact / Version</span><input placeholder="例如 1.0.7"/></label><label><span>Expected SHA</span><input placeholder="artifact hash"/></label><StateChip>LOCAL FORM ONLY</StateChip></article>
      <article className="admin-policy-card"><h2>Install</h2><button disabled>Deploy / Install 未接駁</button><small>冇 runtime / carrier / storage adapter。</small></article>
      <article className="admin-policy-card"><h2>Observed Runtime</h2><div className="admin-read-empty">OTA_RUNTIME_READBACK_NOT_WIRED</div></article>
      <article className="admin-policy-card"><h2>Rollback</h2><button disabled>Rollback 未接駁</button><small>只喺 observed mismatch / install failure 後先可進入。</small></article>
    </div>
  </section>;
}

export function CashCloseRecordWorkspace(){
  const [opening,setOpening]=useState('');
  const [counted,setCounted]=useState('');
  const [note,setNote]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="現金／收舖記錄" description="只做 Cash / Close record workflow。同 Business Day 一樣係記錄、attention、handoff；永遠唔可以阻 Order / Checkout / Payment / Local Commit。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Opening Record</h2><label><span>Opening Cash</span><input inputMode="decimal" value={opening} onChange={e=>setOpening(e.target.value)} placeholder="0.00"/></label><StateChip>RECORD ONLY</StateChip></article>
      <article className="admin-policy-card"><h2>Close Preview</h2><div className="admin-read-empty">EXPECTED_CASH_READBACK_NOT_WIRED</div><small>任何 difference / pending item 只顯示 ATTENTION，唔係 transaction gate。</small></article>
      <article className="admin-policy-card"><h2>Count / Handover Draft</h2><label><span>Counted Cash</span><input inputMode="decimal" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="0.00"/></label><label><span>Note</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="交更備註"/></label><StateChip>SESSION ONLY</StateChip></article>
      <article className="admin-policy-card"><h2>Close Record</h2><button disabled>Save Close Record 未接駁</button><small>唔會關閉 transaction authority。</small></article>
    </div>
  </section>;
}

export function AccessSessionWorkspace(){
  const [scope,setScope]=useState('STORE');
  const [pin,setPin]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="登入／Session／Scope" description="Admin Login、PIN、Scope、Session revoke 同 trusted-device presentation。只做 config / governance shape；唔建立第二套 Auth。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>PIN Draft</h2><label><span>PIN</span><input inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 digits"/></label><StateChip>NOT SAVED</StateChip></article>
      <article className="admin-policy-card"><h2>Permission Scope</h2><label><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value)}><option value="STORE">Store</option><option value="MULTI_STORE">Multi-store</option><option value="REPORT_ONLY">Report only</option></select></label><div className="admin-read-empty">AUTHZ_SNAPSHOT_NOT_WIRED</div></article>
      <article className="admin-policy-card"><h2>Admin Session</h2><div className="admin-read-empty">SESSION_STATE_NOT_WIRED</div><button disabled>Revoke Session 未接駁</button></article>
      <article className="admin-policy-card"><h2>Trusted Device</h2><div className="admin-read-empty">TRUSTED_DEVICE_READBACK_NOT_WIRED</div><button disabled>Revoke Device 未接駁</button></article>
    </div>
  </section>;
}

function FixedReport({title,metrics}:{title:string;metrics:readonly string[]}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title={title} description="P0 固定可信報表 shape。Admin 只讀 projection，唔自行重算 transaction truth。"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button disabled>讀取未接駁</button></div>
    <div className="admin-kpi-grid">{metrics.map(metric=><article key={metric}><span>{metric}</span><strong>—</strong><small>NOT_WIRED</small></article>)}</div>
    <section className="admin-rule-card"><h2>Trust Envelope</h2><p>metricVersion：—　completeness：UNAVAILABLE　freshness：UNKNOWN</p><StateChip>READ MODEL ONLY</StateChip></section>
  </section>;
}

export const ProductReportWorkspace=()=> <FixedReport title="商品報表" metrics={['Units','Sales','Mix %','Top Product']}/>;
export const ChannelReportWorkspace=()=> <FixedReport title="渠道報表" metrics={['Orders','Gross','Provider Facts','Exceptions']}/>;
export const RefundReportWorkspace=()=> <FixedReport title="退款報表" metrics={['Requests','Approved','Rejected','Unknown']}/>;

export function ExportGovernanceWorkspace(){
  const [scope,setScope]=useState('REPORT_CURRENT_FILTER');
  const [includePii,setIncludePii]=useState(false);
  return <section className="admin-editor-page">
    <UpgradeHeader title="匯出治理" description="Export 只建立 permission / scope / PII / audit evidence shape；未接 Export service。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Export Scope</h2><label><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value)}><option value="REPORT_CURRENT_FILTER">Current report filter</option><option value="STORE_DAY">Store / Day</option><option value="AUDIT_RANGE">Audit range</option></select></label><label className="admin-toggle"><input type="checkbox" checked={includePii} onChange={e=>setIncludePii(e.target.checked)}/><span>Request PII fields</span></label></article>
      <article className="admin-policy-card"><h2>Evidence</h2><div className="admin-read-empty">EXPORT_PERMISSION / HASH / AUDIT_NOT_WIRED</div><button disabled>Export 未接駁</button></article>
    </div>
  </section>;
}

export function DiagnosticsWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="Diagnostics" description="Finding / incident / trace / evidence / recovery proof。未證明 root cause 就保持 UNKNOWN；Diagnostics 唔取得 domain mutation authority。"/>
    <div className="admin-kpi-grid"><article><span>Health</span><strong>—</strong><small>UNKNOWN</small></article><article><span>First Failure</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Recovery Proof</span><strong>—</strong><small>NOT_WIRED</small></article><article><span>Evidence Ref</span><strong>—</strong><small>NOT_WIRED</small></article></div>
    <section className="admin-read-table"><header><span>Finding</span><span>Domain</span><span>State</span><span>Evidence</span><span>Action</span></header><div className="admin-read-empty">DIAGNOSTICS_READ_MODEL_NOT_WIRED</div></section>
  </section>;
}

export function IntegrationsGovernanceWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="Integrations Governance" description="只顯示 credential reference / scope / webhook / schema / signature / replay / delivery/DLQ readiness；唔接任何 Provider。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Credential</h2><div className="admin-read-empty">CREDENTIAL_REFERENCE_NOT_WIRED</div><small>唔顯示、唔保存 secret value。</small></article>
      <article className="admin-policy-card"><h2>Webhook / Security</h2><div className="admin-read-empty">WEBHOOK_SIGNATURE_REPLAY_NOT_WIRED</div></article>
      <article className="admin-policy-card"><h2>Schema</h2><div className="admin-read-empty">PROVIDER_SCHEMA_READBACK_NOT_WIRED</div></article>
      <article className="admin-policy-card"><h2>Delivery / DLQ</h2><div className="admin-read-empty">DELIVERY_READBACK_NOT_WIRED</div></article>
    </div>
  </section>;
}

export function EffectiveSettingsWorkspace(){
  const [override,setOverride]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="進階設定" description="顯示 effective value / source / optional override / security floor。只做設定 shape，唔建立巨型 Settings engine。"/>
    <section className="admin-read-table"><header><span>Setting</span><span>Effective</span><span>Source</span><span>Floor</span><span>Override Draft</span></header>
      <div className="admin-policy-row"><span>Example Policy</span><span>—</span><span>NOT_WIRED</span><span>SECURITY FLOOR</span><input value={override} onChange={e=>setOverride(e.target.value)} placeholder="optional override"/></div>
    </section>
    <div className="admin-editor-actions"><button disabled>Publish Settings 未接駁</button></div>
  </section>;
}
