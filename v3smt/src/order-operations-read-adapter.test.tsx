import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import * as domain from './order-operations-domain.ts';
import type {MfpCanonicalOrder,MfpOrderOperationsReadModel} from './order-operations-domain.ts';
import {MfpOrderOperationsWorkspace} from './order-operations-workspace.tsx';

const order=():MfpCanonicalOrder=>({
  orderId:'O1',displayNumber:'0042',source:'WALK_IN',createdAt:'2026-10-03T01:00:00Z',revision:2,
  lifecycleState:'ACTIVE',fulfillmentState:'IN_PROGRESS',effectiveTenderId:'CASH',
  recognizedAmountMinor:0,outstandingAmountMinor:6200,serviceMode:'DINE_IN',
  items:[{lineId:'L1',name:'海南雞飯團',quantity:1,unitMinor:6200,options:['少飯']}],adjustments:[],
  dining:{tableId:'T01',partySize:2,seatedAt:'2026-10-03T01:00:00Z'},
});
const snapshot=():MfpOrderOperationsReadModel=>({
  schema:'mfp.order-operations.read.v1',storeId:'MF01',revision:6,readAt:'2026-10-03T01:02:00Z',orders:[order()],
  dining:{revision:4,waiting:[{waitingId:'W1',displayNumber:'W01',partySize:2,createdAt:'2026-10-03T01:01:00Z'}],
    tables:domain.MFP_DINING_TABLE_IDS.map(tableId=>({tableId,label:tableId,location:tableId==='OUTDOOR'?'OUTDOOR':'INDOOR',revision:1,
      state:tableId==='T01'?'OCCUPIED':'AVAILABLE',...(tableId==='T01'?{orderId:'O1',displayNumber:'0042',partySize:2,seatedAt:'2026-10-03T01:00:00Z'}:{})}))},
  availability:{revision:1,items:[]},capacity:{revision:1,pools:[]},etaPolicy:{revision:1,workloadBands:[],diningWarningMinutes:45},
});

function adapter(readOperations:()=>Promise<unknown>,storeId='MF01'){
  return domain.createMfpOrderOperationsReadAdapter({storeId,readOperations});
}

describe('retained Order/Dining canonical read adapter',()=>{
  it('renders existing Orders and Dining directly from the same validated native DTO',async()=>{
    const native=snapshot();const source=adapter(async()=>native);const model=await source.readOperations();
    const props={model,tenders:[],onOperation:()=>{},onSplitCheckout:()=>{},onTool:()=>{}};
    const orders=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="ORDERS" {...props}/>);
    const dining=renderToStaticMarkup(<MfpOrderOperationsWorkspace surface="MFP_PAD" page="DINING" {...props}/>);
    expect(orders).toContain('0042');expect(orders).toContain('海南雞飯團');expect(orders).toContain('未收');
    expect(dining).toContain('W01');expect(dining).toContain('T01');
    expect(model.orders[0].recognizedAmountMinor).toBe(0);
    expect(model.orders[0].outstandingAmountMinor).toBe(6200);
    expect(await source.readOrder('O1')).toEqual(order());expect(await source.readOrder('missing')).toBeNull();
  });
  it('returns isolated immutable snapshots and fresh readOrder data without a client cache',async()=>{
    let native=snapshot();const source=adapter(async()=>native);const first=await source.readOperations();
    expect(first).not.toBe(native);expect(Object.isFrozen(first.orders[0].items)).toBe(true);
    expect(Object.isFrozen(native)).toBe(false);
    native={...native,orders:[{...order(),revision:3,fulfillmentState:'READY'}]};
    expect((await source.readOrder('O1'))?.fulfillmentState).toBe('READY');
    expect(first.orders[0].fulfillmentState).toBe('IN_PROGRESS');
  });
  it('rejects a wrong-store snapshot before it can be rendered',async()=>{
    await expect(adapter(async()=>({...snapshot(),storeId:'OTHER'})).readOperations()).rejects.toThrow('MFP_ORDER_OPERATIONS_STORE_MISMATCH');
  });
  it.each([null,{},[],{...snapshot(),schema:'mfp.ordering.intent.draft.v1'},
    {...snapshot(),orders:[{...order(),draftOnly:true}]},
    {...snapshot(),orders:[{...order(),schema:'mfp.ordering.intent.draft.v1'}]},
  ])('fails malformed or draft readback closed (%#)',async value=>{
    await expect(adapter(async()=>value).readOperations()).rejects.toThrow('MFP_ORDER_OPERATIONS_READBACK_INVALID');
  });
  it('propagates native read failure instead of showing an invented empty floor',async()=>{
    await expect(adapter(async()=>{throw new Error('NATIVE_NOT_BOUND');}).readOperations()).rejects.toThrow('NATIVE_NOT_BOUND');
  });
});

describe('actual baseline readback validation defects',()=>{
  it.each([
    {dining:{...snapshot().dining,revision:undefined}},
    {dining:{...snapshot().dining,tables:snapshot().dining.tables.map(row=>({...row,state:'BROKEN'}))}},
    {dining:{...snapshot().dining,waiting:[{...snapshot().dining.waiting[0],displayNumber:undefined}]}},
    {etaPolicy:{...snapshot().etaPolicy,revision:undefined}},
  ])('rejects malformed dining/policy fields before existing workspace uses them (%#)',changes=>{
    expect(()=>domain.validateMfpOrderOperationsReadModel({...snapshot(),...changes} as unknown as MfpOrderOperationsReadModel)).toThrow();
  });
  it.each([{lifecycleState:'DRAFT'},{items:[{...order().items[0],options:42}]},{dining:{tableId:'T01',partySize:0}}])('rejects invalid order presentation data (%#)',changes=>{
    expect(()=>domain.validateMfpCanonicalOrder({...order(),...changes} as unknown as MfpCanonicalOrder)).toThrow();
  });
});

describe('ordinary operation receipt/readback safety',()=>{
  it('does not label a stale same-order readback COMMITTED and retries with the same operation identity',async()=>{
    let current=order();const submitted:string[]=[];
    const session=domain.createMfpOrderOperationSession({storeId:'MF01',operationId:'OP1',
      operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:2,target:'READY'},
      security:{submitFrontlineFormalCommand:async command=>{submitted.push(command.submissionId);return {schema:'mfp.store-kernel.submission.result.v1',submissionId:command.submissionId,state:'COMMITTED',commitId:'C1',canonicalRevision:3,orderRef:'O1'};}},
      authority:{readOrder:async()=>current},
    });
    expect(await session.submit()).toMatchObject({state:'UNKNOWN',readbackRequired:true});
    current={...order(),revision:3,fulfillmentState:'READY'};
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O1',revision:3}});
    expect(submitted).toEqual(['OP1']);
  });
  it('snapshots command identity before an asynchronous readback',async()=>{
    const operation={kind:'SET_FULFILLMENT' as const,orderId:'O1',expectedRevision:2,target:'READY' as const};
    const readIds:string[]=[];
    const session=domain.createMfpOrderOperationSession({storeId:'MF01',operationId:'OP2',operation,
      security:{submitFrontlineFormalCommand:async command=>({schema:'mfp.store-kernel.submission.result.v1',submissionId:command.submissionId,state:'COMMITTED',commitId:'C2',canonicalRevision:2})},
      authority:{readOrder:async id=>{readIds.push(id);return {...order(),orderId:id};}},
    });
    operation.orderId='O2';
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O1'}});
    expect(readIds).toEqual(['O1']);
  });
});

describe('Dining receipt/readback continuity',()=>{
  it('keeps stale Waiting snapshot UNKNOWN and refreshes dining revision without resubmission',async()=>{
    let current=snapshot();let submissions=0;let reads=0;
    const session=domain.createMfpOrderOperationSession({storeId:'MF01',operationId:'WAIT-2',
      operation:{kind:'CREATE_WAITING',expectedRevision:4,partySize:2},
      security:{submitFrontlineFormalCommand:async command=>{submissions++;return {schema:'mfp.store-kernel.submission.result.v1',submissionId:command.submissionId,state:'COMMITTED',commitId:'C-WAIT',canonicalRevision:5};}},
      authority:{readOrder:async()=>null,readOperations:async()=>{reads++;return current;}},
    });
    expect(await session.submit()).toMatchObject({state:'UNKNOWN'});
    current={...snapshot(),dining:{...snapshot().dining,revision:5}};
    const [first,second]=await Promise.all([session.submit(),session.submit()]);
    expect(first).toBe(second);expect(first).toMatchObject({state:'COMMITTED',snapshot:{dining:{revision:5}}});
    expect(await session.submit()).toBe(first);expect(submissions).toBe(1);expect(reads).toBe(2);
  });
  it('does not acknowledge Dining admission with no canonical order identity',async()=>{
    const session=domain.createMfpOrderOperationSession({storeId:'MF01',operationId:'ADMIT-MISSING',
      operation:{kind:'ADMIT_DINING_ORDER',expectedRevision:4,intent:{schema:'mfp.ordering.intent.draft.v1',draftOnly:true,pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',serviceMode:'dine-in',checkoutReady:true,previewSubtotalMinor:0,lines:[]},target:{kind:'TABLE',tableId:'T02',partySize:2}},
      security:{submitFrontlineFormalCommand:async command=>({schema:'mfp.store-kernel.submission.result.v1',submissionId:command.submissionId,state:'COMMITTED',commitId:'C-ADMIT',canonicalRevision:5})},
      authority:{readOrder:async()=>null,readOperations:async()=>snapshot()},
    });
    expect(await session.submit()).toMatchObject({state:'UNKNOWN',readbackRequired:true});
  });
});
