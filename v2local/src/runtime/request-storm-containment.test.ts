import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');

describe('SMT request-storm containment',()=>{
  it('uses Doorbell/lifecycle-driven intake with zero periodic fallback polling',()=>{
    const customer=read('./customer-cloud-intake.ts');
    const keeta=read('./keeta-order-intake.ts');
    for(const source of [customer,keeta]){
      expect(source).toContain('subscribeSmtCloudDoorbell');
      expect(source).toContain("window.addEventListener('online',reconcile)");
      expect(source).toContain("window.addEventListener('focus',reconcile)");
      expect(source).not.toMatch(/setInterval\s*\(/);
    }
  });

  it('does not run legacy SMM acceptance polling on the public SMT shell',()=>{
    const main=read('../main.tsx');
    expect(main).toContain('if(!webAcceptance)installSmtAdminAutoSync()');
    expect(main).not.toContain('installSmmWebAcceptanceIntake');
  });
});
