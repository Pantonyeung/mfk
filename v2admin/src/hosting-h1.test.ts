import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('MFK Admin Cloudflare H2 + config sync runtime',()=>{
  const source=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');

  it('targets mfk-admin, serves SPA assets, and exposes only the dedicated Admin sync Durable Object',()=>{
    expect(source).toContain('"name": "mfk-admin"');
    expect(source).toContain('"main": "./worker.ts"');
    expect(source).toContain('"directory": "./dist"');
    expect(source).toContain('"binding": "ASSETS"');
    expect(source).toContain('"not_found_handling": "single-page-application"');
    expect(source).toContain('"durable_objects"');
    expect(source).toContain('"name": "ADMIN_SYNC"');
    expect(source).toContain('"class_name": "AdminSyncStore"');
  });

  it('allows SMT appassets to fetch/ACK config while Publish remains Admin-origin-only',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    expect(worker).toContain("const SMT_ORIGIN='https://appassets.androidplatform.net'");
    expect(worker).toContain('CORS_ORIGINS=new Set([ADMIN_ORIGIN,SMT_ORIGIN])');
    expect(worker).toContain("if(origin!==ADMIN_ORIGIN)return false");
    expect(worker).toContain("if(site&&site!=='same-origin')return false");
  });

  it('does not inherit legacy/provider/transaction runtime bindings or background triggers',()=>{
    for(const forbidden of [
      '"d1_databases"',
      '"r2_buckets"',
      '"services"',
      '"triggers"',
      'KEETA_CHANNEL_GATEWAY',
      'PRICING_REALTIME',
      'morefun-v2-production',
      'morefun-v2-product-media',
    ]) expect(source).not.toContain(forbidden);
  });
});
