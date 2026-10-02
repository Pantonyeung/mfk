import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';

import type {MfpCustomerExternalIntent,MfpExternalReadModel,MfpKeetaExternalIntent} from './external-domain.ts';
import {MfpExternalInbox,MfpExternalReviewPanel,startMfpExternalLifecycle} from './external-runtime.tsx';

const customer:MfpCustomerExternalIntent={
  kind:'CUSTOMER',submissionId:'C1',idempotencyKey:'K1',revision:1,customerDisplayName:'陳小姐',phone:'85291234567',
  itemCount:2,previewAmountMinor:10400,serviceMode:'TAKEAWAY',paymentMethod:'ELECTRONIC',paymentChannelId:'FPS',paymentEvidenceRef:'https://evidence.example/C1',evidenceReview:'VERIFIED',createdAt:'2026-10-02T09:00:00.000Z',
  status:'PENDING',attentionCode:null,canonicalOrderId:null,productIds:['P1'],items:[{lineId:'L1',name:'飯團',quantity:2,previewUnitMinor:5200}],
};
const keeta:MfpKeetaExternalIntent={
  kind:'KEETA',provider:'KEETA',providerShopId:100,providerOrderId:'K100',providerMessageId:'M100',fingerprint:'F100',providerPushedAt:'2026-10-02T09:01:00.000Z',receivedAt:'2026-10-02T09:01:01.000Z',revision:2,providerEvidenceRef:'KEETA-E-100',
  itemCount:1,amountMinor:6800,mappingState:'VALID',mappingRevision:'MAP-1',providerFactsValid:true,acceptanceMode:'MANUAL',deferCount:1,status:'ATTENTION',attentionCode:'ACK_RETRY',canonicalOrderId:null,productIds:['P1'],items:[{providerLineId:'KL1',providerName:'Keeta 飯團',quantity:1,mappedProductId:'P1',mappedName:'飯團'}],
};
const model:MfpExternalReadModel={
  schema:'mfp.external.read.v1',storeId:'MF01',revision:3,readAt:'2026-10-02T09:02:00.000Z',
  customer:{intents:[customer],confirmations:[{confirmationId:'CONF-1',orderId:'O1',expectedRevision:2,proposedChangeRef:'MOD-1',state:'UNKNOWN',amountDeltaMinor:100,observedAt:'2026-10-02T09:02:00.000Z'}],acceptance:{revision:2,mode:'SPECIAL_CUTOFF',acceptingNew:false,cutoffAt:'2026-10-02T16:30:00.000Z',message:'提早截單'}},
  keeta:{intents:[keeta],lifecycleEvents:[{providerOrderId:'K100',providerMessageId:'L1',fingerprint:'LF1',providerPushedAt:'2026-10-02T09:02:00.000Z',receivedAt:'2026-10-02T09:02:01.000Z',eventCode:'READY',canonicalOrderId:'O-K100',state:'ATTENTION',attentionCode:'ACK_FAILED'}],afterSales:[{afterSaleOrderId:'AS-1',providerOrderId:'K100',providerMessageId:'AS-M1',canonicalOrderId:'O-K100',providerStatus:'PENDING',requestedRefundMinor:1000,eligibleRefundMinor:2000,lineUnits:[{lineId:'L1',quantity:1}],state:'PENDING',attentionCode:null}]},
  health:{customer:{state:'READY',code:null,observedAt:'2026-10-02T09:02:00.000Z'},keeta:{state:'ATTENTION',code:'ACK_FAILED',observedAt:'2026-10-02T09:02:00.000Z'}},
};
const actions={onAccept:vi.fn(),onReviewEvidence:vi.fn(),onModify:vi.fn(),onCancel:vi.fn(),onDefer:vi.fn(),onRefresh:vi.fn(),onSetCustomerControl:vi.fn(),onAfterSaleDecision:vi.fn(),onApplyAfterSaleRefund:vi.fn()};

describe('MFP V3 A8 external pending UI',()=>{
  it('binds real Customer and Keeta read-model facts into the Pad top strip',()=>{
    const html=renderToStaticMarkup(<MfpExternalInbox surface="MFP_PAD" model={model} actions={actions}/>);
    expect(html).toContain('data-external-surface="MFP_PAD"');expect(html).toContain('陳小姐');expect(html).toContain('2 件');expect(html).toContain('$104.00');
    expect(html).toContain('K100');expect(html).toContain('$68.00');expect(html).toContain('ACK_RETRY');
  });

  it('renders a touch-first Mobile inbox instead of a shrunken Pad strip',()=>{
    const html=renderToStaticMarkup(<MfpExternalInbox surface="MFP_MOBILE" model={model} actions={actions}/>);
    expect(html).toContain('data-external-surface="MFP_MOBILE"');expect(html).toContain('mfp-external-mobile-inbox');expect(html).not.toContain('mfp-external-pad-strip');
  });

  it('shows canonical Customer cutoff state and WhatsApp fallback without stopping local MFP',()=>{
    const html=renderToStaticMarkup(<MfpExternalInbox surface="MFP_PAD" model={model} actions={actions}/>);
    expect(html).toContain('SPECIAL_CUTOFF');expect(html).toContain('提早截單');expect(html).toContain('WhatsApp fallback');expect(html).toContain('只影響新 Customer 單');
  });

  it('shows Customer items, evidence review, zoom, WhatsApp QR/contact and formal actions in a stable major panel',()=>{
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={customer} model={model} actions={actions} onClose={vi.fn()}/>);
    for(const value of ['mfp-external-review','飯團','FPS','VERIFIED','放大檢視','WhatsApp QR / Contact','Accept','Modify','Cancel'])expect(html).toContain(value);
    expect(html).toContain('data-payment-truth="STORE_KERNEL_ONLY"');expect(html).toContain('data-whatsapp-order-writer="false"');
  });

  it.each(['UNREVIEWED','REJECTED','NEEDS_RESUBMISSION'] as const)('keeps Customer %s evidence out of paid truth',evidenceReview=>{
    const intent={...customer,evidenceReview};
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={intent} model={{...model,customer:{...model.customer,intents:[intent]}}} actions={actions} onClose={vi.fn()}/>);
    expect(html).toContain(evidenceReview);expect(html).toContain('disabled=""');expect(html).toContain('EVIDENCE ≠ PAYMENT TRUTH');
  });

  it('shows Keeta provider identity, mapping, Immediate/Later, lifecycle and after-sale facts',()=>{
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={keeta} model={model} actions={actions} onClose={vi.fn()}/>);
    for(const value of ['K100','M100','F100','Keeta 飯團','飯團','Immediate','Later','defer 1 / 2','ACK_FAILED','AS-1','APPROVE','REJECT'])expect(html).toContain(value);
    expect(html).toContain('data-provider-decision="NOT_LOCAL_REFUND_TRUTH"');
  });

  it('disables Later at deferCount 2 while keeping the order visible',()=>{
    const intent={...keeta,deferCount:2 as const};
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={intent} model={{...model,keeta:{...model.keeta,intents:[intent]}}} actions={actions} onClose={vi.fn()}/>);
    expect(html).toContain('defer 2 / 2');expect(html).toContain('Later');expect(html).toContain('disabled=""');expect(html).toContain('K100');
  });

  it('offers formal partial refund application only after provider approval',()=>{
    const approved={...model.keeta.afterSales[0]!,state:'APPROVED' as const};
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={keeta} model={{...model,keeta:{...model.keeta,afterSales:[approved]}}} actions={actions} onClose={vi.fn()}/>);
    expect(html).toContain('Apply formal partial refund');expect(html).toContain('A6 / A5 canonical refund');
  });

  it('surfaces Customer confirmation UNKNOWN as pending rather than accepted',()=>{
    const html=renderToStaticMarkup(<MfpExternalReviewPanel intent={customer} model={model} actions={actions} onClose={vi.fn()}/>);
    expect(html).toContain('CONF-1');expect(html).toContain('UNKNOWN');expect(html).toContain('等候客人確認');
  });
});

describe('MFP V3 A8 external runtime safety',()=>{
  it('installs startup, Doorbell and online only, with no focus/visibility/interval request fan-out',()=>{
    const coordinator={startup:vi.fn(async()=>undefined),networkOnline:vi.fn(async()=>undefined),networkOffline:vi.fn(),connectDoorbell:vi.fn(()=>vi.fn())};
    const listeners=new Map<string,()=>void>();
    const environment={addEventListener:vi.fn((type:string,listener:()=>void)=>listeners.set(type,listener)),removeEventListener:vi.fn(),navigator:{onLine:true}};
    const stop=startMfpExternalLifecycle(coordinator,environment);
    expect(environment.addEventListener).toHaveBeenCalledTimes(2);expect([...listeners.keys()]).toEqual(['online','offline']);expect(coordinator.startup).toHaveBeenCalledTimes(1);expect(coordinator.connectDoorbell).toHaveBeenCalledTimes(1);
    stop();
  });

  it('contains no periodic/focus/visibility pull or provider secret/browser credential surface',()=>{
    const source=readFileSync(new URL('./external-runtime.tsx',import.meta.url),'utf8');
    expect(source).not.toMatch(/setInterval|visibilitychange|addEventListener\(['"]focus/);
    expect(source).not.toMatch(/appSecret|signingKey|webhookSecret|longLivedBearer|Authorization:/i);
    expect(source).not.toMatch(/from .*(v2local|v2smm)/);
    expect(source).toContain('QRCode.toDataURL');
  });

  it('keeps formal action submitting, rejected, unknown and committed readback states explicit',()=>{
    const source=readFileSync(new URL('./external-runtime.tsx',import.meta.url),'utf8');
    for(const value of ['處理中','REJECTED','UNKNOWN','SOURCE_VERIFIED','canonical readback'])expect(source).toContain(value);
  });

  it('keeps the review panel keyboard trapped, labelled and status updates announced',()=>{
    const source=readFileSync(new URL('./external-runtime.tsx',import.meta.url),'utf8');
    for(const value of ['aria-labelledby={titleId}','closeRef.current?.focus()','event.key===\'Escape\'','querySelectorAll<HTMLElement>','aria-live="polite"'])expect(source).toContain(value);
  });

  it('is mounted above the shared application workspace and reuses A6 authority',()=>{
    const source=readFileSync(new URL('./order-operations-runtime.tsx',import.meta.url),'utf8');
    expect(source).toContain('<MfpExternalRuntime');expect(source).toContain('authority={operations.authority}');
    expect(source.indexOf('<MfpExternalRuntime')).toBeLessThan(source.indexOf('<MfpOperationsNavigation'));
  });
});
