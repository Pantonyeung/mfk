import {describe,expect,it} from 'vitest';
import {buildOrderPrintPlan,type PrintBinding,type PrintableOrder} from './print-routing.ts';

const order:PrintableOrder={
  id:'MFK-1',
  display:'P001',
  createdAt:'2026-09-21T05:00:00.000Z',
  totalMinor:5900,
  paymentLabel:'CASH',
  sourceLabel:'現場',
  items:[
    {id:'riceball',name:'原味飯團',qty:2,unitMinor:2100},
    {id:'tea',name:'台式奶茶',qty:1,unitMinor:1700},
  ],
};

const binding=(role:PrintBinding['role'],id:string):PrintBinding=>({
  id,role,routeKey:'logical.'+id,name:role+' printer',model:'LAN',host:'192.168.1.50',port:9100,
  capability:role.includes('標籤')?'label-58mm':'receipt-80mm/kitchen',
});

describe('MFK checkout print fanout',()=>{
  it('creates every configured receipt production packing and label output',()=>{
    const plan=buildOrderPrintPlan(order,[
      binding('顧客小票','receipt'),
      binding('製作單','production'),
      binding('打包單','packing'),
      binding('產品標籤','product-label'),
      binding('袋標籤','bag-label'),
    ]);
    expect(plan.map(job=>job.role)).toEqual([
      '顧客小票',
      '製作單',
      '打包單',
      '產品標籤','產品標籤','產品標籤',
      '袋標籤',
    ]);
    expect(plan).toHaveLength(7);
    expect(plan[0]?.payload).toContain('P001');
    expect(plan[1]?.payload).toContain('製作單');
    expect(plan[2]?.payload).toContain('打包單');
    expect(plan[3]?.payload).toContain('原味飯團');
    expect(plan[6]?.payload).toContain('P001');
  });

  it('prints only routes that are actually bound',()=>{
    const unbound={...binding('製作單','production'),host:''};
    const plan=buildOrderPrintPlan(order,[binding('顧客小票','receipt'),unbound]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.role).toBe('顧客小票');
  });
});
