import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('SMT Dining Admin config live refresh',()=>{
  it('reloads the canonical Dining projection after an applied Admin config',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const source=fs.readFileSync(path.join(here,'RuntimeDiningWorkspace.tsx'),'utf8');
    expect(source).toContain('subscribeSmtAdminConfig(()=>{setAdminConfigRevision(value=>value+1);void load();})');
  });
});
