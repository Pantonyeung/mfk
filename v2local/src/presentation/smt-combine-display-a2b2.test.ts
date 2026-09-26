// A2b2 latest-main proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const model=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace-model.ts'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

describe('SMT A2b2 presentation-only Combine',()=>{
  it('defaults Combine OFF and keeps raw source lines until operator enables grouping',()=>{
    expect(app).toContain('const [combineSimilar,setCombineSimilar]=useState(false)');
    expect(app).toContain("if(!combineSimilar)return cart.map((line,index)=>presentCartLine(line,index,line.qty,[line.id]))");
  });

  it('groups only exact product/service/price/detail semantics without mutating source cart',()=>{
    expect(app).toContain("const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::')");
    expect(app).toContain("id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id");
    expect(app).toContain('sourceLineIds');
    expect(app).toContain('const presentationCart=(()=>{');
    expect(app).toContain('lines:presentationCart');
  });

  it('keeps checkout and hold payloads on the raw cart rather than presentation grouping',()=>{
    expect(app).toContain('const holdItems=()=>cart.map');
    expect(app).toContain('items:cart.map(line=>({');
    expect(app).not.toContain('items:presentationCart.map');
  });

  it('routes grouped row actions back to source line ids',()=>{
    expect(model).toContain('readonly sourceLineIds?:readonly string[]');
    expect(model).toContain('readonly onChangeLineServiceMode:(lineIds:readonly string[],mode:ServiceMode)=>void');
    expect(model).toContain('readonly onAdjustLineQuantity:(lineIds:readonly string[],delta:-1|1)=>void');
    expect(model).toContain('readonly onEditCartLine:(lineIds:readonly string[])=>void');
    expect(workspace).toContain("const sourceLineIds=line.sourceLineIds?.length?line.sourceLineIds:[line.id]");
  });

  it('labels the control as display behavior and keeps the landed independent-add allocator',()=>{
    expect(workspace).toContain('合併顯示');
    expect(app).toContain('const nextLocalCartLineId=()=>');
    const addBlock=app.slice(app.indexOf('const add=(id:string)=>{'),app.indexOf('const addConfigured='));
    expect(addBlock).toContain('id:nextLocalCartLineId()');
    expect(addBlock).not.toContain('cart.find(');
  });
});
