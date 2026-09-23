import {beforeEach,describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope} from '../runtime/admin-config-sync.ts';
import {LocalAdminMenuWorkspace} from './LocalAdminMenuWorkspace.tsx';

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
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{
    getRandomValues:(buffer:Uint8Array)=>{buffer.fill(7);return buffer;},
  }});
}

describe('SMT Admin sync status UI',()=>{
  beforeEach(()=>installStorage());

  it('is read-only and contains zero manual Admin mutation controls',()=>{
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:7,
      publishedAt:'2026-09-22T09:30:00.000Z',
      adminFingerprint:'fnv1a32:admin7',
      snapshot:{
        catalog:{categories:[],products:[],combos:[],comboPools:[]},
        optionCenter:{sets:[],productLinks:[]},
        availability:{},businessDay:{},logicalPrinters:[],printTemplates:{},printRules:{},
        productMedia:{},storeSettings:{},quickReasons:[],staff:[],channelPolicy:{},channelMapping:[],
        capacity:{},presentation:{},inventory:[],loyalty:{},coupons:[],announcements:[],
      },
    }));

    const html=renderToStaticMarkup(<LocalAdminMenuWorkspace/>);
    for(const marker of ['管理端同步狀態','毋須手動操作','收銀端正在使用','已收到完整設定','R7']){
      expect(html).toContain(marker);
    }
    for(const forbidden of ['匯入 Admin A2 Bundle','下載 SMT Readback Receipt','保存草稿','發布到 POS','初始 Menu → 草稿','＋ 分類','＋ 商品']){
      expect(html).not.toContain(forbidden);
    }
  });
});
