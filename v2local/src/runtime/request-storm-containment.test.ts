import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');

describe('SMT request-storm containment',()=>{
  it('uses Doorbell-first intake and only a disconnected 30s safety fallback',()=>{
    const customer=read('./customer-cloud-intake.ts');
    const keeta=read('./keeta-order-intake.ts');
    for(const source of [customer,keeta]){
      expect(source).toContain('!isSmtCloudDoorbellConnected()');
      expect(source).toContain('30000');
      expect(source).not.toContain('},5000);');
    }
  });

  it('does not run legacy SMM acceptance polling on the public SMT shell',()=>{
    const main=read('../main.tsx');
    expect(main).toContain('if(!webAcceptance)installSmtAdminAutoSync()');
    expect(main).not.toContain('installSmmWebAcceptanceIntake');
  });
});
