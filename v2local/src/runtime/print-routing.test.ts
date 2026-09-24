import {describe,expect,it} from 'vitest';
import {buildOrderPrintPlan,groupTscBitmapJobsByPhysicalPrinter,type PrintBinding,type PrintableOrder} from './print-routing.ts';

const order:PrintableOrder={
  id:'MFK-1',
  display:'P001',
  createdAt:'2026-09-21T05:00:00.000Z',
  totalMinor:5900,
  paymentLabel:'CASH',
  sourceLabel:'Keeta · 4890',
  providerPickupCode:'4890',
  orderRemark:'少辣',
  items:[
    {id:'riceball',name:'原味飯團',qty:2,unitMinor:2100,serviceMode:'takeaway',productCode:'A1',detail:'少飯'},
    {id:'tea',name:'台式奶茶',qty:1,unitMinor:1700,serviceMode:'takeaway',productCode:'D1'},
  ],
};

const binding=(role:PrintBinding['role'],id:string,productIds?:readonly string[],logicalPrinterId?:string):PrintBinding=>({
  id,role,routeKey:'logical.'+id,name:role+' printer',model:'LAN',host:'192.168.1.50',port:9100,
  capability:role.includes('標籤')?'label-58mm':'receipt-80mm/kitchen',encoding:role.includes('標籤')?'big5':'gb18030',
  ...(logicalPrinterId?{logicalPrinterId}:{}),
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
    expect(plan[0]?.renderMode).toBe('escpos-raster');
    expect(plan[0]?.ticketKind).toBe('receipt');
    expect(plan[1]?.renderMode).toBe('escpos-raster');
    expect(plan[1]?.ticketKind).toBe('production');
    expect(plan[2]?.renderMode).toBe('escpos-raster');
    expect(plan[2]?.ticketKind).toBe('packing');
    expect(plan[1]?.payload).toContain('廚房製作單');
    expect(plan[2]?.payload).toContain('外賣打包單');

    const productJobs=plan.filter(job=>job.role==='產品標籤');
    expect(productJobs.map(job=>job.binding.id)).toEqual([
      'product-label-riceball','product-label-riceball','product-label-takeaway',
    ]);
    expect(productJobs[0]?.labelSpec).toMatchObject({kind:'product',orderCode:'P001',primaryText:'原味飯團',productCode:'A1',pieceLabel:'1/3',secondaryText:'外賣 · 少飯'});
    expect(productJobs[1]?.labelSpec).toMatchObject({orderCode:'P001',primaryText:'原味飯團',pieceLabel:'2/3'});
    expect(productJobs[2]?.labelSpec).toMatchObject({orderCode:'P001',primaryText:'台式奶茶',pieceLabel:'3/3'});
    expect(productJobs.every(job=>job.renderMode==='tsc-bitmap')).toBe(true);

    expect(plan[6]?.renderMode).toBe('tsc-bitmap');
    expect(plan[6]?.labelSpec).toMatchObject({kind:'bag',orderCode:'P001',primaryText:'共 3 件',secondaryText:'共 3 件'});
    expect(plan[6]?.labelSpec?.pieceLabel).toBeUndefined();
  });


  it('renders owner-approved 80mm operational hierarchy without inventing missing facts',()=>{
    const plan=buildOrderPrintPlan(order,[
      binding('顧客小票','receipt'),
      binding('製作單','production'),
      binding('打包單','packing'),
    ]);
    const receipt=plan.find(job=>job.role==='顧客小票')!.payload;
    const production=plan.find(job=>job.role==='製作單')!.payload;
    const packing=plan.find(job=>job.role==='打包單')!.payload;

    expect(receipt).toContain('客戶收據');
    expect(receipt).toContain('P001');
    expect(receipt).toContain('取餐碼');
    expect(receipt).toContain('4890');
    expect(receipt).toContain('合計 $59.00');
    expect(receipt).not.toContain('內容物確認');

    expect(production).toContain('廚房製作單');
    expect(production).toContain('A1. 原味飯團');
    expect(production).toContain('數量');
    expect(production).toContain('少辣');

    expect(packing).toContain('外賣打包單');
    expect(packing).toContain('總數量');
    expect(packing).toContain('內容物確認');
    expect(packing).toContain('餐具：未記錄');
  });

  it('batches eleven labels for one logical printer into one native dispatch batch',()=>{
    const eleven:PrintableOrder={...order,items:[{id:'riceball',name:'原味飯團',qty:11,unitMinor:2100}]};
    const plan=buildOrderPrintPlan(eleven,[binding('產品標籤','product-label-riceball',['riceball'])]);
    expect(plan).toHaveLength(11);
    expect(plan.map(job=>job.labelSpec?.pieceLabel)).toEqual([
      '1/11','2/11','3/11','4/11','5/11','6/11','7/11','8/11','9/11','10/11','11/11'
    ]);
    const batches=groupTscBitmapJobsByPhysicalPrinter(plan);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.binding.id).toBe('product-label-riceball');
    expect(batches[0]?.jobs).toHaveLength(11);
  });

  it('merges product and bag label jobs that share the same physical printer into one socket batch',()=>{
    const sharedHost='192.168.1.77';
    const rice={...binding('產品標籤','rice',['riceball']),host:sharedHost};
    const takeaway={...binding('產品標籤','takeaway',['tea']),host:sharedHost};
    const bag={...binding('袋標籤','bag'),host:sharedHost};
    const plan=buildOrderPrintPlan(order,[rice,takeaway,bag]);
    const batches=groupTscBitmapJobsByPhysicalPrinter(plan);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.jobs).toHaveLength(4);
    expect(batches[0]?.jobs.map(job=>job.labelSpec?.pieceLabel)).toEqual(['1/3','2/3','3/3',undefined]);
  });

  it('keeps a newly added custom product-label route silent until products are assigned',()=>{
    const plan=buildOrderPrintPlan(order,[binding('產品標籤','product-label-custom',[])]);
    expect(plan).toHaveLength(0);
  });

  it('respects Admin logical-printer active state and product print rules',()=>{
    const config={
      logicalPrinters:[
        {id:'logical-receipt',type:'RECEIPT' as const,active:false},
        {id:'logical-production',type:'PRODUCTION' as const,active:true},
        {id:'logical-label-a',type:'LABEL' as const,active:true},
      ],
      productRules:{
        riceball:{receipt:true,production:true,packing:false,label:true,dineIn:true,takeaway:true,labelPrinterIds:['logical-label-a']},
        tea:{receipt:true,production:false,packing:false,label:false,dineIn:true,takeaway:true,labelPrinterIds:[]},
      },
    };
    const plan=buildOrderPrintPlan(order,[
      binding('顧客小票','receipt',undefined,'logical-receipt'),
      binding('製作單','production',undefined,'logical-production'),
      binding('產品標籤','label-a',undefined,'logical-label-a'),
    ],config);
    expect(plan.some(job=>job.role==='顧客小票')).toBe(false);
    expect(plan.filter(job=>job.role==='製作單')).toHaveLength(1);
    expect(plan.filter(job=>job.role==='產品標籤')).toHaveLength(2);
    expect(plan.find(job=>job.role==='製作單')?.payload).toContain('原味飯團');
    expect(plan.find(job=>job.role==='製作單')?.payload).not.toContain('台式奶茶');
  });

  it('applies Admin dine-in/takeaway print flags per item',()=>{
    const mixed:PrintableOrder={...order,items:[
      {id:'riceball',name:'原味飯團',qty:1,unitMinor:2100,serviceMode:'dine-in'},
      {id:'tea',name:'台式奶茶',qty:1,unitMinor:1700,serviceMode:'takeaway'},
    ]};
    const config={
      logicalPrinters:[{id:'logical-production',type:'PRODUCTION' as const,active:true}],
      productRules:{
        riceball:{receipt:true,production:true,packing:true,label:false,dineIn:false,takeaway:true,labelPrinterIds:[]},
        tea:{receipt:true,production:true,packing:true,label:false,dineIn:true,takeaway:true,labelPrinterIds:[]},
      },
    };
    const plan=buildOrderPrintPlan(mixed,[binding('製作單','production',undefined,'logical-production')],config);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.payload).not.toContain('原味飯團');
    expect(plan[0]?.payload).toContain('台式奶茶');
  });

  it('prints only routes that are actually bound',()=>{
    const unbound={...binding('製作單','production'),host:''};
    const plan=buildOrderPrintPlan(order,[binding('顧客小票','receipt'),unbound]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.role).toBe('顧客小票');
  });
});
