import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {V3_ADMIN_STATE_AUTHORITY} from './state-authority.ts';

describe('MFK Admin V3 authority',()=>{
  it('locks third-party state ownership',()=>{
    expect(V3_ADMIN_STATE_AUTHORITY.server).toBe('TANSTACK_QUERY');
    expect(V3_ADMIN_STATE_AUTHORITY.outbox).toContain('CONDITIONAL_DEXIE_ONLY');
    expect(V3_ADMIN_STATE_AUTHORITY.authPersistence).toBe('MEMORY_ONLY');
    expect(V3_ADMIN_STATE_AUTHORITY.canonicalValidation).toBe('SHARED_ADMIN_CONFIG_CONTRACT');
    expect(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted).toBe(false);
    expect(V3_ADMIN_STATE_AUTHORITY.v2StateModulesImported).toBe(false);
    expect(V3_ADMIN_STATE_AUTHORITY.v2LocalStorageRead).toBe(false);
  });

  it('does not import v2 client-state modules or v2 browser storage truth',()=>{
    for(const path of ['App.tsx','main.tsx','state-authority.ts','api.ts','auth.ts','canonical.ts','release.ts','scope.ts']){
      const source=readFileSync(new URL('./'+path,import.meta.url),'utf8');
      expect(source).not.toContain('../v2admin');
      expect(source).not.toContain('admin-local-store');
      expect(source).not.toContain('admin-sync-client');
      expect(source).not.toContain('canonical-hydrated.v1');
      expect(source).not.toContain('sync-status.v1');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
  });

  it('forces Cloudflare Pages client assets to bypass persistent browser cache',()=>{
    const headers=readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
    expect(headers).toContain('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    expect(headers).toContain('Pragma: no-cache');
  });

  it('revalidates formal read models periodically and on canonical server doorbells',()=>{
    const source=readFileSync(new URL('./formal-read-model.tsx',import.meta.url),'utf8');
    expect(source.match(/refetchInterval:V3_DATA_REFETCH_INTERVAL_MS/g)?.length).toBeGreaterThanOrEqual(6);
    expect(source).toContain("message.type==='ADMIN_CONFIG_AVAILABLE'");
    expect(source).toContain('v3AdminCanonicalQueryKey(storeId)');
    expect(source).toContain('v3FormalDraftQueryKey(storeId)');
  });

  it('keeps V3 unrouted from production',()=>{
    const pkg=readFileSync(new URL('../package.json',import.meta.url),'utf8');
    expect(pkg).not.toContain('wrangler');
    expect(pkg).not.toContain('"deploy"');
  });
});
