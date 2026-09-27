import {useMemo,useState} from 'react';
import type {OwnerActivityRecord,OwnerConnectionState,OwnerStaffPresence} from './product-types';
import {humanEmployeeCode,selectStaffAuditHistory} from './staff-identity';

function roleLabel(role:string){
  const key=String(role||'').toUpperCase();
  if(key==='OWNER')return '老闆';
  if(key==='MANAGER')return '經理';
  if(key==='STAFF')return '員工';
  if(key==='VIEWER')return '只讀';
  return role||'未有角色讀回';
}

function displayPresence(value:string){
  const clean=String(value||'').trim();
  return !clean||clean==='UNKNOWN'?'未有資料':clean;
}

function freshnessLabel(connection:OwnerConnectionState){
  if(connection==='FRESH')return '資料新鮮';
  if(connection==='STALE')return '資料稍舊';
  if(connection==='PARTIAL')return '部分資料';
  if(connection==='OFFLINE_READONLY')return '離線唯讀';
  if(connection==='PERMISSION_DENIED')return '權限不足';
  if(connection==='LOADING')return '同步中';
  if(connection==='EMPTY')return '暫無資料';
  if(connection==='UNKNOWN')return '狀態未明';
  return '同步失敗';
}

export function StaffOverviewPage({
  staff,
  activity,
  connection,
  observedAt,
  onBack,
}:{
  staff:readonly OwnerStaffPresence[];
  activity:readonly OwnerActivityRecord[];
  connection:OwnerConnectionState;
  observedAt?:string;
  onBack:()=>void;
}){
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=staff.find(item=>item.staffId===selectedId)??null;
  const roles=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const person of staff){
      const key=roleLabel(person.role);
      counts.set(key,(counts.get(key)??0)+1);
    }
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-HK'));
  },[staff]);
  const selectedHistory=useMemo(
    ()=>selected?selectStaffAuditHistory(activity,selected).slice(0,20):[],
    [activity,selected],
  );

  return <section className="page staff-overview-page">
    <header className="page-head secondary-head">
      <button className="back-link" onClick={onBack}>返回</button>
      <div>
        <span>OA-STF-001 · 唯讀</span>
        <h1>員工摘要</h1>
        <small>身份／角色來自 canonical staffAuth；出勤、排班、休息同工時冇 canonical 資料就保持「未有資料」。</small>
      </div>
    </header>

    <section className="card staff-source-card">
      <div className="section-head">
        <div><span className="eyebrow">資料來源</span><h2>Canonical Readback</h2></div>
        <span className="staff-readonly-chip">唯讀</span>
      </div>
      <div className="staff-source-grid">
        <div><span>身份／角色</span><strong>Admin canonical staffAuth</strong><small>{staff.length?staff.length+' 位啟用員工':'未有資料'}</small></div>
        <div><span>出勤／打卡</span><strong>未連接</strong><small>不以 SMT 登入推斷</small></div>
        <div><span>排班／休息／工時</span><strong>未連接</strong><small>不以營業時間或角色推斷</small></div>
        <div><span>Freshness</span><strong>{freshnessLabel(connection)}</strong><small>{observedAt?new Date(observedAt).toLocaleString('zh-HK'):'未有更新時間'}</small></div>
      </div>
    </section>

    <section className="staff-kpi-grid" aria-label="員工摘要指標">
      <article className="card staff-kpi"><span>上班中</span><strong>未有資料</strong><small>冇 canonical 出勤來源</small></article>
      <article className="card staff-kpi"><span>排班 vs 實際</span><strong>未有資料</strong><small>冇 canonical 排班＋打卡對照</small></article>
      <article className="card staff-kpi"><span>休息中</span><strong>未有資料</strong><small>冇 canonical break 事件</small></article>
      <article className="card staff-kpi"><span>今日工時</span><strong>未有資料</strong><small>冇 canonical worked-hours</small></article>
      <article className="card staff-kpi"><span>員工提醒</span><strong>未有資料</strong><small>冇獨立 staff alert source</small></article>
      <article className="card staff-kpi role-kpi"><span>角色摘要</span><strong>{staff.length?roles.map(([name,count])=>name+' '+count).join(' · '):'未有資料'}</strong><small>只計 canonical 啟用員工 projection</small></article>
    </section>

    <section className="card staff-boundary-card">
      <strong>資料邊界</strong>
      <p>已打卡 ≠ 已登入 SMT；已登入 SMT ≠ 有 Manager 權限。Wage／Payroll 預設不顯示。勞效 KPI 只有正式出勤／工時來源同權限同時存在先可以顯示；目前未有來源，所以不顯示任何估算。</p>
    </section>

    <section className="card staff-list-card">
      <div className="section-head">
        <div><span className="eyebrow orange">Staff</span><h2>員工角色摘要</h2></div>
        <small>{staff.length?staff.length+' 位':'未有資料'}</small>
      </div>
      {!staff.length?<div className="staff-empty"><strong>員工資料尚未連接</strong><span>唔會用本機名單或登入紀錄補數。</span></div>:
        <div className="staff-overview-list">{staff.map(person=><button className="staff-overview-row" key={person.staffId} onClick={()=>setSelectedId(person.staffId)}>
          <div className="staff-avatar" aria-hidden="true">{person.name.trim().slice(0,1)||'員'}</div>
          <div className="staff-overview-copy">
            <strong>{person.name}</strong>
            <small>{roleLabel(person.role)} · 員工編號 {humanEmployeeCode(person)??'未有員工編號資料'}</small>
            <span>能力摘要：{person.capabilitySummary??'未有能力摘要資料'}</span>
          </div>
          <div className="staff-overview-state">
            <small>今日出勤</small>
            <strong>{displayPresence(person.presence)}</strong>
            <span>排班：{person.schedule??'未有資料'}</span>
          </div>
          <b aria-hidden="true">›</b>
        </button>)}</div>}
    </section>

    {selected?<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}>
      <section className="drawer staff-detail-drawer" role="dialog" aria-modal="true" aria-label={selected.name+' 員工詳情'}>
        <header className="drawer-head">
          <div><span>STAFF DETAIL · READ ONLY</span><h2>{selected.name}</h2><small>{roleLabel(selected.role)} · 員工編號 {humanEmployeeCode(selected)??'未有員工編號資料'}</small></div>
          <button onClick={()=>setSelectedId(null)} aria-label="關閉">×</button>
        </header>

        <section className="staff-detail-section">
          <h3>1. Identity & Employment</h3>
          <div className="staff-detail-grid">
            <div><span>姓名</span><strong>{selected.name}</strong></div>
            <div><span>員工編號</span><strong>{humanEmployeeCode(selected)??'未有員工編號資料'}</strong></div>
            <div><span>角色</span><strong>{roleLabel(selected.role)}</strong></div>
            <div><span>僱傭／入職資料</span><strong>未有資料</strong></div>
          </div>
        </section>

        <section className="staff-detail-section">
          <h3>2. Today</h3>
          <div className="staff-detail-grid">
            <div><span>排班</span><strong>{selected.schedule??'未有資料'}</strong></div>
            <div><span>實際出勤</span><strong>{displayPresence(selected.presence)}</strong></div>
            <div><span>休息</span><strong>未有資料</strong></div>
            <div><span>今日工時</span><strong>未有資料</strong></div>
          </div>
          <p className="staff-detail-note">目前冇 canonical attendance / break / worked-hours source；禁止由 SMT login、營業時間或角色估算。</p>
        </section>

        <section className="staff-detail-section">
          <h3>3. Role & Capability Summary</h3>
          <div className="staff-detail-grid">
            <div><span>角色</span><strong>{roleLabel(selected.role)}</strong></div>
            <div><span>能力摘要</span><strong>{selected.capabilitySummary??'未有能力摘要資料'}</strong></div>
          </div>
          <p className="staff-detail-note">此頁只顯示已讀回摘要；不能新增／停用員工、改角色／權限或重設 PIN。</p>
        </section>

        <section className="staff-detail-section">
          <h3>4. History & Audit</h3>
          {!selectedHistory.length?<div className="staff-empty"><strong>未有可可靠歸屬 Audit 讀回</strong><span>只接受 stable canonical staff identity；name-only actor 不會歸屬。</span></div>:
            <div className="staff-audit-list">{selectedHistory.map(item=><article key={item.activityId}>
              <div><strong>{item.title}</strong><span>{new Date(item.observedAt).toLocaleString('zh-HK')}</span></div>
              <small>{item.result}{item.readback?' · '+item.readback:''}</small>
            </article>)}</div>}
        </section>
      </section>
    </div>:null}
  </section>;
}
