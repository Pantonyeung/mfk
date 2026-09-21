import {describe,expect,it} from 'vitest';
import {buildOrderPrintPlan,groupTscBitmapJobsByBinding,type PrintBinding,type PrintableOrder} from './print-routing.ts';

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

const binding=(role:PrintBinding['role'],id:string,productIds?:readonly string[]):PrintBinding=>({
  id,role,routeKey:'logical.'+id,name:role+' printer',model:'LAN',host:'192.168.1.50',port:9100,
  capability:role.includes('標籤')?'label-58mm':'receipt-80mm/kitchen',encoding:role.includes('標籤')?'big5':'gb18030',
  ...(productIds===undefined?{}:{productIds}),
});

describe('MFK checkout print fanout',()=>{
  it('routes product labels to separate logical label printers without duplicate fanout',()=>{
    const plan=buildOrderPrintPlan(order,[
      binding('顧客小票','receipt'),
      binding('製作單','production'),
      binding('打包單','packing'),
      binding('產品標籤','product-label-riceball',['riceball']),
      binding('產品標籤','product-label-takeaway',['tea']),
      binding('袋標籤','bag-label'),
    ]);
    expect(plan.map(job=>job.role)).toEqual([
      '顧客小票',
      '製作單',
      '打包單',
      '產品標籤','產品標籤',
      '產品標籤',
      '袋標籤',
    ]);
    expect(plan).toHaveLength(7);
    expect(plan[0]?.payload).toContain('P001');
    expect(plan[1]?.payload).toContain('製作單');
    expect(plan[2]?.payload).toContain('打包單');

    const productJobs=plan.filter(job=>job.role==='產品標籤');
    expect(productJobs.map(job=>job.binding.id)).toEqual([
      'product-label-riceball','product-label-riceball','product-label-takeaway',
    ]);
    expect(productJobs[0]?.labelSpec).toMatchObject({orderCode:'P001',primaryText:'原味飯團',pieceLabel:'1/2'});
    expect(productJobs[1]?.labelSpec).toMatchObject({orderCode:'P001',primaryText:'原味飯團',pieceLabel:'2/2'});
    expect(productJobs[2]?.labelSpec).toMatchObject({orderCode:'P001',primaryText:'台式奶茶',pieceLabel:'1/1'});
    expect(productJobs.every(job=>job.renderMode==='tsc-bitmap')).toBe(true);

    expect(plan[6]?.renderMode).toBe('tsc-bitmap');
    expect(plan[6]?.labelSpec?.orderCode).toBe('P001');
  });

  it('batches eleven labels for one logical printer into one native dispatch batch',()=>{
    const eleven:PrintableOrder={...order,items:[{id:'riceball',name:'原味飯團',qty:11,unitMinor:2100}]};
    const plan=buildOrderPrintPlan(eleven,[binding('產品標籤','product-label-riceball',['riceball'])]);
    expect(plan).toHaveLength(11);
    expect(plan.map(job=>job.labelSpec?.pieceLabel)).toEqual([
      '1/11','2/11','3/11','4/11','5/11','6/11','7/11','8/11','9/11','10/11','11/11'
    ]);
    const batches=groupTscBitmapJobsByBinding(plan);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.binding.id).toBe('product-label-riceball');
    expect(batches[0]?.jobs).toHaveLength(11);
  });

  it('keeps a newly added custom product-label route silent until products are assigned',()=>{
    const plan=buildOrderPrintPlan(order,[binding('產品標籤','product-label-custom',[])]);
    expect(plan).toHaveLength(0);
  });

  it('prints only routes that are actually bound',()=>{
    const unbound={...binding('製作單','production'),host:''};
    const plan=buildOrderPrintPlan(order,[binding('顧客小票','receipt'),unbound]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.role).toBe('顧客小票');
  });
});
