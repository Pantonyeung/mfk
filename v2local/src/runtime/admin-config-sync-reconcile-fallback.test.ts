import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('SMT Admin sync reconciliation fallback',()=>{
  it('reconciles periodically while the doorbell is open and stops with it',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const source=fs.readFileSync(path.join(here,'admin-config-sync.ts'),'utf8');
    expect(source).toContain('window.setInterval(()=>void fetchAndApplyAdminConfig(),15000)');
    expect(source.match(/window\.clearInterval\(doorbellReconcileTimer\)/g)).toHaveLength(3);
  });
});
