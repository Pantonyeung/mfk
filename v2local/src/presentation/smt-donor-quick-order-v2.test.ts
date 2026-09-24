import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const model=fs.readFileSync(path.join(root,'features/ordering/fast-lane-model.ts'),'utf8');

describe('SMT donor Quick Mode + Quick Drink',()=>{
  it('restores Normal / Quick mode without bypassing optional force-show truth',()=>{
    expect(workspace).toContain("orderingMode==='quick'&&product.quickAddAllowed");
    expect(app).toContain("quickAddAllowed:!product.optionSets.some(set=>set.forceShow&&!set.required&&set.min===0)");
    expect(app).toContain("<small>{orderingMode==='quick'?'快捷':'普通'}</small>");
    expect(app).toContain('clean-order-tools');
  });

  it('Quick Mode preserves current Admin default option selections and lets Required flow remain explicit',()=>{
    expect(app).toContain('defaultSelectionsForProduct(fastProduct)');
    expect(app).toContain('rebuildConfiguredLine(base,fastProduct');
    expect(app).toContain('requiredTasks(cart,fastLaneProducts)');
    expect(app).toContain('fastLaneBlockers===0');
  });

  it('derives Quick Drink from Admin Combo DRINK slots instead of name heuristics',()=>{
    expect(app).toContain("filter(group=>group.role==='DRINK')");
    expect(app).toContain("row.groupId===group.groupId&&row.role==='DRINK'");
    expect(app).toContain('quickDrinkChoices');
    expect(app).toContain('<span>飲</span><small>飲品</small>');
    expect(model).toContain("pool.addonKind==='DRINK'?'DRINK':'SNACK'");
  });

  it('keeps configured drink child identity reversible and routes multi-target choice to the Combo Fast Lane',()=>{
    expect(app).toContain('fillPendingComboGroupFromConfiguredProduct');
    expect(app).toContain("setPanel({type:'quick-drink-config'");
    expect(app).toContain("setPanel({type:'fast-lane',lane:'combo'})");
    expect(workspace).toContain('指定餐點');
    expect(model).toContain('configurationAdjustmentMinor');
    expect(model).toContain('dissolveComboLine');
  });

  it('does not add any runtime import or a second quick pricing authority',()=>{
    expect(app).toContain("projectSyncedCombos(adminConfig)");
    expect(app).toContain("projectSyncedOrderingCatalog(serviceMode,adminConfig)");
    expect(app).not.toContain("includes('tea')");
    expect(app).not.toContain("includes('drink')");
  });
});
