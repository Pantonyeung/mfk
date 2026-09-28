import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const read=(name:string)=>fs.readFileSync(path.join(root,'src','presentation',name),'utf8');

describe('SMT Stage 0 bounded-main asset contract',()=>{
  it('excludes known bad/reference assets from Stage 0 runtime gates',()=>{
    for(const source of [read('StaffAuthGate.tsx'),read('CashOpeningGate.tsx')]){
      expect(source).not.toContain('stage0-approved-login-reference.jpeg');
      expect(source).not.toContain('stage0-logo.jpg');
      expect(source).not.toContain('stage0-bg-cafe-main.jpg');
      expect(source).toContain('s0-brand-slot');
      expect(source).toContain('s0-ip-slot');
    }
  });
});
