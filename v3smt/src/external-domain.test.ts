import {describe,expect,it,vi} from 'vitest';

import {
  buildMfpWhatsAppContact,
  canAutoAcceptMfpKeeta,
  cancelMfpCustomerPending,
  createMfpCustomerChannelControlSession,
  createMfpCustomerConfirmationSession,
  createMfpExternalAdmissionSession,
  createMfpExternalCoordinator,
  createMfpKeetaAfterSaleRefundSession,
  createMfpKeetaLifecycleSession,
  decideMfpKeetaAfterSale,
  deferMfpKeetaIntent,
  proposeMfpCustomerModification,
  reviewMfpCustomerEvidence,
  validateMfpExternalReadModel,
  type MfpCustomerExternalIntent,
  type MfpCustomerModificationConfirmation,
  type MfpExternalReadModel,
  type MfpKeetaAfterSaleCase,
  type MfpKeetaExternalIntent,
  type MfpKeetaLifecycleEvent,
} from './external-domain.ts';
import type {MfpCanonicalOrder,MfpOrderOperationsReadModel} from './order-operations-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import {
  MFP_STORE_KERNEL_RESULT_SCHEMA,
  createMfpStoreKernelPort,
  type MfpCommandOutbox,
  type MfpOutboxRecord,
} from './store-kernel-port.ts';

class MemoryOutbox implements MfpCommandOutbox{
  readonly rows=new Map<string,MfpOutboxRecord>();
  async read(submissionId:string){return this.rows.get(submissionId);}
  async write(record:MfpOutboxRecord){this.rows.set(record.submissionId,record);}
}

const customer:MfpCustomerExternalIntent=Object.freeze({
  kind:'CUSTOMER',submissionId:'C1',idempotencyKey:'K1',revision:'EXT-1',
  customerDisplayName:'陳小姐',phone:'85291234567',itemCount:1,previewAmountMinor:5200,
  serviceMode:'TAKEAWAY',paymentMethod:'PAY_AT_STORE',paymentChannelId:null,
  paymentEvidenceRef:null,evidenceReview:'NOT_REQUIRED',createdAt:'2026-10-02T09:00:00.000Z',
  status:'PENDING',attentionCode:null,canonicalOrderId:null,
  productIds:Object.freeze(['P1']),
  items:Object.freeze([Object.freeze({lineId:'C-L1',name:'飯團',quantity:1,previewUnitMinor:5200})]),
});

const keeta:MfpKeetaExternalIntent=Object.freeze({
  kind:'KEETA',provider:'KEETA',providerShopId:100,providerOrderId:'K100',
  providerMessageId:'M100',fingerprint:'F100',providerPushedAt:'2026-10-02T09:00:00.000Z',
  receivedAt:'2026-10-02T09:00:01.000Z',revision:'EXT-2',providerEvidenceRef:'KEETA-EVIDENCE-100',
  itemCount:1,amountMinor:6800,mappingState:'VALID',mappingRevision:'MAP-7',providerFactsValid:true,
  acceptanceMode:'MANUAL',deferCount:0,status:'PENDING',attentionCode:null,canonicalOrderId:null,
  productIds:Object.freeze(['P1']),
  items:Object.freeze([Object.freeze({providerLineId:'K-L1',providerName:'Keeta 飯團',quantity:1,mappedProductId:'P1',mappedName:'飯團'})]),
});

const canonicalOrder=(orderId:string,source:'MORE_FUN_APP'|'KEETA'):MfpCanonicalOrder=>Object.freeze({
  orderId,displayNumber:orderId,source,createdAt:'2026-10-02T09:01:00.000Z',revision:1,
  fulfillmentState:'IN_PROGRESS',effectiveTenderId:source==='KEETA'?'KEETA':'PAY_AT_STORE',
  recognizedAmountMinor:source==='KEETA'?6800:0,outstandingAmountMinor:source==='KEETA'?0:5200,
  serviceMode:'TAKEAWAY',items:Object.freeze([Object.freeze({lineId:'L1',productId:'P1',name:'飯團',quantity:1,unitMinor:5200})]),
  adjustments:Object.freeze([]),
});

const operations=():MfpOrderOperationsReadModel=>({
  schema:'mfp.order-operations.read.v1',storeId:'MF01',revision:1,readAt:'2026-10-02T09:00:00.000Z',orders:Object.freeze([]),
  dining:{revision:1,waiting:Object.freeze([]),tables:Object.freeze([
    ['T01','1'],['T02','2'],['T03','3'],['T04','4'],['T05','5'],['T06','6'],['T07','7'],['T08','8'],['OUTDOOR','戶外'],
  ].map(([tableId,label])=>Object.freeze({tableId:tableId as 'T01',label,location:tableId==='OUTDOOR'?'OUTDOOR' as const:'INDOOR' as const,revision:1,state:'AVAILABLE' as const})))},
  availability:{revision:1,items:Object.freeze([])},
  capacity:{revision:1,pools:Object.freeze([Object.freeze({
    poolId:'POOL-1',name:'飯團',businessDayId:'BD-1',businessDate:'2026-10-02',resetAt:'2026-10-03T06:00:00.000Z',revision:1,
    initialQuantity:100,usedQuantity:1,remainingQuantity:99,boundProductIds:Object.freeze(['P1']),consumptionByProduct:Object.freeze([]),
    thirdPartyThreshold:0,ownPlatformThreshold:0,thirdPartyAccepting:true,ownPlatformAccepting:true,stoppedChannels:Object.freeze([]),overrideRemaining:0,audit:Object.freeze([]),
  })])},
  etaPolicy:{revision:1,workloadBands:Object.freeze([{minimumActive:0,etaMinutes:10}]),diningWarningMinutes:30},
});

function harness(){
  const orders=new Map<string,MfpCanonicalOrder>();
  const submitCommand=vi.fn(async command=>{
    const source=command.commandType==='EXTERNAL_CUSTOMER_ORDER_ADMIT'?'MORE_FUN_APP' as const:'KEETA' as const;
    const orderId=source==='MORE_FUN_APP'?'O-C1':'O-K100';
    orders.set(orderId,canonicalOrder(orderId,source));
    return {schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:`COMMIT-${orderId}`,canonicalRevision:1,orderRef:orderId};
  });
  const port=createMfpStoreKernelPort({outbox:new MemoryOutbox(),transport:{
    submitCommand,
    readSubmission:async submissionId=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId,state:'COMMITTED',commitId:`READ-${submissionId}`,canonicalRevision:1,orderRef:submissionId==='C1'?'O-C1':'O-K100'}),
  }});
  const security={submitFrontlineFormalCommand:command=>port.submitFormalCommand({...command,deviceId:'PAD-1',staffSessionRef:'SESSION-1'})} as Pick<MfpSecurityPort,'submitFrontlineFormalCommand'>;
  const adapter={submitExternalAction:vi.fn(async()=>Object.freeze({state:'ACKNOWLEDGED' as const}))};
  const authority={readOrder:vi.fn(async(orderId:string)=>orders.get(orderId)??null),readOperations:vi.fn(async()=>operations())};
  return {orders,submitCommand,security,adapter,authority};
}

describe('MFP V3 A8 first RED — EXTERNAL DUPLICATE != NEW FORMAL ORDER',()=>{
  it('keeps duplicate Customer C1/K1 pending at zero Orders, then Accepts the same canonical Order once',async()=>{
    const h=harness();
    const session=createMfpExternalAdmissionSession({intent:customer,security:h.security,authority:h.authority,adapter:h.adapter});

    expect(h.orders.size).toBe(0);
    const [first,replay]=await Promise.all([session.accept(),session.accept()]);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({state:'COMMITTED',order:{orderId:'O-C1',source:'MORE_FUN_APP'}});
    expect(h.orders.size).toBe(1);
    expect(h.submitCommand).toHaveBeenCalledTimes(1);
    expect(h.adapter.submitExternalAction).toHaveBeenCalledTimes(1);
  });

  it('maps duplicate Keeta K100/M100/F100 to one external intent, one canonical Order and one ACK lineage',async()=>{
    const h=harness();
    const session=createMfpExternalAdmissionSession({intent:keeta,security:h.security,authority:h.authority,adapter:h.adapter});

    expect(h.orders.size).toBe(0);
    const [first,replay]=await Promise.all([session.accept(),session.accept()]);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({state:'COMMITTED',order:{orderId:'O-K100',source:'KEETA'},ackState:'ACKNOWLEDGED'});
    expect(h.orders.size).toBe(1);
    expect(h.submitCommand).toHaveBeenCalledTimes(1);
    expect(h.adapter.submitExternalAction).toHaveBeenCalledTimes(1);
  });
});

const externalModel=(overrides:Partial<MfpExternalReadModel>={}):MfpExternalReadModel=>({
  schema:'mfp.external.read.v1',storeId:'MF01',revision:1,readAt:'2026-10-02T09:00:00.000Z',
  customer:{
    intents:Object.freeze([customer]),
    confirmations:Object.freeze([]),
    acceptance:{revision:1,mode:'OPEN',acceptingNew:true,cutoffAt:null,message:null},
  },
  keeta:{intents:Object.freeze([keeta]),lifecycleEvents:Object.freeze([]),afterSales:Object.freeze([])},
  health:{customer:{state:'READY',code:null,observedAt:'2026-10-02T09:00:00.000Z'},keeta:{state:'READY',code:null,observedAt:'2026-10-02T09:00:00.000Z'}},
  ...overrides,
});

describe('MFP V3 A8 bounded external read model',()=>{
  it('deduplicates the exact same Customer submissionId/idempotencyKey',()=>{
    const model=externalModel({customer:{...externalModel().customer,intents:[customer,{...customer}]}});
    expect(validateMfpExternalReadModel(model).customer.intents).toHaveLength(1);
  });

  it('fails a reused Customer submission identity with conflicting material closed',()=>{
    const model=externalModel({customer:{...externalModel().customer,intents:[customer,{...customer,previewAmountMinor:9999}]}});
    expect(()=>validateMfpExternalReadModel(model)).toThrow('MFP_CUSTOMER_INTENT_IDENTITY_CONFLICT');
  });

  it('deduplicates exact Keeta providerOrderId/providerMessageId/fingerprint identity',()=>{
    const model=externalModel({keeta:{...externalModel().keeta,intents:[keeta,{...keeta}]}});
    expect(validateMfpExternalReadModel(model).keeta.intents).toHaveLength(1);
  });

  it('does not use Keeta display amount as dedupe identity',()=>{
    const model=externalModel({keeta:{...externalModel().keeta,intents:[keeta,{...keeta,amountMinor:9999}]}});
    expect(()=>validateMfpExternalReadModel(model)).toThrow('MFP_KEETA_INTENT_IDENTITY_CONFLICT');
  });

  it('deduplicates exact lifecycle and after-sale inbound events',()=>{
    const life=lifecycle();const sale=afterSale();
    const result=validateMfpExternalReadModel(externalModel({keeta:{intents:[keeta],lifecycleEvents:[life,{...life}],afterSales:[sale,{...sale}]}}));
    expect(result.keeta.lifecycleEvents).toHaveLength(1);expect(result.keeta.afterSales).toHaveLength(1);
  });

  it('fails conflicting lifecycle, after-sale and confirmation identities closed',()=>{
    const life=lifecycle();const sale=afterSale();const confirm=confirmation('ACCEPTED');
    expect(()=>validateMfpExternalReadModel(externalModel({keeta:{intents:[keeta],lifecycleEvents:[life,{...life,fingerprint:'CHANGED'}],afterSales:[]}}))).toThrow('MFP_KEETA_LIFECYCLE_IDENTITY_CONFLICT');
    expect(()=>validateMfpExternalReadModel(externalModel({keeta:{intents:[keeta],lifecycleEvents:[],afterSales:[sale,{...sale,providerMessageId:'CHANGED'}]}}))).toThrow('MFP_KEETA_AFTER_SALE_IDENTITY_CONFLICT');
    expect(()=>validateMfpExternalReadModel(externalModel({customer:{...externalModel().customer,confirmations:[confirm,{...confirm,state:'REJECTED'}]}}))).toThrow('MFP_CUSTOMER_CONFIRMATION_IDENTITY_CONFLICT');
  });

  it.each(['MISSING','AMBIGUOUS'] as const)('keeps %s Keeta mapping as attention and not formally admissible',mappingState=>{
    const blocked={...keeta,mappingState,mappingRevision:null,status:'ATTENTION' as const,attentionCode:`KEETA_MAPPING_${mappingState}`};
    expect(validateMfpExternalReadModel(externalModel({keeta:{...externalModel().keeta,intents:[blocked]}})).keeta.intents[0]).toMatchObject({mappingState,status:'ATTENTION'});
    const h=harness();
    expect(()=>createMfpExternalAdmissionSession({intent:blocked,security:h.security,authority:h.authority,adapter:h.adapter})).toThrow('MFP_KEETA_MAPPING_INVALID');
    expect(h.orders.size).toBe(0);
  });
});

describe('MFP V3 A8 Customer evidence and WhatsApp remain non-authoritative',()=>{
  it('rejects electronic formal admission before evidence is VERIFIED',()=>{
    const h=harness();
    expect(()=>createMfpExternalAdmissionSession({intent:{...customer,paymentMethod:'ELECTRONIC',paymentChannelId:'FPS',paymentEvidenceRef:'E1',evidenceReview:'UNREVIEWED'},security:h.security,authority:h.authority,adapter:h.adapter})).toThrow('MFP_CUSTOMER_PAYMENT_EVIDENCE_NOT_VERIFIED');
    expect(h.orders.size).toBe(0);
  });

  it.each(['VERIFIED','REJECTED','NEEDS_RESUBMISSION'] as const)('submits %s as evidence review only',async evidenceReview=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    const result=await reviewMfpCustomerEvidence(adapter,{...customer,paymentMethod:'ELECTRONIC',paymentChannelId:'FPS',paymentEvidenceRef:'E1',evidenceReview:'UNREVIEWED'},evidenceReview);
    expect(result).toMatchObject({state:'ACKNOWLEDGED'});
    expect(adapter.submitExternalAction).toHaveBeenCalledWith(expect.objectContaining({kind:'CUSTOMER_EVIDENCE_REVIEW',evidenceReview}));
    expect(JSON.stringify(adapter.submitExternalAction.mock.calls)).not.toMatch(/paymentTruth|paid/i);
  });

  it('keeps REJECTED evidence pending for customer action',()=>{
    expect(validateMfpExternalReadModel(externalModel({customer:{...externalModel().customer,intents:[{...customer,paymentMethod:'ELECTRONIC',paymentChannelId:'FPS',paymentEvidenceRef:'E1',evidenceReview:'REJECTED',status:'PENDING'}]}})).customer.intents[0]).toMatchObject({status:'PENDING',evidenceReview:'REJECTED'});
  });

  it('builds deterministic WhatsApp contact without changing Order, payment or evidence truth',()=>{
    const result=buildMfpWhatsAppContact({...customer,paymentMethod:'ELECTRONIC',paymentChannelId:'FPS',paymentEvidenceRef:'E1',evidenceReview:'REJECTED'},'AMOUNT_MISMATCH');
    expect(result.phone).toBe('85291234567');
    expect(result.url).toBe(`https://wa.me/${result.phone}?text=${encodeURIComponent(result.message)}`);
    expect(result).not.toHaveProperty('order');
    expect(result).not.toHaveProperty('payment');
  });

  it('fails an invalid WhatsApp phone closed',()=>{
    expect(()=>buildMfpWhatsAppContact({...customer,phone:'123'},'UNCLEAR')).toThrow('MFP_CUSTOMER_WHATSAPP_PHONE_INVALID');
  });

  it('cancels only the pending Customer intent through the external adapter',async()=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    await cancelMfpCustomerPending(adapter,customer,'客人取消');
    expect(adapter.submitExternalAction).toHaveBeenCalledWith(expect.objectContaining({kind:'CUSTOMER_PENDING_CANCEL',submissionId:'C1'}));
    expect(JSON.stringify(adapter.submitExternalAction.mock.calls)).not.toMatch(/ORDER_CANCEL|refund/i);
  });

  it('proposes a modification without inventing a Customer confirmation or formal Order',async()=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ATTENTION' as const,code:'CUSTOMER_CONFIRMATION_REQUIRED'}))};
    expect(await proposeMfpCustomerModification(adapter,customer,'少飯')).toEqual({state:'ATTENTION',code:'CUSTOMER_CONFIRMATION_REQUIRED'});
    expect(adapter.submitExternalAction).toHaveBeenCalledWith(expect.objectContaining({kind:'CUSTOMER_MODIFICATION_PROPOSE',proposal:'少飯'}));
    expect(JSON.stringify(adapter.submitExternalAction.mock.calls)).not.toMatch(/ORDER_MODIFICATION_CUSTOMER_DECISION|ACCEPTED/);
  });
});

describe('MFP V3 A8 Keeta Later semantics',()=>{
  it('distinguishes valid AUTO from MANUAL and invalid provider facts',()=>{
    expect(canAutoAcceptMfpKeeta({...keeta,acceptanceMode:'AUTO'})).toBe(true);
    expect(canAutoAcceptMfpKeeta(keeta)).toBe(false);
    expect(canAutoAcceptMfpKeeta({...keeta,acceptanceMode:'AUTO',providerFactsValid:false,status:'ATTENTION'})).toBe(false);
  });
  it.each([[0,1],[1,2]] as const)('allows defer %i → %i and keeps the intent pending',async(deferCount,nextDeferCount)=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    await deferMfpKeetaIntent(adapter,{...keeta,deferCount},'2026-10-02T09:05:00.000Z');
    expect(adapter.submitExternalAction).toHaveBeenCalledWith(expect.objectContaining({kind:'KEETA_DEFER',nextDeferCount,status:'PENDING'}));
    expect(JSON.stringify(adapter.submitExternalAction.mock.calls)).not.toMatch(/ACCEPT|REJECT|CANCEL/);
  });

  it('blocks Later after deferCount 2',async()=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    await expect(deferMfpKeetaIntent(adapter,{...keeta,deferCount:2},'2026-10-02T09:05:00.000Z')).rejects.toThrow('MFP_KEETA_DEFER_LIMIT_REACHED');
    expect(adapter.submitExternalAction).not.toHaveBeenCalled();
  });
});

describe('MFP V3 A8 Customer cutoff / immediate stop',()=>{
  it.each([
    ['SPECIAL_CUTOFF','2026-10-02T16:30:00.000Z'],
    ['IMMEDIATE_STOP',null],
  ] as const)('%s blocks only future Customer submissions through formal policy',async(mode,cutoffAt)=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({
      schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,
      commitId:'CONTROL-COMMIT',canonicalRevision:2,
    }));
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    const session=createMfpCustomerChannelControlSession({
      commandId:`CONTROL-${mode}`,expectedRevision:1,mode,cutoffAt,message:'暫停網上下單',
      security:{submitFrontlineFormalCommand},adapter,now:()=> '2026-10-02T09:00:00.000Z',
    });

    expect(await session.submit()).toMatchObject({state:'COMMITTED',propagationState:'ACKNOWLEDGED'});
    const command=submitFrontlineFormalCommand.mock.calls[0]?.[0];
    expect(command).toMatchObject({commandType:'CUSTOMER_NEW_ORDER_ACCEPTANCE_SET',payload:{scope:'FUTURE_CUSTOMER_SUBMISSIONS_ONLY',mode,cutoffAt}});
    expect(JSON.stringify(command)).not.toMatch(/ORDER_CANCEL|refund|localTrading/i);
  });

  it('keeps duplicate channel-control submit terminal',async()=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2}));
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    const session=createMfpCustomerChannelControlSession({commandId:'CONTROL-1',expectedRevision:1,mode:'OPEN',cutoffAt:null,message:null,security:{submitFrontlineFormalCommand},adapter});
    await session.submit();await session.submit();
    expect(submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);expect(adapter.submitExternalAction).toHaveBeenCalledTimes(1);
  });
});

const confirmation=(state:MfpCustomerModificationConfirmation['state'],amountDeltaMinor=0):MfpCustomerModificationConfirmation=>({
  confirmationId:'CONFIRM-1',orderId:'O-C1',expectedRevision:1,proposedChangeRef:'MOD-1',state,amountDeltaMinor,
  observedAt:'2026-10-02T09:10:00.000Z',
});

describe('MFP V3 A8 Customer modification confirmation',()=>{
  it('keeps timeout/UNKNOWN pending and submits no formal command',async()=>{
    const submitFrontlineFormalCommand=vi.fn();
    const session=createMfpCustomerConfirmationSession({confirmation:confirmation('UNKNOWN'),security:{submitFrontlineFormalCommand},authority:{readOrder:vi.fn()}});
    expect(await session.submit()).toEqual({state:'PENDING',confirmationState:'UNKNOWN'});
    expect(submitFrontlineFormalCommand).not.toHaveBeenCalled();
  });

  it.each(['ACCEPTED','REJECTED'] as const)('%s updates the same canonical Order through Store Kernel readback',async state=>{
    const order=canonicalOrder('O-C1','MORE_FUN_APP');
    const submitFrontlineFormalCommand=vi.fn(async command=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O-C1'}));
    const session=createMfpCustomerConfirmationSession({confirmation:confirmation(state),security:{submitFrontlineFormalCommand},authority:{readOrder:async()=>({...order,revision:2,modificationState:state==='ACCEPTED'?'CONFIRMED':'REJECTED'})}});
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O-C1'}});
    expect(submitFrontlineFormalCommand).toHaveBeenCalledWith(expect.objectContaining({commandType:'ORDER_MODIFICATION_CUSTOMER_DECISION',payload:expect.objectContaining({orderId:'O-C1',decision:state})}));
  });

  it.each([[100,'A5_PAYMENT_TOP_UP_REQUIRED'],[-100,'A6_A5_REFUND_REQUIRED'],[0,'NONE']] as const)('routes amount delta %i to %s without settling money locally',(amountDeltaMinor,moneyRoute)=>{
    const submitFrontlineFormalCommand=vi.fn();
    const session=createMfpCustomerConfirmationSession({confirmation:confirmation('ACCEPTED',amountDeltaMinor),security:{submitFrontlineFormalCommand},authority:{readOrder:vi.fn()}});
    expect(session.command).toMatchObject({payload:{moneyRoute,amountDeltaMinor}});
    expect(JSON.stringify(session.command)).not.toMatch(/paymentState|refundState|paid/i);
  });
});

const lifecycle=(overrides:Partial<MfpKeetaLifecycleEvent>={}):MfpKeetaLifecycleEvent=>({
  providerOrderId:'K100',providerMessageId:'LIFE-1',fingerprint:'LF1',providerPushedAt:'2026-10-02T09:20:00.000Z',
  receivedAt:'2026-10-02T09:20:01.000Z',eventCode:'ORDER_READY',canonicalOrderId:'O-K100',state:'PENDING',attentionCode:null,...overrides,
});

describe('MFP V3 A8 Keeta lifecycle',()=>{
  it('links a lifecycle event to the same canonical Order and ACKs once',async()=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O-K100'}));
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    const session=createMfpKeetaLifecycleSession({event:lifecycle(),security:{submitFrontlineFormalCommand},authority:{readOrder:async()=>({...canonicalOrder('O-K100','KEETA'),revision:2})},adapter});
    const [first,replay]=await Promise.all([session.apply(),session.apply()]);
    expect(first).toEqual(replay);expect(first).toMatchObject({state:'COMMITTED',order:{orderId:'O-K100'},ackState:'ACKNOWLEDGED'});
    expect(submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);expect(adapter.submitExternalAction).toHaveBeenCalledTimes(1);
  });

  it('cannot manufacture a new Order when canonical link is absent',()=>{
    expect(()=>createMfpKeetaLifecycleSession({event:lifecycle({canonicalOrderId:null}),security:{submitFrontlineFormalCommand:vi.fn()},authority:{readOrder:vi.fn()},adapter:{submitExternalAction:vi.fn()}})).toThrow('MFP_KEETA_LIFECYCLE_CANONICAL_ORDER_REQUIRED');
  });

  it('fails a stale provider event closed for reconcile',()=>{
    expect(()=>createMfpKeetaLifecycleSession({event:lifecycle({providerPushedAt:'2026-10-02T08:00:00.000Z'}),lastProviderPushedAt:'2026-10-02T09:00:00.000Z',security:{submitFrontlineFormalCommand:vi.fn()},authority:{readOrder:vi.fn()},adapter:{submitExternalAction:vi.fn()}})).toThrow('MFP_KEETA_LIFECYCLE_RECONCILE_REQUIRED');
  });

  it('keeps ACK failure as attention after the local Order commit',async()=>{
    const submitFrontlineFormalCommand=vi.fn(async command=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O-K100'}));
    const session=createMfpKeetaLifecycleSession({event:lifecycle(),security:{submitFrontlineFormalCommand},authority:{readOrder:async()=>canonicalOrder('O-K100','KEETA')},adapter:{submitExternalAction:vi.fn(async()=>{throw new Error('ACK_FAILED');})}});
    expect(await session.apply()).toMatchObject({state:'COMMITTED',ackState:'ATTENTION'});
  });
});

const afterSale=(overrides:Partial<MfpKeetaAfterSaleCase>={}):MfpKeetaAfterSaleCase=>({
  afterSaleOrderId:'AS-1',providerOrderId:'K100',providerMessageId:'AS-M1',canonicalOrderId:'O-K100',providerStatus:'PENDING',
  requestedRefundMinor:1000,eligibleRefundMinor:2000,lineUnits:[{lineId:'L1',quantity:1}],state:'PENDING',attentionCode:null,...overrides,
});

describe('MFP V3 A8 Keeta after-sale uses A6/A5 refund authority',()=>{
  it('keeps provider APPROVE as an external decision only',async()=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ACKNOWLEDGED' as const}))};
    await decideMfpKeetaAfterSale(adapter,afterSale(),'APPROVE');
    expect(adapter.submitExternalAction).toHaveBeenCalledWith(expect.objectContaining({kind:'KEETA_AFTER_SALE_DECISION',decision:'APPROVE'}));
    expect(JSON.stringify(adapter.submitExternalAction.mock.calls)).not.toMatch(/ORDER_REFUND|refundTruth/i);
  });

  it('keeps a provider after-sale failure as attention',async()=>{
    const adapter={submitExternalAction:vi.fn(async()=>({state:'ATTENTION' as const,code:'PROVIDER_UNAVAILABLE'}))};
    expect(await decideMfpKeetaAfterSale(adapter,afterSale(),'REJECT')).toEqual({state:'ATTENTION',code:'PROVIDER_UNAVAILABLE'});
  });

  it('bounds a formal partial refund by canonical eligible amount',()=>{
    const order={...canonicalOrder('O-K100','KEETA'),refundableAmountMinor:900};
    expect(()=>createMfpKeetaAfterSaleRefundSession({case:afterSale({state:'APPROVED'}),order,amountMinor:1000,refundTenderId:'KEETA',lineUnits:[{lineId:'L1',quantity:1}],security:{submitFrontlineFormalCommand:vi.fn()},authority:{readOrder:vi.fn()}})).toThrow('MFP_REFUND_EXCEEDS_ELIGIBLE_AMOUNT');
  });

  it('submits the formal refund through the existing A6 operation command and preserves the same Order',async()=>{
    const order={...canonicalOrder('O-K100','KEETA'),refundableAmountMinor:2000};
    const refunded={...order,revision:2,adjustments:[{adjustmentId:'R1',type:'REFUND' as const,status:'COMMITTED' as const,amountMinor:1000,tenderId:'FPS',occurredAt:'2026-10-02T09:30:00.000Z'}]};
    const submitFrontlineFormalCommand=vi.fn(async command=>({schema:MFP_STORE_KERNEL_RESULT_SCHEMA,submissionId:command.submissionId,state:'COMMITTED' as const,commitId:'C',canonicalRevision:2,orderRef:'O-K100'}));
    const session=createMfpKeetaAfterSaleRefundSession({case:afterSale({state:'APPROVED'}),order,amountMinor:1000,refundTenderId:'FPS',lineUnits:[{lineId:'L1',quantity:1}],security:{submitFrontlineFormalCommand},authority:{readOrder:async()=>refunded}});
    expect(await session.submit()).toMatchObject({state:'COMMITTED',order:{orderId:'O-K100',adjustments:[{tenderId:'FPS'}]}});
    expect(submitFrontlineFormalCommand).toHaveBeenCalledWith(expect.objectContaining({commandType:'ORDER_REFUND'}));
  });
});

describe('MFP V3 A8 canonical channel thresholds',()=>{
  it.each([
    ['CUSTOMER','ownPlatformAccepting'],['KEETA','thirdPartyAccepting'],
  ] as const)('blocks %s from A6 canonical stop facts while leaving existing Orders untouched',async(kind,flag)=>{
    const h=harness();
    const existing=canonicalOrder('EXISTING','MORE_FUN_APP');h.orders.set(existing.orderId,existing);
    const stopped=operations();
    const pool={...stopped.capacity.pools[0]!,[flag]:false};
    h.authority.readOperations.mockResolvedValue({...stopped,orders:[existing],capacity:{revision:2,pools:[pool]}});
    const session=createMfpExternalAdmissionSession({intent:kind==='CUSTOMER'?customer:keeta,security:h.security,authority:h.authority,adapter:h.adapter});
    await expect(session.accept()).rejects.toThrow(kind==='CUSTOMER'?'MFP_CUSTOMER_CHANNEL_STOPPED':'MFP_KEETA_CHANNEL_STOPPED');
    expect(h.orders.get('EXISTING')).toBe(existing);expect(h.submitCommand).not.toHaveBeenCalled();
  });
});

describe('MFP V3 A8 external single-flight coordinator',()=>{
  it('performs no periodic pulls while idle',async()=>{
    const readExternal=vi.fn(async()=>externalModel());
    createMfpExternalCoordinator({transport:{readExternal,connectDoorbell:()=>()=>undefined}});
    await Promise.resolve();
    expect(readExternal).not.toHaveBeenCalled();
  });

  it('coalesces concurrent startup/online/Doorbell triggers without parallel pulls and keeps one bounded trailing read',async()=>{
    let release!:()=>void;let active=0;let maxActive=0;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const readExternal=vi.fn(async()=>{active++;maxActive=Math.max(maxActive,active);if(readExternal.mock.calls.length===1)await gate;active--;return externalModel();});
    const coordinator=createMfpExternalCoordinator({transport:{readExternal,connectDoorbell:()=>()=>undefined}});
    const tasks=[coordinator.startup(),coordinator.networkOnline(),coordinator.doorbellReceived({type:'EXTERNAL_AVAILABLE',payload:{fakeOrder:'NOT_TRUTH'}})];
    release();await Promise.all(tasks);
    expect(maxActive).toBe(1);expect(readExternal).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot().model?.customer.intents[0]?.submissionId).toBe('C1');
  });

  it('bounds an event storm during both reads to two passes',async()=>{
    let coordinator:ReturnType<typeof createMfpExternalCoordinator>;
    const readExternal=vi.fn(async()=>{if(readExternal.mock.calls.length<=2)void coordinator.doorbellReceived({type:'EXTERNAL_AVAILABLE'});return externalModel();});
    coordinator=createMfpExternalCoordinator({transport:{readExternal,connectDoorbell:()=>()=>undefined}});
    await coordinator.startup();
    expect(readExternal).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot().state).toBe('ATTENTION');
  });

  it('treats Doorbell payload as notification only',async()=>{
    const readExternal=vi.fn(async()=>externalModel());
    const coordinator=createMfpExternalCoordinator({transport:{readExternal,connectDoorbell:()=>()=>undefined}});
    await coordinator.doorbellReceived({type:'EXTERNAL_AVAILABLE',payload:{customer:{intents:[{submissionId:'FAKE'}]}}});
    expect(coordinator.getSnapshot().model?.customer.intents[0]?.submissionId).toBe('C1');
  });
});
