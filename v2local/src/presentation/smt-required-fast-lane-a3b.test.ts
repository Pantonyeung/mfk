// A3b Owner-decided Required Fast Lane proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  applyRequiredSelectionToCart,
  quickConfigurationForProduct,
  requiredTasksForCart,
  type WorkspaceCartLine,
  type WorkspaceProduct,
} from '../features/ordering/OrderingCenterWorkspaces.tsx';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

const requiredProduct:WorkspaceProduct={
  id:'meal',
  category:'便當',
  name:'肉燥便當',
  priceMinor:4100,
  priceLabel:'$41.00',
  optionSets:[{
    id:'rice',
    name:'飯底',
    required:true,
    forceShow:false,
    selection:'SINGLE',
    min:1,
    max:1,
    options:[
      {id:'braised',name:'肉燥',priceAdjustmentMinor:200,defaultSelected:true,active:true},
      {id:'veg',name:'菜飯',priceAdjustmentMinor:0,defaultSelected:false,active:true},
    ],
  }],
};

describe('SMT A3b Required Fast Lane',()=>{
  it('lets Quick admit a Required product unresolved instead of forcing Product Editor',()=>{
    expect(quickConfigurationForProduct(requiredProduct)).toEqual({eligible:true,detail:'',deltaMinor:0});
    const line:WorkspaceCartLine={id:'line-1',productId:'meal',name:'肉燥便當',qty:1,unitMinor:4100};
    const tasks=requiredTasksForCart([line],[requiredProduct]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({lineId:'line-1',groupId:'rice',min:1,max:1,missingCount:1});
  });

  it('applies Admin-published Required selection onto the SAME cart line and clears the task',()=>{
    const line:WorkspaceCartLine={id:'line-1',productId:'meal',name:'肉燥便當',qty:1,unitMinor:4100};
    const next=applyRequiredSelectionToCart([line],[requiredProduct],'line-1','rice',['braised']);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('line-1');
    expect(next[0]?.unitMinor).toBe(4300);
    expect(next[0]?.detail).toBe('飯底：肉燥');
    expect(requiredTasksForCart(next,[requiredProduct])).toHaveLength(0);
  });

  it('supports Admin min/max for multi-select Required without hard-coded options',()=>{
    const product:WorkspaceProduct={
      ...requiredProduct,
      optionSets:[{
        id:'toppings',
        name:'配料',
        required:true,
        forceShow:false,
        selection:'MULTI',
        min:2,
        max:2,
        options:[
          {id:'a',name:'A',priceAdjustmentMinor:0,defaultSelected:false,active:true},
          {id:'b',name:'B',priceAdjustmentMinor:100,defaultSelected:false,active:true},
          {id:'c',name:'C',priceAdjustmentMinor:200,defaultSelected:false,active:true},
        ],
      }],
    };
    const line:WorkspaceCartLine={id:'line-2',productId:'meal',name:'肉燥便當',qty:1,unitMinor:4100};
    expect(()=>applyRequiredSelectionToCart([line],[product],'line-2','toppings',['a'])).toThrow('REQUIRED_FAST_LANE_SELECTION_INVALID');
    const next=applyRequiredSelectionToCart([line],[product],'line-2','toppings',['a','b']);
    expect(next[0]?.unitMinor).toBe(4200);
    expect(next[0]?.detail).toBe('配料：A、B');
  });

  it('blocks checkout until Required tasks are resolved and wires the dedicated 必選區',()=>{
    expect(app).toContain("const requiredWork=requiredTasksForCart(cart,workspaceProducts)");
    expect(app).toContain("requiredWork.length===0");
    expect(app).toContain("{id:'required',label:'必選／補選',count:requiredWork.length}");
    expect(app).toContain("<RequiredFastLaneWorkspace");
    expect(app).toContain("onApply={applyRequired}");
    expect(app).toContain("if(id==='required')setPanel({type:'required'})");
  });

  it('keeps Normal body editor-first and the product-card three-dot editor available in every mode',()=>{
    expect(workspace).toContain("if(mode==='normal'||!product.quickAddAllowed)actions.onConfigureProduct(product.id)");
    expect(workspace).toContain("onClick={()=>actions.onConfigureProduct(product.id)}>⋮</button>");
  });

  it('does not import the later full Fast Lane stack or create a second pricing authority',()=>{
    expect(app).not.toContain("FastLaneWorkspaces");
    expect(app).not.toContain("fast-lane-model");
    expect(app).not.toContain("createSecondPricingEngine");
  });
});
