import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D6 local SMT Dining add-order UI wiring',()=>{
  it('enters add-order mode from the Dining detail and keeps the SAME Formal Order identity',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

    expect(dining).toContain('onAddOrder:(request:DiningAddOrderRequest)=>void');
    expect(dining).toContain('submissionId:nextDiningAdditionSubmissionId(detail.holdId)');
    expect(dining).toContain('formalOrderId:detail.formalOrderId');
    expect(dining).toContain('>＋ 加單</button>');

    expect(app).toContain('saveDiningAddOrderUiSession(request)');
    expect(app).toContain('setDiningAddition(request)');
    expect(app).toContain("setServiceMode('dine-in')");
    expect(app).toContain('setCartState([])');
  });

  it('confirms add-order through appendDiningItems + delta print instead of Checkout / second Order',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    const start=app.indexOf('  const submitDiningAddition=async()=>{');
    const end=app.indexOf('  const actions:OrderingWorkspaceActions={',start);
    const block=app.slice(start,end);

    expect(block).toContain('localRuntime.appendDiningItems(diningAddition.holdId');
    expect(block).toContain('submissionId:diningAddition.submissionId');
    expect(block).toContain('localRuntime.ensureDiningAdditionPrint(diningAddition.holdId,committed.additionId)');
    expect(block).toContain("sourceLabel:'現場'");
    expect(block).not.toContain('createOrder(');
    expect(block).not.toContain("navigate('/checkout')");
    expect(app).toContain("if(diningAddition){void submitDiningAddition();return;}navigate('/checkout')");
  });

  it('recovers a durable addition by submission id and never blind-resubmits it',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

    expect(app).toContain('detail.additions.find(row=>row.submissionId===diningAddition.submissionId)');
    expect(app).toContain('localRuntime.ensureDiningAdditionPrint(diningAddition.holdId,existing.id)');
    expect(app).toContain('打印結果未知，系統唔會自動重印');
    expect(app).toContain("location.pathname==='/dining'&&diningAddition");
  });

  it('locks the ordering surface to dine-in and relabels the primary action as 確認加單',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
    const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');

    expect(app).toContain("?{takeaway:false,dineIn:storeSettings.dineInEnabled}");
    expect(app).toContain('lineServiceMode:!diningAddition');
    expect(app).toContain("primaryActionLabel:diningAddState==='processing'?'加單處理中'");
    expect(app).toContain("contextLabel:'加單 · '+diningAddition.tableLabel");
    expect(ordering).toContain("view.cart.primaryActionLabel??'結帳'");
  });
});
