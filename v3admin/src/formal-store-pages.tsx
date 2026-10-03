import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {
  FORMAL_TABLE_RETIREMENT_GAP,
  addFormalDiningTable,
  moveFormalDiningTable,
  patchFormalBusinessDay,
  patchFormalDiningTable,
  patchFormalStoreSettings,
  patchFormalWeeklyHours,
  readFormalBusinessDay,
  readFormalStoreSettings,
  type FormalDiningTable,
  type FormalStoreDay,
} from './formal-store.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

const DAYS:readonly [FormalStoreDay,string][]=[
  ['MON','星期一'],['TUE','星期二'],['WED','星期三'],['THU','星期四'],['FRI','星期五'],['SAT','星期六'],['SUN','星期日'],
];

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  return error instanceof Error?error.message:'FORMAL_STORE_SAVE_FAILED';
}

export function FormalStoreSettingsPage({mode}:{mode:'settings'|'hours'|'business-day'|'operations'}){
  const formal=useV3FormalDraft();
  const settings=useMemo(()=>readFormalStoreSettings(formal.workingSnapshot),[formal.workingSnapshot]);
  const businessDay=useMemo(()=>readFormalBusinessDay(formal.workingSnapshot),[formal.workingSnapshot]);
  const [error,setError]=useState('');
  const [basic,setBasic]=useState(()=>({
    storeName:settings.storeName,
    dineInEnabled:settings.dineInEnabled,
    takeawayEnabled:settings.takeawayEnabled,
  }));
  const [ops,setOps]=useState(()=>({
    lateArrivalMinutes:settings.lateArrivalMinutes,
    fulfillmentMinutes:settings.fulfillmentMinutes,
    archiveHours:settings.archiveHours,
    diningOverdueMinutes:settings.diningOverdueMinutes,
    reminderAfterMinutes:settings.reminderAfterMinutes,
    reminderIntervalMinutes:settings.reminderIntervalMinutes,
    repeatReminder:settings.repeatReminder,
    timeoutPriority:settings.timeoutPriority,
  }));
  const [dayConfig,setDayConfig]=useState(()=>({...businessDay,postCloseCorrectionRoles:[...businessDay.postCloseCorrectionRoles]}));

  const saveBasic=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalStoreSettings(snapshot,basic));}
    catch(err){setError(errorCopy(err));}
  };
  const saveOps=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalStoreSettings(snapshot,ops));}
    catch(err){setError(errorCopy(err));}
  };
  const saveBusinessDay=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalBusinessDay(snapshot,dayConfig));}
    catch(err){setError(errorCopy(err));}
  };
  const saveDay=async(day:FormalStoreDay,patch:Parameters<typeof patchFormalWeeklyHours>[2])=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalWeeklyHours(snapshot,day,patch));}
    catch(err){setError(errorCopy(err));}
  };

  const title=mode==='settings'?'門店資料':mode==='hours'?'營業時間':mode==='business-day'?'營業日分界':'營運時間／提醒設定';
  return <div className="v3-functional-page">
    <PageHeader eyebrow="門店設定" title={title} description="呢頁已接 Formal Server Draft；Saved ≠ Published，正式生效要經發佈同回讀。"/>
    {error?<div className="v3-error">{error}</div>:null}

    {mode==='settings'?<section className="v3-functional-section">
      <header><div><h3>門店基本資料</h3><p>Store ID、貨幣、時區屬穩定 identity / system setting，Preview 唔會自行改寫。</p></div><StatusBadge tone="warning">Formal Draft</StatusBadge></header>
      <div className="v3-functional-grid">
        <label><span>門店名稱</span><input value={basic.storeName} onChange={event=>setBasic(current=>({...current,storeName:event.target.value}))}/></label>
        <label><span>門店代碼</span><input value={settings.storeCode} disabled/></label>
        <label><span>貨幣</span><input value={settings.currency} disabled/></label>
        <label><span>時區</span><input value={settings.timezone} disabled/></label>
      </div>
      <label className="v3-functional-switch"><input type="checkbox" checked={basic.dineInEnabled} onChange={event=>setBasic(current=>({...current,dineInEnabled:event.target.checked}))}/><span>堂食</span></label>
      <label className="v3-functional-switch"><input type="checkbox" checked={basic.takeawayEnabled} onChange={event=>setBasic(current=>({...current,takeawayEnabled:event.target.checked}))}/><span>外賣</span></label>
      <button className="v3-primary" type="button" disabled={!basic.storeName.trim()||formal.isSaving} onClick={()=>void saveBasic()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button>
    </section>:null}

    {mode==='hours'?<div className="v3-hours-list">{DAYS.map(([day,label])=>{
      const value=settings.weeklyHours[day];
      return <article key={day}>
        <strong>{label}</strong>
        <label><input type="checkbox" checked={!value.closed} disabled={formal.isSaving} onChange={event=>void saveDay(day,{closed:!event.target.checked})}/>營業</label>
        <input type="time" value={value.opensAt} disabled={value.closed||formal.isSaving} onChange={event=>void saveDay(day,{opensAt:event.target.value})}/>
        <span>至</span>
        <input type="time" value={value.closesAt} disabled={value.closed||formal.isSaving} onChange={event=>void saveDay(day,{closesAt:event.target.value})}/>
      </article>;
    })}</div>:null}

    {mode==='business-day'?<section className="v3-functional-section">
      <header><div><h3>營業日分界</h3><p>只影響營業日分類／收舖政策，唔係第二交易引擎。</p></div><StatusBadge tone="warning">Formal Draft</StatusBadge></header>
      <div className="v3-functional-grid">
        <label><span>每日分界時間</span><input type="time" value={dayConfig.cutoff} onChange={event=>setDayConfig(current=>({...current,cutoff:event.target.value}))}/></label>
        <label><span>現金容許差額 HK$</span><input inputMode="decimal" value={dayConfig.cashTolerance} onChange={event=>setDayConfig(current=>({...current,cashTolerance:event.target.value.replace(/[^0-9.-]/g,'')}))}/></label>
      </div>
      <label className="v3-functional-switch"><input type="checkbox" checked={dayConfig.requireCloseApproval} onChange={event=>setDayConfig(current=>({...current,requireCloseApproval:event.target.checked}))}/><span>超出差額需要授權</span></label>
      <div className="v3-option-link-grid">{['STAFF','MANAGER','OWNER'].map(role=><label key={role}><input type="checkbox" checked={dayConfig.postCloseCorrectionRoles.includes(role)} onChange={event=>setDayConfig(current=>{const roles=new Set(current.postCloseCorrectionRoles);if(event.target.checked)roles.add(role);else roles.delete(role);return{...current,postCloseCorrectionRoles:[...roles]};})}/><span><strong>{role}</strong><small>允許日結後修正</small></span></label>)}</div>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void saveBusinessDay()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button>
    </section>:null}

    {mode==='operations'?<section className="v3-functional-section">
      <header><div><h3>營運計時／提醒</h3><p>門店營運政策直接寫 Formal Server Draft。</p></div><StatusBadge tone="warning">Formal Draft</StatusBadge></header>
      <div className="v3-functional-grid">
        <label><span>遲到界線（分鐘）</span><input type="number" min={0} value={ops.lateArrivalMinutes} onChange={event=>setOps(current=>({...current,lateArrivalMinutes:Number(event.target.value)||0}))}/></label>
        <label><span>目標出餐（分鐘）</span><input type="number" min={0} value={ops.fulfillmentMinutes} onChange={event=>setOps(current=>({...current,fulfillmentMinutes:Number(event.target.value)||0}))}/></label>
        <label><span>封存（小時）</span><input type="number" min={1} value={ops.archiveHours} onChange={event=>setOps(current=>({...current,archiveHours:Number(event.target.value)||1}))}/></label>
        <label><span>堂食超時（分鐘）</span><input type="number" min={0} value={ops.diningOverdueMinutes} onChange={event=>setOps(current=>({...current,diningOverdueMinutes:Number(event.target.value)||0}))}/></label>
        <label><span>首次提醒（分鐘）</span><input type="number" min={1} value={ops.reminderAfterMinutes} onChange={event=>setOps(current=>({...current,reminderAfterMinutes:Number(event.target.value)||1}))}/></label>
        <label><span>重複提醒間隔（分鐘）</span><input type="number" min={1} value={ops.reminderIntervalMinutes} onChange={event=>setOps(current=>({...current,reminderIntervalMinutes:Number(event.target.value)||1}))}/></label>
        <label><span>提醒優先級</span><select value={ops.timeoutPriority} onChange={event=>setOps(current=>({...current,timeoutPriority:event.target.value as typeof current.timeoutPriority}))}><option value="NORMAL">正常</option><option value="HIGH">高</option><option value="URGENT">緊急</option></select></label>
      </div>
      <label className="v3-functional-switch"><input type="checkbox" checked={ops.repeatReminder} onChange={event=>setOps(current=>({...current,repeatReminder:event.target.checked}))}/><span>重複提醒</span></label>
      <button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void saveOps()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button>
    </section>:null}
  </div>;
}

function FormalDiningTableEditor({table,onClose}:{table:FormalDiningTable;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const [name,setName]=useState(table.name);
  const [active,setActive]=useState(table.active);
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>patchFormalDiningTable(snapshot,table.id,{name:name.trim(),active}));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button className="v3-functional-backdrop" type="button" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{table.name}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <label><span>餐桌名稱 *</span><input value={name} onChange={event=>setName(event.target.value)}/></label>
          <label><span>餐桌 ID</span><input value={table.id} disabled/></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/><span>{active?'可使用':'暫停使用'}</span></label>
          <div className="v3-mobile-form-note">改名會保留版本歷史；正式發佈後 SMT／SMM 共用同一枱號身份。</div>
          {error?<div className="v3-error">{error}</div>:null}
        </section>
        <section className="v3-functional-section">
          <header><div><h3>永久退休</h3><p>未有 fresh occupancy readback 前唔提供假退休按鈕。</p></div><StatusBadge tone="warning">{FORMAL_TABLE_RETIREMENT_GAP.status}</StatusBadge></header>
          <small>{FORMAL_TABLE_RETIREMENT_GAP.requirement}</small>
        </section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={!name.trim()||formal.isSaving} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalDiningTablesPage(){
  const formal=useV3FormalDraft();
  const settings=useMemo(()=>readFormalStoreSettings(formal.workingSnapshot),[formal.workingSnapshot]);
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const tables=[...settings.diningTables].sort((a,b)=>a.sortOrder-b.sortOrder);
  const current=selected?tables.find(item=>item.id===selected):undefined;
  const create=async()=>{
    const used=tables.map(item=>Number(item.id.replace(/\D/g,''))).filter(Number.isFinite);
    const next=Math.max(0,...used)+1;
    const id='T'+String(next).padStart(4,'0');
    setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalDiningTable(snapshot,id));setSelected(id);}
    catch(err){setError(errorCopy(err));}
  };
  const move=async(id:string,direction:-1|1)=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>moveFormalDiningTable(snapshot,id,direction));}
    catch(err){setError(errorCopy(err));}
  };
  return <div className="v3-functional-page">
    <PageHeader eyebrow="門店設定" title="餐桌管理" description="餐桌身份、名稱、排序同暫停使用直接寫 Formal Server Draft；永久退休保留 occupancy guard。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增餐桌</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    <div className="v3-functional-card-grid">{tables.map((table,index)=><article className="v3-functional-card" key={table.id}>
      <button className="v3-functional-card-main" type="button" onClick={()=>setSelected(table.id)}>
        <div><strong>{table.name}</strong><small>{table.id}</small></div><b>{table.sortOrder}</b><span>次序</span><StatusBadge tone={table.retirementStatus==='RETIRED'?'neutral':table.active?'good':'warning'}>{table.retirementStatus==='RETIRED'?'已退休':table.active?'可使用':'暫停'}</StatusBadge>
      </button>
      <div className="v3-inline-order-buttons"><button type="button" disabled={index===0||formal.isSaving} onClick={()=>void move(table.id,-1)}>↑</button><button type="button" disabled={index===tables.length-1||formal.isSaving} onClick={()=>void move(table.id,1)}>↓</button></div>
    </article>)}</div>
    {current?<FormalDiningTableEditor table={current} onClose={()=>setSelected(null)}/>:null}
  </div>;
}
