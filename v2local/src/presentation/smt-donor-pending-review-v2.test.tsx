import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PendingOrderReviewWorkspace} from '../features/ordering/PendingOrderReviewWorkspace.tsx';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const pendingSource=fs.readFileSync(path.join(root,'features/ordering/PendingOrderReviewWorkspace.tsx'),'utf8');

const order={
  id:'MFK-1',
  display:'P017',
  sourceLabel:'Keeta · 門店',
  createdAt:'2026-09-24T10:00:00.000Z',
  totalMinor:5900,
  paymentLabel:'KEETA',
  fulfillmentLabel:'待處理',
  providerPickupCode:'K017',
  items:[
    {id:'main',name:'紫米飯團 A 餐',qty:1,unitMinor:5900,detail:'飯團：原味 · 小食：鹽酥雞'},
  ],
};

describe('SMT donor pending summary review accept flow',()=>{
  it('opens on a non-mutating summary before review',()=>{
    const html=renderToStaticMarkup(<PendingOrderReviewWorkspace order={order} onAccept={async()=>''} onOpenOrders={()=>undefined}/>);
    expect(html).toContain('#P017');
    expect(html).toContain('摘要');
    expect(html).toContain('開始核對');
    expect(html).toContain('完整訂單工作台');
    expect(html).not.toContain('確認接單');
  });

  it('keeps explicit Review then Accept controls in the same workflow source',()=>{
    expect(pendingSource).toContain("setStage('review')");
    expect(pendingSource).toContain('接單核對');
    expect(pendingSource).toContain('確認接單');
    expect(pendingSource).toContain("order.fulfillmentLabel==='待處理'");
    expect(pendingSource).toContain('disabled={!isPending||busy||Boolean(result)}');
  });

  it('routes queue cards into the pending review panel instead of jumping directly to Orders',()=>{
    expect(app).toContain("setPanel({type:'pending-order',orderId:id})");
    expect(app).toContain('PendingOrderReviewWorkspace');
    expect(app).toContain('localRuntime.acceptOrder(order.id)');
  });

  it('reuses existing Customer/Keeta formal accept semantics and does not invent a second provider path',()=>{
    expect(app).toContain("result.provider.state==='ATTENTION'");
    expect(app).toContain("result.provider.state==='SYNCED'||result.provider.state==='IDEMPOTENT'");
    expect(pendingSource).not.toContain('fetch(');
    expect(pendingSource).not.toContain('createOrder(');
    expect(pendingSource).not.toContain('printOrderOutputs(');
  });

  it('does not claim payment proof data that current StoredOrder does not provide',()=>{
    expect(pendingSource).not.toContain('付款證明');
    expect(pendingSource).toContain('付款記錄');
  });
});
