import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('public SMT deployment identity',()=>{
  it('publishes an unauthenticated, no-store build identity backed by deploy metadata',()=>{
    const worker=readFileSync(new URL('../../web-acceptance-worker.ts',import.meta.url),'utf8');
    const config=readFileSync(new URL('../../wrangler.web-acceptance.jsonc',import.meta.url),'utf8');
    const manifest=readFileSync(new URL('../../package.json',import.meta.url),'utf8');
    const endpoint=worker.indexOf("url.pathname==='/__mfk/build'");
    const gate=worker.indexOf('if(!await authorized(request,env))');
    expect(endpoint).toBeGreaterThan(0);
    expect(endpoint).toBeLessThan(gate);
    expect(worker).toContain("product:'MFK'");
    expect(worker).toContain("surface:'SMT'");
    expect(worker).toContain("mode:expected?'WEB_ACCEPTANCE':'PUBLIC_SMT_SHELL'");
    expect(worker).toContain("if(!token)return true");
    expect(worker).toContain("code:'PUBLIC_SMT_STAFF_AUTH_REQUIRED'");
    expect(worker).toContain("businessMutationAuth:expected?'PREVIEW_GATE_ONLY':'FORMAL_STAFF_AUTH_REQUIRED'");
    expect(worker).toContain("'cache-control':'no-store'");
    expect(config).not.toContain('"WEB_ACCEPTANCE_TOKEN"');
    expect(config).toContain('"binding": "MFK_VERSION"');
    expect(config).toContain('"MFK_BUILD_ID"');
    expect(manifest).toContain('MFK_SOURCE_SHA:$(git rev-parse HEAD)');
  });
});
