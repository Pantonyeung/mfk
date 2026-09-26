import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configurationFromDetail,type WorkspaceProduct} from '../features/ordering/OrderingCenterWorkspaces.tsx';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');

const product:WorkspaceProduct={
  id:'p1',
  category:'測試',
  name:'測試商品',
  priceMinor:4100,
  priceLabel:'$41.00',
  optionSets:[
    {
      id:'rice',
      name:'飯底',
      required:true,
      forceShow:true,
      selection:'SINGLE',
      min:1,
      max:1,
      options:[
        {id:'white',name:'白飯',priceAdjustmentMinor:0,defaultSelected:true,active:true},
        {id:'veg',name:'菜飯',priceAdjustmentMinor:200,defaultSelected:false,active:true},
      ],
    },
    {
      id:'drink',
      name:'飲品',
      required:false,
      forceShow:false,
      selection:'SINGLE',
      min:0,
      max:1,
      options:[
        {id:'tea',name:'台式奶茶',priceAdjustmentMinor:800,defaultSelected:false,active:true},
      ],
    },
  ],
};

describe('SMT A2a SAME-line product edit',()=>{
  it('recovers published option selections and note from existing cart detail',()=>{
    const config=configurationFromDetail(product,'飯底：菜飯 · 飲品：台式奶茶 · 醬分開');
    expect(config.selected.rice).toEqual(['veg']);
    expect(config.selected.drink).toEqual(['tea']);
    expect(config.note).toBe('醬分開');
  });

  it('falls back to Admin defaults when the existing detail has no matching option segment',()=>{
    const config=configurationFromDetail(product,'舊資料');
    expect(config.selected.rice).toEqual(['white']);
    expect(config.note).toBe('舊資料');
  });

  it('carries line identity into the product editor and updates the SAME line',()=>{
    expect(center).toContain("readonly type:'product';readonly productId:string;readonly lineId?:string");
    expect(app).toContain("setPanel({type:'product',productId:line.productId,lineId})");
    expect(app).toContain("id:lineId??'line-'");
    expect(app).toContain("cart.map(item=>item.id===lineId?{...line,serviceMode:item.serviceMode}:item)");
  });

  it('initializes edit quantity/detail/configuration and labels the action as save',()=>{
    expect(app).toContain("initial={line?{qty:line.qty,detail:line.detail,configuration:line.configuration}:undefined}");
    expect(center).toContain("{initial?'儲存修改':'加入訂單'}");
  });

  it('keeps the same-line edit inside presentation/composition instead of adding runtime authority',()=>{
    expect(app).not.toContain('createCartEditEngine');
    expect(center).not.toContain('runtime/');
  });
});
