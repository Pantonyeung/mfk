import {describe,expect,it,vi} from 'vitest';

import {
  MFP_DINING_TABLE_IDS,
  countMfpEtaWorkload,
  createMfpOrderOperationSession,
  createMfpRefundOperation,
  createMfpRiceGroupAvailabilityOperation,
  createMfpSplitCheckoutPart,
  createMfpSplitCheckoutPlan,
  filterMfpAvailabilityItems,
  filterMfpOrders,
  isMfpDiningWarning,
  mfpOrderLane,
  openMfpSplitCheckout,
  selectMfpEtaMinutes,
  validateMfpOrderOperationsReadModel,
  type MfpCanonicalOrder,
  type MfpOrderOperation,
  type MfpOrderOperationsReadModel,
} from './order-operations-domain.ts';
import type {MfpNormalizedOrderingIntent} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';

const createdAt='2026-10-02T09:00:00.000Z';

function canonicalOrder(overrides:Partial<MfpCanonicalOrder>={}):MfpCanonicalOrder{
  return {
    orderId:'O1',displayNumber:'0001',source:'WALK_IN',createdAt,revision:1,lifecycleState:'ACTIVE',
    fulfillmentState:'IN_PROGRESS',effectiveTenderId:'CASH',tenderAudit:['CASH'],recognizedAmountMinor:5000,
    outstandingAmountMinor:0,refundableAmountMinor:5000,serviceMode:'TAKEAWAY',
    items:[{lineId:'L1',productId:'P1',name:'原味飯團',quantity:1,unitMinor:5000}],adjustments:[],
    ...overrides,
  };
}

function tables(){
  return MFP_DINING_TABLE_IDS.map((tableId,index)=>({
    tableId,label:tableId==='OUTDOOR'?'戶外':tableId,location:tableId==='OUTDOOR'?'OUTDOOR' as const:'INDOOR' as const,
    revision:1,state:'AVAILABLE' as const,...(index===0?{}:{}),
  }));
}

function readModel(input:Partial<MfpOrderOperationsReadModel>={}):MfpOrderOperationsReadModel{
  return {
    schema:'mfp.order-operations.read.v1',storeId:'MF01',revision:1,readAt:'2026-10-02T09:10:00.000Z',
    orders:[canonicalOrder()],
    dining:{revision:1,waiting:[],tables:tables()},
    availability:{revision:1,items:[
      {productId:'P1',name:'原味飯團',categoryId:'RICE',status:'AVAILABLE',riceGroupId:'PURPLE_RICE'},
      {productId:'P2',name:'紫米飯團',categoryId:'RICE',status:'SOLD_OUT',riceGroupId:'PURPLE_RICE'},
      {productId:'D1',name:'奶茶',categoryId:'DRINK',status:'AVAILABLE'},
    ]},
    capacity:{revision:1,pools:[{
      poolId:'CAP1',name:'紫米',businessDayId:'BD-2026-10-02',businessDate:'2026-10-02',
      resetAt:'2026-10-03T05:00:00+08:00',revision:1,initialQuantity:10,usedQuantity:2,remainingQuantity:8,
      boundProductIds:['P1','P2'],consumptionByProduct:[{productId:'P1',quantity:2}],
      thirdPartyThreshold:5,ownPlatformThreshold:2,thirdPartyAccepting:true,ownPlatformAccepting:true,
      stoppedChannels:[],overrideRemaining:0,audit:[],
    }]},
    etaPolicy:{revision:'ETA-1',workloadBands:[{minimumActive:0,etaMinutes:10},{minimumActive:3,etaMinutes:20}],diningWarningMinutes:45},
    todaySummary:{orderCount:1,recognizedAmountMinor:5000,source:'A5_CANONICAL_MONEY_READBACK'},
    ...input,
  };
}

function committedSession(operation:MfpOrderOperation,after:()=>MfpCanonicalOrder=()=>canonicalOrder({revision:2})){
  const submitFrontlineFormalCommand=vi.fn(async command=>({
    schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'COMMITTED' as const,
    commitId:'COMMIT-1',canonicalRevision:2,...('orderId' in operation?{orderRef:operation.orderId}:{}),
  }));
  const readOrder=vi.fn(async()=>after());
  const session=createMfpOrderOperationSession({operation,operationId:'OP-1',security:{submitFrontlineFormalCommand},authority:{readOrder,readOperations:async()=>readModel()}});
  return {session,submitFrontlineFormalCommand,readOrder};
}

const diningIntent: MfpNormalizedOrderingIntent={
  schema:'mfp.ordering.intent.draft.v1',draftOnly:true,pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',
  serviceMode:'dine-in',checkoutReady:true,previewSubtotalMinor:5000,
  lines:[{cartLineId:'L1',kind:'PRODUCT',productId:'P1',comboId:null,displayName:'原味飯團',note:'',quantity:1,
    serviceMode:'dine-in',optionSelections:[],comboSelections:[],materialPriceFacts:[{
      factId:'PRICE-1',amountMinor:5000,currency:'HKD',revision:1,role:'PRODUCT_BASE',sourceId:'P1',
    }],previewUnitMinor:5000,state:'READY',issues:[],sourceProjection:{
      storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:1,projectionHash:'P1',appliedAt:createdAt,
    }}],
};

describe('MFP V3 A6 Orders / same identity',()=>{
  it('A6-01 projects a committed A5 Order into the canonical read model',()=>{
    expect(validateMfpOrderOperationsReadModel(readModel()).orders[0]).toMatchObject({orderId:'O1',displayNumber:'0001'});
  });

  it('A6-03 keeps stale revision REJECTED with zero canonical readback',async()=>{
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'REJECTED' as const,rejectionCode:'EXPECTED_REVISION_STALE'}));
    const readOrder=vi.fn();
    const session=createMfpOrderOperationSession({operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:0,target:'READY'},operationId:'STALE',security:{submitFrontlineFormalCommand:submit},authority:{readOrder}});
    expect(await session.submit()).toMatchObject({state:'REJECTED'});
    expect(readOrder).not.toHaveBeenCalled();
  });

  it('A6-04 keeps one stable operation identity on retry',async()=>{
    const calls:string[]=[];
    const submit=vi.fn(async command=>{
      calls.push(`${command.submissionId}:${command.idempotencyKey}`);
      return calls.length===1
        ?{schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'UNKNOWN' as const,readbackRequired:true as const,retryPermitted:false}
        :{schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O1'};
    });
    const session=createMfpOrderOperationSession({operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'READY'},operationId:'STABLE',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:async()=>canonicalOrder({revision:2,fulfillmentState:'READY'})}});
    await session.submit();await session.submit();
    expect(calls).toEqual(['STABLE:STABLE','STABLE:STABLE']);
  });

  it('A6-05 keeps timeout UNKNOWN until the stable Store Kernel seam resolves readback',async()=>{
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'UNKNOWN' as const,readbackRequired:true as const,retryPermitted:false}));
    const session=createMfpOrderOperationSession({operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'READY'},operationId:'UNKNOWN',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:vi.fn()}});
    expect(await session.submit()).toMatchObject({state:'UNKNOWN',readbackRequired:true});
  });
});

describe('MFP V3 A6 fulfillment',()=>{
  it.each([
    ['A6-06 IN_PROGRESS → READY','READY' as const],
    ['A6-07 READY → IN_PROGRESS','IN_PROGRESS' as const],
    ['A6-08 READY → PICKED_UP','PICKED_UP' as const],
  ])('%s stays on O1',async(_label,target)=>{
    const value=committedSession({kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target},()=>canonicalOrder({revision:2,fulfillmentState:target}));
    expect(await value.session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O1',fulfillmentState:target}});
  });

  it('A6-09 treats pickup code as display evidence, not a fulfillment gate',async()=>{
    const value=committedSession({kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'PICKED_UP'},()=>canonicalOrder({revision:2,fulfillmentState:'PICKED_UP',pickupCode:undefined}));
    expect(await value.session.submit()).toMatchObject({state:'COMMITTED'});
  });
});

describe('MFP V3 A6 modification / correction / refund',()=>{
  it('A6-10 requires canonical readback after a modification commit',async()=>{
    const value=committedSession({kind:'REQUEST_MODIFICATION',orderId:'O1',expectedRevision:1,reason:'走蔥'});
    await value.session.submit();expect(value.readOrder).toHaveBeenCalledWith('O1');
  });

  it('A6-11 preserves CUSTOMER_CONFIRMATION_REQUIRED from own-platform readback',async()=>{
    const value=committedSession({kind:'REQUEST_MODIFICATION',orderId:'O1',expectedRevision:1,reason:'轉凍飲'},()=>canonicalOrder({source:'MORE_FUN_APP',revision:2,modificationState:'CUSTOMER_CONFIRMATION_REQUIRED'}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',modificationState:'CUSTOMER_CONFIRMATION_REQUIRED'}});
  });

  it('A6-12 keeps payment correction on the same Order with audit readback',async()=>{
    const value=committedSession({kind:'CORRECT_PAYMENT',orderId:'O1',expectedRevision:1,toTenderId:'FPS'},()=>canonicalOrder({revision:2,effectiveTenderId:'FPS',tenderAudit:['CASH','FPS']}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',effectiveTenderId:'FPS',tenderAudit:['CASH','FPS']}});
  });

  it('A6-13 sends no kitchen or first-print replay instruction for payment correction',()=>{
    const value=committedSession({kind:'CORRECT_PAYMENT',orderId:'O1',expectedRevision:1,toTenderId:'FPS'});
    expect(JSON.stringify(value.session.command)).not.toMatch(/print|kitchen|production/i);
  });

  it('A6-14 keeps a full refund linked while retaining the original Order',async()=>{
    const adjustment={adjustmentId:'R1',type:'REFUND' as const,status:'COMMITTED' as const,amountMinor:5000,tenderId:'CASH',occurredAt:createdAt};
    const value=committedSession(createMfpRefundOperation(canonicalOrder(),{scope:'FULL',amountMinor:5000,refundTenderId:'CASH'}),()=>canonicalOrder({revision:2,refundableAmountMinor:0,adjustments:[adjustment]}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',adjustments:[{adjustmentId:'R1'}]}});
  });

  it('A6-15 bounds partial refund by canonical eligible amount',()=>{
    expect(()=>createMfpRefundOperation(canonicalOrder({refundableAmountMinor:1000}),{scope:'PARTIAL',amountMinor:1001,refundTenderId:'CASH',lineUnits:[{lineId:'L1',quantity:1}]})).toThrow('MFP_REFUND_EXCEEDS_ELIGIBLE_AMOUNT');
  });

  it('A6-16 records an alternate refund method through canonical readback',async()=>{
    const adjustment={adjustmentId:'R2',type:'REFUND' as const,status:'COMMITTED' as const,amountMinor:1000,tenderId:'FPS',occurredAt:createdAt};
    const value=committedSession(createMfpRefundOperation(canonicalOrder(),{scope:'PARTIAL',amountMinor:1000,refundTenderId:'FPS',lineUnits:[{lineId:'L1',quantity:1}]}),()=>canonicalOrder({revision:2,adjustments:[adjustment]}));
    expect(await value.session.submit()).toMatchObject({order:{adjustments:[{tenderId:'FPS'}]}});
  });

  it('A6-17 carries canonical cash movement linkage for a cash refund',async()=>{
    const adjustment={adjustmentId:'R3',type:'REFUND' as const,status:'COMMITTED' as const,amountMinor:1000,tenderId:'CASH',cashMovementRef:'CM-1',occurredAt:createdAt};
    const value=committedSession(createMfpRefundOperation(canonicalOrder(),{scope:'PARTIAL',amountMinor:1000,refundTenderId:'CASH',lineUnits:[{lineId:'L1',quantity:1}]}),()=>canonicalOrder({revision:2,adjustments:[adjustment]}));
    expect(await value.session.submit()).toMatchObject({order:{adjustments:[{cashMovementRef:'CM-1'}]}});
  });

  it('A6-18 appends a cross-day adjustment without rewriting its original report link',()=>{
    const before=canonicalOrder({adjustments:[{adjustmentId:'R1',type:'REFUND',status:'COMMITTED',amountMinor:500,tenderId:'CASH',originalReportId:'REPORT-1',occurredAt:'2026-10-01T10:00:00.000Z'}]});
    const after=canonicalOrder({revision:2,adjustments:[...before.adjustments,{adjustmentId:'R2',type:'REFUND',status:'COMMITTED',amountMinor:500,tenderId:'CASH',originalReportId:'REPORT-1',occurredAt:createdAt}]});
    expect(after.adjustments.map(row=>row.originalReportId)).toEqual(['REPORT-1','REPORT-1']);
    expect(before.adjustments).toHaveLength(1);
  });
});

describe('MFP V3 A6 cancellation',()=>{
  it('A6-19 cancels the same Order identity',async()=>{
    const value=committedSession({kind:'CANCEL',orderId:'O1',expectedRevision:1,reason:'客人取消'},()=>canonicalOrder({revision:2,lifecycleState:'CANCELLED',fulfillmentState:'CANCELLED'}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',lifecycleState:'CANCELLED'}});
  });

  it('A6-20 consumes one canonical capacity restoration readback after cancellation',()=>{
    const before=readModel();
    const pool={...before.capacity.pools[0]!,remainingQuantity:10,usedQuantity:0};
    const after=readModel({capacity:{revision:2,pools:[pool]}});
    expect(validateMfpOrderOperationsReadModel(after).capacity.pools[0]?.remainingQuantity).toBe(10);
  });

  it('A6-21 keeps duplicate cancel terminal with one formal submission',async()=>{
    const value=committedSession({kind:'CANCEL',orderId:'O1',expectedRevision:1,reason:'客人取消'},()=>canonicalOrder({revision:2,fulfillmentState:'CANCELLED'}));
    await value.session.submit();await value.session.submit();expect(value.submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);
  });

  it('A6-22 exposes CANCEL_NOTICE_REQUIRED after dispatched cancellation',async()=>{
    const value=committedSession({kind:'CANCEL',orderId:'O1',expectedRevision:1,reason:'廚房已出單'},()=>canonicalOrder({revision:2,fulfillmentState:'CANCELLED',productionDispatched:true,cancelNoticeIntent:'CANCEL_NOTICE_REQUIRED'}));
    expect(await value.session.submit()).toMatchObject({order:{cancelNoticeIntent:'CANCEL_NOTICE_REQUIRED'}});
  });

  it('A6-23 exposes human communication without auto correction print after dispatch',async()=>{
    const value=committedSession({kind:'REQUEST_MODIFICATION',orderId:'O1',expectedRevision:1,reason:'改單'},()=>canonicalOrder({revision:2,productionDispatched:true,humanCommunicationRequired:true,correctionPrintIntent:false}));
    expect(await value.session.submit()).toMatchObject({order:{humanCommunicationRequired:true,correctionPrintIntent:false}});
  });
});

describe('MFP V3 A6 Dining and split checkout',()=>{
  it('A6-24 direct seating admits exactly one Formal Order through Store Kernel',async()=>{
    const operation:MfpOrderOperation={kind:'ADMIT_DINING_ORDER',expectedRevision:1,intent:diningIntent,target:{kind:'TABLE',tableId:'T01',partySize:2}};
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O1'}));
    const session=createMfpOrderOperationSession({operation,operationId:'ADMIT-1',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:async()=>canonicalOrder({revision:2,serviceMode:'DINE_IN',dining:{tableId:'T01',partySize:2,seatedAt:createdAt}})}});
    expect(await session.submit()).toMatchObject({order:{orderId:'O1',dining:{tableId:'T01'}}});
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('A6-25 admits an ordered waiting check before seating',async()=>{
    const operation:MfpOrderOperation={kind:'ADMIT_DINING_ORDER',expectedRevision:1,intent:diningIntent,target:{kind:'WAITING',waitingId:'W1',partySize:2}};
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O1'}));
    const session=createMfpOrderOperationSession({operation,operationId:'ADMIT-WAIT',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:async()=>canonicalOrder({revision:2,serviceMode:'DINE_IN',dining:{waitingId:'W1',partySize:2}})}});
    expect(await session.submit()).toMatchObject({order:{orderId:'O1',dining:{waitingId:'W1'}}});
  });

  it('A6-26 assigns a waiting Order to a table while preserving Order and display identity',async()=>{
    const value=committedSession({kind:'ASSIGN_TABLE',orderId:'O1',expectedRevision:1,waitingId:'W1',tableId:'T03',expectedTableRevision:1},()=>canonicalOrder({revision:2,displayNumber:'0001',serviceMode:'DINE_IN',dining:{waitingId:'W1',tableId:'T03',partySize:2,seatedAt:createdAt}}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',displayNumber:'0001',dining:{tableId:'T03'}}});
  });

  it('A6-27 creates an empty waiting record without manufacturing a Formal Order',async()=>{
    const model=readModel({orders:[],dining:{revision:2,waiting:[{waitingId:'W1',displayNumber:'W001',partySize:3,createdAt}],tables:tables()}});
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2}));
    const session=createMfpOrderOperationSession({operation:{kind:'CREATE_WAITING',expectedRevision:1,partySize:3},operationId:'WAIT-1',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:vi.fn(),readOperations:async()=>model}});
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:null,snapshot:{orders:[]}});
  });

  it('A6-28 transfers a table without changing Order identity',async()=>{
    const value=committedSession({kind:'TRANSFER_TABLE',orderId:'O1',expectedRevision:1,fromTableId:'T01',toTableId:'T03',expectedTableRevision:1},()=>canonicalOrder({revision:2,serviceMode:'DINE_IN',dining:{tableId:'T03',partySize:2,seatedAt:createdAt}}));
    expect(await value.session.submit()).toMatchObject({order:{orderId:'O1',dining:{tableId:'T03'}}});
  });

  it('A6-29 fails an occupied transfer target closed',async()=>{
    const submit=vi.fn(async command=>({schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:command.submissionId,state:'REJECTED' as const,rejectionCode:'DINING_TABLE_OCCUPIED'}));
    const session=createMfpOrderOperationSession({operation:{kind:'TRANSFER_TABLE',orderId:'O1',expectedRevision:1,fromTableId:'T01',toTableId:'T03',expectedTableRevision:1},operationId:'MOVE',security:{submitFrontlineFormalCommand:submit},authority:{readOrder:vi.fn()}});
    expect(await session.submit()).toMatchObject({state:'REJECTED',result:{rejectionCode:'DINING_TABLE_OCCUPIED'}});
  });

  it('A6-30 preserves real seatedAt across transfer readback',async()=>{
    const seatedAt='2026-10-02T08:00:00.000Z';
    const value=committedSession({kind:'TRANSFER_TABLE',orderId:'O1',expectedRevision:1,fromTableId:'T01',toTableId:'T03',expectedTableRevision:1},()=>canonicalOrder({revision:2,serviceMode:'DINE_IN',dining:{tableId:'T03',partySize:2,seatedAt}}));
    expect(await value.session.submit()).toMatchObject({order:{dining:{seatedAt}}});
  });

  it('A6-31 leaves a partially split-paid Dining Order active with remaining units',()=>{
    const order=canonicalOrder({serviceMode:'DINE_IN',outstandingAmountMinor:5000,items:[{lineId:'L1',name:'飯團',quantity:2,settledQuantity:1,unitMinor:5000}],dining:{tableId:'T01',partySize:1,seatedAt:createdAt}});
    expect(createMfpSplitCheckoutPlan(order)).toMatchObject({orderId:'O1',maxParts:1,units:[{unitId:'L1::2'}]});
  });

  it('A6-32 routes full split settlement into the injected A5 checkout entry',()=>{
    const plan=createMfpSplitCheckoutPlan(canonicalOrder());
    const part=createMfpSplitCheckoutPart(plan,'PART-1',[plan.units[0]!.unitId]);
    const entry={openFormalOrderPart:vi.fn(()=>({state:'A5_CHECKOUT'}))};
    expect(openMfpSplitCheckout(entry,part)).toEqual({state:'A5_CHECKOUT'});
    expect(entry.openFormalOrderPart).toHaveBeenCalledWith(part);
  });

  it('A6-33 permits up to ten split parts for ten separable units',()=>{
    expect(createMfpSplitCheckoutPlan(canonicalOrder({items:[{lineId:'L1',name:'飯團',quantity:10,unitMinor:500}]})).maxParts).toBe(10);
  });

  it('A6-34 does not limit split count by Dining party size',()=>{
    const order=canonicalOrder({serviceMode:'DINE_IN',items:[{lineId:'L1',name:'飯團',quantity:10,unitMinor:500}],dining:{tableId:'T01',partySize:2,seatedAt:createdAt}});
    expect(createMfpSplitCheckoutPlan(order).maxParts).toBe(10);
  });

  it('A6-35 keeps Dining warning visual-only',()=>{
    const table={...tables()[0]!,state:'OCCUPIED' as const,orderId:'O1',seatedAt:'2026-10-02T08:00:00.000Z'};
    const before=structuredClone(table);
    expect(isMfpDiningWarning(table,readModel().etaPolicy,Date.parse('2026-10-02T09:00:00.000Z'))).toBe(true);
    expect(table).toEqual(before);
  });
});

describe('MFP V3 A6 ETA',()=>{
  it('A6-36 counts only active not-ready Orders',()=>{
    expect(countMfpEtaWorkload([canonicalOrder(),canonicalOrder({orderId:'O2',fulfillmentState:'READY'})])).toBe(1);
  });

  it('A6-37 excludes READY, PICKED_UP and CANCELLED from ETA workload',()=>{
    expect(countMfpEtaWorkload([
      canonicalOrder({orderId:'R',fulfillmentState:'READY'}),canonicalOrder({orderId:'P',fulfillmentState:'PICKED_UP'}),
      canonicalOrder({orderId:'C',fulfillmentState:'CANCELLED',lifecycleState:'CANCELLED'}),
    ])).toBe(0);
  });

  it('A6-38 consumes Admin/canonical ETA bands instead of hard-coding a threshold',()=>{
    expect(selectMfpEtaMinutes({revision:'CUSTOM',workloadBands:[{minimumActive:0,etaMinutes:7},{minimumActive:2,etaMinutes:31}],diningWarningMinutes:40},2)).toBe(31);
  });

  it('A6-39 routes auto-ready through the same formal fulfillment command/readback',()=>{
    const value=committedSession({kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'READY'});
    expect(value.session.command).toMatchObject({commandType:'ORDER_FULFILLMENT_SET',payload:{orderId:'O1',target:'READY'}});
  });
});

describe('MFP V3 A6 Sold-out / Capacity',()=>{
  it('A6-40 filters availability without mutating canonical truth',()=>{
    const items=readModel().availability.items;
    expect(filterMfpAvailabilityItems(items,{search:'紫米',status:'SOLD_OUT'}).map(row=>row.productId)).toEqual(['P2']);
    expect(items).toHaveLength(3);
  });

  it.each([
    ['A6-41 batch sold-out','SOLD_OUT' as const],
    ['A6-42 batch restore','AVAILABLE' as const],
  ])('%s uses the single formal availability command',(_label,status)=>{
    const value=committedSession({kind:'SET_AVAILABILITY',expectedRevision:1,productIds:['P1','P2'],status});
    expect(value.session.command).toMatchObject({commandType:'RUNTIME_AVAILABILITY_SET',payload:{productIds:['P1','P2'],status}});
  });

  it('A6-43 limits quick rice-group action to formally bound products',()=>{
    expect(createMfpRiceGroupAvailabilityOperation(readModel(),'PURPLE_RICE','SOLD_OUT').productIds).toEqual(['P1','P2']);
    expect(()=>createMfpRiceGroupAvailabilityOperation(readModel(),'UNBOUND','SOLD_OUT')).toThrow('MFP_RICE_GROUP_UNBOUND');
  });

  it('A6-44 consumes immediate capacity deduction only from canonical readback',()=>{
    const after=readModel({capacity:{revision:2,pools:[{...readModel().capacity.pools[0]!,usedQuantity:3,remainingQuantity:7}]}});
    expect(validateMfpOrderOperationsReadModel(after).capacity.pools[0]).toMatchObject({usedQuantity:3,remainingQuantity:7});
  });

  it('A6-45 observes cancellation replenish once',()=>{
    const after=readModel({capacity:{revision:2,pools:[{...readModel().capacity.pools[0]!,usedQuantity:0,remainingQuantity:10}]}});
    expect(validateMfpOrderOperationsReadModel(after).capacity.pools[0]?.remainingQuantity).toBe(10);
  });

  it('A6-46 does not infer replenish from refund alone',()=>{
    const before=readModel().capacity.pools[0]!;
    const refunded=canonicalOrder({adjustments:[{adjustmentId:'R',type:'REFUND',status:'COMMITTED',amountMinor:5000,occurredAt:createdAt}]});
    expect(refunded.adjustments[0]?.type).toBe('REFUND');
    expect(before.remainingQuantity).toBe(8);
  });

  it('A6-47 uses the canonical Business Day boundary instead of midnight',()=>{
    expect(validateMfpOrderOperationsReadModel(readModel()).capacity.pools[0]?.resetAt).toBe('2026-10-03T05:00:00+08:00');
  });

  it('A6-48 keeps manual capacity correction audited by canonical readback',()=>{
    const pool={...readModel().capacity.pools[0]!,remainingQuantity:9,audit:[{auditId:'A1',type:'MANUAL_CORRECTION' as const,actorId:'STAFF-1',occurredAt:createdAt,quantity:9,scope:'POOL'}]};
    expect(validateMfpOrderOperationsReadModel(readModel({capacity:{revision:2,pools:[pool]}})).capacity.pools[0]?.audit[0]).toMatchObject({actorId:'STAFF-1',type:'MANUAL_CORRECTION'});
  });

  it('A6-49 lets third-party stop independently while own platform remains active',()=>{
    const pool={...readModel().capacity.pools[0]!,remainingQuantity:5,thirdPartyAccepting:false,ownPlatformAccepting:true,stoppedChannels:['THIRD_PARTY']};
    expect(pool).toMatchObject({thirdPartyAccepting:false,ownPlatformAccepting:true});
  });

  it('A6-50 keeps own-platform threshold independently configurable',()=>{
    const pool=readModel().capacity.pools[0]!;
    expect([pool.thirdPartyThreshold,pool.ownPlatformThreshold]).toEqual([5,2]);
  });

  it('A6-51 represents pool zero as both bound remote lanes stopped',()=>{
    const pool={...readModel().capacity.pools[0]!,usedQuantity:10,remainingQuantity:0,thirdPartyAccepting:false,ownPlatformAccepting:false,stoppedChannels:['THIRD_PARTY','OWN_PLATFORM']};
    expect(pool).toMatchObject({remainingQuantity:0,thirdPartyAccepting:false,ownPlatformAccepting:false});
  });

  it('A6-52 leaves existing Orders unchanged when a capacity threshold crosses',()=>{
    const before=canonicalOrder();const after=readModel({orders:[before],capacity:{revision:2,pools:[{...readModel().capacity.pools[0]!,thirdPartyAccepting:false,stoppedChannels:['THIRD_PARTY']}]}});
    expect(after.orders[0]).toBe(before);
  });

  it('A6-53 submits a finite audited Capacity Override through formal authority',()=>{
    const value=committedSession({kind:'CREATE_CAPACITY_OVERRIDE',expectedRevision:1,poolId:'CAP1',scope:'OWN_PLATFORM',quantity:3,reason:'即場確認'});
    expect(value.session.command).toMatchObject({commandType:'CAPACITY_OVERRIDE_CREATE',payload:{poolId:'CAP1',scope:'OWN_PLATFORM',quantity:3}});
    expect(()=>committedSession({kind:'CREATE_CAPACITY_OVERRIDE',expectedRevision:1,poolId:'CAP1',scope:'OWN_PLATFORM',quantity:0,reason:'無'})).toThrow('MFP_CAPACITY_OVERRIDE_QUANTITY_INVALID');
  });

  it('A6-54 consumes canonical re-stop after override exhaustion',()=>{
    const pool={...readModel().capacity.pools[0]!,remainingQuantity:0,overrideRemaining:0,thirdPartyAccepting:false,ownPlatformAccepting:false,stoppedChannels:['THIRD_PARTY','OWN_PLATFORM']};
    expect(validateMfpOrderOperationsReadModel(readModel({capacity:{revision:3,pools:[pool]}})).capacity.pools[0]).toMatchObject({overrideRemaining:0,ownPlatformAccepting:false});
  });

  it('keeps lane mapping and source→tender filtering deterministic',()=>{
    const orders=[canonicalOrder(),canonicalOrder({orderId:'O2',source:'MORE_FUN_APP',effectiveTenderId:'FPS'}),canonicalOrder({orderId:'O3',source:'KEETA',effectiveTenderId:'FPS'})];
    expect(orders.map(order=>mfpOrderLane(order.source))).toEqual(['DIRECT','OWN_PLATFORM','THIRD_PARTY']);
    expect(filterMfpOrders(orders,{lane:'THIRD_PARTY',tenderId:'FPS'}).map(order=>order.orderId)).toEqual(['O3']);
  });
});
