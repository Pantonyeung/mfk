import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('MFK Admin Cloudflare H2 hosting config',()=>{
  const source=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');

  it('targets the existing Cloudflare Worker and serves only SPA assets',()=>{
    expect(source).toContain('"name": "mfk-admin"');
    expect(source).toContain('"directory": "./dist"');
    expect(source).toContain('"not_found_handling": "single-page-application"');
  });

  it('does not inherit legacy runtime bindings or background execution',()=>{
    for(const forbidden of [
      '"d1_databases"',
      '"r2_buckets"',
      '"durable_objects"',
      '"services"',
      '"triggers"',
      '"main"',
      'KEETA_CHANNEL_GATEWAY',
      'PRICING_REALTIME',
      'morefun-v2-production',
      'morefun-v2-product-media',
    ]) expect(source).not.toContain(forbidden);
  });
});
