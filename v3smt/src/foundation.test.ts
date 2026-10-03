import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');

describe('V3 SMT A0 foundation',()=>{
  it('locks one Store Kernel formal transaction authority',()=>{
    const port=read('./store-kernel-port.ts');
    const state=read('./state-authority.ts');
    expect(port).toContain("STORE_KERNEL_AUTHORITY='FORMAL_TRANSACTION_AUTHORITY'");
    expect(state).toContain("formalTransaction:'STORE_KERNEL'");
  });

  it('forbids periodic business polling in the fresh client',()=>{
    for(const file of ['./App.tsx','./main.tsx','./state-authority.ts']){
      const source=read(file);
      expect(source).not.toMatch(/setInterval\s*\(/);
    }
    const state=read('./state-authority.ts');
    expect(state).toContain('refetchInterval:false');
    expect(state).not.toMatch(/refetchInterval:\s*(?:true|[1-9]\d*)/);
  });

  it('does not import v2 client state or runtime modules',()=>{
    for(const file of ['./App.tsx','./main.tsx','./state-authority.ts','./store-kernel-port.ts']){
      const source=read(file);
      expect(source).not.toContain('v2local');
      expect(source).not.toContain('../v2');
      expect(source).not.toContain('../../v2');
    }
  });

  it('supports responsive Desktop and Handheld surfaces from one shell',()=>{
    const app=read('./App.tsx');
    expect(app).toContain("'DESKTOP'");
    expect(app).toContain("'HANDHELD'");
    expect(app).toContain("matchMedia('(max-width: 767px)')");
  });
});
