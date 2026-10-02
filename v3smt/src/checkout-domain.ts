import type {MfpNormalizedOrderingIntent} from './ordering-domain.ts';
import {isMfpFrontlineSessionEligible,type MfpSecurityPort} from './security-port.ts';
import type {MfpStoreKernelCommandEnvelope,MfpStoreKernelResult} from './store-kernel-port.ts';

export const MFP_CHECKOUT_CHANNELS=Object.freeze([
  'WALK_IN','PHONE','WHATSAPP','MORE_FUN_APP','FOODPANDA','KEETA',
] as const);
export type MfpCheckoutChannelId=typeof MFP_CHECKOUT_CHANNELS[number]|(string&{});

export interface MfpTenderConfig{
  readonly id:string;
  readonly label:string;
  readonly enabled:boolean;
}

export interface MfpFormalQuoteLine{
  readonly cartLineId:string;
  readonly quantity:number;
  readonly formalUnitMinor:number;
  readonly formalLineTotalMinor:number;
  readonly studentDiscountEligible:boolean;
}

export interface MfpFormalDiscountRow{
  readonly code:string;
  readonly amountMinor:number;
  readonly cartLineId?:string;
  readonly quantity?:number;
}

export interface MfpFormalQuote{
  readonly quoteRef:string;
  readonly formalRevision:string|number;
  readonly currency:string;
  readonly lines:readonly MfpFormalQuoteLine[];
  readonly discounts:readonly MfpFormalDiscountRow[];
  readonly formalSubtotalMinor:number;
  readonly formalDiscountMinor:number;
  readonly formalTotalDueMinor:number;
  readonly acceptedTenderIds:readonly string[];
  readonly validatedAt:string;
}

export interface MfpStudentDiscountIntent{
  readonly schema:'mfp.student-discount.intent.v1';
  readonly mode:'MANUAL'|'AUTO';
  readonly studentCount:number;
  readonly selections:readonly Readonly<{cartLineId:string;quantity:number}>[];
}

export interface MfpFormalCheckoutValidationRequest{
  readonly schema:'mfp.checkout.validation.request.v1';
  readonly intent:MfpNormalizedOrderingIntent;
  readonly channelId:MfpCheckoutChannelId|null;
  readonly tenderId:string|null;
  readonly studentDiscountIntent:MfpStudentDiscountIntent|null;
}

export type MfpFormalCheckoutValidationResult=
  |Readonly<{state:'VALID';quote:MfpFormalQuote}>
  |Readonly<{state:'REJECTED';rejectionCode:string;revalidationRequired?:true}>
  |Readonly<{state:'UNKNOWN';readbackRequired:true}>;

export interface MfpFormalCheckoutAuthority{
  validateCheckout(request:MfpFormalCheckoutValidationRequest):Promise<MfpFormalCheckoutValidationResult>;
}

export interface MfpCheckoutFinalReview{
  readonly channelId:MfpCheckoutChannelId;
  readonly tenderId:string;
  readonly quoteRef:string;
  readonly formalRevision:string|number;
  readonly formalTotalDueMinor:number;
  readonly formalDiscountMinor:number;
  readonly cashReceivedMinor:number|null;
  readonly changeMinor:number|null;
  readonly studentDiscountIntent:MfpStudentDiscountIntent|null;
  readonly sourceIdentity:Readonly<{customerPhone?:string;pickupCode?:string;externalOrderNo?:string}>;
}

export type MfpCheckoutState='NEW'|'VALID'|'REJECTED'|'UNKNOWN'|'FINAL_REVIEW'|'SUBMITTING'|'COMMITTED';

export interface MfpCheckoutSnapshot{
  readonly state:MfpCheckoutState;
  readonly quote:MfpFormalQuote|null;
  readonly rejectionCode:string|null;
  readonly draftRevalidationRequired:boolean;
  readonly channelId:MfpCheckoutChannelId|null;
  readonly tenderId:string|null;
  readonly cashReceivedMinor:number|null;
  readonly studentDiscountIntent:MfpStudentDiscountIntent|null;
  readonly finalReview:MfpCheckoutFinalReview|null;
  readonly result:MfpStoreKernelResult|null;
  readonly submissionId:string|null;
  readonly idempotencyKey:string|null;
}

type CheckoutSecurity=Pick<MfpSecurityPort,'getSnapshot'|'submitFrontlineFormalCommand'>;

export interface MfpCheckoutSession{
  getSnapshot():MfpCheckoutSnapshot;
  open():Promise<MfpFormalCheckoutValidationResult>;
  selectChannel(channelId:MfpCheckoutChannelId,sourceIdentity?:MfpCheckoutFinalReview['sourceIdentity']):void;
  selectTender(tenderId:string):void;
  setCashReceivedMinor(amountMinor:number):void;
  validateStudentDiscount(intent:MfpStudentDiscountIntent|null):Promise<MfpFormalCheckoutValidationResult>;
  openFinalReview():MfpCheckoutFinalReview;
  returnToOrder():void;
  paymentConfirm():Promise<MfpStoreKernelResult>;
}

export const MFP_CASH_QUICK_AMOUNTS_MINOR=Object.freeze([2000,5000,10000,20000,50000] as const);

function minor(value:number,code='MFP_MONEY_MINOR_INVALID'){
  if(!Number.isSafeInteger(value)||value<0)throw new Error(code);
  return value;
}

function requiredText(value:string,code:string){
  if(!value||value!==value.trim())throw new Error(code);
  return value;
}

export function parseMfpMoneyInput(value:string){
  const normalized=value.trim();
  const match=/^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(normalized);
  if(!match)throw new Error('MFP_MONEY_INPUT_INVALID');
  const result=Number(match[1])*100+Number((match[2]??'').padEnd(2,'0'));
  return minor(result);
}

export function mfpCashSettlement(dueMinor:number,receivedMinor:number){
  minor(dueMinor);minor(receivedMinor);
  return Object.freeze({
    dueMinor,receivedMinor,
    changeMinor:Math.max(0,receivedMinor-dueMinor),
    sufficient:receivedMinor>=dueMinor,
  });
}

function validateQuote(quote:MfpFormalQuote){
  requiredText(quote.quoteRef,'MFP_FORMAL_QUOTE_INVALID');
  if((typeof quote.formalRevision!=='string'||!quote.formalRevision.trim())
    &&(!Number.isSafeInteger(quote.formalRevision)||Number(quote.formalRevision)<0))throw new Error('MFP_FORMAL_QUOTE_INVALID');
  requiredText(quote.currency,'MFP_FORMAL_QUOTE_INVALID');
  minor(quote.formalSubtotalMinor,'MFP_FORMAL_QUOTE_INVALID');
  minor(quote.formalDiscountMinor,'MFP_FORMAL_QUOTE_INVALID');
  minor(quote.formalTotalDueMinor,'MFP_FORMAL_QUOTE_INVALID');
  if(quote.formalTotalDueMinor!==quote.formalSubtotalMinor-quote.formalDiscountMinor)throw new Error('MFP_FORMAL_QUOTE_INVALID');
  if(!Number.isFinite(Date.parse(quote.validatedAt)))throw new Error('MFP_FORMAL_QUOTE_INVALID');
  const lineIds=new Set<string>();
  for(const line of quote.lines){
    requiredText(line.cartLineId,'MFP_FORMAL_QUOTE_INVALID');
    if(lineIds.has(line.cartLineId))throw new Error('MFP_FORMAL_QUOTE_INVALID');
    lineIds.add(line.cartLineId);
    if(!Number.isSafeInteger(line.quantity)||line.quantity<1)throw new Error('MFP_FORMAL_QUOTE_INVALID');
    minor(line.formalUnitMinor,'MFP_FORMAL_QUOTE_INVALID');
    minor(line.formalLineTotalMinor,'MFP_FORMAL_QUOTE_INVALID');
    if(line.formalLineTotalMinor!==line.formalUnitMinor*line.quantity)throw new Error('MFP_FORMAL_QUOTE_INVALID');
  }
  if(quote.lines.reduce((sum,line)=>sum+line.formalLineTotalMinor,0)!==quote.formalSubtotalMinor)throw new Error('MFP_FORMAL_QUOTE_INVALID');
  for(const row of quote.discounts){requiredText(row.code,'MFP_FORMAL_QUOTE_INVALID');minor(row.amountMinor,'MFP_FORMAL_QUOTE_INVALID');}
  if(quote.discounts.reduce((sum,row)=>sum+row.amountMinor,0)!==quote.formalDiscountMinor)throw new Error('MFP_FORMAL_QUOTE_INVALID');
  if(new Set(quote.acceptedTenderIds).size!==quote.acceptedTenderIds.length||quote.acceptedTenderIds.some(id=>!id.trim()))throw new Error('MFP_FORMAL_QUOTE_INVALID');
  return quote;
}

function validateQuoteForIntent(quote:MfpFormalQuote,intent:MfpNormalizedOrderingIntent){
  validateQuote(quote);
  const quoted=new Map(quote.lines.map(line=>[line.cartLineId,line]));
  if(quoted.size!==intent.lines.length||intent.lines.some(line=>quoted.get(line.cartLineId)?.quantity!==line.quantity))throw new Error('MFP_FORMAL_QUOTE_DRAFT_MISMATCH');
  if(intent.lines.some(line=>line.materialPriceFacts.some(fact=>fact.currency!==quote.currency)))throw new Error('MFP_FORMAL_QUOTE_CURRENCY_MISMATCH');
  return quote;
}

function assertCheckoutIntent(intent:MfpNormalizedOrderingIntent){
  if(intent.schema!=='mfp.ordering.intent.draft.v1'||!intent.draftOnly)throw new Error('MFP_CHECKOUT_DRAFT_SCHEMA_INVALID');
  if(!intent.lines.length)throw new Error('MFP_CHECKOUT_EMPTY_DRAFT');
  if(intent.lines.some(line=>line.state==='REVALIDATION_REQUIRED'))throw new Error('MFP_CHECKOUT_REVALIDATION_REQUIRED');
  if(intent.lines.some(line=>line.state==='INCOMPLETE'||line.issues.some(issue=>issue.includes('REQUIRED'))))throw new Error('MFP_CHECKOUT_REQUIRED_SELECTION_UNRESOLVED');
  if(intent.lines.some(line=>line.previewUnitMinor===null))throw new Error('MFP_CHECKOUT_PRICE_NOT_READY');
  if(intent.lines.some(line=>line.issues.some(issue=>/UNSELLABLE|UNAVAILABLE/.test(issue))))throw new Error('MFP_CHECKOUT_ITEM_UNAVAILABLE');
  if(!intent.checkoutReady)throw new Error('MFP_CHECKOUT_NOT_READY');
}

export function createMfpStudentDiscountIntent(
  quote:MfpFormalQuote,
  input:Readonly<{
    mode:'MANUAL'|'AUTO';
    studentCount:number;
    selected?:readonly Readonly<{cartLineId:string;quantity:number}>[];
  }>,
):MfpStudentDiscountIntent{
  validateQuote(quote);
  if(!Number.isSafeInteger(input.studentCount)||input.studentCount<0||input.studentCount>999)throw new Error('MFP_STUDENT_COUNT_INVALID');
  const eligible=new Map(quote.lines.filter(line=>line.studentDiscountEligible).map(line=>[line.cartLineId,line]));
  let selections:ReadonlyArray<Readonly<{cartLineId:string;quantity:number}>>;
  if(input.mode==='MANUAL'){
    const rows=new Map<string,number>();
    for(const selected of input.selected??[]){
      const line=eligible.get(selected.cartLineId);
      if(!line)throw new Error('MFP_STUDENT_DISCOUNT_LINE_INELIGIBLE');
      if(!Number.isSafeInteger(selected.quantity)||selected.quantity<1)throw new Error('MFP_STUDENT_DISCOUNT_QUANTITY_INVALID');
      rows.set(selected.cartLineId,(rows.get(selected.cartLineId)??0)+selected.quantity);
      if(rows.get(selected.cartLineId)!>line.quantity)throw new Error('MFP_STUDENT_DISCOUNT_QUANTITY_INVALID');
    }
    selections=[...rows].sort(([a],[b])=>a.localeCompare(b)).map(([cartLineId,quantity])=>Object.freeze({cartLineId,quantity}));
  }else{
    const units=quote.lines.filter(line=>line.studentDiscountEligible).flatMap(line=>
      Array.from({length:line.quantity},(_,index)=>({cartLineId:line.cartLineId,index,formalUnitMinor:line.formalUnitMinor})),
    ).sort((a,b)=>b.formalUnitMinor-a.formalUnitMinor||(a.cartLineId<b.cartLineId?-1:a.cartLineId>b.cartLineId?1:0)||a.index-b.index)
      .slice(0,input.studentCount);
    const rows=new Map<string,number>();
    for(const unit of units)rows.set(unit.cartLineId,(rows.get(unit.cartLineId)??0)+1);
    selections=[...rows].map(([cartLineId,quantity])=>Object.freeze({cartLineId,quantity}));
  }
  if(selections.reduce((sum,row)=>sum+row.quantity,0)>input.studentCount)throw new Error('MFP_STUDENT_DISCOUNT_COUNT_EXCEEDED');
  return Object.freeze({
    schema:'mfp.student-discount.intent.v1',mode:input.mode,studentCount:input.studentCount,
    selections:Object.freeze(selections),
  });
}

export function createMfpCheckoutSession(input:{
  readonly intent:MfpNormalizedOrderingIntent;
  readonly authority:MfpFormalCheckoutAuthority;
  readonly security:CheckoutSecurity;
  readonly tenders:readonly MfpTenderConfig[];
  readonly identity?:()=>Readonly<{submissionId:string;idempotencyKey:string}>;
  readonly now?:()=>string;
}):MfpCheckoutSession{
  assertCheckoutIntent(input.intent);
  const now=input.now??(()=>new Date().toISOString());
  const identity=input.identity??(()=>{
    const id=crypto.randomUUID();
    return Object.freeze({submissionId:`MFP-CHECKOUT-${id}`,idempotencyKey:`MFP-CHECKOUT-${id}`});
  });
  let state:MfpCheckoutState='NEW';
  let quote:MfpFormalQuote|null=null;
  let rejectionCode:string|null=null;
  let draftRevalidationRequired=false;
  let channelId:MfpCheckoutChannelId|null=null;
  let tenderId:string|null=null;
  let cashReceivedMinor:number|null=null;
  let studentDiscountIntent:MfpStudentDiscountIntent|null=null;
  let sourceIdentity:MfpCheckoutFinalReview['sourceIdentity']=Object.freeze({});
  let finalReview:MfpCheckoutFinalReview|null=null;
  let result:MfpStoreKernelResult|null=null;
  let stableIdentity:Readonly<{submissionId:string;idempotencyKey:string}>|null=null;
  let stableCommand:Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>|null=null;
  let activeConfirm:Promise<MfpStoreKernelResult>|null=null;
  const assertMutable=()=>{if(stableCommand||activeConfirm||result)throw new Error('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');};

  const snapshot=():MfpCheckoutSnapshot=>Object.freeze({
    state,quote,rejectionCode,draftRevalidationRequired,channelId,tenderId,cashReceivedMinor,studentDiscountIntent,
    finalReview,result,submissionId:stableIdentity?.submissionId??null,idempotencyKey:stableIdentity?.idempotencyKey??null,
  });
  const request=():MfpFormalCheckoutValidationRequest=>Object.freeze({
    schema:'mfp.checkout.validation.request.v1',intent:input.intent,channelId,tenderId,studentDiscountIntent,
  });
  const validate=async()=>{
    if(!isMfpFrontlineSessionEligible(input.security.getSnapshot(),Date.parse(now())))throw new Error('MFP_CHECKOUT_SECURITY_NOT_ELIGIBLE');
    const validation=await input.authority.validateCheckout(request());
    finalReview=null;result=null;rejectionCode=null;draftRevalidationRequired=false;
    if(validation.state==='VALID'){
      quote=validateQuoteForIntent(validation.quote,input.intent);state='VALID';
    }else if(validation.state==='REJECTED'){
      quote=null;rejectionCode=requiredText(validation.rejectionCode,'MFP_FORMAL_REJECTION_INVALID');draftRevalidationRequired=validation.revalidationRequired===true;state='REJECTED';
    }else{
      quote=null;state='UNKNOWN';
    }
    return validation;
  };
  const reopen=()=>{if(state==='FINAL_REVIEW')state='VALID';finalReview=null;};

  return Object.freeze({
    getSnapshot:snapshot,
    open:validate,
    selectChannel(nextChannelId:MfpCheckoutChannelId,nextSourceIdentity:MfpCheckoutFinalReview['sourceIdentity']=Object.freeze({})){
      assertMutable();
      channelId=requiredText(nextChannelId,'MFP_CHECKOUT_CHANNEL_INVALID');
      sourceIdentity=Object.freeze({...nextSourceIdentity});reopen();
    },
    selectTender(nextTenderId:string){
      assertMutable();
      const tender=input.tenders.find(row=>row.id===nextTenderId&&row.enabled);
      if(!tender)throw new Error('MFP_CHECKOUT_TENDER_UNAVAILABLE');
      tenderId=tender.id;if(tenderId!=='CASH')cashReceivedMinor=null;reopen();
    },
    setCashReceivedMinor(amountMinor:number){assertMutable();cashReceivedMinor=minor(amountMinor);reopen();},
    async validateStudentDiscount(nextIntent:MfpStudentDiscountIntent|null){assertMutable();studentDiscountIntent=nextIntent;return validate();},
    openFinalReview(){
      assertMutable();
      if(state!=='VALID'||!quote)throw new Error('MFP_CHECKOUT_FORMAL_VALIDATION_REQUIRED');
      if(!channelId)throw new Error('MFP_CHECKOUT_CHANNEL_REQUIRED');
      if(!tenderId)throw new Error('MFP_CHECKOUT_TENDER_REQUIRED');
      if(!quote.acceptedTenderIds.includes(tenderId))throw new Error('MFP_CHECKOUT_TENDER_REJECTED');
      const cash=tenderId==='CASH'?mfpCashSettlement(quote.formalTotalDueMinor,cashReceivedMinor??0):null;
      if(cash&&!cash.sufficient)throw new Error('MFP_CHECKOUT_CASH_INSUFFICIENT');
      finalReview=Object.freeze({
        channelId,tenderId,quoteRef:quote.quoteRef,formalRevision:quote.formalRevision,
        formalTotalDueMinor:quote.formalTotalDueMinor,formalDiscountMinor:quote.formalDiscountMinor,
        cashReceivedMinor:cash?.receivedMinor??null,changeMinor:cash?.changeMinor??null,
        studentDiscountIntent,sourceIdentity,
      });
      state='FINAL_REVIEW';return finalReview;
    },
    returnToOrder(){
      if(activeConfirm||state==='UNKNOWN'||state==='COMMITTED')throw new Error('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
      state='NEW';finalReview=null;
    },
    paymentConfirm(){
      if(activeConfirm)return activeConfirm;
      if(result&&(state==='COMMITTED'||state==='REJECTED'))return Promise.resolve(result);
      if(!finalReview||!quote||!['FINAL_REVIEW','REJECTED','UNKNOWN'].includes(state))return Promise.reject(new Error('MFP_CHECKOUT_FINAL_REVIEW_REQUIRED'));
      if(!stableIdentity){
        stableIdentity=identity();
        requiredText(stableIdentity.submissionId,'MFP_CHECKOUT_SUBMISSION_ID_INVALID');
        requiredText(stableIdentity.idempotencyKey,'MFP_CHECKOUT_IDEMPOTENCY_KEY_INVALID');
        stableCommand=Object.freeze({
          schema:'mfp.store-kernel.command.v1',storeId:input.intent.lines[0]!.sourceProjection.storeId,
          submissionId:stableIdentity.submissionId,idempotencyKey:stableIdentity.idempotencyKey,
          commandType:'CHECKOUT_PAYMENT_CONFIRM',expectedRevision:quote.formalRevision,
          payload:Object.freeze({intent:input.intent,review:finalReview}),createdAt:now(),
        });
      }
      state='SUBMITTING';
      const promise=input.security.submitFrontlineFormalCommand(stableCommand!).then(next=>{
        result=next;
        state=next.state==='COMMITTED'?'COMMITTED':next.state;
        return next;
      }).finally(()=>{if(activeConfirm===promise)activeConfirm=null;});
      activeConfirm=promise;
      return promise;
    },
  });
}
