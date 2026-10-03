import {describe,expect,it,vi} from 'vitest';

import {
  createMfpOrderOperationSession,
  type MfpCanonicalOrder,
} from './order-operations-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import {
  MFP_STORE_KERNEL_RESULT_SCHEMA,
  createMfpStoreKernelPort,
  type MfpCommandOutbox,
  type MfpOutboxRecord,
} from './store-kernel-port.ts';

const order=(revision:number,fulfillmentState:'IN_PROGRESS'|'READY'):MfpCanonicalOrder=>Object.freeze({
  orderId:'O1',displayNumber:'0001',source:'WALK_IN',createdAt:'2026-10-02T09:00:00.000Z',
  revision,fulfillmentState,effectiveTenderId:'CASH',recognizedAmountMinor:5000,outstandingAmountMinor:0,
  serviceMode:'TAKEAWAY',items:Object.freeze([Object.freeze({lineId:'L1',name:'原味飯團',quantity:1,unitMinor:5000})]),
  adjustments:Object.freeze([]),
});

describe('MFP V3 A6 first RED — SAME Formal Order continuity',()=>{
  it('moves O1 IN_PROGRESS → READY → IN_PROGRESS without a second Order or duplicate formal effect',async()=>{
    let canonical=order(1,'IN_PROGRESS');
    const orders=new Map([['O1',canonical]]);
    const submitFrontlineFormalCommand=vi.fn(async command=>{
      const payload=command.payload as {orderId:string;target:'IN_PROGRESS'|'READY'};
      expect(payload.orderId).toBe('O1');
      canonical=order(Number(command.expectedRevision)+1,payload.target);
      orders.set(canonical.orderId,canonical);
      return {
        schema:'mfp.store-kernel.submission.result.v1' as const,
        submissionId:command.submissionId,state:'COMMITTED' as const,
        commitId:`COMMIT-${command.submissionId}`,canonicalRevision:canonical.revision,orderRef:'O1',
      };
    });
    const security={submitFrontlineFormalCommand} as Pick<MfpSecurityPort,'submitFrontlineFormalCommand'>;
    const authority={readOrder:vi.fn(async(orderId:string)=>orders.get(orderId)??null)};

    const ready=createMfpOrderOperationSession({
      operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'READY'},
      operationId:'OP-O1-READY-1',security,authority,now:()=> '2026-10-02T09:01:00.000Z',
    });
    const [readyFirst,readyDuplicate]=await Promise.all([ready.submit(),ready.submit()]);
    expect(readyFirst).toEqual(readyDuplicate);
    expect(readyFirst).toMatchObject({state:'COMMITTED',order:{orderId:'O1',revision:2,fulfillmentState:'READY'}});

    const reverted=createMfpOrderOperationSession({
      operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:2,target:'IN_PROGRESS'},
      operationId:'OP-O1-IN-PROGRESS-2',security,authority,now:()=> '2026-10-02T09:02:00.000Z',
    });
    expect(await reverted.submit()).toMatchObject({
      state:'COMMITTED',order:{orderId:'O1',revision:3,fulfillmentState:'IN_PROGRESS'},
    });

    expect([...orders]).toEqual([['O1',canonical]]);
    expect(submitFrontlineFormalCommand).toHaveBeenCalledTimes(2);
    expect(submitFrontlineFormalCommand.mock.calls.map(([command])=>({
      submissionId:command.submissionId,idempotencyKey:command.idempotencyKey,
      commandType:command.commandType,expectedRevision:command.expectedRevision,
    }))).toEqual([
      {submissionId:'OP-O1-READY-1',idempotencyKey:'OP-O1-READY-1',commandType:'ORDER_FULFILLMENT_SET',expectedRevision:1},
      {submissionId:'OP-O1-IN-PROGRESS-2',idempotencyKey:'OP-O1-IN-PROGRESS-2',commandType:'ORDER_FULFILLMENT_SET',expectedRevision:2},
    ]);
  });

  it('fails a stale revision closed and keeps the rejection terminal',async()=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({
      schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,
      state:'REJECTED' as const,rejectionCode:'EXPECTED_REVISION_STALE',
    }));
    const authority={readOrder:vi.fn(async()=>order(2,'READY'))};
    const session=createMfpOrderOperationSession({
      operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'IN_PROGRESS'},
      operationId:'OP-STALE',security:{submitFrontlineFormalCommand},authority,
    });

    expect(await session.submit()).toMatchObject({state:'REJECTED',result:{rejectionCode:'EXPECTED_REVISION_STALE'}});
    expect(await session.submit()).toMatchObject({state:'REJECTED'});
    expect(submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);
    expect(authority.readOrder).not.toHaveBeenCalled();
  });

  it('keeps UNKNOWN readback-first by reusing A1 submission identity',async()=>{
    class MemoryOutbox implements MfpCommandOutbox{
      readonly rows=new Map<string,MfpOutboxRecord>();
      async read(submissionId:string){return this.rows.get(submissionId);}
      async write(record:MfpOutboxRecord){this.rows.set(record.submissionId,record);}
    }
    const calls:string[]=[];
    const committed={
      schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:'OP-UNKNOWN',state:'COMMITTED' as const,
      commitId:'COMMIT-UNKNOWN',canonicalRevision:2,orderRef:'O1',
    };
    const port=createMfpStoreKernelPort({outbox:new MemoryOutbox(),transport:{
      submitCommand:vi.fn(async()=>{calls.push('submit');throw new Error('TIMEOUT');}),
      readSubmission:vi.fn(async()=>{calls.push('read');return committed;}),
    }});
    const security={submitFrontlineFormalCommand:(command:Parameters<MfpSecurityPort['submitFrontlineFormalCommand']>[0])=>port.submitFormalCommand({
      ...command,deviceId:'PAD-01',staffSessionRef:'SESSION-01',
    })};
    const session=createMfpOrderOperationSession({
      operation:{kind:'SET_FULFILLMENT',orderId:'O1',expectedRevision:1,target:'READY'},
      operationId:'OP-UNKNOWN',security,authority:{readOrder:async()=>order(2,'READY')},
    });

    expect(await session.submit()).toMatchObject({state:'UNKNOWN'});
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O1'}});
    expect(calls).toEqual(['submit','read']);
  });

  it('routes a formal modification through the same operation/readback seam',async()=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({
      schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,
      state:'COMMITTED' as const,commitId:'COMMIT-MODIFY',canonicalRevision:2,orderRef:'O1',
    }));
    const session=createMfpOrderOperationSession({
      operation:{kind:'REQUEST_MODIFICATION',orderId:'O1',expectedRevision:1,reason:'走蔥'},
      operationId:'OP-MODIFY',security:{submitFrontlineFormalCommand},authority:{readOrder:async()=>order(2,'IN_PROGRESS')},
    });

    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O1'}});
    expect(submitFrontlineFormalCommand.mock.calls[0]?.[0]).toMatchObject({
      commandType:'ORDER_MODIFICATION_REQUEST',expectedRevision:1,payload:{orderId:'O1',reason:'走蔥'},
    });
  });
});
