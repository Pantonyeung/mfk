import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {LinkedPosView} from './linked-pos-workspace.tsx';
import {createLinkedPosController} from './linked-pos.ts';

describe('linked POS surface isolation',()=>{
  it('clearly labels disconnected formal capabilities and exposes canonical refresh',()=>{
    const model=createLinkedPosController({enabled:true,request:vi.fn(),subscribe:vi.fn()}).getSnapshot();
    const html=renderToStaticMarkup(<LinkedPosView model={model} onRefresh={vi.fn()} onReview={vi.fn()}/>);
    for(const label of ['TEST REQUEST','連線測試','已發布菜單','重新讀取','尚未接通正式交易','尚未接通實體打印'])expect(html).toContain(label);
    expect(html).not.toContain('付款確認');expect(html).not.toContain('列印收據');
  });
  it('shows canonical options, published price and test-only review actions without server success text',()=>{
    const model=createLinkedPosController({enabled:true,request:vi.fn(),subscribe:vi.fn()}).getSnapshot();
    model.inbox=[{submissionId:'12345678-1234-1234-1234-123456789abc',idempotencyKey:'V3:12345678-1234-1234-1234-123456789abc',state:'PENDING_SMT',reviewState:'UNSEEN',reviewedAt:null,receivedAt:'2026-10-03T01:00:00Z',formalOrderCreated:false,paymentConfirmed:false,message:'PAID PRINTED COMMITTED',cart:[{productName:'飯糰',quantity:2,selections:[{optionName:'少飯'}]}],checkout:{name:'測試客人',phone:'00000000'}}];
    model.catalog={scope:'MFP_V3_LINKED_TEST_MF01_20261003',mode:'CONNECTED_TEST',fingerprint:'catalog-proof',revision:1,publishedAt:'2026-10-03T01:00:00Z',formalCheckoutConnected:false,physicalPrintConnected:false,categories:[{id:'rice',name:'飯糰'}],products:[{id:'p1',name:'飯糰',description:'',categoryId:'rice',priceMinor:4100,available:true,unavailableReason:'',options:[{id:'rice-option',name:'飯量',min:1,max:1,defaults:['small'],choices:[{id:'small',name:'少飯',adjustmentMinor:-100}]}]}]};
    const html=renderToStaticMarkup(<LinkedPosView model={model} onRefresh={vi.fn()} onReview={vi.fn()}/>);
    for(const label of ['41.00','少飯','預設','標記已查看','拒絕要求','未建立正式訂單','發布時間'])expect(html).toContain(label);
    for(const state of ['PAID','PRINTED','COMMITTED'])expect(html).not.toContain(state);
    Object.assign(model.inbox[0],{state:'REJECTED',reviewState:'SEEN',message:'POS 已查看點餐要求'});
    const rejected=renderToStaticMarkup(<LinkedPosView model={model} onRefresh={vi.fn()} onReview={vi.fn()}/>);
    expect(rejected).toContain('已拒絕測試要求');expect(rejected).not.toContain('已查看測試要求');
  });
  it('does not import or call formal business/native/print providers',()=>{
    const path=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
    for(const source of [path('./linked-pos.ts'),path('./linked-pos-workspace.tsx')]){
      for(const prohibited of ['checkout-runtime','order-operations-runtime','print-hardware-runtime','store-kernel-port','moreFunNative','localStorage','setInterval'])expect(source).not.toContain(prohibited);
    }
    expect(path('./main.tsx')).toContain('VITE_MFP_V3_LINKED_TEST');
  });
});
