import {describe,expect,it,vi} from 'vitest';

import {
  createMfpPrintHardwareSession,
  selectMfpLabelJobs,
  validateMfpCanonicalPrintJob,
  validateMfpPrinterBinding,
  type MfpAuthorizedPrintDispatch,
  type MfpCanonicalPrintJob,
  type MfpPrintAuthorityPort,
  type MfpPrintGatewayPort,
  type MfpPrintHardwareBinding,
  type MfpReprintRequest,
  type MfpPrinterBinding,
} from './print-hardware-domain.ts';

const printer:MfpPrinterBinding={
  bindingId:'KITCHEN-01',logicalDestinationId:'kitchen',displayName:'Kitchen',model:'EPSON',
  transport:'tcp',host:'10.0.0.12',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030',enabled:true,
};

function job(overrides:Partial<MfpCanonicalPrintJob>={}):MfpCanonicalPrintJob{return{
  canonicalPrintJobId:'J1',orderId:'O1',jobType:'PRODUCTION',purpose:'INITIAL',
  logicalDestinationId:'kitchen',templateId:'production-v3',templateRevision:1,
  payloadIdentity:'PAYLOAD-J1',payloadDigest:'digest-j1',createdAt:'2026-10-02T09:00:00.000Z',
  canonicalState:'READY',transportState:'NOT_STARTED',dispatchAttemptId:'ATTEMPT-J1',kickDrawer:false,
  ...overrides,
};}

function evidence(value:MfpCanonicalPrintJob=job(),state=value.transportState){return{
  canonicalPrintJobId:value.canonicalPrintJobId,dispatchAttemptId:value.dispatchAttemptId!,state,
  lastStage:state,lastCode:state==='AMBIGUOUS_AFTER_SEND'?'PRINT_GATEWAY_PROCESS_RESTART_OUTCOME_UNKNOWN':undefined,
  payloadDigest:value.payloadDigest,createdAt:value.createdAt,updatedAt:'2026-10-02T09:01:00.000Z',
};}

function authorized(value:MfpCanonicalPrintJob=job()):MfpAuthorizedPrintDispatch{return{
  job:value,dispatchAttemptId:value.dispatchAttemptId!,payloadBase64:'AQID',payloadDigest:value.payloadDigest,
};}

function makeBinding(jobs:readonly MfpCanonicalPrintJob[],overrides:{
  snapshot?:unknown;bindings?:unknown;enqueue?:MfpPrintGatewayPort['enqueueCanonicalPrintJob'];
  authorizeDispatch?:MfpPrintAuthorityPort['authorizeDispatch'];requestReprint?:MfpPrintAuthorityPort['requestReprint'];
  requestSafeRetry?:MfpPrintAuthorityPort['requestSafeRetry'];ensureCancelNotice?:MfpPrintAuthorityPort['ensureCancelNotice'];
}={}):MfpPrintHardwareBinding{
  return{
    authority:{
      readPrintModel:vi.fn(async()=>({schema:'mfp.print-hardware.read.v1',storeId:'MF01',revision:1,readAt:'2026-10-02T09:01:00.000Z',jobs})),
      authorizeDispatch:overrides.authorizeDispatch??vi.fn(async(id:string)=>authorized(jobs.find(row=>row.canonicalPrintJobId===id)!)),
      requestReprint:overrides.requestReprint??vi.fn(),requestSafeRetry:overrides.requestSafeRetry??vi.fn(),ensureCancelNotice:overrides.ensureCancelNotice??vi.fn(),
    },
    gateway:{
      readGatewaySnapshot:vi.fn(async()=>(overrides.snapshot??{serviceReady:true,queueDepth:0,lastJob:null})),
      enqueueCanonicalPrintJob:overrides.enqueue??vi.fn(async(input:any)=>evidence({...job(),canonicalPrintJobId:input.canonicalPrintJobId,dispatchAttemptId:input.dispatchAttemptId},'DISPATCHING')),
      readEndpointBindings:vi.fn(async()=>overrides.bindings??[printer]),applyEndpointBinding:vi.fn(async()=>({ok:true})),
      probeEndpoint:vi.fn(async()=>({reachable:true,physicalPaperProof:false})),testEndpoint:vi.fn(async()=>({accepted:true,physicalPaperProof:false})),
    },
  };
}

describe('MFP V3 A7 first RED — UNKNOWN print outcome is not safe to retry',()=>{
  it('reconstructs J1 as AMBIGUOUS after restart with zero automatic physical redispatch',async()=>{
    const ambiguous=job({transportState:'DISPATCHING'});
    const enqueue=vi.fn();
    const binding=makeBinding([ambiguous],{snapshot:{serviceReady:true,queueDepth:0,lastJob:evidence(ambiguous,'AMBIGUOUS_AFTER_SEND')},enqueue});

    const recovered=await createMfpPrintHardwareSession(binding).read();

    expect(recovered.jobs[0]).toMatchObject({
      canonicalPrintJobId:'J1',transportState:'AMBIGUOUS_AFTER_SEND',
      attention:{kind:'HUMAN_CHECK',safeAction:'人工檢查；如有需要，建立新重印'},
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps a browser timeout uncertain unless gateway readback proves a result',async()=>{
    const enqueue=vi.fn(async()=>{throw new Error('BRIDGE_TIMEOUT');});
    const binding=makeBinding([job()],{enqueue});
    const result=await createMfpPrintHardwareSession(binding).dispatchCanonical('J1');
    expect(result).toMatchObject({state:'AMBIGUOUS_AFTER_SEND',lastCode:'MFP_PRINT_GATEWAY_READBACK_UNCONFIRMED'});
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1'}));
  });

  it('permits formal safe retry only for FAILED_BEFORE_SEND and retains the canonical job identity',async()=>{
    const failed=job({transportState:'FAILED_BEFORE_SEND',lastCode:'PRINT_CONNECT_FAILED'});
    const retryJob=job({dispatchAttemptId:'ATTEMPT-J1-R2'});
    const requestSafeRetry=vi.fn(async()=>authorized(retryJob));
    const enqueue=vi.fn(async()=>evidence(retryJob,'DISPATCHING'));
    const binding=makeBinding([failed],{snapshot:{serviceReady:true,queueDepth:0,lastJob:evidence(failed)},requestSafeRetry,enqueue});
    const session=createMfpPrintHardwareSession(binding);

    expect(await session.requestSafeRetry('J1','SAFE-1')).toEqual([expect.objectContaining({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1-R2'})]);
    expect(requestSafeRetry).toHaveBeenCalledWith('J1','SAFE-1');
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('forbids safe retry for UNKNOWN and never asks authority or gateway to retry it',async()=>{
    const unknown=job({transportState:'AMBIGUOUS_AFTER_SEND'});
    const requestSafeRetry=vi.fn();const enqueue=vi.fn();
    const session=createMfpPrintHardwareSession(makeBinding([unknown],{requestSafeRetry,enqueue}));
    await expect(session.requestSafeRetry('J1','SAFE-UNKNOWN')).rejects.toThrow('MFP_PRINT_SAFE_RETRY_FORBIDDEN');
    expect(requestSafeRetry).not.toHaveBeenCalled();expect(enqueue).not.toHaveBeenCalled();
  });

  it('uses one new drawer-suppressed reprint identity and coalesces duplicate human clicks',async()=>{
    const source=job({transportState:'AMBIGUOUS_AFTER_SEND'});
    const reprint=job({canonicalPrintJobId:'J1-R1',purpose:'REPRINT',transportState:'NOT_STARTED',dispatchAttemptId:'ATTEMPT-R1',reprintOfPrintJobId:'J1',kickDrawer:false});
    const requestReprint=vi.fn(async(_request:MfpReprintRequest)=>[authorized(reprint)]);const enqueue=vi.fn(async(_input:Parameters<MfpPrintGatewayPort['enqueueCanonicalPrintJob']>[0])=>evidence(reprint,'DISPATCHING'));
    const session=createMfpPrintHardwareSession(makeBinding([source],{requestReprint,enqueue}));
    const request={requestId:'REPRINT-1',orderId:'O1',reason:'人手檢查後補印',humanConfirmed:true as const,selection:{kind:'WHOLE_TICKET' as const,sourcePrintJobId:'J1',jobType:'PRODUCTION' as const}};

    const [first,duplicate]=await Promise.all([session.requestReprint(request),session.requestReprint(request)]);
    expect(first).toEqual(duplicate);expect(requestReprint).toHaveBeenCalledTimes(1);expect(enqueue).toHaveBeenCalledTimes(1);
    expect(requestReprint.mock.calls[0]?.[0]).toMatchObject({orderId:'O1',humanConfirmed:true});
  });

  it('selects exactly labels 2 and 4 of 5 on one route and leaves another route untouched',async()=>{
    const labels=[1,2,3,4,5].map(index=>job({canonicalPrintJobId:`L${index}`,jobType:'PRODUCT_LABEL',logicalDestinationId:'label-a',dispatchAttemptId:`A${index}`,labelUnit:{labelId:`LABEL-${index}`,index,total:5}}));
    const other=job({canonicalPrintJobId:'OTHER',jobType:'BAG_LABEL',logicalDestinationId:'label-b',dispatchAttemptId:'OTHER-A',labelUnit:{labelId:'OTHER-LABEL',index:1,total:1}});
    expect(selectMfpLabelJobs([...labels,other],'label-a',['LABEL-2','LABEL-4']).map(row=>row.canonicalPrintJobId)).toEqual(['L2','L4']);

    const reprints=[2,4].map(index=>job({canonicalPrintJobId:`L${index}-R`,jobType:'PRODUCT_LABEL',purpose:'REPRINT',logicalDestinationId:'label-a',dispatchAttemptId:`R${index}`,reprintOfPrintJobId:`L${index}`,labelUnit:{labelId:`LABEL-${index}`,index,total:5}}));
    const labelPrinter={...printer,bindingId:'LABEL-01',logicalDestinationId:'label-a',capability:'label-58mm' as const};
    const requestReprint=vi.fn(async(_request:MfpReprintRequest)=>reprints.map(authorized));const enqueue=vi.fn(async(input:Parameters<MfpPrintGatewayPort['enqueueCanonicalPrintJob']>[0])=>evidence(reprints.find(row=>row.dispatchAttemptId===input.dispatchAttemptId)!,'DISPATCHING'));
    const session=createMfpPrintHardwareSession(makeBinding([...labels,other],{bindings:[labelPrinter],requestReprint,enqueue}));
    await session.requestReprint({requestId:'LABEL-R',orderId:'O1',reason:'第 2、4 張損壞',humanConfirmed:true,selection:{kind:'LABELS',routeId:'label-a',sourcePrintJobIds:['L2','L4'],labelIds:['LABEL-2','LABEL-4']}});
    expect(enqueue.mock.calls.map(([input])=>input.canonicalPrintJobId)).toEqual(['L2-R','L4-R']);
  });

  it('rejects cross-route or forged label selection before authority or dispatch',()=>{
    const labels=[1,2].map(index=>job({canonicalPrintJobId:`L${index}`,jobType:'PRODUCT_LABEL',logicalDestinationId:'label-a',labelUnit:{labelId:`LABEL-${index}`,index,total:2}}));
    expect(()=>selectMfpLabelJobs(labels,'label-b',['LABEL-1'])).toThrow('MFP_REPRINT_LABEL_SELECTION_INVALID');
    expect(()=>selectMfpLabelJobs(labels,'label-a',['LABEL-1','FORGED'])).toThrow('MFP_REPRINT_LABEL_SELECTION_INVALID');
  });

  it('deduplicates an already acknowledged dispatch attempt, including drawer payloads',async()=>{
    const receipt=job({jobType:'RECEIPT',purpose:'PAYMENT_RECEIPT',paymentRef:'PAY-1',kickDrawer:true});
    const enqueue=vi.fn();
    const session=createMfpPrintHardwareSession(makeBinding([receipt],{snapshot:{serviceReady:true,queueDepth:0,lastJob:evidence(receipt,'ACKNOWLEDGED')},enqueue}));
    expect(await session.dispatchCanonical('J1')).toMatchObject({state:'ACKNOWLEDGED',dispatchAttemptId:'ATTEMPT-J1'});
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('fails invalid endpoint binding closed before gateway enqueue',async()=>{
    expect(()=>validateMfpPrinterBinding({...printer,port:70000})).toThrow('MFP_PRINTER_ENDPOINT_INVALID');
    const enqueue=vi.fn();
    const session=createMfpPrintHardwareSession(makeBinding([job()],{bindings:[{...printer,port:70000}],enqueue}));
    await expect(session.dispatchCanonical('J1')).rejects.toThrow('MFP_PRINTER_ENDPOINT_INVALID');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('makes corrupt binding readback visible instead of creating browser fallback truth',async()=>{
    const readback=await createMfpPrintHardwareSession(makeBinding([job()],{bindings:[{...printer,port:0}]})).read();
    expect(readback).toMatchObject({bindings:[],bindingError:'MFP_PRINTER_ENDPOINT_INVALID'});
    expect(readback.jobs[0]?.attention.kind).toBe('INVALID_CONFIG');
  });

  it('keeps Probe and Test Print inside the gateway with no Order, Payment or Fulfillment call',async()=>{
    const binding=makeBinding([]);const session=createMfpPrintHardwareSession(binding);
    await session.probeEndpoint('KITCHEN-01');await session.testEndpoint('KITCHEN-01');
    expect(binding.gateway.probeEndpoint).toHaveBeenCalledTimes(1);expect(binding.gateway.testEndpoint).toHaveBeenCalledTimes(1);
    expect(binding.authority.authorizeDispatch).not.toHaveBeenCalled();expect(binding.authority.requestReprint).not.toHaveBeenCalled();
  });

  it('observes an existing cancel notice once and creates no duplicate job or dispatch',async()=>{
    const cancel=job({canonicalPrintJobId:'C1',jobType:'CANCEL_NOTICE',purpose:'CANCEL_NOTICE',transportState:'ACKNOWLEDGED',dispatchAttemptId:'C-A1'});
    const ensureCancelNotice=vi.fn();const enqueue=vi.fn();
    const session=createMfpPrintHardwareSession(makeBinding([cancel],{ensureCancelNotice,enqueue}));
    expect(await session.ensureCancelNotice('O1','CANCEL-2')).toEqual([expect.objectContaining({canonicalPrintJobId:'C1',state:'ACKNOWLEDGED'})]);
    expect(ensureCancelNotice).not.toHaveBeenCalled();expect(enqueue).not.toHaveBeenCalled();
  });

  it('allows unpaid table-ticket transport without inventing paid or completed state',async()=>{
    const table=job({jobType:'TABLE_TICKET',purpose:'INITIAL'});
    const enqueue=vi.fn(async()=>evidence(table,'DISPATCHING'));
    expect(await createMfpPrintHardwareSession(makeBinding([table],{enqueue})).dispatchCanonical('J1')).toMatchObject({state:'DISPATCHING'});
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('requires payment linkage for a drawer receipt and material linkage for Dining delta print',()=>{
    expect(()=>validateMfpCanonicalPrintJob(job({jobType:'RECEIPT',purpose:'PAYMENT_RECEIPT',kickDrawer:true}))).toThrow('MFP_PRINT_PAYMENT_REF_REQUIRED');
    expect(()=>validateMfpCanonicalPrintJob(job({purpose:'DINING_ADDITION'}))).toThrow('MFP_PRINT_DELTA_ITEMS_REQUIRED');
    expect(validateMfpCanonicalPrintJob(job({purpose:'DINING_ADDITION',materialItemRefs:['NEW-LINE-2']}))).toMatchObject({materialItemRefs:['NEW-LINE-2']});
  });

  it('rejects drawer pulse on every reprint at the canonical contract boundary',()=>{
    expect(()=>validateMfpCanonicalPrintJob(job({purpose:'REPRINT',reprintOfPrintJobId:'J0',kickDrawer:true,jobType:'RECEIPT',paymentRef:'PAY-1'}))).toThrow('MFP_PRINT_DRAWER_POLICY_INVALID');
  });
});

describe('print evidence is correlated to the requested job, attempt and payload',()=>{
  const foreignEvidence=[
    ['another job',{canonicalPrintJobId:'FOREIGN-JOB'}],
    ['changed payload',{payloadDigest:'FOREIGN-DIGEST'}],
    ['missing payload digest',{payloadDigest:undefined}],
  ] as const;
  const mismatchedReceipts=[...foreignEvidence,['another attempt',{dispatchAttemptId:'FOREIGN-ATTEMPT'}] as const];
  const snapshot=(lastJob:unknown)=>({serviceReady:true,queueDepth:0,lastJob});

  it.each(foreignEvidence)('does not enqueue or return a colliding attempt for %s',async(_label,override)=>{
    const binding=makeBinding([job()],{snapshot:snapshot({...evidence(job(),'ACKNOWLEDGED'),...override})});
    const result=await createMfpPrintHardwareSession(binding).dispatchCanonical('J1');
    expect(result).toMatchObject({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1',state:'AMBIGUOUS_AFTER_SEND'});
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it.each(mismatchedReceipts)('does not accept enqueue evidence for %s or silently retry',async(_label,override)=>{
    const binding=makeBinding([job()],{enqueue:vi.fn(async()=>({...evidence(job(),'ACKNOWLEDGED'),...override}))});
    const result=await createMfpPrintHardwareSession(binding).dispatchCanonical('J1');
    expect(result).toMatchObject({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1',state:'AMBIGUOUS_AFTER_SEND'});
    expect(binding.gateway.enqueueCanonicalPrintJob).toHaveBeenCalledTimes(1);
    expect(binding.gateway.readGatewaySnapshot).toHaveBeenCalledTimes(2);
  });

  it.each(mismatchedReceipts)('does not accept timeout recovery evidence for %s',async(_label,override)=>{
    const binding=makeBinding([job()],{enqueue:vi.fn(async()=>{throw new Error('TIMEOUT');})});
    vi.mocked(binding.gateway.readGatewaySnapshot).mockResolvedValueOnce(snapshot(null))
      .mockResolvedValueOnce(snapshot({...evidence(job(),'ACKNOWLEDGED'),...override}));
    const result=await createMfpPrintHardwareSession(binding).dispatchCanonical('J1');
    expect(result).toMatchObject({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1',state:'AMBIGUOUS_AFTER_SEND'});
    expect(binding.gateway.enqueueCanonicalPrintJob).toHaveBeenCalledTimes(1);
  });

  it.each(mismatchedReceipts)('does not overlay canonical readback with %s evidence',async(_label,override)=>{
    const binding=makeBinding([job()],{snapshot:snapshot({...evidence(job(),'ACKNOWLEDGED'),...override})});
    const result=await createMfpPrintHardwareSession(binding).read();
    expect(result.jobs[0]).toMatchObject({canonicalPrintJobId:'J1',payloadDigest:'digest-j1',transportState:'NOT_STARTED'});
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it.each(['PERSISTED','DISPATCHING','ACKNOWLEDGED','FAILED_BEFORE_SEND','AMBIGUOUS_AFTER_SEND'] as const)(
    'replays exact %s evidence without enqueue, including a duplicate call',async state=>{
      const expected=evidence(job(),state);
      const binding=makeBinding([job()],{snapshot:snapshot(expected)});
      const session=createMfpPrintHardwareSession(binding);
      expect(await session.dispatchCanonical('J1')).toEqual(expected);
      expect(await session.dispatchCanonical('J1')).toEqual(expected);
      expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
    },
  );

  it('allows an unrelated latest job while preserving the new request identity',async()=>{
    const binding=makeBinding([job()],{snapshot:snapshot(evidence(job({canonicalPrintJobId:'OTHER',dispatchAttemptId:'OTHER-A',payloadDigest:'other-digest'}),'ACKNOWLEDGED'))});
    expect(await createMfpPrintHardwareSession(binding).dispatchCanonical('J1')).toMatchObject({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1',state:'DISPATCHING'});
    expect(binding.gateway.enqueueCanonicalPrintJob).toHaveBeenCalledTimes(1);
  });

  it.each(['ACKNOWLEDGED','FAILED_BEFORE_SEND'] as const)('uses exact authoritative %s readback after a foreign receipt without enqueueing again',async state=>{
    const expected=evidence(job(),state);
    const binding=makeBinding([job()],{enqueue:vi.fn(async()=>evidence(job({canonicalPrintJobId:'OTHER',dispatchAttemptId:'OTHER-A'}),'ACKNOWLEDGED'))});
    vi.mocked(binding.gateway.readGatewaySnapshot).mockResolvedValueOnce(snapshot(null)).mockResolvedValueOnce(snapshot(expected));
    expect(await createMfpPrintHardwareSession(binding).dispatchCanonical('J1')).toEqual(expected);
    expect(binding.gateway.enqueueCanonicalPrintJob).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['payload digest',{payloadDigest:'CHANGED-DIGEST'}],
    ['payload identity',{payloadIdentity:'CHANGED-PAYLOAD'}],
  ] as const)('rejects a safe-retry authorization that changes the original %s',async(_label,override)=>{
    const failed=job({transportState:'FAILED_BEFORE_SEND'});
    const retry=job({dispatchAttemptId:'ATTEMPT-J1-R2',...override});
    const binding=makeBinding([failed],{requestSafeRetry:vi.fn(async()=>authorized(retry))});
    await expect(createMfpPrintHardwareSession(binding).requestSafeRetry('J1','RETRY-PAYLOAD')).rejects.toThrow('MFP_PRINT_SAFE_RETRY_IDENTITY_INVALID');
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it('rejects another authorized canonical job before consulting the gateway',async()=>{
    const binding=makeBinding([job()],{authorizeDispatch:vi.fn(async()=>authorized(job({canonicalPrintJobId:'OTHER'})))});
    await expect(createMfpPrintHardwareSession(binding).dispatchCanonical('J1')).rejects.toThrow('MFP_PRINT_JOB_IDENTITY_MISMATCH');
    expect(binding.gateway.readGatewaySnapshot).not.toHaveBeenCalled();
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it('checks the authorization identity for an existing cancel notice too',async()=>{
    const cancel=job({canonicalPrintJobId:'C1',jobType:'CANCEL_NOTICE',purpose:'CANCEL_NOTICE'});
    const binding=makeBinding([cancel],{authorizeDispatch:vi.fn(async()=>authorized(job()))});
    await expect(createMfpPrintHardwareSession(binding).ensureCancelNotice('O1','CANCEL-IDENTITY')).rejects.toThrow('MFP_PRINT_JOB_IDENTITY_MISMATCH');
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it.each([
    ['another order',{orderId:'OTHER-ORDER'}],
    ['a drawer receipt',{jobType:'RECEIPT',purpose:'PAYMENT_RECEIPT',paymentRef:'PAY-OTHER',kickDrawer:true}],
  ] as const)('rejects same-ID cancel-notice authorization replaced with %s',async(_label,override)=>{
    const cancel=job({canonicalPrintJobId:'C1',jobType:'CANCEL_NOTICE',purpose:'CANCEL_NOTICE'});
    const binding=makeBinding([cancel],{authorizeDispatch:vi.fn(async()=>authorized({...cancel,...override}))});
    await expect(createMfpPrintHardwareSession(binding).ensureCancelNotice('O1','CANCEL-POLICY')).rejects.toThrow('MFP_CANCEL_NOTICE_POLICY_INVALID');
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it.each([
    ['payload digest',{payloadDigest:'CHANGED-DIGEST'}],
    ['payload identity',{payloadIdentity:'CHANGED-PAYLOAD'}],
    ['existing attempt',{dispatchAttemptId:'CHANGED-ATTEMPT'}],
  ] as const)('rejects changed %s on an existing cancel-notice authorization',async(_label,override)=>{
    const cancel=job({canonicalPrintJobId:'C1',jobType:'CANCEL_NOTICE',purpose:'CANCEL_NOTICE'});
    const binding=makeBinding([cancel],{authorizeDispatch:vi.fn(async()=>authorized({...cancel,...override}))});
    await expect(createMfpPrintHardwareSession(binding).ensureCancelNotice('O1','CANCEL-CORRELATION')).rejects.toThrow('MFP_PRINT_JOB_IDENTITY_MISMATCH');
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it.each([true,false])('dispatches an unchanged existing cancel notice with preallocated attempt %s',async preallocated=>{
    const cancel=job({canonicalPrintJobId:'C1',jobType:'CANCEL_NOTICE',purpose:'CANCEL_NOTICE',dispatchAttemptId:preallocated?'C-A1':undefined});
    const ready={...cancel,dispatchAttemptId:'C-A1'};
    const binding=makeBinding([cancel],{authorizeDispatch:vi.fn(async()=>authorized(ready)),enqueue:vi.fn(async()=>evidence(ready,'DISPATCHING'))});
    expect(await createMfpPrintHardwareSession(binding).ensureCancelNotice('O1','CANCEL-VALID')).toEqual([expect.objectContaining({canonicalPrintJobId:'C1',dispatchAttemptId:'C-A1',state:'DISPATCHING'})]);
    expect(binding.gateway.enqueueCanonicalPrintJob).toHaveBeenCalledTimes(1);
  });

  it('does not regress canonical acknowledgment when an older dispatch snapshot arrives',async()=>{
    const ack=job({transportState:'ACKNOWLEDGED'});
    const binding=makeBinding([ack],{snapshot:snapshot(evidence(ack,'PERSISTED'))});
    const result=await createMfpPrintHardwareSession(binding).read();
    expect(result.jobs[0]).toMatchObject({transportState:'ACKNOWLEDGED',attention:{kind:'ACKNOWLEDGED'}});
  });

  it.each(['NOT_STARTED','PERSISTED','DISPATCHING','FAILED_BEFORE_SEND'] as const)('does not downgrade canonical ambiguous evidence to %s',async state=>{
    const unknown=job({transportState:'AMBIGUOUS_AFTER_SEND'});
    const binding=makeBinding([unknown],{snapshot:snapshot(evidence(unknown,state))});
    const session=createMfpPrintHardwareSession(binding);
    expect((await session.read()).jobs[0]).toMatchObject({transportState:'AMBIGUOUS_AFTER_SEND',attention:{kind:'HUMAN_CHECK'}});
    await expect(session.requestSafeRetry('J1','UNSAFE-RETRY')).rejects.toThrow('MFP_PRINT_SAFE_RETRY_FORBIDDEN');
    expect(binding.authority.requestSafeRetry).not.toHaveBeenCalled();
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it('permits an exact acknowledged readback to resolve canonical ambiguity',async()=>{
    const unknown=job({transportState:'AMBIGUOUS_AFTER_SEND'});
    const binding=makeBinding([unknown],{snapshot:snapshot(evidence(unknown,'ACKNOWLEDGED'))});
    expect((await createMfpPrintHardwareSession(binding).read()).jobs[0]).toMatchObject({transportState:'ACKNOWLEDGED',attention:{kind:'ACKNOWLEDGED'}});
    expect(binding.gateway.enqueueCanonicalPrintJob).not.toHaveBeenCalled();
  });

  it('keeps concurrently reordered responses tied to their original requests',async()=>{
    const other=job({canonicalPrintJobId:'J2',dispatchAttemptId:'ATTEMPT-J2',payloadDigest:'digest-j2'});
    let resolveFirst!:(value:unknown)=>void;
    const first=new Promise<unknown>(resolve=>{resolveFirst=resolve;});
    const enqueue=vi.fn(async(input:Parameters<MfpPrintGatewayPort['enqueueCanonicalPrintJob']>[0])=>input.canonicalPrintJobId==='J1'?first:evidence(other,'ACKNOWLEDGED'));
    const binding=makeBinding([job(),other],{enqueue});
    const session=createMfpPrintHardwareSession(binding);
    const pending=session.dispatchCanonical('J1');
    const second=await session.dispatchCanonical('J2');
    resolveFirst(evidence(other,'ACKNOWLEDGED'));
    expect(second).toMatchObject({canonicalPrintJobId:'J2',state:'ACKNOWLEDGED'});
    expect(await pending).toMatchObject({canonicalPrintJobId:'J1',dispatchAttemptId:'ATTEMPT-J1',payloadDigest:'digest-j1',state:'AMBIGUOUS_AFTER_SEND'});
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});


describe('Admin-owned immutable print template pin',()=>{
  it('dispatches an authorized existing job with its original pin after Admin selects a newer template',async()=>{
    const original=job({templateId:'production-v3',templateRevision:1,payloadDigest:'original-digest'});
    const enqueue=vi.fn(async()=>evidence(original,'DISPATCHING'));
    const binding=makeBinding([original],{bindings:[{...printer,publishedTemplateId:'production-v4'}],enqueue});
    await expect(createMfpPrintHardwareSession(binding).dispatchCanonical('J1')).resolves.toMatchObject({state:'DISPATCHING',payloadDigest:'original-digest'});
    expect(binding.authority.authorizeDispatch).toHaveBeenCalledWith('J1');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({canonicalPrintJobId:'J1',payloadDigest:'original-digest'}));
    expect(original).toMatchObject({templateId:'production-v3',templateRevision:1});
  });
});

it('keeps an authority-issued reprint on its pinned old template after an endpoint hint changes',async()=>{
  const source=job({transportState:'ACKNOWLEDGED'});
  const reprint=job({canonicalPrintJobId:'J1-REPRINT',purpose:'REPRINT',reprintOfPrintJobId:'J1',dispatchAttemptId:'REPRINT-A1',templateId:'production-v3',templateRevision:1,payloadDigest:'reprint-old-template',kickDrawer:false});
  const enqueue=vi.fn(async()=>evidence(reprint,'DISPATCHING'));
  const binding=makeBinding([source],{bindings:[{...printer,publishedTemplateId:'production-v4'}],requestReprint:vi.fn(async()=>[authorized(reprint)]),enqueue});
  await expect(createMfpPrintHardwareSession(binding).requestReprint({requestId:'OLD-TEMPLATE-REPRINT',orderId:'O1',reason:'Authorized reprint',humanConfirmed:true,selection:{kind:'WHOLE_TICKET',sourcePrintJobId:'J1',jobType:'PRODUCTION'}})).resolves.toMatchObject([{state:'DISPATCHING',payloadDigest:'reprint-old-template'}]);
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(reprint).toMatchObject({templateId:'production-v3',templateRevision:1,kickDrawer:false});
});

it.each([
  [{templateId:''},'MFP_PRINT_TEMPLATE_REQUIRED'],
  [{templateRevision:0},'MFP_PRINT_TEMPLATE_REVISION_INVALID'],
  [{canonicalPrintJobId:'FOREIGN-JOB'},'MFP_PRINT_JOB_IDENTITY_MISMATCH'],
] as const)('never uses an endpoint template hint to rescue invalid or foreign canonical identity %j',async(overrides,code)=>{
  const enqueue=vi.fn();
  const binding=makeBinding([job()],{bindings:[{...printer,publishedTemplateId:'production-v4'}],authorizeDispatch:vi.fn(async()=>authorized(job(overrides))),enqueue});
  await expect(createMfpPrintHardwareSession(binding).dispatchCanonical('J1')).rejects.toThrow(code);
  expect(enqueue).not.toHaveBeenCalled();
});
