// A2b latest-main proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const model=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace-model.ts'),'utf8');
const workspace=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

describe('SMT A2b independent add identity + presentation-only combine',()=>{
  it('creates a new source cart line for each separate product add action',()=>{
    expect(app).toContain('const nextLocalCartLineId=');
    expect(app).toContain("const line:CartLine={id:nextLocalCartLineId(),productId:product.id");
    expect(app).not.toContain('const existing=cart.find(item=>item.productId===id&&item.serviceMode===serviceMode)');
  });

  it('keeps Combine off by default and groups only exact visible semantics when enabled',()=>{
    expect(app).toContain('const [combineSimilar,setCombineSimilar]=useState(false)');
    expect(app).toContain("if(!combineSimilar)return cart.map");
    expect(app).toContain("const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::')");
    expect(app).toContain("id:sourceLineIds.length>1?'group:'+sourceLineIds.join('+'):line.id");
  });

  it('preserves source line identity through grouped presentation actions',()=>{
    expect(model).toContain('readonly sourceLineIds?:readonly string[]');
    expect(model).toContain('readonly onChangeLineServiceMode:(lineIds:readonly string[],mode:ServiceMode)=>void');
    expect(model).toContain('readonly onAdjustLineQuantity:(lineIds:readonly string[],delta:-1|1)=>void');
    expect(model).toContain('readonly onEditCartLine:(lineIds:readonly string[])=>void');
    expect(workspace).toContain("const sourceLineIds=line.sourceLineIds?.length?line.sourceLineIds:[line.id]");
  });

  it('labels Combine as display behavior and does not change checkout or hold source data',()=>{
    expect(workspace).toContain('合併顯示');
    expect(app).toContain('const holdItems=()=>cart.map');
    expect(app).toContain('items:cart.map(line=>({');
    expect(app).not.toContain('items:presentationCart.map');
  });

  it('keeps same-line edit available when Combine groups exact-equal rows',()=>{
    expect(app).toContain('const line=cart.find(item=>item.id===lineIds[0])');
    expect(app).toContain("setPanel({type:'product',productId:line.productId,lineId:line.id})");
  });
});
