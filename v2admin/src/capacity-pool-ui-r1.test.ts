import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'ReadModelWorkspaces.tsx'),'utf8');

describe('CAP0 Admin capacity-pool authoring surface',()=>{
  it('keeps legacy daily capacity while exposing canonical pool fields',()=>{
    expect(source).toContain("usePersistentAdminState<CapacityConfig>('capacity.v1'");
    expect(source).toContain('新增產能 Pool');
    expect(source).toContain('初始數量');
    expect(source).toContain('自家平台停售門檻');
    expect(source).toContain('第三方平台停售門檻');
    expect(source).toContain('綁定商品');
  });

  it('binds pools to current Admin products and fails closed before activation',()=>{
    expect(source).toContain('draft.products');
    expect(source).toContain('capacityPoolCanActivate');
    expect(source).toContain('pool.productIds.includes(product.id)');
    expect(source).toContain('disabled={!capacityPoolCanActivate(pool)}');
  });

  it('does not introduce SMT transaction or hard-stop execution in CAP0',()=>{
    expect(source).not.toContain('deductCapacityPool');
    expect(source).not.toContain('restoreCapacityPool');
    expect(source).toContain('CAP0 只建立規則');
  });
});