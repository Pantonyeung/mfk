import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');

describe('SMT request-storm containment',()=>{
  it('keeps Customer and Keeta event-driven with canonical config dedupe',()=>{
    const customer=read('./customer-cloud-intake.ts');
    const keeta=read('./keeta-order-intake.ts');
    for(const source of [customer,keeta]){
      expect(source).toContain('subscribeSmtCloudDoorbell');
      expect(source).toContain("window.addEventListener('online',reconcile)");
      expect(source).toContain('lastObservedConfigFingerprint');
      expect(source).toContain('fingerprint===lastObservedConfigFingerprint');
      expect(source).not.toMatch(/setInterval\s*\(/);
      expect(source).not.toContain("window.addEventListener('focus'");
      expect(source).not.toContain('visibilitychange');
    }
  });

  it('does not let focus/config UI events flush business outbox or provider consumers',()=>{
    const lifecycle=read('./keeta-order-lifecycle.ts');
    const afterSale=read('./keeta-after-sale.ts');
    const refund=read('./admin-refund-intake.ts');
    const outbox=read('./projection-outbox.ts');
    for(const source of [lifecycle,afterSale,refund,outbox]){
      expect(source).not.toContain("window.addEventListener('focus'");
    }
    expect(outbox).not.toContain('subscribeSmtAdminConfig');
    expect(outbox).toContain("window.addEventListener('online',flush)");
  });

  it('does not run legacy SMM acceptance polling on the public SMT shell',()=>{
    const main=read('../main.tsx');
    expect(main).toContain('if(!webAcceptance)installSmtAdminAutoSync()');
    expect(main).not.toContain('installSmmWebAcceptanceIntake');
  });
});
