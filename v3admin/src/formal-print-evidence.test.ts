import {describe,expect,it} from 'vitest';
import {projectVerifiedPrintEvidence} from './formal-print-pages.tsx';
import type {V3ProjectedOrder} from './formal-read-model.tsx';

function order(input:Partial<V3ProjectedOrder>&Pick<V3ProjectedOrder,'orderId'|'display'>):V3ProjectedOrder{
  return{
    orderId:input.orderId,
    display:input.display,
    createdAt:input.createdAt??'2026-10-01T03:00:00.000Z',
    updatedAt:input.updatedAt??'2026-10-01T03:02:00.000Z',
    businessDate:input.businessDate??'2026-10-01',
    totalMinor:input.totalMinor??6800,
    paymentLabel:input.paymentLabel??'未收款',
    fulfillmentLabel:input.fulfillmentLabel??'進行中',
    sourceLabel:input.sourceLabel??'堂食',
    items:input.items??[],
    ...(input.printEvidence?{printEvidence:input.printEvidence}:{}),
  };
}

describe('Admin V3 verified print evidence projection',()=>{
  it('shows only orders carrying verified SMT print evidence',()=>{
    const rows=projectVerifiedPrintEvidence([
      order({orderId:'O-NONE',display:'001'}),
      order({
        orderId:'O-PRINT',
        display:'002',
        printEvidence:{
          scope:'DINING_INITIAL',
          certainty:'TRANSPORT_ONLY',
          attemptedAt:'2026-10-01T03:01:00.000Z',
          state:'DONE',
          planned:2,
          sent:2,
          failed:0,
          results:[
            {jobId:'O-PRINT:production',role:'製作單',ok:true,code:'SENT'},
            {jobId:'O-PRINT:packing',role:'打包單',ok:true,code:'SENT'},
          ],
        },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderId:'O-PRINT',
      display:'002',
      needsAttention:false,
      evidence:{certainty:'TRANSPORT_ONLY',state:'DONE',planned:2,sent:2,failed:0},
    });
  });

  it('keeps UNKNOWN as attention instead of converting it to failed or success',()=>{
    const rows=projectVerifiedPrintEvidence([
      order({
        orderId:'O-UNKNOWN',
        display:'003',
        printEvidence:{
          scope:'DINING_INITIAL',
          certainty:'TRANSPORT_ONLY',
          attemptedAt:'2026-10-01T03:01:00.000Z',
          state:'UNKNOWN',
          planned:3,
          sent:2,
          failed:1,
          results:[{jobId:'O-UNKNOWN:packing',role:'打包單',ok:false,code:'PRINT_OUTCOME_UNKNOWN'}],
        },
      }),
    ]);
    expect(rows[0]?.needsAttention).toBe(true);
    expect(rows[0]?.evidence.state).toBe('UNKNOWN');
    expect(rows[0]?.evidence.results[0]?.code).toBe('PRINT_OUTCOME_UNKNOWN');
  });

  it('sorts newest transport evidence first without inventing physical proof',()=>{
    const rows=projectVerifiedPrintEvidence([
      order({
        orderId:'O-OLD',
        display:'004',
        printEvidence:{scope:'DINING_INITIAL',certainty:'TRANSPORT_ONLY',attemptedAt:'2026-10-01T01:00:00.000Z',state:'FAILED',planned:1,sent:0,failed:1,results:[]},
      }),
      order({
        orderId:'O-NEW',
        display:'005',
        printEvidence:{scope:'DINING_INITIAL',certainty:'TRANSPORT_ONLY',attemptedAt:'2026-10-01T04:00:00.000Z',state:'DONE',planned:1,sent:1,failed:0,results:[]},
      }),
    ]);
    expect(rows.map(row=>row.orderId)).toEqual(['O-NEW','O-OLD']);
    expect(JSON.stringify(rows)).not.toMatch(/physicalPrinted|paperPrinted|printedSuccessfully/i);
  });
});
