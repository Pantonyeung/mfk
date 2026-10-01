import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {MFK_CUSTOMER_ORDER_INTENT_SCHEMA} from '../../contracts/customer-cloud-v1.ts';
import {
  MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS,
  verifyCustomerCommercialCart,
} from '../../contracts/customer-commercial-freshness-v1.ts';
import {
  issueCustomerCommercialFreshnessProof,
  parseCustomerCommercialProofKeyring,
  verifyCustomerCommercialFreshnessProof,
} from '../customer-commercial-proof.ts';
import worker,{AdminSyncStore} from '../worker.ts';
import {CustomerRuntimeStore} from '../customer-runtime.ts';

const now=Date.parse('2026-10-01T12:00:00.000Z');
const keyring=parseCustomerCommercialProofKeyring(JSON.stringify({
  current:{keyId:'oct-2026',secretHex:'11'.repeat(32)},
  previous:[{keyId:'sep-2026',secretHex:'22'.repeat(32)}],
}));
const keyringRaw=JSON.stringify({
  current:{keyId:'oct-2026',secretHex:'11'.repeat(32)},
  previous:[{keyId:'sep-2026',secretHex:'22'.repeat(32)}],
});
const identity={
  storeId:'MF01',
  customerPortSeq:17,
  projectionHash:'a'.repeat(64),
  canonicalRevision:42,
  canonicalFingerprint:'b'.repeat(64),
} as const;

describe('Customer commercial freshness proof',()=>{
  it('issues a five-minute HMAC proof and verifies the exact commercial identity',async()=>{
    const proof=await issueCustomerCommercialFreshnessProof(identity,keyring,now);
    expect(Date.parse(proof.expiresAt)-Date.parse(proof.issuedAt)).toBe(MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS);
    await expect(verifyCustomerCommercialFreshnessProof(proof,keyring,identity,now+299_999)).resolves.toEqual(proof);
  });

  it.each([
    ['projection hash',{projectionHash:'c'.repeat(64)},'CUSTOMER_COMMERCIAL_PROOF_SIGNATURE_INVALID'],
    ['port sequence',{customerPortSeq:18},'CUSTOMER_COMMERCIAL_PROOF_SIGNATURE_INVALID'],
  ])('fails closed for tampered %s',async(_label,mutation,code)=>{
    const proof=await issueCustomerCommercialFreshnessProof(identity,keyring,now);
    await expect(verifyCustomerCommercialFreshnessProof({...proof,...mutation},keyring,{...identity,...mutation},now+1)).rejects.toThrow(code);
  });

  it('rejects a proof issued for another store',async()=>{
    const proof=await issueCustomerCommercialFreshnessProof(identity,keyring,now);
    await expect(verifyCustomerCommercialFreshnessProof(proof,keyring,{...identity,storeId:'MF02'},now+1)).rejects.toThrow('CUSTOMER_COMMERCIAL_PROOF_STORE_MISMATCH');
  });

  it('uses server receipt time and rejects an expired proof without consulting browser time',async()=>{
    const proof=await issueCustomerCommercialFreshnessProof(identity,keyring,now);
    await expect(verifyCustomerCommercialFreshnessProof(proof,keyring,identity,now+300_000)).rejects.toThrow('CUSTOMER_COMMERCIAL_PROOF_EXPIRED');
  });

  it('accepts the previous rotation key but rejects malformed and unknown-key tokens',async()=>{
    const previous={...keyring,current:keyring.previous[0]!,previous:[keyring.current]};
    const proof=await issueCustomerCommercialFreshnessProof(identity,previous,now);
    await expect(verifyCustomerCommercialFreshnessProof(proof,keyring,identity,now+1)).resolves.toEqual(proof);
    await expect(verifyCustomerCommercialFreshnessProof({...proof,freshnessToken:'broken'},keyring,identity,now+1)).rejects.toThrow('CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID');
    await expect(verifyCustomerCommercialFreshnessProof({...proof,keyId:'unknown'},keyring,identity,now+1)).rejects.toThrow('CUSTOMER_COMMERCIAL_PROOF_KEY_UNKNOWN');
  });
});

describe('Customer historical commercial facts',()=>{
  const projection={menu:{
    products:[{
      productId:'bento',name:'肉燥便當',available:true,publishedUnitPriceMinor:4800,
      optionGroups:[{optionGroupId:'rice',name:'飯量',required:true,minSelections:1,maxSelections:1,options:[
        {optionId:'extra',name:'加飯',available:true,publishedAdjustmentMinor:400},
      ]}],
    }],
    combos:[],comboPools:[],
  }};
  const cart=[{
    lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:1,
    selections:[{optionGroupId:'rice',optionId:'extra',optionName:'加飯',publishedAdjustmentMinor:400}],
    publishedUnitPriceMinor:5200,
  }];

  it('honours facts from the signed historical projection even after the current price changes',()=>{
    expect(verifyCustomerCommercialCart(cart,projection)).toMatchObject({totalMinor:5200});
    const current=structuredClone(projection);
    current.menu.products[0]!.publishedUnitPriceMinor=5200;
    expect(()=>verifyCustomerCommercialCart(cart,current)).toThrow('CUSTOMER_COMMERCIAL_UNIT_PRICE_MISMATCH:L1');
  });

  it('rejects a browser-modified unit price and option adjustment',()=>{
    expect(()=>verifyCustomerCommercialCart([{...cart[0]!,publishedUnitPriceMinor:100}],projection)).toThrow('CUSTOMER_COMMERCIAL_UNIT_PRICE_MISMATCH:L1');
    expect(()=>verifyCustomerCommercialCart([{
      ...cart[0]!,
      selections:[{...cart[0]!.selections[0]!,publishedAdjustmentMinor:1}],
    }],projection)).toThrow('CUSTOMER_COMMERCIAL_OPTION_FACT_MISMATCH:L1:extra');
  });
});

class MemoryStorage{
  rows=new Map<string,unknown>();
  async get(key:string){return this.rows.get(key);}
  async put(key:string,value:unknown){this.rows.set(key,value);}
  async delete(key:string){this.rows.delete(key);}
  async list({prefix}:{prefix:string}){return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)));}
  async transaction<T>(work:(storage:MemoryStorage)=>Promise<T>){return work(this);}
}
function adminSnapshot(price:string){
  return{
    catalog:{
      categories:[{id:'meal',name:'飯',position:1,active:true}],
      products:[{id:'bento',categoryId:'meal',name:'肉燥便當',description:'',basePrice:price,active:true}],
      combos:[],comboPools:[],
    },
    optionCenter:{sets:[],productLinks:[]},
    availability:{},
    productMedia:{},
    customerChannelPolicy:{enabled:true},
    storeSettings:{storeName:'磨飯',customerPaymentChannels:[]},
  };
}

describe('AdminSyncStore commercial issue and historical verification',()=>{
  it('honours a valid old $48 proof after $52 publishes and rejects browser price tampering',async()=>{
    const storage=new MemoryStorage();
    const pending:Promise<unknown>[]=[];
    const store=new AdminSyncStore({
      storage,
      getWebSockets:()=>[],
      waitUntil:(promise:Promise<unknown>)=>pending.push(promise),
    } as never,{CUSTOMER_COMMERCIAL_PROOF_KEYRING:keyringRaw} as never);
    const first=createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:'2026-10-01T11:00:00.000Z',adminFingerprint:'admin-1',snapshot:adminSnapshot('48.00')});
    expect((await store.publishEnvelope(first)).status).toBe(200);
    await Promise.all(pending.splice(0));
    const headResponse=await store.fetch(new Request('https://internal/sync/head?storeId=MF01&port=CUSTOMER',{headers:{origin:'https://order.morefunos.com'}}));
    expect(headResponse.status).toBe(200);
    const head=await headResponse.json() as Record<string,any>;
    const proof=head.commercialFreshness;
    const intent={
      schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
      storeId:'MF01',submissionId:'CUSTOMER-proof-1',menuRevision:'1',idempotencyKey:'customer-order:CUSTOMER-proof-1',
      customerPortSeq:proof.customerPortSeq,projectionHash:proof.projectionHash,canonicalRevision:proof.canonicalRevision,commercialProof:proof,
      createdAt:'2026-10-01T12:00:00.000Z',updatedAt:'2026-10-01T12:00:00.000Z',
      cart:[{lineId:'L1',productId:'bento',productName:'肉燥便當',quantity:1,selections:[],publishedUnitPriceMinor:4800}],
      checkout:{name:'Test',phone:'91234567',paymentMethod:'PAY_AT_STORE'},
    };
    const customer=new CustomerRuntimeStore({storage:new MemoryStorage()} as never,{} as never);
    const env={
      ADMIN_SYNC:{idFromName:()=> 'MF01',get:()=>store},
      CUSTOMER_RUNTIME:{idFromName:()=> 'MF01',get:()=>customer},
    };
    const currentAccepted=await worker.fetch(new Request('https://admin.morefunos.com/api/customer/orders/submit?storeId=MF01',{
      method:'POST',headers:{origin:'https://order.morefunos.com','content-type':'application/json'},body:JSON.stringify(intent),
    }),env as never);
    expect(currentAccepted.status).toBe(202);

    const second=createMfkAdminConfigEnvelope({storeId:'MF01',revision:2,publishedAt:'2026-10-01T11:01:00.000Z',adminFingerprint:'admin-2',snapshot:adminSnapshot('52.00')});
    expect((await store.publishEnvelope(second)).status).toBe(200);
    await Promise.all(pending.splice(0));

    const oldIntent={...intent,submissionId:'CUSTOMER-proof-2',idempotencyKey:'customer-order:CUSTOMER-proof-2'};
    const accepted=await store.fetch(new Request('https://internal/customer-commercial/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(oldIntent)}));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({grant:{totalMinor:4800,canonicalRevision:1}});

    const tampered=await store.fetch(new Request('https://internal/customer-commercial/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...oldIntent,cart:[{...intent.cart[0],publishedUnitPriceMinor:100}]})}));
    expect(tampered.status).toBe(409);
    expect(await tampered.json()).toMatchObject({code:'CUSTOMER_COMMERCIAL_UNIT_PRICE_MISMATCH:L1'});
  });
});
