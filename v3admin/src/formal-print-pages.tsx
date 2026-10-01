import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {
  FORMAL_PRINT_ROUTING_GAP,
  addFormalLogicalPrinter,
  patchFormalLogicalPrinter,
  patchFormalPrintTemplates,
  readFormalLogicalPrinters,
  readFormalPrintTemplates,
  removeFormalLogicalPrinter,
  type FormalLogicalPrinter,
  type FormalPrintTemplateSet,
} from './formal-print.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_PRINTER_IN_USE')return '仍有正式商品打印規則引用呢個 Logical Printer，未可以刪除。';
    return error.message;
  }
  return 'FORMAL_PRINT_SAVE_FAILED';
}

function FormalPrinterEditor({printer,onClose}:{printer:FormalLogicalPrinter;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const [draft,setDraft]=useState(()=>({...printer,capabilities:[...printer.capabilities]}));
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>patchFormalLogicalPrinter(snapshot,printer.id,{
        name:draft.name.trim(),
        type:draft.type,
        model:draft.model.trim(),
        widthMm:draft.widthMm,
        active:draft.active,
        capabilities:[draft.type],
      }));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalLogicalPrinter(snapshot,printer.id));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>Logical Printer</h3><p>Admin 管理名稱同用途；實體 IP／USB 仍由現場 SMT 綁定。</p></div><StatusBadge tone="warning">Admin Logical Authority</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>名稱 *</span><input value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>
            <label><span>用途</span><select value={draft.type} onChange={event=>setDraft(current=>({...current,type:event.target.value as FormalLogicalPrinter['type']}))}><option value="RECEIPT">小票</option><option value="PRODUCTION">製作單</option><option value="PACKING">打包單</option><option value="LABEL">Label</option></select></label>
            <label><span>打印規格</span><input value={draft.model} onChange={event=>setDraft(current=>({...current,model:event.target.value}))}/></label>
            <label><span>紙寬／Label 寬 mm</span><input type="number" min={20} max={120} value={draft.widthMm} onChange={event=>setDraft(current=>({...current,widthMm:Number(event.target.value)||80}))}/></label>
          </div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} onChange={event=>setDraft(current=>({...current,active:event.target.checked}))}/><span>{draft.active?'啟用':'停用'}</span></label>
          <div className="v3-mobile-form-note">Logical ID：{printer.id}。現場 SMT 只需要將呢個 Logical ID 綁到真實打印機。</div>
          {error?<div className="v3-error">{error}</div>:null}
        </section>
        <section className="v3-functional-danger"><div><strong>刪除 Logical Printer</strong><small>如果正式商品打印規則仲引用，會 fail-closed。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>刪除</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!draft.name.trim()||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalPrintersPage(){
  const formal=useV3FormalDraft();
  const printers=useMemo(()=>readFormalLogicalPrinters(formal.workingSnapshot),[formal.workingSnapshot]);
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const create=async()=>{
    const id='logical-'+crypto.randomUUID();
    setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalLogicalPrinter(snapshot,id));setSelected(id);}
    catch(err){setError(errorCopy(err));}
  };
  const current=selected?printers.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="打印管理" title="邏輯打印機" description="Logical Printer 名稱、用途同規格直接寫 Formal Server Draft；實體 IP／USB 唔入 Admin。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增 Logical Printer</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-functional-card-grid">{printers.map(printer=><button type="button" key={printer.id} onClick={()=>setSelected(printer.id)}>
      <div><strong>{printer.name}</strong><small>{printer.id}</small></div>
      <b>{printer.widthMm}mm</b><span>{printer.type}</span>
      <StatusBadge tone={printer.active?'good':'neutral'}>{printer.active?'啟用':'停用'}</StatusBadge>
      <small>{printer.model||'未填規格'}</small>
    </button>)}</div>
    {current?<FormalPrinterEditor printer={current} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

const TEMPLATE_ROWS=[
  {key:'receipt' as const,label:'小票'},
  {key:'production' as const,label:'製作單'},
  {key:'packing' as const,label:'打包單'},
  {key:'label' as const,label:'Label'},
];

function FormalTemplateEditor({templateKey,templates,onClose}:{templateKey:keyof Pick<FormalPrintTemplateSet,'receipt'|'production'|'packing'|'label'>;templates:FormalPrintTemplateSet;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const label=TEMPLATE_ROWS.find(item=>item.key===templateKey)?.label??templateKey;
  const [value,setValue]=useState(templates[templateKey]);
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalPrintTemplates(snapshot,{[templateKey]:value}));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{label} Template</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body"><section className="v3-functional-section">
        <header><div><h3>{label} Template</h3><p>Template 內容由 Admin 管理；實體機綁定唔喺呢度做。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
        <label><span>Template 內容</span><textarea rows={14} value={value} onChange={event=>setValue(event.target.value)}/></label>
        {error?<div className="v3-error">{error}</div>:null}
      </section></div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalPrintTemplatesPage(){
  const formal=useV3FormalDraft();
  const templates=useMemo(()=>readFormalPrintTemplates(formal.workingSnapshot),[formal.workingSnapshot]);
  const [selected,setSelected]=useState<typeof TEMPLATE_ROWS[number]['key']|null>(null);
  const [error,setError]=useState('');
  const patchSemantics=async(patch:Partial<FormalPrintTemplateSet>)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalPrintTemplates(snapshot,patch));}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="打印管理" title="打印模板" description="正式 Template 內容直接寫 Formal Server Draft。"/>
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-functional-card-grid">{TEMPLATE_ROWS.map(item=><button type="button" key={item.key} onClick={()=>setSelected(item.key)}>
      <div><strong>{item.label}</strong><small>{item.key.toUpperCase()}</small></div><b>{templates[item.key].split('\n').filter(Boolean).length}</b><span>行</span><StatusBadge tone="good">正式模板</StatusBadge>
    </button>)}</div>
    <section className="v3-functional-section">
      <h3>輸出語義</h3>
      <label className="v3-functional-switch"><input type="checkbox" checked={templates.showComboRelationship} disabled={formal.isSaving} onChange={event=>void patchSemantics({showComboRelationship:event.target.checked})}/><span>保留套餐與 child 關係</span></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={templates.separateFoodDrinkCount} disabled={formal.isSaving} onChange={event=>void patchSemantics({separateFoodDrinkCount:event.target.checked})}/><span>食品／飲品總件數分開</span></label>
    </section>
    {selected?<FormalTemplateEditor templateKey={selected} templates={templates} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function FormalPrintRulesGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="打印管理" title="打印規則" description="正式 Canonical 目前仍係 legacy product flags + labelPrinterIds；V3 已鎖定要升級成每種輸出獨立 Logical Printer + Template routing。"/>
    <section className="v3-functional-section">
      <header><div><h3>Schema seam 未完成</h3><p>呢頁而家唔會將 Preview routing 寫落舊 schema，避免製作單／打包單／小票 routing 被壓扁或遺失。</p></div><StatusBadge tone="warning">SCHEMA SEAM REQUIRED</StatusBadge></header>
      <div className="v3-formal-draft-meta">
        <div><span>Current</span><strong>{FORMAL_PRINT_ROUTING_GAP.currentCanonicalShape}</strong></div>
        <div><span>Required</span><strong>{FORMAL_PRINT_ROUTING_GAP.requiredV3Shape}</strong></div>
        <div><span>Physical Binding</span><strong>{FORMAL_PRINT_ROUTING_GAP.physicalBindingAuthority}</strong></div>
      </div>
      <div className="v3-mobile-form-note">Logical Printer 同 Template 已經可以正式儲存；Product per-output routing 要先擴正式 schema + SMT apply contract，之後先開正式寫入。</div>
    </section>
  </div>;
}


export function FormalPrintOverviewPage(){
  const formal=useV3FormalDraft();
  const printers=useMemo(()=>readFormalLogicalPrinters(formal.workingSnapshot),[formal.workingSnapshot]);
  const templates=useMemo(()=>readFormalPrintTemplates(formal.workingSnapshot),[formal.workingSnapshot]);
  const active=printers.filter(printer=>printer.active);
  const counts={
    RECEIPT:active.filter(printer=>printer.type==='RECEIPT').length,
    PRODUCTION:active.filter(printer=>printer.type==='PRODUCTION').length,
    PACKING:active.filter(printer=>printer.type==='PACKING').length,
    LABEL:active.filter(printer=>printer.type==='LABEL').length,
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="打印管理" title="打印總覽" description="直接讀 Formal Server Draft / Canonical 嘅 Logical Printer 同 Template；實體 IP／USB 保持 SMT 現場 authority。"/>
    <section className="v3-whole-kpi-grid">
      <article><span>小票 Logical Printer</span><strong>{counts.RECEIPT}</strong><small>{templates.receipt?'Template 已設定':'未有 Template'}</small></article>
      <article><span>製作單 Logical Printer</span><strong>{counts.PRODUCTION}</strong><small>{templates.production?'Template 已設定':'未有 Template'}</small></article>
      <article><span>打包單 Logical Printer</span><strong>{counts.PACKING}</strong><small>{templates.packing?'Template 已設定':'未有 Template'}</small></article>
      <article><span>Label Logical Printer</span><strong>{counts.LABEL}</strong><small>{templates.label?'Template 已設定':'未有 Template'}</small></article>
    </section>
    <section className="v3-functional-section">
      <header><div><h3>正式打印 Authority</h3><p>Admin 已接 Logical Printer + Template；Product per-output routing 仲等正式 schema seam。</p></div><StatusBadge tone="warning">{FORMAL_PRINT_ROUTING_GAP.status}</StatusBadge></header>
      <div className="v3-action-list">{printers.map(printer=><article key={printer.id}><div><strong>{printer.name}</strong><small>{printer.id} · {printer.type} · {printer.widthMm}mm</small></div><StatusBadge tone={printer.active?'good':'neutral'}>{printer.active?'啟用':'停用'}</StatusBadge></article>)}</div>
    </section>
  </div>;
}

export function FormalPrintExceptionsGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="打印管理" title="打印狀態／異常" description="未有 verified server print-job / safe-retry read seam 前保持 fail-closed。"/>
    <section className="v3-functional-section">
      <header><div><h3>Print evidence seam 未接</h3><p>需要正式 Print Job identity、目的地、狀態、失敗原因，同 safe-retry command/readback。</p></div><StatusBadge tone="warning">READ + COMMAND SEAM REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">呢頁唔會用 Preview 假異常，亦唔會提供未有 idempotency contract 嘅「重印」按鈕。</div>
    </section>
  </div>;
}
