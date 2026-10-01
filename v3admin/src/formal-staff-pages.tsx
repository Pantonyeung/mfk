import {useMemo,useState} from 'react';
import {useV3FormalDraft,V3FormalDraftHttpError} from './formal-draft.tsx';
import {
  FORMAL_STAFF_AUTH_GAP,
  FORMAL_STAFF_PERMISSIONS,
  addFormalStaff,
  patchFormalStaff,
  readFormalStaff,
  removeFormalStaff,
  validateFormalStaff,
  type FormalStaff,
} from './formal-staff.ts';
import {PageHeader,StatusBadge} from './ui.tsx';

function errorCopy(error:unknown){
  if(error instanceof V3FormalDraftHttpError){
    if(error.code==='ADMIN_DRAFT_REVISION_CONFLICT')return '另一個分頁已更新正式草稿。重新讀取後再儲存。';
    if(error.code==='ADMIN_DRAFT_BASE_CONFLICT')return '正式版本已改變。舊草稿唔會覆蓋新正式版本。';
  }
  if(error instanceof Error){
    if(error.message==='FORMAL_STAFF_PIN_VERIFIER_REQUIRED')return '呢個員工未有已發布 PIN Verifier，唔可以直接啟用登入。';
    if(error.message==='FORMAL_ACTIVE_OWNER_REMOVE_FORBIDDEN')return '唔可以移除仍然啟用中嘅 OWNER。';
    return error.message;
  }
  return 'FORMAL_STAFF_SAVE_FAILED';
}

function StaffEditor({staff,onClose}:{staff:FormalStaff;onClose:()=>void}){
  const formal=useV3FormalDraft();
  const [draft,setDraft]=useState(()=>({...staff,permissions:[...staff.permissions]}));
  const [error,setError]=useState('');
  const save=async()=>{
    setError('');
    try{
      await formal.mutateSnapshot(snapshot=>patchFormalStaff(snapshot,staff.id,{
        loginId:draft.loginId.trim(),
        name:draft.name.trim(),
        role:draft.role,
        scope:draft.scope,
        adminLogin:draft.adminLogin,
        active:draft.active,
        permissions:[...draft.permissions],
      }));
      onClose();
    }catch(err){setError(errorCopy(err));}
  };
  const remove=async()=>{
    setError('');
    try{await formal.mutateSnapshot(snapshot=>removeFormalStaff(snapshot,staff.id));onClose();}
    catch(err){setError(errorCopy(err));}
  };
  const togglePermission=(permission:string,checked:boolean)=>setDraft(current=>{
    const next=new Set(current.permissions);
    if(checked)next.add(permission);else next.delete(permission);
    return{...current,permissions:[...next]};
  });

  return <div className="v3-functional-editor" role="dialog" aria-modal="true">
    <button type="button" className="v3-functional-backdrop" aria-label="關閉" onClick={onClose}/>
    <section className="v3-functional-sheet">
      <header><div><small>Formal Server Draft</small><h2>{draft.name||draft.loginId||'未命名員工'}</h2></div><button type="button" onClick={onClose}>關閉</button></header>
      <div className="v3-functional-body">
        <section className="v3-functional-section">
          <header><div><h3>員工身份</h3><p>身份、角色、scope 同 permission 直接寫 Formal Server Draft。</p></div><StatusBadge tone="warning">Saved ≠ Published</StatusBadge></header>
          <div className="v3-functional-grid">
            <label><span>登入編號 *</span><input autoComplete="username" value={draft.loginId} onChange={event=>setDraft(current=>({...current,loginId:event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)}))}/></label>
            <label><span>員工名稱 *</span><input value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>
            <label><span>角色</span><select value={draft.role} onChange={event=>setDraft(current=>({...current,role:event.target.value as FormalStaff['role']}))}><option value="STAFF">員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option><option value="VIEWER">只讀人員</option></select></label>
            <label><span>權限範圍</span><select value={draft.scope} onChange={event=>setDraft(current=>({...current,scope:event.target.value as FormalStaff['scope']}))}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label>
          </div>
          <div className="v3-option-link-grid">{FORMAL_STAFF_PERMISSIONS.map(([id,label])=><label key={id}><input type="checkbox" checked={draft.permissions.includes(id)} onChange={event=>togglePermission(id,event.target.checked)}/><span><strong>{label}</strong><small>{id}</small></span></label>)}</div>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.adminLogin} disabled={!draft.hasPinVerifier} onChange={event=>setDraft(current=>({...current,adminLogin:event.target.checked}))}/><span>允許 Admin 登入</span></label>
          <label className="v3-functional-switch"><input type="checkbox" checked={draft.active} disabled={!draft.hasPinVerifier} onChange={event=>setDraft(current=>({...current,active:event.target.checked}))}/><span>{draft.active?'啟用員工':'停用員工'}</span></label>
          <div className="v3-mobile-form-note">PIN：{draft.hasPinVerifier?'已有已發布 Verifier；V3 唔會讀明文 PIN。':'未有 Verifier。'+FORMAL_STAFF_AUTH_GAP.pinChange}</div>
          {error?<div className="v3-error">{error}</div>:null}
        </section>
        <section className="v3-functional-danger"><div><strong>移除員工草稿</strong><small>一般情況建議停用保留歷史身份；啟用中 OWNER 會被 guard 阻止移除。</small></div><button type="button" disabled={formal.isSaving} onClick={()=>void remove()}>移除</button></section>
      </div>
      <footer className="v3-functional-footer"><button type="button" onClick={onClose}>取消</button><button className="v3-primary" type="button" disabled={formal.isSaving||!draft.name.trim()||!draft.loginId.trim()} onClick={()=>void save()}>{formal.isSaving?'儲存中…':'儲存正式草稿'}</button></footer>
    </section>
  </div>;
}

export function FormalStaffPage(){
  const formal=useV3FormalDraft();
  const staff=useMemo(()=>readFormalStaff(formal.workingSnapshot),[formal.workingSnapshot]);
  const validation=useMemo(()=>validateFormalStaff(formal.workingSnapshot),[formal.workingSnapshot]);
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const create=async()=>{
    const id='staff-'+crypto.randomUUID();
    setError('');
    try{await formal.mutateSnapshot(snapshot=>addFormalStaff(snapshot,id));setSelected(id);}
    catch(err){setError(errorCopy(err));}
  };
  const current=selected?staff.find(item=>item.id===selected):undefined;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="人員與權限" title="員工管理" description="員工身份、角色、scope 同 permission 直接寫 Formal Server Draft；PIN 變更唔會用明文草稿假接。" aside={<button className="v3-primary" type="button" disabled={formal.isSaving} onClick={()=>void create()}>＋ 新增員工</button>}/>
    {error?<div className="v3-error">{error}</div>:null}
    {validation.length?<div className="v3-error">{validation.join('；')}</div>:null}
    <div className="v3-functional-card-grid">{staff.map(person=><button type="button" key={person.id} onClick={()=>setSelected(person.id)}>
      <div><strong>{person.name||person.loginId||'未命名員工'}</strong><small>{person.loginId||'未有登入編號'} · {person.id}</small></div>
      <b>{person.role}</b><span>{person.scope}</span>
      <StatusBadge tone={person.active?'good':'neutral'}>{person.active?'啟用':'停用'}</StatusBadge>
      <small>{person.permissions.length} 個權限 · {person.hasPinVerifier?'PIN ready':'未有 PIN verifier'}</small>
    </button>)}</div>
    {current?<StaffEditor staff={current} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

export function FormalRolesSummaryPage(){
  const formal=useV3FormalDraft();
  const staff=useMemo(()=>readFormalStaff(formal.workingSnapshot),[formal.workingSnapshot]);
  const roles=['OWNER','MANAGER','STAFF','VIEWER'] as const;
  return <div className="v3-functional-page">
    <PageHeader eyebrow="人員與權限" title="角色管理" description="目前正式 Canonical 冇獨立 Role Registry；role 係 Staff record 嘅分類，實際權限仍然逐員工保存。"/>
    <section className="v3-functional-section">
      <header><div><h3>Current Canonical Role Model</h3><p>唔會喺 V3 Preview 另造第二套 role authority。</p></div><StatusBadge tone="warning">DERIVED / READ-ONLY</StatusBadge></header>
      <div className="v3-functional-card-grid">{roles.map(role=><article className="v3-functional-card-static" key={role}><div><strong>{role}</strong><small>由 Staff records 派生</small></div><b>{staff.filter(person=>person.role===role).length}</b><span>位員工</span></article>)}</div>
    </section>
  </div>;
}

export function FormalPermissionsSummaryPage(){
  const formal=useV3FormalDraft();
  const staff=useMemo(()=>readFormalStaff(formal.workingSnapshot),[formal.workingSnapshot]);
  return <div className="v3-functional-page">
    <PageHeader eyebrow="人員與權限" title="權限管理" description="正式權限目前儲存在 Staff record；修改入口保持單一 Primary Home：員工管理。"/>
    <div className="v3-permission-matrix">
      <header><strong>權限</strong>{['OWNER','MANAGER','STAFF','VIEWER'].map(role=><strong key={role}>{role}</strong>)}</header>
      {FORMAL_STAFF_PERMISSIONS.map(([permission,label])=><div key={permission}>
        <span><strong>{label}</strong><small>{permission}</small></span>
        {['OWNER','MANAGER','STAFF','VIEWER'].map(role=>{
          const people=staff.filter(person=>person.role===role);
          const count=people.filter(person=>person.permissions.includes(permission)).length;
          return <span key={role}>{count}/{people.length}</span>;
        })}
      </div>)}
    </div>
  </div>;
}

export function FormalAccessGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="人員與權限" title="登入／工作階段／受信任裝置" description="呢個係 Security Runtime State，唔屬 Formal Config Snapshot。"/>
    <section className="v3-functional-section">
      <header><div><h3>Security runtime seam 未接</h3><p>{FORMAL_STAFF_AUTH_GAP.sessionManagement}</p></div><StatusBadge tone="warning">SECURITY SEAM REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">正式 Staff config 已接；Session revoke / Trusted Device 必須接 server auth runtime endpoint，唔可以寫入 Draft 當真相。</div>
    </section>
  </div>;
}
