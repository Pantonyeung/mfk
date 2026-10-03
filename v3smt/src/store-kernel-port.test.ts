import {describe,expect,it,vi} from 'vitest';

import {
  MFP_STORE_KERNEL_RESULT_SCHEMA,
  createMfpCommandEnvelope,
  createMfpStoreKernelPort,
  createMfpSurfacePorts,
  type MfpCommandOutbox,
  type MfpOutboxRecord,
  type MfpStoreKernelResult,
  type MfpStoreKernelTransport,
} from './store-kernel-port.ts';

class MemoryOutbox implements MfpCommandOutbox{
  readonly rows=new Map<string,MfpOutboxRecord>();
  async read(submissionId:string){return this.rows.get(submissionId);}
  async write(record:MfpOutboxRecord){this.rows.set(record.submissionId,record);}
}

const command=(payload:unknown={productId:'P1'})=>createMfpCommandEnvelope({
  schema:'mfp.store-kernel.command.v1',
  storeId:'MF01',
  deviceId:'PAD-01',
  staffSessionRef:'STAFF-SESSION-01',
  submissionId:'SUB-01',
  idempotencyKey:'IDEMP-01',
  commandType:'ORDER_CREATE',
  expectedRevision:'MENU-7',
  payload,
  createdAt:'2026-10-02T04:00:00.000Z',
});

const committed=(commitId='COMMIT-01'):MfpStoreKernelResult=>Object.freeze({
  schema:MFP_STORE_KERNEL_RESULT_SCHEMA,
  submissionId:'SUB-01',
  state:'COMMITTED',
  commitId,
  canonicalRevision:8,
  orderRef:'ORDER-01',
});

const rejected=(code='STORE_KERNEL_REJECTED'):MfpStoreKernelResult=>Object.freeze({
  schema:MFP_STORE_KERNEL_RESULT_SCHEMA,
  submissionId:'SUB-01',
  state:'REJECTED',
  rejectionCode:code,
});

const unknown=(retryPermitted:boolean):MfpStoreKernelResult=>Object.freeze({
  schema:MFP_STORE_KERNEL_RESULT_SCHEMA,
  submissionId:'SUB-01',
  state:'UNKNOWN',
  readbackRequired:true,
  retryPermitted,
});

describe('MFP V3 A1 Store Kernel port',()=>{
  it('deduplicates the same submission and returns one formal business effect',async()=>{
    const result=committed();
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>result),
      readSubmission:vi.fn(async()=>result),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});

    expect(await port.submitFormalCommand(command())).toEqual(result);
    expect(await port.submitFormalCommand(command())).toEqual(result);
    expect(transport.submitCommand).toHaveBeenCalledTimes(1);
    expect(transport.readSubmission).toHaveBeenCalledTimes(1);
  });

  it('rejects a reused submissionId when the material payload changes',async()=>{
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>committed()),
      readSubmission:vi.fn(async()=>committed()),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());

    await expect(port.submitFormalCommand(command({productId:'P2'})))
      .rejects.toThrow('MFP_SUBMISSION_PAYLOAD_CONFLICT');
    expect(transport.submitCommand).toHaveBeenCalledTimes(1);
  });

  it('maps a submit timeout to UNKNOWN without inventing COMMITTED',async()=>{
    const outbox=new MemoryOutbox();
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>{throw new Error('TIMEOUT');}),
      readSubmission:vi.fn(async()=>unknown(false)),
    };
    const port=createMfpStoreKernelPort({transport,outbox});

    expect(await port.submitFormalCommand(command())).toEqual(unknown(false));
    expect(outbox.rows.get('SUB-01')?.status).toBe('UNKNOWN');
  });

  it('does canonical readback before retrying an UNKNOWN submission',async()=>{
    const calls:string[]=[];
    let submits=0;
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>{
        calls.push('submit');
        if(submits++===0)throw new Error('TIMEOUT');
        return committed();
      }),
      readSubmission:vi.fn(async()=>{calls.push('read');return unknown(true);}),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());

    expect(await port.submitFormalCommand(command())).toEqual(committed());
    expect(calls).toEqual(['submit','read','submit']);
    expect(transport.readSubmission).toHaveBeenCalledWith(expect.objectContaining({
      submissionId:'SUB-01',idempotencyKey:'IDEMP-01',commandType:'ORDER_CREATE',
    }));
  });

  it('returns the original commit identity when readback is COMMITTED',async()=>{
    const original=committed('COMMIT-ORIGINAL');
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>{throw new Error('RESPONSE_LOST');}),
      readSubmission:vi.fn(async()=>original),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());

    expect(await port.submitFormalCommand(command())).toEqual(original);
    expect(transport.submitCommand).toHaveBeenCalledTimes(1);
  });

  it('surfaces the stable Store Kernel rejection code from readback',async()=>{
    const canonical=rejected('EXPECTED_REVISION_STALE');
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>{throw new Error('RESPONSE_LOST');}),
      readSubmission:vi.fn(async()=>canonical),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());

    expect(await port.submitFormalCommand(command())).toEqual(canonical);
  });

  it('retries only with the original idempotencyKey after UNKNOWN readback',async()=>{
    const keys:string[]=[];
    let submits=0;
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async input=>{
        keys.push(input.idempotencyKey);
        if(submits++===0)throw new Error('TIMEOUT');
        return committed();
      }),
      readSubmission:vi.fn(async()=>unknown(true)),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());
    await port.submitFormalCommand(command());

    expect(keys).toEqual(['IDEMP-01','IDEMP-01']);
  });

  it('does not retry when canonical readback has not permitted it',async()=>{
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>{throw new Error('TIMEOUT');}),
      readSubmission:vi.fn(async()=>unknown(false)),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    await port.submitFormalCommand(command());

    expect(await port.submitFormalCommand(command())).toEqual(unknown(false));
    expect(transport.submitCommand).toHaveBeenCalledTimes(1);
  });

  it('uses only the injected Store Kernel command/query transport',async()=>{
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>committed()),
      readSubmission:vi.fn(async()=>committed()),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});

    await port.submitFormalCommand(command());
    expect(transport.submitCommand).toHaveBeenCalledTimes(1);
    expect(transport.readSubmission).not.toHaveBeenCalled();
  });

  it('gives MFP Pad and MFP Mobile the same business port instance',()=>{
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>committed()),
      readSubmission:vi.fn(async()=>committed()),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});
    const surfaces=createMfpSurfacePorts(port);

    expect(surfaces.MFP_PAD).toBe(port);
    expect(surfaces.MFP_MOBILE).toBe(port);
  });

  it('fails closed as UNKNOWN for a malformed claimed commit',async()=>{
    const transport:MfpStoreKernelTransport={
      submitCommand:vi.fn(async()=>({
        schema:MFP_STORE_KERNEL_RESULT_SCHEMA,
        submissionId:'SUB-01',
        state:'COMMITTED',
      }) as MfpStoreKernelResult),
      readSubmission:vi.fn(async()=>unknown(false)),
    };
    const port=createMfpStoreKernelPort({transport,outbox:new MemoryOutbox()});

    expect(await port.submitFormalCommand(command())).toEqual(unknown(false));
  });
});
