import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const model=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace-model.ts'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

describe('SMT A2b-2 reversible Combine presentation',()=>{
  it('keeps Combine OFF by default and derives a presentation view without mutating source cart',()=>{
    expect(app).toContain('const [combineSimilar,setCombineSimilar]=useState(false)');
    expect(app).toContain('const presentationCart=(()=>{');
    expect(app).toContain('if(!combineSimilar)return cart.map');
    expect(app).toContain('lines:presentationCart');
    expect(app).toContain('const total=cart.reduce');
  });

  it('groups only exact-equal current cart semantics',()=>{
    expect(app).toContain("const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::')");
    expect(app).toContain('current.quantity+=line.qty');
    expect(app).toContain('current.ids.push(line.id)');
  });

  it('retains the source line ids so Combine never destroys identity',()=>{
    expect(model).toContain('readonly sourceLineIds?:readonly string[]');
    expect(app).toContain("id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id");
    expect(app).toContain('sourceLineIds');
  });

  it('makes grouped rows read-only until Combine is turned off instead of guessing which source line to edit',()=>{
    expect(workspace).toContain('const grouped=sourceLineIds.length>1');
    expect(workspace).toContain('availability.lineEdit&&!grouped');
    expect(workspace).toContain('availability.lineQuantity&&!grouped');
    expect(workspace).toContain('availability.lineServiceMode&&!grouped');
    expect(workspace).toContain('關閉合併可逐行修改');
  });

  it('exposes an explicit reversible Combine toggle in the cart header',()=>{
    expect(model).toContain('readonly combineSimilar:boolean');
    expect(model).toContain('readonly onToggleCombine:()=>void');
    expect(workspace).toContain("合併 {view.cart.combineSimilar?'開':'關'}");
    expect(app).toContain('onToggleCombine:()=>setCombineSimilar(value=>!value)');
  });
});
