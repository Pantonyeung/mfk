import {describe,expect,it} from 'vitest';
import {createMfpOrderingDomain,type MfpOrderingCatalog} from './ordering-domain.ts';
import {createMfpCheckoutSession,type MfpFormalQuote} from './checkout-domain.ts';
import {createMfpSecurityPort} from './security-port.ts';
import {createMfpStoreKernelPort,type MfpOutboxRecord} from './store-kernel-port.ts';
import {createMfpFormalBusinessNativeTransport} from './formal-business-native-transport.ts';
import type {MfpNativeBridge} from './a9-runtime.ts';

// Test-only canonical authority fixtures. Production bindings remain fail-closed.
const now=()=> '2026-10-02T06:00:00.000Z';
const catalog:MfpOrderingCatalog={
  source:{storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,projectionHash:'P7',appliedAt:now()},
  categories:[{id:'C1',label:'Food',position:1}],
  products:[{productId:'P1',categoryId:'C1',name:'Food',description:'',sellable:true,priceReady:true,
    publishedUnitPrice:{factId:'F1',amountMinor:3800,currency:'HKD',revision:7},serviceModeAdjustments:{},optionSets:[]}],
  combos:[],comboPools:[],
};
const quote:MfpFormalQuote={
  quoteRef:'Q1',formalRevision:8,currency:'HKD',
  lines:[{cartLineId:'L1',quantity:1,formalUnitMinor:4000,formalLineTotalMinor:4000,studentDiscountEligible:true}],
  discounts:[],formalSubtotalMinor:4000,formalDiscountMinor:0,formalTotalDueMinor:4000,
  acceptedTenderIds:['FPS'],validatedAt:now(),
};

async function fixture(publicMode=false){
  let callback:(event:{data:unknown})=>void=()=>{};
  let requestSequence=0;
  const posted:Record<string,unknown>[]=[];
  const timers=new Map<number,()=>void>();
  const bridge:MfpNativeBridge={
    addEventListener(_type,listener){callback=listener;},removeEventListener(){},
    postMessage(raw){posted.push(JSON.parse(raw));},
  };
  const transport=createMfpFormalBusinessNativeTransport({
    currentUrl:()=>new URL(publicMode?'https://mfp.example.com/':'https://appassets.androidplatform.net/runtime/index.html?releaseId=test&runtimeVersion=test&runtimeChannel=candidate'),
    bridge:()=>bridge,listenWindow:()=>()=>undefined,randomUUID:()=>String(++requestSequence),
    setTimer:handler=>{timers.set(requestSequence,handler);return requestSequence;},clearTimer:timer=>{timers.delete(timer as number);},
  });
  const rows=new Map<string,MfpOutboxRecord>();
  const kernel=createMfpStoreKernelPort({transport,outbox:{async read(id){return rows.get(id);},async write(row){rows.set(row.submissionId,row);}},now});
  const security=createMfpSecurityPort({
    storeId:'MF01',deviceClass:'PAD',now,randomUUID:()=> '1',storeKernel:kernel,
    metadataStore:{async read(){return undefined;},async write(){}},
    authority:{
      async readDeviceAuthorization(device){return {...device,status:'AUTHORIZED'};},
      async loginStaff(input){return {state:'AUTHENTICATED',session:{
        state:'AUTHENTICATED',staffSessionRef:'S1',staffId:input.staffId,displayName:'Test',role:'STAFF',scope:'STORE',permissions:[],
        issuedAt:now(),expiresAt:'2026-10-02T10:00:00.000Z',deviceId:input.deviceId,storeId:input.storeId,
      }};},
      async readStaffSession(){throw new Error('UNUSED');},async logoutStaff(){},
    },
  });
  await security.loadDevice();await security.refreshDeviceAuthorization();await security.loginStaff('STAFF-1','TEST-PROOF');
  const ordering=createMfpOrderingDomain(catalog);
  const intent=ordering.normalize(ordering.addProduct(ordering.createDraft('takeaway'),{cartLineId:'L1',productId:'P1',quantity:1,optionSelections:{}}));
  const checkout=createMfpCheckoutSession({
    intent,security,authority:{async validateCheckout(){return {state:'VALID',quote};}},
    tenders:[{id:'FPS',label:'FPS',enabled:true}],identity:()=>({submissionId:'SUB-1',idempotencyKey:'KEY-1'}),now,
  });
  const untilPosted=async(count:number)=>{for(let i=0;i<20&&posted.length<count;i++)await Promise.resolve();expect(posted).toHaveLength(count);};
  const reply=(result:Record<string,unknown>)=>callback({data:JSON.stringify({
    type:'mfp.store-kernel.submission.result.v1',schema:'mfp.store-kernel.submission.result.v1',protocolVersion:1,
    requestId:posted.at(-1)?.requestId,submissionId:'SUB-1',...result,
  })});
  const review=async()=>{await checkout.open();checkout.selectChannel('WALK_IN');checkout.selectTender('FPS');checkout.openFinalReview();};
  return {checkout,security,posted,timers,reply,review,untilPosted,rows};
}
const receipt={state:'COMMITTED',commitId:'COMMIT-1',canonicalRevision:9,orderRef:'ORDER-1'};

describe('ordering → checkout → security → durable port → bounded native seam',()=>{
  it('double click and lost reply recover the original receipt by readback without a second command',async()=>{
    const value=await fixture();await value.review();expect(value.posted).toHaveLength(0);
    const first=value.checkout.paymentConfirm();const duplicate=value.checkout.paymentConfirm();expect(duplicate).toBe(first);
    await value.untilPosted(1);
    expect(value.posted[0]).toMatchObject({type:'mfp.store-kernel.command.v1',commandType:'CHECKOUT_PAYMENT_CONFIRM',deviceId:'MFP-PAD-1',staffSessionRef:'S1',expectedRevision:8});
    value.timers.get(1)!();
    await expect(first).resolves.toMatchObject({state:'UNKNOWN',readbackRequired:true,retryPermitted:false});
    const recovery=value.checkout.paymentConfirm();await value.untilPosted(2);
    expect(value.posted[1]).toEqual({type:'mfp.store-kernel.submission.read.v1',storeId:'MF01',deviceId:'MFP-PAD-1',staffSessionRef:'S1',submissionId:'SUB-1',protocolVersion:1,requestId:'mfp-formal-2'});
    value.reply(receipt);await expect(recovery).resolves.toMatchObject(receipt);
    await expect(value.checkout.paymentConfirm()).resolves.toMatchObject(receipt);
    expect(value.posted.filter(row=>row.type==='mfp.store-kernel.command.v1')).toHaveLength(1);
    expect(value.rows.get('SUB-1')?.status).toBe('TERMINAL_OBSERVED');
  });

  it('keeps UNKNOWN readback locked and never blindly resubmits',async()=>{
    const value=await fixture();await value.review();
    const first=value.checkout.paymentConfirm();await value.untilPosted(1);value.timers.get(1)!();await first;
    const recovery=value.checkout.paymentConfirm();await value.untilPosted(2);
    value.reply({state:'UNKNOWN',readbackRequired:true,retryPermitted:false});await recovery;
    expect(value.posted).toHaveLength(2);
    expect(()=>value.checkout.returnToOrder()).toThrow('MFP_CHECKOUT_FORMAL_SUBMISSION_LOCKED');
  });

  it('retains a definitive stale-revision rejection without relabelling it as timeout or retrying',async()=>{
    const value=await fixture();await value.review();
    const first=value.checkout.paymentConfirm();await value.untilPosted(1);
    value.reply({state:'REJECTED',rejectionCode:'EXPECTED_REVISION_STALE'});
    await expect(first).resolves.toMatchObject({state:'REJECTED',rejectionCode:'EXPECTED_REVISION_STALE'});
    await expect(value.checkout.paymentConfirm()).resolves.toMatchObject({state:'REJECTED'});
    expect(value.posted).toHaveLength(1);
  });

  it('does not accept malformed canonical commit evidence',async()=>{
    const value=await fixture();await value.review();
    const first=value.checkout.paymentConfirm();await value.untilPosted(1);value.reply({state:'COMMITTED'});
    await expect(first).resolves.toMatchObject({state:'UNKNOWN',readbackRequired:true});
    expect(value.rows.get('SUB-1')?.status).toBe('UNKNOWN');
  });

  it('blocks public-mode native writes even with injected bridge and test-authenticated UI',async()=>{
    const value=await fixture(true);await value.review();
    await expect(value.checkout.paymentConfirm()).resolves.toMatchObject({state:'UNKNOWN'});
    expect(value.posted).toHaveLength(0);
    expect(value.checkout.getSnapshot().state).not.toBe('COMMITTED');
  });
});
