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

  it('prunes stale persisted outbox rows before startup auto-flush can replay them',()=>{
    const sync=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
    expect(sync).toContain('writeOutbox(readOutbox().filter(row=>{');
    expect(sync).toContain('rowPublishedAt>activePublishedAt');
    expect(sync).toContain('if(row.fingerprint===active.fingerprint)return false');
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
