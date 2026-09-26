import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {productEditorInitialFromDetail,type WorkspaceProduct} from '../features/ordering/OrderingCenterWorkspaces.tsx';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

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
      id:'egg',
      name:'雞蛋',
      required:false,
      forceShow:false,
      selection:'MULTI',
      min:0,
      max:2,
      options:[
        {id:'keep',name:'有蛋',priceAdjustmentMinor:0,defaultSelected:true,active:true},
        {id:'no',name:'走蛋',priceAdjustmentMinor:0,defaultSelected:false,active:true},
      ],
    },
  ],
};

describe('SMT A2a same-line product edit',()=>{
  it('reconstructs current editor selections and note from the existing line detail',()=>{
    const initial=productEditorInitialFromDetail(product,'飯底：菜飯 · 雞蛋：走蛋 · 醬分開');
    expect(initial.selected.rice).toEqual(['veg']);
    expect(initial.selected.egg).toEqual(['no']);
    expect(initial.note).toBe('醬分開');
  });

  it('falls back to published defaults when the line has no detail',()=>{
    const initial=productEditorInitialFromDetail(product);
    expect(initial.selected.rice).toEqual(['white']);
    expect(initial.selected.egg).toEqual(['keep']);
    expect(initial.note).toBe('');
  });

  it('opens normal product edit with lineId and updates the same cart line',()=>{
    expect(app).toContain("setPanel({type:'product',productId:line.productId,lineId:line.id})");
    expect(app).toContain('const addConfigured=(productId:string,detail:string,deltaMinor:number,qty:number,lineId?:string)');
    expect(app).toContain('const existing=cart.find(item=>item.id===lineId);if(!existing)return;');
    expect(app).toContain('const next=cart.map(item=>item.id===lineId?{');
    expect(app).toContain('serviceMode:existing.serviceMode');
  });

  it('does not require runtime, Order, Payment or Print changes for same-line edit',()=>{
    expect(app).not.toContain('createSecondOrderEngine');
    expect(app).not.toContain('createSecondPricingEngine');
  });
});
