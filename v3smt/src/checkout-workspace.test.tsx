import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';

import {MfpCheckoutWorkspace} from './checkout-workspace.tsx';
import type {MfpCheckoutSnapshot,MfpTenderConfig} from './checkout-domain.ts';
import type {MfpNormalizedOrderingIntent,MfpOrderingSurface} from './ordering-domain.ts';

const intent={
  schema:'mfp.ordering.intent.draft.v1',draftOnly:true,pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',serviceMode:'takeaway',checkoutReady:true,previewSubtotalMinor:4800,
  lines:[{cartLineId:'L1',kind:'PRODUCT',productId:'P1',comboId:null,displayName:'特飲',note:'',quantity:1,serviceMode:'takeaway',optionSelections:[],comboSelections:[],materialPriceFacts:[],previewUnitMinor:4800,state:'READY',issues:[],sourceProjection:{storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,projectionHash:'P7',appliedAt:'2026-10-02T06:00:00.000Z'}}],
} as MfpNormalizedOrderingIntent;
const snapshot={
  state:'FINAL_REVIEW',rejectionCode:null,draftRevalidationRequired:false,channelId:'PHONE',tenderId:'CASH',cashReceivedMinor:10000,
  studentDiscountIntent:{schema:'mfp.student-discount.intent.v1',mode:'AUTO',studentCount:1,selections:[{cartLineId:'L1',quantity:1}]},
  quote:{quoteRef:'Q1',formalRevision:'R8',currency:'HKD',lines:[{cartLineId:'L1',quantity:1,formalUnitMinor:5000,formalLineTotalMinor:5000,studentDiscountEligible:true}],discounts:[{code:'STUDENT_50',amountMinor:2500}],formalSubtotalMinor:5000,formalDiscountMinor:2500,formalTotalDueMinor:2500,acceptedTenderIds:['CASH'],validatedAt:'2026-10-02T06:01:00.000Z'},
  finalReview:{channelId:'PHONE',tenderId:'CASH',quoteRef:'Q1',formalRevision:'R8',formalTotalDueMinor:2500,formalDiscountMinor:2500,cashReceivedMinor:10000,changeMinor:7500,studentDiscountIntent:{schema:'mfp.student-discount.intent.v1',mode:'AUTO',studentCount:1,selections:[{cartLineId:'L1',quantity:1}]},sourceIdentity:{customerPhone:'91234567'}},
  result:null,submissionId:null,idempotencyKey:null,
} as MfpCheckoutSnapshot;
const tenders:MfpTenderConfig[]=[{id:'CASH',label:'現金',enabled:true},{id:'FPS',label:'轉數快',enabled:true}];
const actions={onBack:()=>undefined,onChannel:()=>undefined,onTender:()=>undefined,onCash:()=>undefined,onStudentDiscount:()=>undefined,onFinalReview:()=>undefined,onPaymentConfirm:()=>undefined};

function render(surface:MfpOrderingSurface){return renderToStaticMarkup(<MfpCheckoutWorkspace surface={surface} intent={intent} snapshot={snapshot} tenders={tenders} actions={actions}/>);}

describe('MFP V3 A5 formal Checkout UI',()=>{
  it('renders Pad full summary, channel, tender, cash, Student Discount and 75% Final Review',()=>{
    const html=render('MFP_PAD');
    for(const text of ['完整訂單摘要','Channel','Tender','應收','實收','找續','Student Discount','Formal Revision','PAYMENT CONFIRM','返回訂單'])expect(html).toContain(text);
    expect(html).toContain('data-checkout-surface="MFP_PAD"');
    expect(html).toContain('mfp-checkout-final-review');
  });

  it('renders a touch-first Mobile flow with the same business contract',()=>{
    const html=render('MFP_MOBILE');
    expect(html).toContain('data-checkout-surface="MFP_MOBILE"');
    expect(html).toContain('mfp-checkout-mobile-steps');
    expect(html).toContain('PAYMENT CONFIRM');
    expect(html).not.toContain('mfp-checkout-pad-layout');
  });

  it.each(['UNKNOWN','REJECTED','COMMITTED'] as const)('renders canonical %s result state',state=>{
    const result=state==='COMMITTED'
      ?{schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:'S',state,commitId:'C',canonicalRevision:9,orderRef:'O'}
      :state==='REJECTED'
        ?{schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:'S',state,rejectionCode:'REJECTED'}
        :{schema:'mfp.store-kernel.submission.result.v1' as const,submissionId:'S',state,readbackRequired:true as const,retryPermitted:false};
    const html=renderToStaticMarkup(<MfpCheckoutWorkspace surface="MFP_PAD" intent={intent} snapshot={{...snapshot,state,result,submissionId:'S',idempotencyKey:'I'}} tenders={tenders} actions={actions}/>);
    expect(html).toContain(state);
    if(state==='UNKNOWN')expect(html).toContain('UNKNOWN → READBACK');
  });
});

describe('checkout validation recovery controls',()=>{
  it('allows returning to the order after an unknown validation before any submission',()=>{
    const html=renderToStaticMarkup(<MfpCheckoutWorkspace surface="MFP_PAD" intent={intent} snapshot={{...snapshot,state:'UNKNOWN',quote:null,finalReview:null,result:null}} tenders={tenders} actions={actions}/>);
    expect(html).toContain('<button type="button">← 返回訂單</button>');
  });
});

describe('checkout action errors',()=>{
  it('shows the reason a checkout action cannot continue',()=>{
    const html=renderToStaticMarkup(<MfpCheckoutWorkspace surface="MFP_PAD" intent={intent} snapshot={snapshot} tenders={tenders} actions={actions} feedback="MFP_CHECKOUT_CHANNEL_REQUIRED"/>);
    expect(html).toContain('MFP_CHECKOUT_CHANNEL_REQUIRED');
    expect(html).toContain('role="alert"');
  });
});
