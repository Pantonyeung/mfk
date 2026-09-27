import {beforeEach,describe,expect,it} from 'vitest';
import type {AdminSessionDraft} from '../../../v2admin/src/admin-draft.tsx';
import {buildAdminA2TransferFromDraft,inspectAdminA2Readback} from '../../../v2admin/src/admin-menu-transfer.ts';
import {
  assertAdminMenuA2NoHiddenTransport,
  validateAdminMenuTransferBundle,
} from '../../../contracts/admin-menu-transfer-v1.ts';
import {readLocalAdminMenu,readLocalAdminMenuReadback} from './local-admin-menu.ts';
import {receiveAdminMenuA2Transfer} from './admin-menu-transfer.ts';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

const draft:AdminSessionDraft=Object.freeze({
  categories:[
    {id:'cat-riceball',name:'飯團',position:10,active:true},
    {id:'cat-drink',name:'飲品',position:20,active:true},
  ],
  products:[
    {id:'riceball',name:'A2 飯團',categoryId:'cat-riceball',active:true,basePrice:'41.00',takeawayAdjustment:'1.00',modifierGroupIds:[]},
    {id:'milkTea',name:'A2 奶茶',categoryId:'cat-drink',active:true,basePrice:'16.00',takeawayAdjustment:'0.00',modifierGroupIds:[]},
  ],
  modifierGroups:[],
  combos:[],
});

describe('Admin A2 controlled transfer + human readback',()=>{
  beforeEach(()=>installStorage());

  it('proves SOURCE_INTENT -> TARGET_OBSERVED -> MATCH without hidden network',()=>{
    const before=readLocalAdminMenuReadback();
    expect(before.revision).toBe(1);

    const bundle=buildAdminA2TransferFromDraft(draft,before.revision,'2026-09-22T07:40:00.000Z');
    expect(validateAdminMenuTransferBundle(bundle).transportId).toBe(bundle.transportId);

    const transport=assertAdminMenuA2NoHiddenTransport();
    expect(transport.transport).toBe('HUMAN_CONTROLLED_FILE');
    expect(transport.network).toBe('ABSENT');
    expect(transport.polling).toBe('ABSENT');

    const receipt=receiveAdminMenuA2Transfer(bundle);
    expect(receipt.deliveryDisposition).toBe('APPLIED');
    expect(receipt.state).toBe('MATCH');

    const compare=inspectAdminA2Readback(bundle,receipt);
    expect(compare.state).toBe('MATCH');
    expect(compare.receipt.observedRevision).toBe(bundle.revision.revision);
    expect(compare.receipt.observedFingerprint).toBe(bundle.revision.fingerprint);
    expect(readLocalAdminMenu().products.find(x=>x.id==='riceball')?.name).toBe('A2 飯團');
  });

  it('same bundle replay is idempotent and still MATCH',()=>{
    const base=readLocalAdminMenuReadback().revision;
    const bundle=buildAdminA2TransferFromDraft(draft,base,'2026-09-22T07:41:00.000Z');
    const first=receiveAdminMenuA2Transfer(bundle);
    const second=receiveAdminMenuA2Transfer(bundle);
    expect(first.deliveryDisposition).toBe('APPLIED');
    expect(second.deliveryDisposition).toBe('IDEMPOTENT');
    expect(second.state).toBe('MATCH');
    expect(inspectAdminA2Readback(bundle,second).state).toBe('MATCH');
  });

  it('stale controlled transfer returns explicit MISMATCH receipt and preserves newer LKG',()=>{
    const first=buildAdminA2TransferFromDraft(draft,1,'2026-09-22T07:42:00.000Z');
    expect(receiveAdminMenuA2Transfer(first).state).toBe('MATCH');

    const staleDraft:AdminSessionDraft={...draft,products:draft.products.map(x=>x.id==='riceball'?{...x,name:'STALE SHOULD NOT APPLY'}:x)};
    const stale=buildAdminA2TransferFromDraft(staleDraft,1,'2026-09-22T07:43:00.000Z');
    const receipt=receiveAdminMenuA2Transfer(stale);
    expect(receipt.deliveryDisposition).toBe('REJECTED');
    expect(receipt.state).toBe('MISMATCH');
    expect(receipt.failureCode).toBe('ADMIN_MENU_INDEX_REVISION_CONFLICT');
    expect(readLocalAdminMenu().revision).toBe(2);
    expect(readLocalAdminMenu().products.find(x=>x.id==='riceball')?.name).toBe('A2 飯團');
  });

  it('tampered transport identity is rejected before target apply',()=>{
    const bundle=buildAdminA2TransferFromDraft(draft,1,'2026-09-22T07:44:00.000Z');
    expect(()=>receiveAdminMenuA2Transfer({...bundle,transportId:'tampered'})).toThrow('ADMIN_MENU_TRANSFER_ID_MISMATCH');
    expect(readLocalAdminMenu().revision).toBe(1);
  });
});
