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

  it('keeps canonical hydration/outbox ordering time-first',()=>{
    const source=readFileSync(new URL('./admin-browser-session.ts',import.meta.url),'utf8');
    expect(source).toContain('Date.parse(b.createdAt)-Date.parse(a.createdAt)');
    expect(source).toContain("row.fingerprint===envelope.fingerprint");
    expect(source).not.toContain('Number(row.revision)>envelope.revision');
  });

  it('does not invent a publish queue from local release history during bootstrap',()=>{
    const source=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
    const installer=source.slice(source.indexOf('export function installAdminSyncAutoFlush'),source.indexOf('export interface AdminDiningOccupancyReadback'));
    expect(installer).toContain("window.addEventListener('mfk-admin-release',queueExplicitRelease)");
    expect(installer).toContain('window.setTimeout(flush,0)');
    expect(installer).not.toContain('window.setTimeout(()=>{queueLatest();flush();},0)');
    expect(installer).not.toContain("window.addEventListener('focus',flush)");
  });
});
