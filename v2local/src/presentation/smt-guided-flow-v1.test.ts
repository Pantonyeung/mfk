import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deriveOrderingGuidance} from '../features/ordering/ordering-workspace-model.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'..');
const appSource=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const workspaceSource=fs.readFileSync(path.join(src,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const fastLaneSource=fs.readFileSync(path.join(src,'features/ordering/FastLaneWorkspaces.tsx'),'utf8');

describe('SMT silent guided flow',()=>{
  it('prioritizes unresolved work before checkout without inventing step labels',()=>{
    expect(deriveOrderingGuidance({
      cartItemCount:2,requiredCount:1,pendingDrinkCount:1,comboBlockingCount:1,autoPairCount:1,checkoutEnabled:false,
    })).toBe('required');
    expect(deriveOrderingGuidance({
      cartItemCount:2,requiredCount:0,pendingDrinkCount:1,comboBlockingCount:1,autoPairCount:1,checkoutEnabled:false,
    })).toBe('quick-drink');
    expect(deriveOrderingGuidance({
      cartItemCount:2,requiredCount:0,pendingDrinkCount:0,comboBlockingCount:1,autoPairCount:1,checkoutEnabled:false,
    })).toBe('combo');
    expect(deriveOrderingGuidance({
      cartItemCount:2,requiredCount:0,pendingDrinkCount:0,comboBlockingCount:0,autoPairCount:1,checkoutEnabled:false,
    })).toBe('riceball-pool');
    expect(deriveOrderingGuidance({
      cartItemCount:2,requiredCount:0,pendingDrinkCount:0,comboBlockingCount:0,autoPairCount:0,checkoutEnabled:true,
    })).toBe('checkout');
    expect(deriveOrderingGuidance({
      cartItemCount:0,requiredCount:0,pendingDrinkCount:0,comboBlockingCount:0,autoPairCount:0,checkoutEnabled:false,
    })).toBe('product');
  });

  it('moves structured actions forward automatically while leaving final checkout deliberate',()=>{
    expect(appSource).toContain('guideAfterStructuredChange(next)');
    expect(appSource).toContain("setPanel({type:'fast-lane',lane:'required'})");
    expect(appSource).toContain("setPanel({type:'fast-lane',lane:'riceball-pool'})");
    expect(appSource).toContain('setQuickDrinkOpen(true)');
    expect(appSource).not.toContain("if(guidanceTarget==='checkout')navigate('/checkout')");
  });

  it('uses visual focus instead of explicit previous/next-step instructional copy',()=>{
    expect(workspaceSource).toContain("guidanceTarget==='quick-drink'?' flow-next':''");
    expect(workspaceSource).toContain("guidanceTarget==='checkout'?' flow-next':''");
    expect(workspaceSource).toContain("isGuided?' flow-next':''");
    expect(fastLaneSource).toContain("index===0?' flow-current':''");
    expect(fastLaneSource).toContain("slot.groupId===firstUnresolvedRequired?' flow-current':''");
    expect(workspaceSource).not.toContain('下一步做乜');
    expect(workspaceSource).not.toContain('上一步');
  });

  it('opens Required automatically only when Quick Mode actually creates unresolved required work',()=>{
    expect(appSource).toContain("if(orderingMode==='quick'&&requiredTasks(next,fastLaneProducts).length)");
  });
});
