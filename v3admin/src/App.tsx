import {useQuery} from '@tanstack/react-query';
import {readV3BackendHealth,v3QueryKeys} from './api.ts';
import {V3_ADMIN_STATE_AUTHORITY,useV3AdminUi} from './state-authority.ts';

export function V3AdminApp(){
  const {panel,setPanel}=useV3AdminUi();
  const health=useQuery({
    queryKey:v3QueryKeys.health,
    queryFn:readV3BackendHealth,
  });

  return <main className="v3-shell">
    <header className="v3-head">
      <div>
        <small>PARALLEL PREVIEW · NO PRODUCTION ROUTING</small>
        <h1>MFK Admin V3</h1>
        <p>新 Web client 平行重生。現有 v2 Production 不受此版本影響。</p>
      </div>
      <nav aria-label="V3 preview">
        <button type="button" data-active={panel==='OVERVIEW'} onClick={()=>setPanel('OVERVIEW')}>狀態</button>
        <button type="button" data-active={panel==='AUTHORITY'} onClick={()=>setPanel('AUTHORITY')}>主權</button>
      </nav>
    </header>

    {panel==='OVERVIEW'?<section className="v3-grid">
      <article>
        <span>Backend</span>
        <strong>{health.isPending?'檢查中':health.isError?'未連接':'已連接'}</strong>
        <small>{health.data?health.data.service+' · '+health.data.sourceSha.slice(0,12):health.error instanceof Error?health.error.message:'TanStack Query health probe'}</small>
      </article>
      <article>
        <span>Server State</span>
        <strong>TanStack Query</strong>
        <small>不持久化 server-derived truth</small>
      </article>
      <article>
        <span>Durable Outbox</span>
        <strong>Dexie / IndexedDB</strong>
        <small>A0 只建立 schema，未啟用任何 command</small>
      </article>
      <article>
        <span>Local UI</span>
        <strong>Zustand</strong>
        <small>只保存 UI / draft 類狀態；A0 不持久化</small>
      </article>
    </section>:<section className="v3-authority">
      <h2>V3 State Authority</h2>
      <dl>
        <div><dt>Cloud / Server</dt><dd>{V3_ADMIN_STATE_AUTHORITY.server}</dd></div>
        <div><dt>Outbox</dt><dd>{V3_ADMIN_STATE_AUTHORITY.outbox}</dd></div>
        <div><dt>Draft / UI</dt><dd>{V3_ADMIN_STATE_AUTHORITY.localDraft}</dd></div>
        <div><dt>Persist derived status</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted)}</dd></div>
        <div><dt>Import v2 state modules</dt><dd>{String(V3_ADMIN_STATE_AUTHORITY.v2StateModulesImported)}</dd></div>
      </dl>
    </section>}
  </main>;
}
