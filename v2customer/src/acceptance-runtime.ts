import type {CustomerRuntimePort,CustomerReadModelSnapshot,CustomerCartLine} from './product-types';

const observedAt='2026-09-22T13:45:00+08:00';

const snapshot:CustomerReadModelSnapshot={
  store:{
    storeId:'ACCEPTANCE-MF01',
    storeName:'磨飯｜驗收樣本店',
    channelAvailable:true,
    etaLabel:'約 15–20 分鐘',
    notice:'ACCEPTANCE SAMPLE ONLY',
    observedAt,
  },
  menu:{
    revision:'ACCEPTANCE-CUSTOMER-R1',
    observedAt,
    categories:[
      {categoryId:'popular',name:'人氣',sortOrder:1},
      {categoryId:'rice',name:'飯團',sortOrder:2},
      {categoryId:'drink',name:'飲品',sortOrder:3},
    ],
    products:[
      {
        productId:'CP-001',
        categoryId:'popular',
        name:'驗收樣本｜招牌紫米飯團',
        description:'只供介面驗收；唔係正式商品資料。',
        badge:'人氣',
        available:true,
        displayPriceLabel:'HK$41 起',
        variationRequired:true,
        variations:[
          {variationId:'CV-NORMAL',name:'正常飯',available:true},
          {variationId:'CV-LESS',name:'少飯',available:true},
        ],
        optionGroups:[
          {
            optionGroupId:'CG-TOPPING',
            name:'加料',
            required:false,
            minSelections:0,
            maxSelections:2,
            options:[
              {optionId:'CO-EGG',name:'加蛋',available:true},
              {optionId:'CO-VEG',name:'加菜',available:true},
              {optionId:'CO-SAUCE',name:'加醬',available:true},
            ],
          },
        ],
      },
      {
        productId:'CP-002',
        categoryId:'rice',
        name:'驗收樣本｜雞肉飯團',
        description:'展示售罄狀態。',
        available:false,
        displayPriceLabel:'HK$43 起',
        optionGroups:[],
      },
      {
        productId:'CP-003',
        categoryId:'drink',
        name:'驗收樣本｜冷泡茶',
        description:'只供介面驗收。',
        available:true,
        displayPriceLabel:'HK$10',
        optionGroups:[],
      },
    ],
  },
  activeOrders:[
    {
      orderId:'CO-ACTIVE-001',
      displayCode:'C-A101',
      stage:'DELAYED',
      itemSummary:'招牌紫米飯團 ×1 · 冷泡茶 ×1',
      amountLabel:'HK$51.00',
      pickupCode:'4821',
      phoneMasked:'**** 2218',
      etaLabel:'更新：約 12 分鐘',
      handoverState:'NOT_ARRIVED',
      observedAt,
      readback:'CONFIRMED',
      timeline:[
        {at:'2026-09-22T13:20:00+08:00',stage:'RECEIVED',label:'已收到訂單'},
        {at:'2026-09-22T13:21:00+08:00',stage:'ACCEPTED',label:'店舖已接單'},
        {at:'2026-09-22T13:24:00+08:00',stage:'PREPARING',label:'製作中'},
        {at:'2026-09-22T13:35:00+08:00',stage:'DELAYED',label:'稍有延誤'},
      ],
    },
    {
      orderId:'CO-ACTIVE-002',
      displayCode:'C-A102',
      stage:'READY',
      itemSummary:'冷泡茶 ×2',
      amountLabel:'HK$20.00',
      pickupCode:'7734',
      phoneMasked:'**** 6632',
      etaLabel:'可以取餐',
      handoverState:'ARRIVED',
      observedAt,
      readback:'PARTIAL',
      timeline:[
        {at:'2026-09-22T13:05:00+08:00',stage:'RECEIVED',label:'已收到訂單'},
        {at:'2026-09-22T13:06:00+08:00',stage:'ACCEPTED',label:'店舖已接單'},
        {at:'2026-09-22T13:12:00+08:00',stage:'READY',label:'可取餐'},
      ],
    },
  ],
  history:[
    {
      orderId:'CO-HISTORY-001',
      displayCode:'C-099',
      completedAt:'2026-09-21T20:10:00+08:00',
      itemSummary:'招牌紫米飯團 ×1 · 冷泡茶 ×1',
      amountLabel:'HK$51.00',
      reorderEligible:true,
    },
    {
      orderId:'CO-HISTORY-002',
      displayCode:'C-098',
      completedAt:'2026-09-20T19:30:00+08:00',
      itemSummary:'冷泡茶 ×2',
      amountLabel:'HK$20.00',
      reorderEligible:true,
    },
  ],
  observedAt,
};

function quote(cart:readonly CustomerCartLine[]){
  const totalMinor=cart.reduce((sum,line)=>sum+line.quantity*4100,0);
  return {
    quoteId:'ACCEPTANCE-CUSTOMER-QUOTE',
    revision:'ACCEPTANCE-ONLY',
    currency:'HKD',
    totalMinor,
    observedAt,
    freshness:'CURRENT' as const,
  };
}

const port:CustomerRuntimePort={
  portId:'MFK_CUSTOMER_PORT_V1',
  async readSnapshot(){return snapshot},
  async quoteCart(cart){return quote(cart)},
  async submitOrder(){return {state:'NOT_CONNECTED',message:'驗收環境：正式 Customer→SMT 提交未接線。'}},
  async readSubmission(){return {state:'UNKNOWN',message:'驗收環境：示範 UNKNOWN / Readback-first 狀態。'}},
  async buildReorderCart(){
    return {
      state:'CONFIRMED',
      message:'驗收環境：已按目前樣本商品重建購物籃。',
      cart:[
        {
          lineId:crypto.randomUUID(),
          productId:'CP-001',
          productName:'驗收樣本｜招牌紫米飯團',
          quantity:1,
          selections:[],
          createdAt:observedAt,
          attention:'驗收樣本：重新下單前仍需正式 Quote / Sellability 驗證。',
        },
      ],
      attention:['重新驗證價格','重新驗證供應狀態'],
    };
  },
  async requestFallback(){return {state:'NOT_CONNECTED',message:'驗收環境：備用聯絡入口未接線。'}},
};

window.__MFK_CUSTOMER_PRODUCT_PORT__=port;
