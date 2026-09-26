// A2b-1 proof trigger on locked main.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

describe('SMT A2b-1 independent add identity',()=>{
  it('creates a fresh source line for every plain product add action',()=>{
    const start=app.indexOf('  const add=(id:string)=>');
    const end=app.indexOf('  const addConfigured=',start);
    const add=app.slice(start,end);
    expect(add).toContain('id:nextLocalCartLineId()');
    expect(add).toContain('setCart([...cart,line])');
    expect(add).not.toContain('cart.find(item=>item.productId===id');
    expect(add).not.toContain('qty:item.qty+1');
  });

  it('uses a monotonic suffix so same-millisecond adds cannot reuse a line id',()=>{
    expect(app).toContain('let localCartLineSequence=0');
    expect(app).toContain('localCartLineSequence+=1');
    expect(app).toContain("return 'line-'+Date.now().toString(36)+'-'+localCartLineSequence.toString(36)");
  });

  it('uses the same identity allocator for new configured and combo lines while preserving A2a edit identity',()=>{
    expect(app).toContain('const line:CartLine={id:nextLocalCartLineId(),productId:product.id');
    expect(app).toContain('const line:CartLine={id:nextLocalCartLineId(),productId:comboId');
    expect(app).toContain('if(lineId){');
    expect(app).toContain('const existing=cart.find(item=>item.id===lineId);if(!existing)return;');
  });

  it('keeps quantity plus/minus as an operation on one selected source line even when presentation grouping is enabled',()=>{
    expect(app).toContain("onAdjustLineQuantity:(lineIds,delta)=>{");
    expect(app).toContain("const lineId=lineIds[0];if(!lineId)return;");
    expect(app).toContain("item.id===lineId?{...item,qty:item.qty+delta}:item");
  });
});
