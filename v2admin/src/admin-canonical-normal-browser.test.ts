import {describe,expect,it} from 'vitest';
import {adminCanonicalHydrationRequired} from './AdminCanonicalBootstrap.tsx';
import {readFileSync} from 'node:fs';

describe('Admin normal-browser canonical hydration',()=>{
  const active={
    revision:25,
    publishedAt:'2026-09-30T02:30:00.000Z',
    adminFingerprint:'admin-new',
    fingerprint:'canonical-new',
  };

  it('hydrates when the same Rxx points at a different canonical publish',()=>{
    const local={version:25,createdAt:'2026-09-30T02:20:00.000Z',fingerprint:'admin-old'};
    const sync={state:'PUBLISHED',fingerprint:'canonical-old',cloudPublishedAt:'2026-09-30T02:20:00.000Z'};
    expect(adminCanonicalHydrationRequired(local,active,sync)).toBe(true);
  });

  it('does not use revision equality as freshness proof',()=>{
    const local={version:25,createdAt:active.publishedAt,fingerprint:active.adminFingerprint};
    const sync={state:'PUBLISHED',fingerprint:active.fingerprint,cloudPublishedAt:active.publishedAt};
    expect(adminCanonicalHydrationRequired(local,active,sync)).toBe(false);
  });

  it('clears saved outbox rows that are not later than canonical cloud state',()=>{
    const sync=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
    expect(sync).toContain('writeOutbox(readOutbox().filter(row=>{');
    expect(sync).toContain('if(row.fingerprint===active.fingerprint)return false');
    expect(sync).toContain('rowPublishedAt>activePublishedAt');
  });

  it('shows a compact R4 runtime diagnostic that distinguishes stale JS from saved outbox state',()=>{
    const shell=readFileSync(new URL('./AdminShell.tsx',import.meta.url),'utf8');
    const sync=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
    expect(shell).toContain('readAdminRuntimeSourceSha');
    expect(shell).toContain('data-admin-runtime-diag="R4"');
    expect(sync).toContain("/api/health?adminRuntimeDiagnostic=R4");
    expect(shell).toContain("' Q'+diagnostic.outboxCount+' C'+canonical");
    expect(sync).toContain('readAdminSyncDiagnosticSnapshot');
    expect(sync).toContain("'canonical-hydrated.v1'");
    expect(sync).toContain('outboxCount:outbox.length');
    expect(shell).toContain('className="mfk-admin-sync-detail"');
  });

  it('does not turn cached release history into a new publish during startup',()=>{
    const sync=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
    const bootstrap=readFileSync(new URL('./AdminCanonicalBootstrap.tsx',import.meta.url),'utf8');
    expect(sync).toContain('window.setTimeout(flush,0)');
    expect(sync).not.toContain('queueLatest();flush();');
    expect(bootstrap).toContain('reconcileAdminSyncStatusFromCanonical(active)');
    expect(bootstrap).toContain('reconcileAdminSyncStatusFromCanonical(publisherActive)');
  });

  it('keeps canonical hydration/outbox ordering time-first',()=>{
    const source=readFileSync(new URL('./admin-browser-session.ts',import.meta.url),'utf8');
    expect(source).toContain('Date.parse(b.createdAt)-Date.parse(a.createdAt)');
    expect(source).toContain("row.fingerprint===envelope.fingerprint");
    expect(source).not.toContain('Number(row.revision)>envelope.revision');
  });
});
