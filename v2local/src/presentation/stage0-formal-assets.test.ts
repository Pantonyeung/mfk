import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const asset=(name:string)=>path.join(root,'public','assets','smt','stage0',name);
const read=(name:string)=>fs.readFileSync(path.join(root,'src','presentation',name),'utf8');

describe('SMT Stage 0 formal asset landing',()=>{
  it('ships the required formal binary assets',()=>{
    for(const name of ['stage0-logo.jpg','stage0-ip-boy.png','stage0-bg-cafe-main.jpg']){
      expect(fs.existsSync(asset(name)),name).toBe(true);
      expect(fs.statSync(asset(name)).size,name).toBeGreaterThan(0);
    }
  });
  it('renders formal logo and IP from both Stage 0 gates',()=>{
    for(const source of [read('StaffAuthGate.tsx'),read('CashOpeningGate.tsx')]){
      expect(source).toContain('/assets/smt/stage0/stage0-logo.jpg');
      expect(source).toContain('/assets/smt/stage0/stage0-ip-boy.png');
      expect(source).toContain("classList.add('asset-failed')");
      expect(source).not.toContain('className="s0-mascot"');
    }
  });
});
