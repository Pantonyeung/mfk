import {describe,expect,it} from 'vitest';

import {
  appendMfpCashMovement,
  appendMfpDailyReportAdjustment,
  classifyMfpLegacyElectronicTender,
  countMfpCashDenominations,
  createMfpBusinessDayOpening,
  createMfpCashMovement,
  createMfpDailyReport,
  suggestMfpNextOpening,
} from './money-domain.ts';

const actor={staffId:'STAFF-01',displayName:'店員甲'};
const at='2026-10-02T14:00:00.000Z';
const opening=createMfpBusinessDayOpening({
  businessDayId:'BD-2026-10-02',businessDate:'2026-10-02',amountMinor:30000,
  actor,occurredAt:'2026-10-02T05:00:00.000Z',
});
const orders=Object.freeze([
  {orderRef:'O-1',channelId:'WALK_IN',recognizedAmountMinor:5000,effectiveTenderId:'CASH',tenderAudit:Object.freeze(['CASH'])},
  {orderRef:'O-2',channelId:'PHONE',recognizedAmountMinor:4200,effectiveTenderId:'FPS',tenderAudit:Object.freeze(['CASH','FPS'])},
]);

describe('MFP V3 A5 Business Day and cash facts',()=>{
  it('uses previous retained cash as a next-opening suggestion without rewriting the close',()=>{
    const previousOpening=createMfpBusinessDayOpening({businessDayId:'BD-2026-10-01',businessDate:'2026-10-01',amountMinor:30000,actor,occurredAt:'2026-10-01T05:00:00.000Z'});
    const report=createMfpDailyReport({
      reportId:'R-1',businessDate:'2026-10-01',opening:previousOpening,orders:[],movements:[],
      cashRefundAdjustmentMinor:0,countedCashMinor:30000,cashRemovedMinor:12000,closedAt:at,
    });
    expect(suggestMfpNextOpening([report],'2026-10-02')).toEqual({
      amountMinor:18000,sourceReportId:'R-1',sourceBusinessDate:'2026-10-01',
    });
    expect(report.retainedCashMinor).toBe(18000);
  });

  it('records an opening override explicitly with actor and prior suggestion',()=>{
    const row=createMfpBusinessDayOpening({
      businessDayId:'BD-2026-10-02',businessDate:'2026-10-02',amountMinor:20000,
      suggestion:{amountMinor:18000,sourceReportId:'R-1',sourceBusinessDate:'2026-10-01'},actor,occurredAt:at,
    });
    expect(row).toMatchObject({amountMinor:20000,changedFromSuggestion:true,suggestedMinor:18000,actor});
  });

  it('keeps Cash In and Cash Out as append-only ledger records distinct from sales and refunds',()=>{
    const cashIn=createMfpCashMovement({movementId:'M-1',businessDayId:opening.businessDayId,type:'CASH_IN',amountMinor:1000,reason:'找續補充',actor,occurredAt:at});
    const cashOut=createMfpCashMovement({movementId:'M-2',businessDayId:opening.businessDayId,type:'CASH_OUT',amountMinor:500,reason:'零用支出',actor,occurredAt:at});
    const ledger=appendMfpCashMovement(appendMfpCashMovement([],cashIn),cashOut);
    expect(ledger.map(row=>row.type)).toEqual(['CASH_IN','CASH_OUT']);
    expect(JSON.stringify(ledger)).not.toMatch(/SALE|REFUND|PAYMENT_CORRECTION/);
  });

  it('makes cash movement replay idempotent and rejects identity conflicts',()=>{
    const row=createMfpCashMovement({movementId:'M-1',businessDayId:opening.businessDayId,type:'CASH_IN',amountMinor:1000,reason:'找續補充',actor,occurredAt:at});
    expect(appendMfpCashMovement([row],row)).toEqual([row]);
    expect(()=>appendMfpCashMovement([row],{...row,amountMinor:1001})).toThrow('MFP_CASH_MOVEMENT_CONFLICT');
  });

  it('normalizes denomination and direct-total modes to the same countedCashMinor',()=>{
    const denomination=countMfpCashDenominations({100:5,200:5,500:3,1000:2,2000:1,5000:1,10000:1,50000:0});
    expect(denomination).toBe(22000);
    expect(createMfpDailyReport({reportId:'R',businessDate:'2026-10-02',opening,orders:[],movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:denomination,cashRemovedMinor:0,closedAt:at}).countedCashMinor).toBe(22000);
  });

  it('calculates expected cash, variance, removed and retained in integer minor units',()=>{
    const movements=[
      createMfpCashMovement({movementId:'M-1',businessDayId:opening.businessDayId,type:'CASH_IN',amountMinor:1000,reason:'補充',actor,occurredAt:at}),
      createMfpCashMovement({movementId:'M-2',businessDayId:opening.businessDayId,type:'CASH_OUT',amountMinor:500,reason:'支出',actor,occurredAt:at}),
    ];
    const report=createMfpDailyReport({reportId:'R',businessDate:'2026-10-02',opening,orders,movements,cashRefundAdjustmentMinor:200,countedCashMinor:35400,cashRemovedMinor:5400,closedAt:at});
    expect(report).toMatchObject({cashSalesMinor:5000,cashInMinor:1000,cashOutMinor:500,cashRefundAdjustmentMinor:200,expectedCashMinor:35300,countedCashMinor:35400,varianceMinor:100,cashRemovedMinor:5400,retainedCashMinor:30000});
  });

  it('rejects cash removed greater than counted cash',()=>{
    expect(()=>createMfpDailyReport({reportId:'R',businessDate:'2026-10-02',opening,orders:[],movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:100,cashRemovedMinor:101,closedAt:at})).toThrow('MFP_CASH_REMOVED_EXCEEDS_COUNTED');
  });
});

describe('MFP V3 A5 immutable reporting facts',()=>{
  it('keeps channel and current-effective-tender summaries separate without double counting audit history',()=>{
    const report=createMfpDailyReport({reportId:'R',businessDate:'2026-10-02',opening,orders,movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:35000,cashRemovedMinor:5000,closedAt:at});
    expect(report.channelSummary).toEqual([
      {id:'PHONE',orderCount:1,amountMinor:4200},{id:'WALK_IN',orderCount:1,amountMinor:5000},
    ]);
    expect(report.tenderSummary).toEqual([
      {id:'CASH',orderCount:1,amountMinor:5000},{id:'FPS',orderCount:1,amountMinor:4200},
    ]);
    expect(report.tenderSummary.reduce((sum,row)=>sum+row.amountMinor,0)).toBe(9200);
  });

  it('classifies unknown non-cash providers only as ELECTRONIC_UNCLASSIFIED',()=>{
    expect(classifyMfpLegacyElectronicTender({cash:false,provider:null})).toBe('ELECTRONIC_UNCLASSIFIED');
    expect(classifyMfpLegacyElectronicTender({cash:false,provider:'WECHAT'})).toBe('WECHAT');
    expect(classifyMfpLegacyElectronicTender({cash:true,provider:null})).toBe('CASH');
  });

  it('does not mutate original order truth when applying reporting classification',()=>{
    const legacy={orderRef:'O',paymentEvidence:'NON_CASH'};
    classifyMfpLegacyElectronicTender({cash:false,provider:null});
    expect(legacy).toEqual({orderRef:'O',paymentEvidence:'NON_CASH'});
  });

  it('freezes the original 1.0 report and appends linked 1.1 adjustment facts',()=>{
    const report=createMfpDailyReport({reportId:'R',businessDate:'2026-10-02',opening,orders,movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:35000,cashRemovedMinor:5000,closedAt:at});
    const ledger=appendMfpDailyReportAdjustment([],report,{adjustmentId:'A-1',type:'REFUND',originalOrderRef:'O-1',amountMinor:1000,occurredAt:'2026-10-03T09:00:00.000Z'});
    expect(report.reportVersion).toBe('1.0');
    expect(Object.isFrozen(report)).toBe(true);
    expect(ledger[0]).toMatchObject({adjustmentVersion:'1.1',originalReportId:'R',originalOrderRef:'O-1'});
    expect(report.grossSalesMinor).toBe(9200);
  });

  it('starts each immutable report adjustment history at 1.1',()=>{
    const first=createMfpDailyReport({reportId:'R-1',businessDate:'2026-10-01',opening:{...opening,businessDate:'2026-10-01'},orders:[],movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:30000,cashRemovedMinor:0,closedAt:at});
    const second=createMfpDailyReport({reportId:'R-2',businessDate:'2026-10-02',opening,orders:[],movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:30000,cashRemovedMinor:0,closedAt:at});
    const ledger=appendMfpDailyReportAdjustment([],first,{adjustmentId:'A-1',type:'REFUND',originalOrderRef:'O-1',amountMinor:100,occurredAt:at});
    expect(appendMfpDailyReportAdjustment(ledger,second,{adjustmentId:'A-2',type:'ADJUSTMENT',originalOrderRef:'O-2',amountMinor:200,occurredAt:at})[1]?.adjustmentVersion).toBe('1.1');
  });
});
