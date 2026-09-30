import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('MFK web canonical baseline',()=>{
  it('uses one passive canonical doorbell instead of polling web surfaces',()=>{
    const shared=read('../../contracts/mfk-canonical-doorbell-v1.ts');
    const customer=read('../../v2customer/src/App.tsx');
    const owner=read('../../v2owner/src/App.tsx');
    const smm=read('../../v2smm/src/App.tsx');

    expect(shared).toContain('MFK_CANONICAL_DOORBELL_URL');
    expect(shared).not.toMatch(/setInterval\s*\(/);
    for(const source of [customer,owner,smm]){
      expect(source).toContain('installMfkCanonicalDoorbell');
    }
    expect(customer).not.toMatch(/setInterval\s*\(/);
    expect(owner).not.toMatch(/setInterval\s*\(/);
    expect(smm).not.toContain("window.addEventListener('pageshow'");
    expect(smm).not.toContain("document.addEventListener('visibilitychange'");
  });

  it('revalidates web shells and never hardcodes an old Customer build SHA',()=>{
    const customerWorker=read('../../v2customer/worker.ts');
    const ownerWorker=read('../../v2owner/worker.ts');
    const smmWorker=read('../../v2smm/worker.ts');
    for(const source of [customerWorker,ownerWorker,smmWorker]){
      expect(source).toContain('no-cache, must-revalidate, max-age=0');
      expect(source).toContain('/assets/');
      expect(source).toContain('/__mfk/build');
    }
    expect(customerWorker).not.toContain('af43260e4b7366c0c7671c1cc2793b8712a4bc3e');
  });

  it('keeps SMM offline fallback but forces online network revalidation',()=>{
    const sw=read('../../v2smm/public/sw.js');
    expect(sw).toContain("cache:'no-store'");
    expect(sw).toContain('caches.match');
  });

  it('publishes the real SMT bundle as a public mirror, not the old acceptance harness',()=>{
    const main=read('../../v2local/src/main.tsx');
    const worker=read('../../v2local/public-mirror-worker.ts');
    const config=read('../../v2local/wrangler.public-mirror.jsonc');
    expect(main).toContain('isSmtPublicMirror');
    expect(main).not.toContain('installSmmWebAcceptanceIntake');
    expect(worker).toContain("mode:'PUBLIC_MIRROR'");
    expect(worker).not.toContain('WEB_ACCEPTANCE_TOKEN');
    expect(config).toContain('"mfk-smt-web"');
  });

  it('does not use Rxx equality to suppress a queued Admin formal publish',()=>{
    const sync=read('./admin-sync-client.ts');
    expect(sync).toContain("status.adminFingerprint===latest.fingerprint");
    expect(sync).not.toContain("status.revision===latest.version");
    expect(sync).toContain('refreshAdminBrowserSession');
  });
});
