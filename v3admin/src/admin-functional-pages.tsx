import {useMemo,useState,type ReactNode} from 'react';
import {PageHeader,StatusBadge} from './ui.tsx';
import {usePreviewCatalog} from './preview-catalog-store.ts';
import {
  PREVIEW_PERMISSION_OPTIONS,
  usePreviewAdmin,
  type PreviewChannelMapping,
  type PreviewPrintRule,
  type PreviewPrintTemplate,
  type PreviewPrinter,
  type PreviewQuickReason,
  type PreviewRole,
  type PreviewStaff,
} from './preview-admin-store.ts';

function Sheet({eyebrow,title,onClose,children,footer}:{eyebrow:string;title:string;onClose:()=>void;children:ReactNode;footer?:ReactNode}){
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>{eyebrow}</small><h2>{title}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">{children}</div>
      {footer?<footer className="v3-functional-footer">{footer}</footer>:null}
    </section>
  </div>;
}

function PreviewNotice(){
  return <div className="v3-preview-banner"><strong>功能 Preview</strong><span>修改會喺目前公網 Preview 即時反映，但唔會寫入 Production。</span></div>;
}

function PrinterEditor({printer,onClose}:{printer:PreviewPrinter;onClose:()=>void}){
  const update=usePreviewAdmin(state=>state.updatePrinter);
  const remove=usePreviewAdmin(state=>state.removePrinter);
  const rules=usePreviewAdmin(state=>state.printRules);
  const [blocked,setBlocked]=useState(false);
  const references=rules.filter(rule=>rule.printerIds.includes(printer.id));
  return <Sheet eyebrow="打印管理" title={printer.name} onClose={onClose}>
    <section className="v3-functional-section">
      <div className="v3-functional-grid">
        <label><span>邏輯打印機名稱 *</span><input value={printer.name} onChange={event=>update(printer.id,{name:event.target.value})}/></label>
        <label><span>用途</span><select value={printer.type} onChange={event=>update(printer.id,{type:event.target.value as PreviewPrinter['type']})}><option value="RECEIPT">收據</option><option value="PRODUCTION">製作單</option><option value="PACKING">打包單</option><option value="LABEL">標籤</option></select></label>
        <label><span>紙寬／標籤寬 mm</span><input type="number" min={20} max={120} value={printer.widthMm} onChange={event=>update(printer.id,{widthMm:Number(event.target.value)||80})}/></label>
        <label><span>邏輯 ID</span><input value={printer.id} disabled/></label>
      </div>
      <label className="v3-functional-switch"><input type="checkbox" checked={printer.active} onChange={event=>update(printer.id,{active:event.target.checked})}/><span>{printer.active?'啟用':'停用'}</span></label>
      <div className="v3-mobile-form-note">實體 IP／USB 配對仍然屬 SMT 現場；Admin 只管理 Logical Printer。</div>
    </section>
    <section className="v3-functional-section">
      <h3>被引用規則</h3>
      {references.length?references.map(rule=><div className="v3-ref-row" key={rule.id}><strong>{rule.name}</strong><small>{rule.event}</small></div>):<p>目前冇打印規則引用。</p>}
    </section>
    <section className="v3-functional-danger">
      <div><strong>刪除邏輯打印機</strong><small>{references.length?'仍有規則引用，必須先移除引用。':'目前可刪除 Preview 設定。'}</small></div>
      <button type="button" disabled={references.length>0} onClick={()=>{const ok=remove(printer.id);setBlocked(!ok);if(ok)onClose();}}>刪除</button>
    </section>
    {blocked?<div className="v3-error">仍有打印規則引用。</div>:null}
  </Sheet>;
}

export function PrintersPage(){
  const printers=usePreviewAdmin(state=>state.printers);
  const add=usePreviewAdmin(state=>state.addPrinter);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?printers.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="打印管理" title="邏輯打印機" description="建立唯一打印用途；實體打印機配對唔喺 Admin 做。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增邏輯打印機</button>}/>
    <div className="v3-functional-card-grid">{printers.map(printer=><button type="button" key={printer.id} onClick={()=>setSelected(printer.id)}>
      <div><strong>{printer.name}</strong><small>{printer.id}</small></div><b>{printer.widthMm}mm</b><span>{printer.type}</span><StatusBadge tone={printer.active?'good':'neutral'}>{printer.active?'啟用':'停用'}</StatusBadge>
    </button>)}</div>
    {row?<PrinterEditor printer={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function TemplateEditor({template,onClose}:{template:PreviewPrintTemplate;onClose:()=>void}){
  const update=usePreviewAdmin(state=>state.updateTemplate);
  const remove=usePreviewAdmin(state=>state.removeTemplate);
  return <Sheet eyebrow="打印模板" title={template.name} onClose={onClose}>
    <section className="v3-functional-section">
      <label><span>模板名稱</span><input value={template.name} onChange={event=>update(template.id,{name:event.target.value})}/></label>
      <label><span>模板內容</span><textarea rows={12} value={template.content} onChange={event=>update(template.id,{content:event.target.value})}/></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={template.active} onChange={event=>update(template.id,{active:event.target.checked})}/><span>{template.active?'啟用':'停用'}</span></label>
    </section>
    <section className="v3-functional-danger"><div><strong>刪除模板</strong><small>Preview 未接正式引用檢查。</small></div><button type="button" onClick={()=>{remove(template.id);onClose();}}>刪除</button></section>
  </Sheet>;
}
export function PrintTemplatesPage(){
  const templates=usePreviewAdmin(state=>state.templates);
  const add=usePreviewAdmin(state=>state.addTemplate);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?templates.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="打印管理" title="打印模板" description="實際編輯收據、製作單、打包單同標籤模板內容。" aside={<button className="v3-primary" type="button" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增打印模板</button>}/>
    <div className="v3-functional-card-grid">{templates.map(item=><button type="button" key={item.id} onClick={()=>setSelected(item.id)}><div><strong>{item.name}</strong><small>{item.id}</small></div><b>{item.content.split('\n').length}</b><span>行</span><StatusBadge tone={item.active?'good':'neutral'}>{item.active?'啟用':'停用'}</StatusBadge></button>)}</div>
    {row?<TemplateEditor template={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function RuleEditor({rule,onClose}:{rule:PreviewPrintRule;onClose:()=>void}){
  const printers=usePreviewAdmin(state=>state.printers);
  const update=usePreviewAdmin(state=>state.updatePrintRule);
  const remove=usePreviewAdmin(state=>state.removePrintRule);
  return <Sheet eyebrow="打印規則" title={rule.name} onClose={onClose}>
    <section className="v3-functional-section">
      <div className="v3-functional-grid">
        <label><span>規則名稱</span><input value={rule.name} onChange={event=>update(rule.id,{name:event.target.value})}/></label>
        <label><span>觸發事件</span><select value={rule.event} onChange={event=>update(rule.id,{event:event.target.value})}><option value="ORDER_CONFIRMED">訂單已確認</option><option value="PAYMENT_CONFIRMED">付款已確認</option><option value="PRODUCT_LABEL">商品標籤</option><option value="ORDER_READY">訂單可取餐</option></select></label>
      </div>
      <label className="v3-functional-switch"><input type="checkbox" checked={rule.active} onChange={event=>update(rule.id,{active:event.target.checked})}/><span>{rule.active?'啟用規則':'停用規則'}</span></label>
    </section>
    <section className="v3-functional-section"><h3>目的地</h3>
      <div className="v3-option-link-grid">{printers.map(printer=><label key={printer.id}><input type="checkbox" checked={rule.printerIds.includes(printer.id)} onChange={event=>{const ids=new Set(rule.printerIds);if(event.target.checked)ids.add(printer.id);else ids.delete(printer.id);update(rule.id,{printerIds:[...ids]});}}/><span><strong>{printer.name}</strong><small>{printer.type} · {printer.active?'啟用':'停用'}</small></span></label>)}</div>
    </section>
    <section className="v3-functional-danger"><div><strong>刪除打印規則</strong></div><button type="button" onClick={()=>{remove(rule.id);onClose();}}>刪除</button></section>
  </Sheet>;
}
export function PrintRulesPage(){
  const rules=usePreviewAdmin(state=>state.printRules);
  const add=usePreviewAdmin(state=>state.addPrintRule);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?rules.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="打印管理" title="打印規則" description="實際設定事件去邊個 Logical Printer；唔建立第二打印 authority。" aside={<button className="v3-primary" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增打印規則</button>}/>
    <div className="v3-functional-card-grid">{rules.map(item=><button key={item.id} type="button" onClick={()=>setSelected(item.id)}><div><strong>{item.name}</strong><small>{item.event}</small></div><b>{item.printerIds.length}</b><span>目的地</span><StatusBadge tone={item.active?'good':'neutral'}>{item.active?'啟用':'停用'}</StatusBadge></button>)}</div>
    {row?<RuleEditor rule={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function RoleEditor({role,onClose}:{role:PreviewRole;onClose:()=>void}){
  const update=usePreviewAdmin(state=>state.updateRole);
  const toggle=usePreviewAdmin(state=>state.toggleRolePermission);
  const remove=usePreviewAdmin(state=>state.removeRole);
  const staff=usePreviewAdmin(state=>state.staff);
  const refs=staff.filter(item=>item.roleId===role.id).length;
  return <Sheet eyebrow="人員與權限" title={role.name} onClose={onClose}>
    <section className="v3-functional-section">
      <label><span>角色名稱</span><input value={role.name} onChange={event=>update(role.id,{name:event.target.value})}/></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={role.active} onChange={event=>update(role.id,{active:event.target.checked})}/><span>{role.active?'啟用角色':'停用角色'}</span></label>
    </section>
    <section className="v3-functional-section"><h3>權限</h3><div className="v3-option-link-grid">{PREVIEW_PERMISSION_OPTIONS.map(permission=><label key={permission.id}><input type="checkbox" checked={role.permissions.includes(permission.id)} onChange={event=>toggle(role.id,permission.id,event.target.checked)}/><span><strong>{permission.label}</strong><small>{permission.id}</small></span></label>)}</div></section>
    <section className="v3-functional-danger"><div><strong>刪除角色</strong><small>{refs?refs+' 位員工仍然使用。':'目前冇員工引用。'}</small></div><button disabled={refs>0} onClick={()=>{if(remove(role.id))onClose();}}>刪除角色</button></section>
  </Sheet>;
}
export function RolesPage(){
  const roles=usePreviewAdmin(state=>state.roles);
  const staff=usePreviewAdmin(state=>state.staff);
  const add=usePreviewAdmin(state=>state.addRole);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?roles.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="人員與權限" title="角色管理" description="建立角色，再由唯一角色權限表控制 Admin 能力。" aside={<button className="v3-primary" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增角色</button>}/>
    <div className="v3-functional-card-grid">{roles.map(role=><button type="button" key={role.id} onClick={()=>setSelected(role.id)}><div><strong>{role.name}</strong><small>{role.id}</small></div><b>{role.permissions.length}</b><span>權限</span><StatusBadge tone={role.active?'good':'neutral'}>{role.active?'啟用':'停用'}</StatusBadge><small>{staff.filter(item=>item.roleId===role.id).length} 位員工</small></button>)}</div>
    {row?<RoleEditor role={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

function StaffEditor({staff,onClose}:{staff:PreviewStaff;onClose:()=>void}){
  const roles=usePreviewAdmin(state=>state.roles);
  const update=usePreviewAdmin(state=>state.updateStaff);
  const remove=usePreviewAdmin(state=>state.removeStaff);
  return <Sheet eyebrow="員工管理" title={staff.name} onClose={onClose}>
    <section className="v3-functional-section"><div className="v3-functional-grid">
      <label><span>姓名 *</span><input value={staff.name} onChange={event=>update(staff.id,{name:event.target.value})}/></label>
      <label><span>登入編號</span><input value={staff.loginId} onChange={event=>update(staff.id,{loginId:event.target.value})}/></label>
      <label><span>角色</span><select value={staff.roleId} onChange={event=>update(staff.id,{roleId:event.target.value})}>{roles.filter(role=>role.active||role.id===staff.roleId).map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label><span>管理範圍</span><input value={staff.scope} onChange={event=>update(staff.id,{scope:event.target.value})}/></label>
    </div>
    <label className="v3-functional-switch"><input type="checkbox" checked={staff.adminLogin} onChange={event=>update(staff.id,{adminLogin:event.target.checked})}/><span>允許 Admin 登入</span></label>
    <label className="v3-functional-switch"><input type="checkbox" checked={staff.active} onChange={event=>update(staff.id,{active:event.target.checked})}/><span>{staff.active?'啟用員工':'停用員工'}</span></label>
    </section>
    <section className="v3-functional-danger"><div><strong>刪除 Preview 員工</strong><small>正式環境一般使用停用保留歷史身份。</small></div><button onClick={()=>{remove(staff.id);onClose();}}>刪除</button></section>
  </Sheet>;
}
export function StaffPage(){
  const staff=usePreviewAdmin(state=>state.staff);
  const roles=usePreviewAdmin(state=>state.roles);
  const add=usePreviewAdmin(state=>state.addStaff);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?staff.find(item=>item.id===selected):undefined;
  const roleMap=useMemo(()=>new Map(roles.map(role=>[role.id,role.name])),[roles]);
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="人員與權限" title="員工管理" description="實際編輯員工身份、登入編號、角色、範圍同啟用狀態。" aside={<button className="v3-primary" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增員工</button>}/>
    <div className="v3-functional-card-grid">{staff.map(item=><button type="button" key={item.id} onClick={()=>setSelected(item.id)}><div><strong>{item.name}</strong><small>{item.loginId||'未設登入編號'}</small></div><b>{roleMap.get(item.roleId)??item.roleId}</b><span>{item.scope}</span><StatusBadge tone={item.active?'good':'neutral'}>{item.active?'啟用':'停用'}</StatusBadge><small>{item.adminLogin?'可登入 Admin':'不可登入 Admin'}</small></button>)}</div>
    {row?<StaffEditor staff={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function PermissionsPage(){
  const roles=usePreviewAdmin(state=>state.roles);
  const toggle=usePreviewAdmin(state=>state.toggleRolePermission);
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="人員與權限" title="權限管理" description="角色 × 權限矩陣；Preview 調整會即時反映角色管理。" />
    <div className="v3-permission-matrix"><header><strong>權限</strong>{roles.map(role=><strong key={role.id}>{role.name}</strong>)}</header>
      {PREVIEW_PERMISSION_OPTIONS.map(permission=><div key={permission.id}><span><strong>{permission.label}</strong><small>{permission.id}</small></span>{roles.map(role=><label key={role.id}><input type="checkbox" checked={role.permissions.includes(permission.id)} onChange={event=>toggle(role.id,permission.id,event.target.checked)}/></label>)}</div>)}
    </div>
  </div>;
}

function QuickReasonEditor({reason,onClose}:{reason:PreviewQuickReason;onClose:()=>void}){
  const update=usePreviewAdmin(state=>state.updateQuickReason);
  const remove=usePreviewAdmin(state=>state.removeQuickReason);
  return <Sheet eyebrow="門店設定" title={reason.label} onClose={onClose}><section className="v3-functional-section">
    <label><span>原因文字</span><input value={reason.label} onChange={event=>update(reason.id,{label:event.target.value})}/></label>
    <label><span>用途</span><select value={reason.domain} onChange={event=>update(reason.id,{domain:event.target.value as PreviewQuickReason['domain']})}><option value="SOLD_OUT">售罄／供應</option><option value="ORDER_EXCEPTION">訂單異常</option><option value="CASH">現金／收舖</option><option value="GENERAL">一般</option></select></label>
    <label className="v3-functional-switch"><input type="checkbox" checked={reason.active} onChange={event=>update(reason.id,{active:event.target.checked})}/><span>{reason.active?'啟用':'停用'}</span></label>
  </section><section className="v3-functional-danger"><div><strong>刪除原因</strong></div><button onClick={()=>{remove(reason.id);onClose();}}>刪除</button></section></Sheet>;
}
export function QuickReasonsPage(){
  const reasons=usePreviewAdmin(state=>state.quickReasons);
  const add=usePreviewAdmin(state=>state.addQuickReason);
  const [selected,setSelected]=useState<string|null>(null);
  const row=selected?reasons.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="門店設定" title="快捷原因" description="管理售罄、異常、現金等操作使用嘅標準原因。" aside={<button className="v3-primary" onClick={()=>{const next=add();setSelected(next.id);}}>＋ 新增快捷原因</button>}/>
    <div className="v3-functional-card-grid">{reasons.map(item=><button type="button" key={item.id} onClick={()=>setSelected(item.id)}><div><strong>{item.label}</strong><small>{item.id}</small></div><b>{item.domain}</b><span>用途</span><StatusBadge tone={item.active?'good':'neutral'}>{item.active?'啟用':'停用'}</StatusBadge></button>)}</div>
    {row?<QuickReasonEditor reason={row} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

const DAYS=[['MON','星期一'],['TUE','星期二'],['WED','星期三'],['THU','星期四'],['FRI','星期五'],['SAT','星期六'],['SUN','星期日']] as const;

export function StoreSettingsPage({mode}:{mode:'settings'|'hours'|'business-day'|'operations'}){
  const settings=usePreviewAdmin(state=>state.storeSettings);
  const hours=usePreviewAdmin(state=>state.hours);
  const update=usePreviewAdmin(state=>state.updateStoreSettings);
  const updateHours=usePreviewAdmin(state=>state.updateHours);
  const title=mode==='settings'?'門店資料':mode==='hours'?'營業時間':mode==='business-day'?'營業日分界':'營運時間／提醒設定';
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="門店設定" title={title} description="目前係可操作 Preview 設定；正式資料將經 Server Draft 發佈。" />
    {mode==='settings'?<section className="v3-functional-section"><div className="v3-functional-grid">
      <label><span>門店名稱</span><input value={settings.storeName} onChange={event=>update({storeName:event.target.value})}/></label>
      <label><span>門店編號</span><input value={settings.storeCode} disabled/></label>
      <label><span>電話</span><input value={settings.phone} onChange={event=>update({phone:event.target.value})}/></label>
      <label><span>地址</span><input value={settings.address} onChange={event=>update({address:event.target.value})}/></label>
      <label><span>時區</span><input value={settings.timezone} disabled/></label>
      <label><span>貨幣</span><input value={settings.currency} disabled/></label>
    </div></section>:null}
    {mode==='hours'?<div className="v3-hours-list">{DAYS.map(([id,label])=>{const value=hours[id];return <article key={id}><strong>{label}</strong><label><input type="checkbox" checked={!value.closed} onChange={event=>updateHours(id,{closed:!event.target.checked})}/>營業</label><input type="time" value={value.opensAt} disabled={value.closed} onChange={event=>updateHours(id,{opensAt:event.target.value})}/><span>至</span><input type="time" value={value.closesAt} disabled={value.closed} onChange={event=>updateHours(id,{closesAt:event.target.value})}/></article>})}</div>:null}
    {mode==='business-day'?<section className="v3-functional-section"><label><span>每日營業日分界</span><input type="time" value={settings.businessDayCutoff} onChange={event=>update({businessDayCutoff:event.target.value})}/></label><p>例如 05:00：凌晨五點前仍計入上一個營業日。</p></section>:null}
    {mode==='operations'?<section className="v3-functional-section"><div className="v3-functional-grid"><label><span>首次提醒（分鐘）</span><input type="number" min={1} value={settings.reminderAfterMinutes} onChange={event=>update({reminderAfterMinutes:Number(event.target.value)||1})}/></label><label><span>重複提醒間隔（分鐘）</span><input type="number" min={1} value={settings.reminderIntervalMinutes} onChange={event=>update({reminderIntervalMinutes:Number(event.target.value)||1})}/></label></div></section>:null}
  </div>;
}

function MappingEditor({mapping,onClose}:{mapping:PreviewChannelMapping;onClose:()=>void}){
  const products=usePreviewCatalog(state=>state.products);
  const update=usePreviewAdmin(state=>state.updateMapping);
  const remove=usePreviewAdmin(state=>state.removeMapping);
  return <Sheet eyebrow="平台／渠道管理" title={mapping.channelName} onClose={onClose}><section className="v3-functional-section">
    <div className="v3-functional-grid"><label><span>Keeta 商品／SKU ID</span><input value={mapping.providerItemId} onChange={event=>update(mapping.id,{providerItemId:event.target.value,status:event.target.value.trim()&&mapping.productIds.length?'MAPPED':'PENDING'})}/></label><label><span>Keeta 顯示名稱</span><input value={mapping.channelName} onChange={event=>update(mapping.id,{channelName:event.target.value})}/></label></div>
    <h3>磨飯製作商品</h3>
    <div className="v3-option-link-grid">{products.map(product=><label key={product.id}><input type="checkbox" checked={mapping.productIds.includes(product.id)} onChange={event=>{const ids=new Set(mapping.productIds);if(event.target.checked)ids.add(product.id);else ids.delete(product.id);const list=[...ids];update(mapping.id,{productIds:list,status:mapping.providerItemId.trim()&&list.length?'MAPPED':'PENDING'});}}/><span><strong>{product.name}</strong><small>{product.code} · {product.category}</small></span></label>)}</div>
  </section><section className="v3-functional-danger"><div><strong>刪除映射</strong></div><button onClick={()=>{remove(mapping.id);onClose();}}>刪除</button></section></Sheet>;
}

export function ChannelPage({mode}:{mode:'overview'|'accept'|'sync'|'binding'|'mapping'|'failures'|'estimate'}){
  const config=usePreviewAdmin(state=>state.channelConfig);
  const mappings=usePreviewAdmin(state=>state.channelMappings);
  const update=usePreviewAdmin(state=>state.updateChannelConfig);
  const addMapping=usePreviewAdmin(state=>state.addMapping);
  const [selected,setSelected]=useState<string|null>(null);
  const mappingRows=mode==='failures'?mappings.filter(item=>item.status==='PENDING'):mappings;
  const selectedMapping=selected?mappings.find(item=>item.id===selected):undefined;
  const title=mode==='overview'?'平台總覽':mode==='accept'?'接單規則':mode==='sync'?'供應同步':mode==='binding'?'門店綁定':mode==='mapping'?'商品映射':mode==='failures'?'匹配失敗':'實收估算';
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="平台／渠道管理" title={title} description="Keeta Preview 設定實際互相連動；正式 Provider mutation 仍然唔會喺呢個 Preview 執行。" aside={mode==='mapping'?<button className="v3-primary" onClick={()=>{const row=addMapping();setSelected(row.id);}}>＋ 新增映射</button>:undefined}/>
    {(mode==='overview'||mode==='accept'||mode==='sync'||mode==='binding'||mode==='estimate')?<section className="v3-functional-section">
      <div className="v3-functional-grid">
        {mode==='overview'?<><label><span>平台顯示名稱</span><input value={config.displayName} onChange={event=>update({displayName:event.target.value})}/></label><label className="v3-functional-switch"><input type="checkbox" checked={config.enabled} onChange={event=>update({enabled:event.target.checked})}/><span>啟用平台設定</span></label></>:null}
        {mode==='accept'?<><label className="v3-functional-switch"><input type="checkbox" checked={config.autoAccept} onChange={event=>update({autoAccept:event.target.checked})}/><span>正常單自動接單</span></label><label><span>遲到訂單界線（分鐘）</span><input type="number" min={0} value={config.lateCutoffMinutes} onChange={event=>update({lateCutoffMinutes:Number(event.target.value)||0})}/></label></>:null}
        {mode==='sync'?<label className="v3-functional-switch"><input type="checkbox" checked={config.syncSellability} onChange={event=>update({syncSellability:event.target.checked})}/><span>同步售罄／供應</span></label>:null}
        {mode==='binding'?<label><span>Keeta Provider Shop ID</span><input value={config.providerShopId} onChange={event=>update({providerShopId:event.target.value})}/></label>:null}
        {mode==='estimate'?<label><span>佣金估算 %</span><input inputMode="decimal" value={String(config.commissionPct)} onChange={event=>update({commissionPct:Number(event.target.value)||0})}/></label>:null}
      </div>
    </section>:null}
    {(mode==='mapping'||mode==='failures')?<div className="v3-functional-card-grid">{mappingRows.map(item=><button type="button" key={item.id} onClick={()=>setSelected(item.id)}><div><strong>{item.channelName}</strong><small>{item.providerItemId||'未填 Keeta ID'}</small></div><b>{item.productIds.length}</b><span>製作商品</span><StatusBadge tone={item.status==='MAPPED'?'good':'warning'}>{item.status==='MAPPED'?'已確認':'需要處理'}</StatusBadge></button>)}</div>:null}
    {selectedMapping?<MappingEditor mapping={selectedMapping} onClose={()=>setSelected(null)}/>:null}
  </div>;
}


export function PrintOverviewPage(){
  const printers=usePreviewAdmin(state=>state.printers);
  const rules=usePreviewAdmin(state=>state.printRules);
  const templates=usePreviewAdmin(state=>state.templates);
  const activePrinters=printers.filter(item=>item.active).length;
  return <div className="v3-functional-page"><PreviewNotice/><PageHeader eyebrow="打印管理" title="打印總覽" description="Logical Printer、模板、規則同異常證據集中概覽；唔直接建立第二重印 authority。" />
    <section className="v3-whole-kpi-grid"><article><span>啟用邏輯打印機</span><strong>{activePrinters}</strong><small>{printers.length} 個總數</small></article><article><span>打印模板</span><strong>{templates.length}</strong></article><article><span>打印規則</span><strong>{rules.filter(item=>item.active).length}</strong></article><article><span>今日異常</span><strong>1</strong><StatusBadge tone="warning">需要檢查</StatusBadge></article></section>
    <section className="v3-functional-section"><h3>規則摘要</h3><div className="v3-action-list">{rules.map(rule=><article key={rule.id}><div><strong>{rule.name}</strong><small>{rule.event}</small></div><strong>{rule.printerIds.length} 個目的地</strong><StatusBadge tone={rule.active?'good':'neutral'}>{rule.active?'啟用':'停用'}</StatusBadge></article>)}</div></section>
  </div>;
}

export function PrintExceptionsPage(){
  const printers=usePreviewAdmin(state=>state.printers);
  const failedPrinter=printers.find(item=>item.type==='LABEL')??printers[0];
  return <div className="v3-functional-page"><div className="v3-preview-banner"><strong>只讀異常 Preview</strong><span>冇正式 safe-retry contract 前，Admin 唔會顯示假「重印」操作。</span></div><PageHeader eyebrow="打印管理" title="打印狀態／異常" description="查看打印工作證據、目的地同第一個異常點。" />
    <div className="v3-action-list"><article><div><strong>PRINT-20261001-001</strong><small>標籤 · 訂單 MF-2600999 · {failedPrinter?.name??'未有目的地'}</small></div><StatusBadge tone="warning">等待確認</StatusBadge><button type="button">查看詳情</button></article></div>
  </div>;
}

export function SettlementPage(){
  const rows=[
    {id:'SET-20260930',period:'2026-09-30',gross:'HK$6,428.20',fees:'HK$1,502.80',earnings:'HK$4,925.40',state:'已取得證據'},
    {id:'SET-20260929',period:'2026-09-29',gross:'HK$5,918.00',fees:'HK$1,382.10',earnings:'HK$4,535.90',state:'已取得證據'},
  ];
  return <div className="v3-functional-page"><div className="v3-preview-banner"><strong>平台對帳 · 只讀</strong><span>Provider commercial evidence 唔會改寫 MFK Sales / Order authority。</span></div><PageHeader eyebrow="平台／渠道管理" title="平台對帳" description="查看 Keeta provider settlement evidence；R1 不提供對帳 mutation。" />
    <div className="v3-price-edit-list">{rows.map(row=><article key={row.id}><div><strong>{row.period}</strong><small>{row.id} · 平台費 {row.fees}</small></div><strong>{row.earnings}</strong><StatusBadge tone="good">{row.state}</StatusBadge></article>)}</div>
  </div>;
}


export function PrintOverviewPage(){
  const printers=usePreviewAdmin(state=>state.printers);
  const rules=usePreviewAdmin(state=>state.printRules);
  const templates=usePreviewAdmin(state=>state.templates);
  const [testState,setTestState]=useState<'IDLE'|'READY'>('IDLE');
  const activePrinters=printers.filter(item=>item.active).length;
  const activeRules=rules.filter(item=>item.active).length;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="打印管理" title="打印總覽" description="由 Logical Printer、模板同打印規則組成；實體配對仍由 SMT 現場處理。" aside={<button className="v3-primary" type="button" onClick={()=>setTestState('READY')}>Preview 打印測試</button>}/>
    {testState==='READY'?<div className="v3-preview-notice">打印測試 Preview 已建立；冇向實體打印機送出任何工作。</div>:null}
    <section className="v3-whole-kpi-grid">
      <article><span>邏輯打印機</span><strong>{activePrinters}/{printers.length}</strong><small>已啟用</small></article>
      <article><span>打印模板</span><strong>{templates.length}</strong><small>可編輯</small></article>
      <article><span>打印規則</span><strong>{activeRules}/{rules.length}</strong><small>已啟用</small></article>
      <article><span>今日異常</span><strong>2</strong><small>Preview 異常記錄</small></article>
    </section>
    <div className="v3-action-list">{printers.map(printer=><article key={printer.id}><div><strong>{printer.name}</strong><small>{printer.type} · {printer.widthMm}mm</small></div><StatusBadge tone={printer.active?'good':'neutral'}>{printer.active?'啟用':'停用'}</StatusBadge><span>{rules.filter(rule=>rule.printerIds.includes(printer.id)).length} 條規則</span></article>)}</div>
  </div>;
}

type PrintException={id:string;printer:string;message:string;at:string;resolved:boolean};
const INITIAL_PRINT_EXCEPTIONS:readonly PrintException[]=[
  {id:'pex-1',printer:'廚房製作單機',message:'最後一次工作回讀逾時',at:'10:06',resolved:false},
  {id:'pex-2',printer:'飯糰標籤',message:'標籤紙寬設定需要確認',at:'09:42',resolved:false},
];

export function PrintExceptionsPage(){
  const [rows,setRows]=useState<PrintException[]>(()=>INITIAL_PRINT_EXCEPTIONS.map(item=>({...item})));
  const unresolved=rows.filter(item=>!item.resolved).length;
  return <div className="v3-functional-page"><PreviewNotice/>
    <PageHeader eyebrow="打印管理" title="打印異常" description="異常只作診斷／處理狀態；唔會喺 Admin 直接控制實體打印機。" aside={<span className="v3-product-count">{unresolved} 項待處理</span>}/>
    <div className="v3-action-list">{rows.map(item=><article key={item.id}><div><strong>{item.printer}</strong><small>{item.message} · {item.at}</small></div><StatusBadge tone={item.resolved?'good':'warning'}>{item.resolved?'已標記處理':'需要處理'}</StatusBadge><button type="button" disabled={item.resolved} onClick={()=>setRows(current=>current.map(row=>row.id===item.id?{...row,resolved:true}:row))}>標記已處理</button></article>)}</div>
  </div>;
}

type SettlementRow={id:string;period:string;grossMinor:number;commissionMinor:number;netMinor:number;status:'已確認'|'待平台結算'};
const SETTLEMENT_ROWS:readonly SettlementRow[]=[
  {id:'settle-0930',period:'2026-09-30',grossMinor:642820,commissionMinor:160705,netMinor:482115,status:'已確認'},
  {id:'settle-1001',period:'2026-10-01',grossMinor:274000,commissionMinor:68500,netMinor:205500,status:'待平台結算'},
];

export function ChannelSettlementPage(){
  const [selected,setSelected]=useState<SettlementRow|null>(null);
  return <div className="v3-functional-page">
    <div className="v3-preview-banner"><strong>只讀 Provider Evidence Preview</strong><span>平台對帳資料只讀；Admin 唔會自行改寫 Keeta settlement truth。</span></div>
    <PageHeader eyebrow="平台／渠道管理" title="平台對帳" description="查看平台營業額、佣金同實收；保持 Provider evidence 只讀。" aside={<span className="v3-product-count">{SETTLEMENT_ROWS.length} 個結算期</span>}/>
    <div className="v3-action-list">{SETTLEMENT_ROWS.map(item=><article key={item.id} className="is-clickable" onClick={()=>setSelected(item)}><div><strong>{item.period}</strong><small>Keeta Settlement</small></div><strong>{'HK$'+(item.netMinor/100).toFixed(2)}</strong><StatusBadge tone={item.status==='已確認'?'good':'warning'}>{item.status}</StatusBadge></article>)}</div>
    {selected?<Sheet eyebrow="平台對帳 · 只讀" title={selected.period} onClose={()=>setSelected(null)}><section className="v3-functional-section"><div className="v3-readback-grid"><div><span>平台營業額</span><strong>{'HK$'+(selected.grossMinor/100).toFixed(2)}</strong></div><div><span>佣金</span><strong>{'HK$'+(selected.commissionMinor/100).toFixed(2)}</strong></div><div><span>預計實收</span><strong>{'HK$'+(selected.netMinor/100).toFixed(2)}</strong></div><div><span>狀態</span><strong>{selected.status}</strong></div></div></section><div className="v3-mobile-form-note">資料只讀；如同 Provider 有差異，要由對帳／provider evidence 流程處理，唔喺呢度硬改。</div></Sheet>:null}
  </div>;
}
