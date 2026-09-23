import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('MFK Admin Cloudflare H2 + config sync runtime',()=>{
  const source=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');

  it('targets mfk-admin, serves SPA assets, and exposes dedicated Admin + Keeta + Customer runtime Durable Objects',()=>{
    expect(source).toContain('"name": "mfk-admin"');
    expect(source).toContain('"main": "./worker.ts"');
    expect(source).toContain('"directory": "./dist"');
    expect(source).toContain('"binding": "ASSETS"');
    expect(source).toContain('"not_found_handling": "single-page-application"');
    expect(source).toContain('"durable_objects"');
    expect(source).toContain('"name": "ADMIN_SYNC"');
    expect(source).toContain('"class_name": "AdminSyncStore"');
    expect(source).toContain('"name": "KEETA_RUNTIME"');
    expect(source).toContain('"class_name": "KeetaRuntimeStore"');
    expect(source).toContain('"tag": "keeta-runtime-v1"');
    expect(source).toContain('"name": "CUSTOMER_RUNTIME"');
    expect(source).toContain('"class_name": "CustomerRuntimeStore"');
    expect(source).toContain('"tag": "customer-runtime-v1"');
  });

  it('allows SMT appassets plus the public Customer origin while Publish remains Admin-origin-only',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    expect(worker).toContain("const SMT_ORIGIN='https://appassets.androidplatform.net'");
    expect(worker).toContain("const CUSTOMER_ORIGIN='https://order.morefunos.com'");
    expect(worker).toContain('CORS_ORIGINS=new Set([ADMIN_ORIGIN,SMT_ORIGIN,CUSTOMER_ORIGIN])');
    expect(worker).toContain("if(origin!==ADMIN_ORIGIN)return false");
    expect(worker).toContain("if(site&&site!=='same-origin')return false");
  });

  it('exposes projection-only SMT event ingress and Admin read endpoints on the same store-scoped Durable Object',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    for(const marker of [
      "/api/projection/",
      "/projection/events",
      "/projection/orders",
      "/projection/reports",
      "SMT_PROJECTION_AVAILABLE",
      "authorizeProjectionWrite",
      "authorizeAdminRead",
    ])expect(worker).toContain(marker);
    expect(worker).toContain("acks[event.deviceId]");
  });

  it('routes Keeta live edge through the dedicated runtime and keeps Admin controls authenticated',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    const keeta=readFileSync(new URL('../keeta-runtime.ts',import.meta.url),'utf8');
    for(const marker of [
      "/api/keeta/admin/",
      "/api/keeta/webhook",
      "/api/keeta/oauth/callback",
      "KEETA_RUNTIME",
      "/authorize-admin",
    ])expect(worker).toContain(marker);
    expect(keeta).toContain("KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH");
    expect(keeta).toContain("automaticOrderMutation:false");
    expect(keeta).toContain("providerCommandActivation:false");
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
