import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectSyncedOrderingCatalog} from '../runtime/admin-config-projection.ts';
import type {MfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const adminDeferred=fs.readFileSync(path.resolve(root,'../../v2admin/src/DeferredWorkspaces.tsx'),'utf8');

function envelope(snapshot:Record<string,unknown>):MfkAdminConfigEnvelope{
  return {
    schema:'MFK_ADMIN_CONFIG_SYNC_V1',
    storeId:'MF01',
    revision:1,
    publishedAt:'2026-09-26T00:00:00.000Z',
    adminFingerprint:'test',
    snapshot,
    fingerprint:'test',
  };
}

describe('SMT A3e frontline presentation',()=>{
  it('projects product description from Admin catalog truth',()=>{
    const config=envelope({
      catalog:{
        categories:[{id:'drink',name:'飲品',position:1,active:true}],
        products:[{id:'p1',categoryId:'drink',name:'手打檸檬茶',description:'即叫即打',basePrice:'22.00',active:true}],
      },
      optionCenter:{sets:[],productLinks:[]},
      availability:{},
      productMedia:{},
    });
    const projected=projectSyncedOrderingCatalog('takeaway',config);
    expect(projected.products[0]).toMatchObject({id:'p1',description:'即叫即打'});
  });

  it('wires Admin frontline columns, descriptions and guidance into the ordering view only',()=>{
    expect(app).toContain('showDescriptions:frontlinePresentation.showDescriptions');
    expect(app).toContain('productColumns:frontlinePresentation.tabletColumns');
    expect(app).toContain('frontlineGuidance:(frontlinePresentation.headline||frontlinePresentation.body)');
    expect(workspace).toContain("'--ordering-product-columns':String(view.productColumns??4)");
    expect(workspace).toContain('showDescription={view.showDescriptions!==false}');
    expect(workspace).toContain('view.frontlineGuidance?.headline');
    expect(css).toContain('repeat(var(--ordering-product-columns,4),minmax(0,1fr))');
    expect(css).toContain('.ordering-product-description');
  });

  it('adds an explicit Save and Publish action to Frontline presentation settings',()=>{
    expect(adminDeferred).toContain("surface==='FRONTLINE'");
    expect(adminDeferred).toContain("saveAdminConfig(draft,undefined,'顯示設定 '+surface)");
    expect(adminDeferred).toContain('保存並發佈');
    expect(adminDeferred).toContain('已排入 Admin → SMT／SMM 自動同步');
  });

  it('keeps business authority outside presentation preferences',()=>{
    expect(app).toContain('localRuntime.createOrder');
    expect(app).toContain('localRuntime.printOrderOutputs');
    expect(adminDeferred).toContain('商品名、價格、供應、訂單同付款權限完全不變');
    expect(adminDeferred).not.toContain('setPriceFromPresentation');
    expect(workspace).not.toContain('unitMinor');
  });
});
