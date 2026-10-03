import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';

import {MFP_DINING_TABLE_IDS,type MfpOrderOperationsReadModel} from './order-operations-domain.ts';
import {MfpOperationsNavigation,MfpOrderOperationsWorkspace} from './order-operations-workspace.tsx';
import type {MfpNormalizedOrderingIntent} from './ordering-domain.ts';

const model: MfpOrderOperationsReadModel={
  schema:'mfp.order-operations.read.v1',storeId:'MF01',revision:6,readAt:'2026-10-02T10:30:00+08:00',
  orders:[
    {orderId:'O1',displayNumber:'0030',source:'WALK_IN',createdAt:'2026-10-02T10:00:00+08:00',revision:2,fulfillmentState:'IN_PROGRESS',effectiveTenderId:'CASH',recognizedAmountMinor:6200,outstandingAmountMinor:0,refundableAmountMinor:6200,serviceMode:'TAKEAWAY',items:[{lineId:'L1',name:'海南雞飯團',quantity:1,unitMinor:6200}],adjustments:[]},
    {orderId:'O2',displayNumber:'K038',source:'KEETA',externalOrderNumber:'K038',createdAt:'2026-10-02T10:01:00+08:00',revision:3,fulfillmentState:'READY',effectiveTenderId:'FPS',recognizedAmountMinor:1800,outstandingAmountMinor:0,refundableAmountMinor:1800,serviceMode:'TAKEAWAY',items:[{lineId:'L2',name:'凍檸茶',quantity:1,unitMinor:1800}],adjustments:[]},
    {orderId:'O3',displayNumber:'A042',source:'MORE_FUN_APP',pickupCode:'A042',createdAt:'2026-10-02T10:02:00+08:00',revision:4,fulfillmentState:'IN_PROGRESS',effectiveTenderId:'CARD',recognizedAmountMinor:5000,outstandingAmountMinor:5000,refundableAmountMinor:5000,serviceMode:'DINE_IN',items:[{lineId:'L3',name:'紫米飯團',quantity:2,unitMinor:5000}],adjustments:[],dining:{tableId:'T01',partySize:2,seatedAt:'2026-10-02T09:30:00+08:00'}},
  ],
  dining:{revision:3,waiting:[{waitingId:'W1',displayNumber:'W012',partySize:3,createdAt:'2026-10-02T10:05:00+08:00',customerDisplayName:'陳小姐',orderId:'O3'},{waitingId:'W2',displayNumber:'W013',partySize:2,createdAt:'2026-10-02T10:06:00+08:00'}],tables:MFP_DINING_TABLE_IDS.map(tableId=>({tableId,label:tableId==='OUTDOOR'?'戶外':tableId,location:tableId==='OUTDOOR'?'OUTDOOR':'INDOOR',revision:1,state:tableId==='T01'?'OCCUPIED':'AVAILABLE',...(tableId==='T01'?{orderId:'O3',displayNumber:'A042',partySize:2,seatedAt:'2026-10-02T09:30:00+08:00'}:{})}))},
  availability:{revision:2,items:[{productId:'P1',name:'海南雞飯團',categoryId:'飯團',status:'AVAILABLE',riceGroupId:'飯團'},{productId:'P2',name:'紫米飯團',categoryId:'飯團',status:'SOLD_OUT',riceGroupId:'飯團'}]},
  capacity:{revision:2,pools:[{poolId:'POOL-RICE',name:'飯團',businessDayId:'BD1',businessDate:'2026-10-02',resetAt:'2026-10-03T05:00:00+08:00',revision:2,initialQuantity:100,usedQuantity:25,remainingQuantity:75,boundProductIds:['P1','P2'],consumptionByProduct:[{productId:'P1',quantity:25}],thirdPartyThreshold:20,ownPlatformThreshold:5,thirdPartyAccepting:true,ownPlatformAccepting:true,stoppedChannels:[],overrideRemaining:0,audit:[]}]},
  etaPolicy:{revision:1,workloadBands:[{minimumActive:0,etaMinutes:10}],diningWarningMinutes:45},
  todaySummary:{orderCount:3,recognizedAmountMinor:13000,source:'A5_CANONICAL_MONEY_READBACK'},
};

const props={model,tenders:[{id:'CASH',label:'現金',enabled:true}],operationStatus:'',onOperation:vi.fn(),onSplitCheckout:vi.fn(),onTool:vi.fn()};
const pendingIntent: MfpNormalizedOrderingIntent={schema:'mfp.ordering.intent.draft.v1',draftOnly:true,pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',serviceMode:'dine-in',checkoutReady:true,previewSubtotalMinor:6200,lines:[{cartLineId:'L-DRAFT',kind:'PRODUCT',productId:'P1',comboId:null,displayName:'海南雞飯團',note:'',quantity:1,serviceMode:'dine-in',optionSelections:[],comboSelections:[],materialPriceFacts:[{factId:'PRICE-1',amountMinor:6200,currency:'HKD',revision:1,role:'PRODUCT_BASE',sourceId:'P1'}],previewUnitMinor:6200,state:'READY',issues:[],sourceProjection:{storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:1,projectionHash:'HASH',appliedAt:'2026-10-02T10:00:00+08:00'}}]};

describe('MFP V3 A6 operational workspace',()=>{
  it('A6-55 keeps More as a route shell into existing Money / Reporting truth',()=>{
    const html=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="MORE" {...props}/>);
    expect(html).toContain('data-more-tools-shell="A6"');
    expect(html).toContain('日結');expect(html).toContain('報表');
    expect(html).toContain('尚未接駁');
  });

  it('A6-56 keeps Ordering, Orders, Dining and Sold-out in the primary touch navigation',()=>{
    const html=renderToStaticMarkup(<MfpOperationsNavigation surface="MFP_PAD" active="ORDERS" onNavigate={vi.fn()}/>);
    for(const label of ['待處理','點單','訂單','堂食','設定'])expect(html).toContain(label);
    expect(html).toContain('aria-current="page"');
  });

  it('A6-57 shares one order-operation contract while giving Mobile lane tabs instead of a shrunken Pad grid',()=>{
    const pad=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="ORDERS" {...props}/>);
    const mobile=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_MOBILE" page="ORDERS" {...props}/>);
    expect(pad).toContain('data-order-operations-contract="SHARED_PAD_MOBILE"');
    expect(pad).toContain('<h1>訂單</h1>');
    expect(mobile).toContain('data-order-operations-contract="SHARED_PAD_MOBILE"');
    expect(pad.match(/class="mfp-order-lane"/g)).toHaveLength(3);
    expect(mobile).toContain('role="tablist"');
    expect(mobile.match(/role="tab"/g)).toHaveLength(3);
  });

  it('renders Waiting, the 3 × 3 table registry, Sold-out and independent channel thresholds',()=>{
    const dining=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="DINING" {...props} pendingDiningIntent={pendingIntent}/>);
    const capacity=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="AVAILABILITY" {...props}/>);
    expect(dining).toContain('<h1>堂食</h1>');expect(dining).toContain('等位');expect(dining).toContain('3 × 3 枱位');expect(dining).toContain('戶外');
    expect(dining).toContain('正式開單到');expect(dining).toContain('落單到等位單 W013');
    expect(capacity).toContain('批次售罄');expect(capacity).toContain('批次恢復');
    expect(capacity).toContain('第三方平台');expect(capacity).toContain('自家平台');expect(capacity).toContain('有限加量');
  });

  it('extends the Owner visual lock with a separate More hamburger, left detail, blue panels and touch-first Mobile',()=>{
    const source=readFileSync(new URL('./order-operations-workspace.tsx',import.meta.url),'utf8');
    const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
    expect(source).toContain('PENDING');
    const orders=source.slice(source.indexOf('mfp-orders-layout'),source.indexOf('function SplitCheckoutPanel'));
    expect(orders.indexOf('<OrderDetail')).toBeLessThan(orders.indexOf('mfp-order-lanes'));
    expect(css).toContain('.mfp-application-runtime');expect(css).toContain('background:#087ee9');
    expect(css).toContain('.mfp-operations-nav-shell.mobile');expect(css).toContain('overflow-x:hidden');expect(css).toContain('min-height:50px');
  });
});

describe('A6 canonical tender eligibility at Order actions',()=>{
  const moneyActions=['更正付款','全額退款','部分退款'];
  const button=(html:string,label:string)=>html.match(new RegExp(`<button\\b[^>]*>${label}</button>`))?.[0]??'';

  it.each(['MFP_PAD','MFP_MOBILE'] as const)('does not infer enabled tenders from historical Orders when config is absent on %s',surface=>{
    const html=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface={surface} page="ORDERS" {...props} tenders={[]}/>);
    for(const label of moneyActions)expect(button(html,label)).toContain('disabled=""');
    expect(html).toContain('未有可用的正式付款方式');
    expect(html).toContain('CASH'); // Historical receipt/display/filter evidence stays visible.
    expect(button(html,'修改訂單')).not.toContain('disabled');
    expect(button(html,'標記可取餐')).not.toContain('disabled');
  });

  it('keeps disabled canonical tenders unavailable even when matching a historical Order',()=>{
    const html=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="ORDERS" {...props} tenders={[{id:'CASH',label:'現金',enabled:false}]}/>);
    for(const label of moneyActions)expect(button(html,label)).toContain('disabled=""');
  });

  it('preserves enabled configured tender actions without requiring a match to historical tender IDs',()=>{
    const html=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="ORDERS" {...props} tenders={[{id:'NEW-TENDER',label:'正式付款方式',enabled:true}]}/>);
    for(const label of moneyActions){expect(button(html,label)).not.toBe('');expect(button(html,label)).not.toContain('disabled');}
    expect(html).not.toContain('未有可用的正式付款方式');
  });
});
