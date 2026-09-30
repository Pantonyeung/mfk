import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('public SMT deployment identity',()=>{
  it('publishes the exact production SMT bundle as a public mirror without an acceptance gate',()=>{
    const worker=readFileSync(new URL('../../public-mirror-worker.ts',import.meta.url),'utf8');
    const config=readFileSync(new URL('../../wrangler.public-mirror.jsonc',import.meta.url),'utf8');
    const manifest=readFileSync(new URL('../../package.json',import.meta.url),'utf8');
    expect(worker).toContain("url.pathname==='/__mfk/build'");
    expect(worker).toContain("mode:'PUBLIC_MIRROR'");
    expect(worker).toContain("surface:'SMT'");
    expect(worker).toContain("'cache-control':'no-store'");
    expect(worker).not.toContain('WEB_ACCEPTANCE_TOKEN');
    expect(config).toContain('"binding": "MFK_VERSION"');
    expect(config).toContain('"MFK_BUILD_ID"');
    expect(manifest).toContain('MFK_SOURCE_SHA:$(git rev-parse HEAD)');
  });
});
