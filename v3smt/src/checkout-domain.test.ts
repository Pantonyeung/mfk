import {describe,expect,it,vi} from 'vitest';

import {
  MFP_CASH_QUICK_AMOUNTS_MINOR,
  MFP_CHECKOUT_CHANNELS,
  createMfpCheckoutSession,
  createMfpStudentDiscountIntent,
  mfpCashSettlement,
  parseMfpMoneyInput,
  type MfpFormalCheckoutAuthority,
  type MfpFormalCheckoutValidationResult,
  type MfpFormalQuote,
} from './checkout-domain.ts';
import {markMfpDraftForFormalRevalidation,type MfpNormalizedOrderingIntent} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpStoreKernelResult} from './store-kernel-port.ts';

const intent: MfpNormalizedOrderingIntent=Object.freeze({
  schema:'mfp.ordering.intent.draft.v1',draftOnly:true,
  pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',serviceMode:'takeaway',
  checkoutReady:true,previewSubtotalMinor:4800,
  lines:Object.freeze([Object.freeze({
    cartLineId:'LINE-01',kind:'PRODUCT',productId:'DRINK-01',comboId:null,
    displayName:'特飲',note:'',quantity:1,serviceMode:'takeaway',
    optionSelections:Object.freeze([]),comboSelections:Object.freeze([]),
    materialPriceFacts:Object.freeze([Object.freeze({
      factId:'PRICE-01',amountMinor:4800,currency:'HKD',revision:'MENU-7',
      role:'PRODUCT_BASE' as const,sourceId:'DRINK-01',
    })]),
    previewUnitMinor:4800,state:'READY' as const,issues:Object.freeze([]),
    sourceProjection:Object.freeze({
      storeId:'MF01',port:'SMT' as const,schemaVersion:1 as const,appliedSeq:7,
      projectionHash:'projection-7',appliedAt:'2026-10-02T06:00:00.000Z',
    }),
  })]),
});

const quote: MfpFormalQuote=Object.freeze({
  quoteRef:'QUOTE-01',formalRevision:'PRICE-8',currency:'HKD',
  lines:Object.freeze([Object.freeze({
    cartLineId:'LINE-01',quantity:1,formalUnitMinor:5000,
    formalLineTotalMinor:5000,studentDiscountEligible:true,
  })]),
  discounts:Object.freeze([]),formalSubtotalMinor:5000,
  formalDiscountMinor:0,formalTotalDueMinor:5000,
  acceptedTenderIds:Object.freeze(['CASH','FPS']),
  validatedAt:'2026-10-02T06:01:00.000Z',
});

function fixture(validation:MfpFormalQuote|{state:'REJECTED';rejectionCode:string;revalidationRequired?:true}=quote){
  const authority:MfpFormalCheckoutAuthority={
    validateCheckout:vi.fn(async()=>('state' in validation?validation:{state:'VALID' as const,quote:validation})),
  };
  const submitFrontlineFormalCommand=vi.fn(async(command:Parameters<MfpSecurityPort['submitFrontlineFormalCommand']>[0]):Promise<MfpStoreKernelResult>=>({
    schema:'mfp.store-kernel.submission.result.v1' as const,
    submissionId:command.submissionId,state:'COMMITTED' as const,
    commitId:'COMMIT-01',canonicalRevision:9,orderRef:'ORDER-01',
  }));
  const security={
    getSnapshot:()=>({
      device:{deviceId:'PAD-01',storeId:'MF01',deviceClass:'PAD' as const,installationId:'I',createdAt:'2026-10-02T04:00:00.000Z',lastSeenAt:'2026-10-02T06:00:00.000Z',status:'AUTHORIZED' as const},
      session:{state:'AUTHENTICATED' as const,staffSessionRef:'SESSION-01',staffId:'STAFF-01',displayName:'店員',role:'STAFF' as const,scope:'STORE' as const,permissions:Object.freeze([]),issuedAt:'2026-10-02T04:00:00.000Z',expiresAt:'2026-10-02T10:00:00.000Z',deviceId:'PAD-01',storeId:'MF01'},
      sessionState:'AUTHENTICATED' as const,
    }),
    submitFrontlineFormalCommand,
  } as Pick<MfpSecurityPort,'getSnapshot'|'submitFrontlineFormalCommand'>;
  const checkout=createMfpCheckoutSession({
    intent,authority,security,
    tenders:Object.freeze([{id:'CASH',label:'現金',enabled:true},{id:'FPS',label:'轉數快',enabled:true}]),
    identity:()=>({submissionId:'SUB-01',idempotencyKey:'IDEMP-01'}),
    now:()=> '2026-10-02T06:02:00.000Z',
  });
  return {authority,checkout,submitFrontlineFormalCommand};
}

describe('MFP V3 A5 first RED — formal boundary',()=>{
  it('keeps zero formal commits until Payment Confirm and double tap submits once',async()=>{
    const value=fixture();

    await value.checkout.open();
    value.checkout.selectChannel('WALK_IN');
    await value.checkout.open();
    value.checkout.selectTender('CASH');
    value.checkout.setCashReceivedMinor(5000);
    value.checkout.openFinalReview();

    expect(value.submitFrontlineFormalCommand).not.toHaveBeenCalled();

    const [first,second]=await Promise.all([
      value.checkout.paymentConfirm(),value.checkout.paymentConfirm(),
    ]);
    expect(first).toEqual(second);
    expect(value.submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);
    expect(value.submitFrontlineFormalCommand.mock.calls[0]?.[0]).toMatchObject({
      submissionId:'SUB-01',idempotencyKey:'IDEMP-01',
      commandType:'CHECKOUT_PAYMENT_CONFIRM',expectedRevision:'PRICE-8',
    });
  });

  it('blocks stale formal validation before Store Kernel commit',async()=>{
    const value=fixture({state:'REJECTED',rejectionCode:'EXPECTED_REVISION_STALE',revalidationRequired:true});
    await expect(value.checkout.open()).resolves.toMatchObject({state:'REJECTED',revalidationRequired:true});
    expect(value.checkout.getSnapshot().draftRevalidationRequired).toBe(true);
    expect(()=>value.checkout.openFinalReview()).toThrow('MFP_CHECKOUT_FORMAL_VALIDATION_REQUIRED');
    await expect(value.checkout.paymentConfirm()).rejects.toThrow('MFP_CHECKOUT_FINAL_REVIEW_REQUIRED');
    expect(value.submitFrontlineFormalCommand).not.toHaveBeenCalled();
    expect(markMfpDraftForFormalRevalidation({draftOnly:true,serviceMode:intent.serviceMode,lines:intent.lines}).lines[0]).toMatchObject({state:'REVALIDATION_REQUIRED',issues:['MFP_FORMAL_VALIDATION_REJECTED']});
  });

  it('returns to Order from Final Review with zero formal commits',async()=>{
    const value=fixture();await value.checkout.open();
    value.checkout.selectChannel('WALK_IN');await value.checkout.open();value.checkout.selectTender('FPS');value.checkout.openFinalReview();
    value.checkout.returnToOrder();
    expect(value.checkout.getSnapshot()).toMatchObject({state:'NEW',finalReview:null});
    expect(value.submitFrontlineFormalCommand).not.toHaveBeenCalled();
  });
});

describe('MFP V3 A5 checkout admission and canonical review',()=>{
  it('uses formal quote total rather than the local preview subtotal',async()=>{
    const value=fixture();
    await value.checkout.open();
    value.checkout.selectChannel('WALK_IN');await value.checkout.open();value.checkout.selectTender('FPS');
    expect(value.checkout.openFinalReview().formalTotalDueMinor).toBe(5000);
    expect(intent.previewSubtotalMinor).toBe(4800);
  });

  it.each([
    ['unresolved required',{...intent,checkoutReady:false,lines:[{...intent.lines[0]!,state:'INCOMPLETE' as const,issues:['MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED']}]},'MFP_CHECKOUT_REQUIRED_SELECTION_UNRESOLVED'],
    ['revalidation required',{...intent,checkoutReady:false,lines:[{...intent.lines[0]!,state:'REVALIDATION_REQUIRED' as const,issues:['MFP_ORDERING_PROJECTION_CHANGED']}]},'MFP_CHECKOUT_REVALIDATION_REQUIRED'],
    ['price not ready',{...intent,checkoutReady:false,lines:[{...intent.lines[0]!,previewUnitMinor:null}]},'MFP_CHECKOUT_PRICE_NOT_READY'],
    ['unavailable',{...intent,checkoutReady:false,lines:[{...intent.lines[0]!,issues:['MFP_ORDERING_PRODUCT_UNAVAILABLE']}]},'MFP_CHECKOUT_ITEM_UNAVAILABLE'],
  ] as const)('blocks %s before formal validation',(_label,badIntent,code)=>{
    const value=fixture();
    expect(()=>createMfpCheckoutSession({
      intent:badIntent,authority:value.authority,
      security:{getSnapshot:value.checkout.getSnapshot as never,submitFrontlineFormalCommand:vi.fn()} as never,
      tenders:[],
    })).toThrow(code);
    expect(value.authority.validateCheckout).not.toHaveBeenCalled();
  });

  it('keeps channel and tender independent and does not require pickup code',async()=>{
    const value=fixture();await value.checkout.open();
    value.checkout.selectChannel('MORE_FUN_APP',{pickupCode:''});
    await value.checkout.open();
    value.checkout.selectTender('FPS');
    expect(value.checkout.openFinalReview()).toMatchObject({channelId:'MORE_FUN_APP',tenderId:'FPS',sourceIdentity:{pickupCode:''}});
  });

  it('covers the Owner channel set and consumes only injected enabled tender facts',async()=>{
    expect(MFP_CHECKOUT_CHANNELS).toEqual(['WALK_IN','PHONE','WHATSAPP','MORE_FUN_APP','FOODPANDA','KEETA']);
    const value=fixture();await value.checkout.open();
    expect(()=>value.checkout.selectTender('ALIPAY')).toThrow('MFP_CHECKOUT_TENDER_UNAVAILABLE');
    value.checkout.selectTender('FPS');
    expect(value.checkout.getSnapshot().tenderId).toBe('FPS');
  });

  it('invalidates a channel-bound quote until the selected channel is revalidated',async()=>{
    const value=fixture();
    await value.checkout.open();
    expect(value.checkout.getSnapshot()).toMatchObject({state:'VALID',quote:{quoteRef:'QUOTE-01'}});

    value.checkout.selectChannel('WALK_IN');
    expect(value.checkout.getSnapshot()).toMatchObject({state:'NEW',quote:null,channelId:'WALK_IN'});
    expect(()=>value.checkout.openFinalReview()).toThrow('MFP_CHECKOUT_FORMAL_VALIDATION_REQUIRED');

    await value.checkout.open();
    expect(value.checkout.getSnapshot()).toMatchObject({state:'VALID',quote:{quoteRef:'QUOTE-01'},channelId:'WALK_IN'});
  });

  it('does not let an older validation response overwrite a newer channel validation',async()=>{
    const value=fixture();
    let resolveFirst!:(result:MfpFormalCheckoutValidationResult)=>void;
    let resolveSecond!:(result:MfpFormalCheckoutValidationResult)=>void;
    vi.mocked(value.authority.validateCheckout)
      .mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;}))
      .mockImplementationOnce(()=>new Promise(resolve=>{resolveSecond=resolve;}));

    const first=value.checkout.open();
    value.checkout.selectChannel('WALK_IN');
    const second=value.checkout.open();
    resolveSecond({state:'VALID',quote:Object.freeze({...quote,quoteRef:'QUOTE-NEW'})});
    await second;
    resolveFirst({state:'VALID',quote:Object.freeze({...quote,quoteRef:'QUOTE-OLD'})});
    await first;

    expect(value.checkout.getSnapshot()).toMatchObject({state:'VALID',quote:{quoteRef:'QUOTE-NEW'},channelId:'WALK_IN'});
  });
});

describe('MFP V3 A5 cash and Student Discount intent',()=>{
  it('uses the exact Owner cash quick amounts and integer-minor change arithmetic',()=>{
    expect(MFP_CASH_QUICK_AMOUNTS_MINOR).toEqual([2000,5000,10000,20000,50000]);
    expect(mfpCashSettlement(4980,5000)).toEqual({dueMinor:4980,receivedMinor:5000,changeMinor:20,sufficient:true});
    expect(mfpCashSettlement(5000,5000)).toMatchObject({changeMinor:0,sufficient:true});
  });

  it('parses exact decimal input without float money and rejects invalid numeric values',()=>{
    expect(parseMfpMoneyInput('20')).toBe(2000);
    expect(parseMfpMoneyInput('20.05')).toBe(2005);
    for(const value of ['-1','NaN','Infinity','1.234',''])expect(()=>parseMfpMoneyInput(value)).toThrow('MFP_MONEY_INPUT_INVALID');
    for(const value of [-1,NaN,Infinity,1.5])expect(()=>mfpCashSettlement(100,value)).toThrow('MFP_MONEY_MINOR_INVALID');
  });

  it('blocks CASH review when received cash is insufficient',async()=>{
    const value=fixture();await value.checkout.open();
    value.checkout.selectChannel('WALK_IN');await value.checkout.open();value.checkout.selectTender('CASH');value.checkout.setCashReceivedMinor(4999);
    expect(()=>value.checkout.openFinalReview()).toThrow('MFP_CHECKOUT_CASH_INSUFFICIENT');
  });

  it('manual mode preserves eligible selections up to Student Count',()=>{
    const expanded={...quote,formalSubtotalMinor:23000,formalTotalDueMinor:23000,lines:[
      {...quote.lines[0]!,quantity:3,formalLineTotalMinor:15000},
      {cartLineId:'FOOD',quantity:1,formalUnitMinor:8000,formalLineTotalMinor:8000,studentDiscountEligible:false},
    ]};
    expect(createMfpStudentDiscountIntent(expanded,{mode:'MANUAL',studentCount:2,selected:[{cartLineId:'LINE-01',quantity:2}]})).toEqual({
      schema:'mfp.student-discount.intent.v1',mode:'MANUAL',studentCount:2,selections:[{cartLineId:'LINE-01',quantity:2}],
    });
    expect(()=>createMfpStudentDiscountIntent(expanded,{mode:'MANUAL',studentCount:1,selected:[{cartLineId:'LINE-01',quantity:2}]})).toThrow('MFP_STUDENT_DISCOUNT_COUNT_EXCEEDED');
    expect(()=>createMfpStudentDiscountIntent(expanded,{mode:'MANUAL',studentCount:1,selected:[{cartLineId:'FOOD',quantity:1}]})).toThrow('MFP_STUDENT_DISCOUNT_LINE_INELIGIBLE');
  });

  it('AUTO selects most expensive eligible units with stable line-identity tie break',()=>{
    const expanded={...quote,formalSubtotalMinor:25000,formalTotalDueMinor:25000,lines:[
      {cartLineId:'B',quantity:2,formalUnitMinor:5000,formalLineTotalMinor:10000,studentDiscountEligible:true},
      {cartLineId:'A',quantity:1,formalUnitMinor:5000,formalLineTotalMinor:5000,studentDiscountEligible:true},
      {cartLineId:'CHEAP',quantity:2,formalUnitMinor:3000,formalLineTotalMinor:6000,studentDiscountEligible:true},
      {cartLineId:'FOOD',quantity:1,formalUnitMinor:4000,formalLineTotalMinor:4000,studentDiscountEligible:false},
    ]};
    expect(createMfpStudentDiscountIntent(expanded,{mode:'AUTO',studentCount:4}).selections).toEqual([
      {cartLineId:'A',quantity:1},{cartLineId:'B',quantity:2},{cartLineId:'CHEAP',quantity:1},
    ]);
  });

  it('creates no phantom discount selection when eligible quantity is below Student Count',()=>{
    expect(createMfpStudentDiscountIntent(quote,{mode:'AUTO',studentCount:4}).selections).toEqual([{cartLineId:'LINE-01',quantity:1}]);
  });

  it('lets Formal Pricing Authority reject a client Student Discount intent',async()=>{
    const value=fixture();await value.checkout.open();
    vi.mocked(value.authority.validateCheckout).mockResolvedValueOnce({state:'REJECTED',rejectionCode:'STUDENT_DISCOUNT_INELIGIBLE'});
    const discount=createMfpStudentDiscountIntent(quote,{mode:'AUTO',studentCount:1});
    expect(await value.checkout.validateStudentDiscount(discount)).toEqual({state:'REJECTED',rejectionCode:'STUDENT_DISCOUNT_INELIGIBLE'});
    expect(()=>value.checkout.openFinalReview()).toThrow('MFP_CHECKOUT_FORMAL_VALIDATION_REQUIRED');
    expect(value.submitFrontlineFormalCommand).not.toHaveBeenCalled();
  });
});

describe('MFP V3 A5 terminal and UNKNOWN handling',()=>{
  it('reuses the same formal identity after UNKNOWN',async()=>{
    const value=fixture();await value.checkout.open();value.checkout.selectChannel('WALK_IN');await value.checkout.open();value.checkout.selectTender('FPS');value.checkout.openFinalReview();
    value.submitFrontlineFormalCommand
      .mockResolvedValueOnce({schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',state:'UNKNOWN',readbackRequired:true,retryPermitted:false})
      .mockResolvedValueOnce({schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',state:'COMMITTED',commitId:'C',canonicalRevision:9});
    expect((await value.checkout.paymentConfirm()).state).toBe('UNKNOWN');
    expect(()=>value.checkout.selectChannel('PHONE')).toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
    expect(()=>value.checkout.selectTender('CASH')).toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
    expect(()=>value.checkout.setCashReceivedMinor(5000)).toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
    await expect(value.checkout.validateStudentDiscount(null)).rejects.toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
    expect(()=>value.checkout.returnToOrder()).toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
    expect((await value.checkout.paymentConfirm()).state).toBe('COMMITTED');
    expect(value.submitFrontlineFormalCommand.mock.calls.map(call=>[call[0].submissionId,call[0].idempotencyKey])).toEqual([
      ['SUB-01','IDEMP-01'],['SUB-01','IDEMP-01'],
    ]);
  });

  it.each(['COMMITTED','REJECTED'] as const)('keeps terminal %s stable without another submit',async terminal=>{
    const value=fixture();await value.checkout.open();value.checkout.selectChannel('WALK_IN');await value.checkout.open();value.checkout.selectTender('FPS');value.checkout.openFinalReview();
    value.submitFrontlineFormalCommand.mockResolvedValueOnce(terminal==='COMMITTED'
      ?{schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',state:'COMMITTED',commitId:'C',canonicalRevision:9}
      :{schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',state:'REJECTED',rejectionCode:'TENDER_REJECTED'});
    const first=await value.checkout.paymentConfirm();
    expect(await value.checkout.paymentConfirm()).toEqual(first);
    expect(value.submitFrontlineFormalCommand).toHaveBeenCalledTimes(1);
  });
});
