import type {SmmRuntimePort,SmmReadModelSnapshot,SmmCartLine} from './product-types';

const observedAt='2026-09-22T13:40:00+08:00';

const snapshot:SmmReadModelSnapshot={
  menu:{
    revision:'ACCEPTANCE-SMM-R1',
    observedAt,
    categories:[
      {categoryId:'popular',name:'人氣',sortOrder:1},
      {categoryId:'rice',name:'飯團',sortOrder:2},
      {categoryId:'snack',name:'小食',sortOrder:3},
    ],
    products:[
      {
        productId:'P-RICE-001',
        categoryId:'popular',
        name:'驗收樣本｜紫米飯團',
        description:'只供介面驗收；唔係正式商品資料。',
        available:true,
        variationRequired:true,
        variations:[
          {variationId:'V-NORMAL',name:'正常飯',available:true},
          {variationId:'V-LESS',name:'少飯',available:true},
        ],
        optionGroups:[
          {
            optionGroupId:'G-TOPPING',
            name:'加料',
            required:false,
            minSelections:0,
            maxSelections:2,
            options:[
              {optionId:'O-EGG',name:'加蛋',available:true},
              {optionId:'O-VEG',name:'加菜',available:true},
              {optionId:'O-SAUCE',name:'加醬',available:true},
            ],
          },
        ],
      },
      {
        productId:'P-SNACK-001',
        categoryId:'snack',
        name:'驗收樣本｜鹽酥雞',
        description:'只供介面驗收。',
        available:true,
        optionGroups:[],
      },
      {
        productId:'P-RICE-002',
        categoryId:'rice',
        name:'驗收樣本｜雞肉飯團',
        description:'展示售罄狀態。',
        available:false,
        optionGroups:[],
      },
    ],
  },
  orders:[
    {
      orderId:'ORDER-ACCEPT-001',
      displayCode:'#A101',
      source:'Keeta',
      lifecycle:'PREPARING',
      amountLabel:'HK$96.00',
      itemSummary:'紫米飯團 ×2 · 鹽酥雞 ×1',
      observedAt,
      readback:'CONFIRMED',
      note:'驗收樣本',
      timeline:[
        {at:'2026-09-22T13:25:00+08:00',label:'已接單'},
        {at:'2026-09-22T13:27:00+08:00',label:'製作中'},
      ],
    },
    {
      orderId:'ORDER-ACCEPT-002',
      displayCode:'#A100',
      source:'自家客戶端',
      lifecycle:'COMPLETED',
      amountLabel:'HK$48.00',
      itemSummary:'肉燥便當 ×1',
      observedAt,
      readback:'PARTIAL',
      timeline:[
        {at:'2026-09-22T12:55:00+08:00',label:'已接單'},
        {at:'2026-09-22T13:10:00+08:00',label:'已完成'},
      ],
    },
  ],
  work:[
    {
      workId:'WORK-001',
      orderId:'ORDER-ACCEPT-001',
      displayCode:'#A101',
      kind:'DELAYED_ORDER',
      summary:'飯團位稍有延誤',
      eta:'約 8 分鐘',
      state:'DELAYED',
      observedAt,
    },
    {
      workId:'WORK-002',
      kind:'PRINT_ATTENTION',
      summary:'製作打印狀態待確認',
      state:'UNKNOWN',
      observedAt,
    },
  ],
  channels:[
    {channel:'Keeta',state:'DEGRADED',detail:'驗收樣本｜Provider readback 有延遲',observedAt},
    {channel:'Customer',state:'CONNECTED',detail:'驗收樣本｜資料已讀取',observedAt},
  ],
  dineSessions:[
    {sessionId:'DINE-001',tableLabel:'A1',covers:2,state:'OPEN',openedAt:'2026-09-22T13:10:00+08:00'},
  ],
  printHealth:[
    {logicalPrinterId:'RECEIPT',label:'收據打印機',state:'READY',detail:'驗收樣本｜正常',observedAt},
    {logicalPrinterId:'KITCHEN',label:'製作打印機',state:'UNKNOWN',detail:'驗收樣本｜最後 Job 未有讀回',observedAt},
  ],
  refundRequests:[
    {refundId:'RF-001',orderId:'ORDER-ACCEPT-002',displayCode:'#A100',source:'Customer',amountLabel:'HK$12.00',reason:'驗收樣本退款要求',state:'PENDING',observedAt},
  ],
  capacity:{state:'BUSY',label:'繁忙',detail:'驗收樣本｜預計等待時間上升',observedAt},
  reporting:{businessDate:'2026-09-22',orderCount:94,salesLabel:'HK$6,320.00',averageOrderLabel:'HK$67.20',freshness:'CURRENT',observedAt},
  staff:{actorId:'STAFF-ACCEPT',displayName:'驗收店員',roleLabel:'前線',storeId:'ACCEPTANCE-MF01',deviceLabel:'Browser Acceptance'},
  businessDay:{businessDate:'2026-09-22',state:'OPEN',observedAt,recordOnly:true},
  observedAt,
};

function quote(cart:readonly SmmCartLine[]){
  const totalMinor=cart.reduce((sum,line)=>sum+line.quantity*4800,0);
  return {
    quoteId:'ACCEPTANCE-QUOTE',
    revision:'ACCEPTANCE-ONLY',
    currency:'HKD',
    totalMinor,
    lines:cart.map(line=>({
      lineId:line.lineId,
      currency:'HKD',
      finalUnitPriceMinor:4800,
      lineTotalMinor:line.quantity*4800,
    })),
    observedAt,
  };
}

const port:SmmRuntimePort={
  portId:'MFK_SMM_PORT_V1',
  async readSnapshot(){return snapshot},
  async quoteCart(cart){return quote(cart)},
  async submitOrder(){return {state:'NOT_CONNECTED',message:'驗收環境：正式落單未接線，未建立任何正式訂單。'}},
  async readSubmission(){return {state:'UNKNOWN',message:'驗收環境：示範 UNKNOWN / Readback-first 狀態。'}},
  async setSellability(){return {state:'NOT_CONNECTED',message:'驗收環境：售罄操作未接線。'}},
  async createDineSession(){return {state:'NOT_CONNECTED',message:'驗收環境：開枱操作未接線。'}},
};

window.__MFK_SMM_PRODUCT_PORT__=port;
