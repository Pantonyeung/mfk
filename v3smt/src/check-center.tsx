import {useCallback,useEffect,useMemo,useState} from 'react';

import type {MfpOrderingSurface} from './ordering-domain.ts';
import {
  MFP_A9_BINDINGS,
  MFP_A9_FORMAL_ROUTER_STATUS,
  MFP_BACKUP_BOUNDARY,
  MFP_BUILD_IDENTITY,
  collectMfpA9NativeDiagnostics,
  createMfpA9NativeAdapter,
  evaluateMfpA9Readiness,
  mfpRuntimeMode,
  readMfpRuntimeReleaseIdentity,
  type MfpA9NativeDiagnostics,
} from './a9-runtime.ts';

const emptyDiagnostics=():MfpA9NativeDiagnostics=>Object.freeze({
  checkedAt:'NOT_CHECKED',carrier:null,storeKernel:null,print:null,faults:null,
  errors:Object.freeze({carrier:null,storeKernel:null,print:null,faults:null}),
});

function field(value:Readonly<Record<string,unknown>>|null,key:string){
  const item=value?.[key];
  return typeof item==='string'||typeof item==='number'||typeof item==='boolean'?String(item):'NOT EXPOSED';
}

function valueRecord(value:Readonly<Record<string,unknown>>|null){
  const nested=value?.value;
  return nested&&typeof nested==='object'&&!Array.isArray(nested)?nested as Readonly<Record<string,unknown>>:value;
}

function nestedField(value:Readonly<Record<string,unknown>>|null,parent:string,key:string){
  const nested=value?.[parent];
  return nested&&typeof nested==='object'&&!Array.isArray(nested)?field(nested as Readonly<Record<string,unknown>>,key):'NOT EXPOSED';
}

function faults(value:Readonly<Record<string,unknown>>|null){
  const rows=value?.value;
  if(!Array.isArray(rows))return [];
  return rows.slice(0,8).flatMap(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row))return[];
    const record=row as Record<string,unknown>;
    return[{source:field(record,'source'),code:field(record,'code'),timestamp:field(record,'observedAtEpochMs')}];
  });
}

function Status({ok,code}:{ok:boolean;code:string|null}){
  return <><strong>{ok?'SOURCE_VERIFIED':'BLOCKED'}</strong><small>{ok?'NONE':code??'NOT CHECKED'}</small></>;
}

export function MfpCheckCenterView({surface,url,diagnostics,onRefresh}:{
  surface:MfpOrderingSurface;
  url:URL;
  diagnostics:MfpA9NativeDiagnostics;
  onRefresh?:()=>void;
}){
  const runtime=readMfpRuntimeReleaseIdentity(url);
  const mode=mfpRuntimeMode(url);
  const readiness=evaluateMfpA9Readiness();
  const carrierOk=Boolean(diagnostics.carrier&&!diagnostics.errors.carrier);
  const kernelOk=Boolean(diagnostics.storeKernel&&!diagnostics.errors.storeKernel);
  const printOk=Boolean(diagnostics.print&&!diagnostics.errors.print);
  const carrier=valueRecord(diagnostics.carrier);
  const kernel=valueRecord(diagnostics.storeKernel);
  const print=valueRecord(diagnostics.print);
  const recentFaults=faults(diagnostics.faults);
  return <section className="mfp-check-center" data-check-center="A9" data-runtime-mode={mode}>
    <header><div><small>More / Tools</small><h1>Check Center</h1></div><div><b>{readiness.status}</b><button type="button" onClick={onRefresh}>重新檢查</button></div></header>
    <p className="mfp-check-warning">{MFP_A9_FORMAL_ROUTER_STATUS.status} · {MFP_A9_FORMAL_ROUTER_STATUS.code}</p>
    <div className="mfp-check-grid">
      <article><h2>IDENTITY</h2><dl>
        <div><dt>Source SHA</dt><dd>{MFP_BUILD_IDENTITY.sourceSha}</dd></div><div><dt>Build ID</dt><dd>{MFP_BUILD_IDENTITY.buildId}</dd></div>
        <div><dt>Target</dt><dd>{MFP_BUILD_IDENTITY.target}</dd></div><div><dt>Surface</dt><dd>{surface}</dd></div>
        <div><dt>releaseId</dt><dd>{runtime?.releaseId??'NOT EXPOSED'}</dd></div><div><dt>runtimeVersion</dt><dd>{runtime?.runtimeVersion??'NOT EXPOSED'}</dd></div>
        <div><dt>Channel</dt><dd>{runtime?.runtimeChannel??'NOT EXPOSED'}</dd></div><div><dt>Mode</dt><dd>{mode}</dd></div>
        <div><dt>Carrier</dt><dd>{field(carrier,'carrierVersionName')} ({field(carrier,'carrierVersionCode')})</dd></div><div><dt>Bridge</dt><dd>{field(carrier,'bridgeVersion')}</dd></div>
      </dl></article>
      <article className="mfp-check-bindings"><h2>BINDINGS</h2>{MFP_A9_BINDINGS.map(([name,code])=><div key={name}><span>{name}</span><Status ok={false} code={code}/></div>)}</article>
      <article><h2>STORE KERNEL</h2><Status ok={kernelOk} code={diagnostics.errors.storeKernel}/><dl>
        <div><dt>Health</dt><dd>{field(kernel,'status')}</dd></div><div><dt>DB</dt><dd>{field(kernel,'database')}</dd></div>
        <div><dt>Schema</dt><dd>{field(kernel,'schemaVersion')}</dd></div><div><dt>Journal</dt><dd>{field(kernel,'journalMode')}</dd></div>
        <div><dt>Synchronous</dt><dd>{field(kernel,'synchronous')}</dd></div><div><dt>Receipt readback</dt><dd>{kernelOk?'AVAILABLE':'BLOCKED'}</dd></div>
      </dl><small>The formal router is source-verified; Security, Pricing, Tender and domain handlers remain BLOCKED.</small></article>
      <article><h2>SYNC</h2><Status ok={false} code="MFP_SYNC_PRODUCTION_BINDING_MISSING"/><dl>
        <div><dt>HeadSeq</dt><dd>NOT EXPOSED</dd></div><div><dt>AppliedSeq</dt><dd>NOT EXPOSED</dd></div><div><dt>Checkpoint</dt><dd>NOT EXPOSED</dd></div>
        <div><dt>Doorbell</dt><dd>BLOCKED</dd></div><div><dt>Last apply</dt><dd>NOT EXPOSED</dd></div><div><dt>Polling</dt><dd>DISABLED</dd></div>
      </dl></article>
      <article><h2>PRINT</h2><Status ok={printOk} code={diagnostics.errors.print}/><dl>
        <div><dt>Gateway</dt><dd>{printOk?'SOURCE_VERIFIED':'BLOCKED'}</dd></div><div><dt>Queue</dt><dd>{field(print,'queueDepth')}</dd></div>
        <div><dt>Bindings</dt><dd>NOT EXPOSED</dd></div><div><dt>Last / ambiguous job</dt><dd>{nestedField(print,'lastJob','state')} · {nestedField(print,'lastJob','lastCode')}</dd></div>
      </dl><small>Carrier gateway evidence ≠ canonical PrintJob binding or physical paper proof.</small></article>
      <article><h2>RUNTIME / OTA</h2><Status ok={carrierOk} code={diagnostics.errors.carrier}/><dl>
        <div><dt>Current</dt><dd>{field(carrier,'currentReleaseId')}</dd></div><div><dt>Candidate</dt><dd>{field(carrier,'candidateReleaseId')}</dd></div>
        <div><dt>Previous</dt><dd>{field(carrier,'previousReleaseId')}</dd></div><div><dt>Selected</dt><dd>{field(carrier,'selectedReleaseId')}</dd></div>
        <div><dt>OTA configured</dt><dd>{field(carrier,'otaConfigured')}</dd></div><div><dt>Rollback available</dt><dd>{field(carrier,'previousReleaseId')==='NOT EXPOSED'?'BLOCKED':'SOURCE_VERIFIED'}</dd></div>
      </dl></article>
      <article><h2>EXTERNAL</h2><Status ok={false} code="MFP_EXTERNAL_PRODUCTION_BINDINGS_MISSING"/><dl>
        <div><dt>Customer</dt><dd>BLOCKED</dd></div><div><dt>Keeta</dt><dd>BLOCKED</dd></div><div><dt>Pending</dt><dd>NOT EXPOSED</dd></div><div><dt>Attention</dt><dd>NOT EXPOSED</dd></div>
      </dl></article>
      <article><h2>BACKUP / RESTORE</h2><Status ok={false} code={MFP_BACKUP_BOUNDARY.code}/><p>可匯出：{MFP_BACKUP_BOUNDARY.allowed.join('、')}</p><p>禁止：{MFP_BACKUP_BOUNDARY.forbidden.join('、')}</p></article>
      <article><h2>FAULT JOURNAL</h2><Status ok={Boolean(diagnostics.faults&&!diagnostics.errors.faults)} code={diagnostics.errors.faults}/>{recentFaults.length?<ul>{recentFaults.map((fault,index)=><li key={`${fault.code}-${index}`}><b>{fault.code}</b><span>{fault.source}</span><time>{fault.timestamp}</time></li>)}</ul>:<p>NOT EXPOSED</p>}</article>
    </div>
    <footer><span>Last checked: {diagnostics.checkedAt}</span><span>Public browser: no native print, drawer, Store Kernel writer, device impersonation or provider mutation.</span></footer>
  </section>;
}

export function MfpCheckCenter({surface}:{surface:MfpOrderingSurface}){
  const adapter=useMemo(()=>createMfpA9NativeAdapter(),[]);
  const [diagnostics,setDiagnostics]=useState<MfpA9NativeDiagnostics>(emptyDiagnostics);
  const refresh=useCallback(()=>{void collectMfpA9NativeDiagnostics(adapter).then(setDiagnostics);},[adapter]);
  useEffect(refresh,[refresh]);
  return <MfpCheckCenterView surface={surface} url={new URL(window.location.href)} diagnostics={diagnostics} onRefresh={refresh}/>;
}
