// A3a latest-main proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {quickConfigurationForProduct,type WorkspaceProduct} from '../features/ordering/OrderingCenterWorkspaces.tsx';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

const base:WorkspaceProduct={id:'p',category:'測試',name:'測試',priceMinor:4100,priceLabel:'$41.00',optionSets:[]};

describe('SMT A3a bounded Quick / Normal ordering',()=>{
  it('allows Quick direct-add for products with no forced decision',()=>{
    expect(quickConfigurationForProduct(base)).toEqual({eligible:true,detail:'',deltaMinor:0});
  });

  it('admits Required products in Quick mode but keeps forceShow-only editor-first',()=>{
    const required:WorkspaceProduct={...base,optionSets:[{id:'s',name:'必選',required:true,forceShow:false,selection:'SINGLE',min:1,max:1,options:[{id:'a',name:'A',priceAdjustmentMinor:200,defaultSelected:true,active:true}]}]};
    const forceShow:WorkspaceProduct={...base,optionSets:[{id:'s',name:'顯示',required:false,forceShow:true,selection:'SINGLE',min:0,max:1,options:[{id:'a',name:'A',priceAdjustmentMinor:0,defaultSelected:false,active:true}]}]};
    expect(quickConfigurationForProduct(required)).toEqual({eligible:true,detail:'',deltaMinor:0});
    expect(quickConfigurationForProduct(forceShow).eligible).toBe(false);
  });

  it('applies published default option price adjustments in Quick mode',()=>{
    const product:WorkspaceProduct={...base,optionSets:[{id:'s',name:'加配',required:false,forceShow:false,selection:'MULTI',min:0,max:2,options:[{id:'a',name:'芝士',priceAdjustmentMinor:200,defaultSelected:true,active:true}]}]};
    expect(quickConfigurationForProduct(product)).toEqual({eligible:true,detail:'加配：芝士',deltaMinor:200});
  });

  it('keeps Normal mode editor-first and Quick mode guarded by quickAddAllowed',()=>{
    expect(workspace).toContain("if(mode==='normal'||!product.quickAddAllowed)actions.onConfigureProduct(product.id)");
    expect(workspace).toContain("onClick={()=>actions.onConfigureProduct(product.id)}>⋮</button>");
    expect(workspace).toContain("actions.onChangeOrderingMode('quick')");
    expect(workspace).toContain("actions.onChangeOrderingMode('normal')");
    expect(app).toContain("const [orderingMode,setOrderingMode]=useState<'quick'|'normal'>('quick')");
    expect(app).toContain('quickAddAllowed:Boolean(quickConfigurationById.get(product.id)?.eligible)');
  });

  it('does not import or create the later Fast Lane stack',()=>{
    expect(app).not.toContain("FastLaneWorkspaces");
    expect(app).not.toContain("fast-lane-model");
    expect(app).not.toContain("QuickDrink");
    expect(app).not.toContain("createSecondPricingEngine");
  });
});
