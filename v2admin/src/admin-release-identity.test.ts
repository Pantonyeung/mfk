import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const worker=fs.readFileSync(path.resolve(process.cwd(),'worker.ts'),'utf8');

describe('Admin production source identity',()=>{
  it('exposes deploy-time source SHA through health without secrets',()=>{
    expect(worker).toContain("url.pathname==='/api/health'");
    expect(worker).toContain("sourceSha:String(env.MFK_SOURCE_SHA||'UNKNOWN')");
    expect(worker).not.toMatch(/api\/health[^\n]*(KEETA_APP_SECRET|KEETA_TOKEN_ENCRYPTION_KEY)/);
  });
});
