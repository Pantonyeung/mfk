import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {V3_ADMIN_STATE_AUTHORITY} from './state-authority.ts';

describe('MFK Admin V3 A0 authority',()=>{
  it('locks third-party state ownership',()=>{
    expect(V3_ADMIN_STATE_AUTHORITY.server).toBe('TANSTACK_QUERY');
    expect(V3_ADMIN_STATE_AUTHORITY.outbox).toBe('DEXIE_INDEXEDDB');
    expect(V3_ADMIN_STATE_AUTHORITY.authPersistence).toBe('MEMORY_ONLY');
    expect(V3_ADMIN_STATE_AUTHORITY.canonicalValidation).toBe('SHARED_ADMIN_CONFIG_CONTRACT');
    expect(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted).toBe(false);
    expect(V3_ADMIN_STATE_AUTHORITY.v2StateModulesImported).toBe(false);
  });

  it('does not import v2 client-state modules',()=>{
    for(const path of ['App.tsx','main.tsx','state-authority.ts','api.ts','auth.ts','canonical.ts']){
      const source=readFileSync(new URL('./'+path,import.meta.url),'utf8');
      expect(source).not.toContain('../v2admin');
      expect(source).not.toContain('admin-local-store');
      expect(source).not.toContain('admin-sync-client');
      expect(source).not.toContain('canonical-hydrated.v1');
      expect(source).not.toContain('sync-status.v1');
    }
  });

  it('keeps A0 unrouted from production',()=>{
    const pkg=readFileSync(new URL('../package.json',import.meta.url),'utf8');
    expect(pkg).not.toContain('wrangler');
    expect(pkg).not.toContain('deploy');
  });
});
