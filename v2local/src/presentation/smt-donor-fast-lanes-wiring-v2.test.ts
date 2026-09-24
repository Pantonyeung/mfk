import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const fast=fs.readFileSync(path.join(root,'features/ordering/FastLaneWorkspaces.tsx'),'utf8');

describe('SMT donor fast lane wiring',()=>{
  it('routes all three fixed Fast Lanes to real task workspaces',()=>{
    expect(app).toContain("onOpenWorkItem:id=>{setPanelDirty(false);setPanel({type:'fast-lane',lane:id});}");
    expect(app).toContain('RiceballPoolWorkspace');
    expect(app).toContain('RequiredFastLaneWorkspace');
    expect(app).toContain('ComboFastLaneWorkspace');
  });

  it('uses Admin projected truth and blocks checkout only for unresolved required work',()=>{
    expect(app).toContain('requiredTasks(cart,fastLaneProducts)');
    expect(app).toContain('comboBlockingCount(cart)');
    expect(app).toContain('fastLaneBlockers===0');
    expect(fast).toContain('ADMIN REQUIRED TRUTH');
    expect(fast).toContain('RICEBALL MEAL');
  });

  it('keeps auto assignment, specified A/B/C pairing, deferred drink and reversible dissolve visible',()=>{
    expect(fast).toContain('建立 {plans.length} 組飯團餐');
    expect(fast).toContain('指定配對');
    expect(fast).toContain('A／B／C…');
    expect(fast).toContain('飲品稍後補');
    expect(fast).toContain('拆開套餐');
  });

  it('does not route Fast Lanes through the old generic OrganizeWorkspace',()=>{
    expect(app).not.toContain("onOpenWorkItem:id=>{if(id==='combo')setPanel({type:'combo'});else setPanel({type:'organize'});}");
  });
});
