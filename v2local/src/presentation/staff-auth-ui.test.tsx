import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {applyAdminConfigEnvelope} from '../runtime/admin-config-sync.ts';
import {StaffAuthGate} from './StaffAuthGate.tsx';

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

describe('Staff login presentation',()=>{
  it('keeps the SMT shell visible underneath a compact blocking login dialog',()=>{
    installStorage();
    applyAdminConfigEnvelope(createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:3,
      publishedAt:'2026-09-22T11:00:00.000Z',
      adminFingerprint:'fnv1a32:staff-ui',
      snapshot:{
        catalog:{categories:[],products:[],combos:[],comboPools:[]},
        staffAuth:{
          schema:'MFK_STAFF_AUTH_V1',
          staff:[{
            staffId:'staff-1',
            name:'老闆',
            role:'OWNER',
            scope:'STORE',
            adminLogin:true,
            active:true,
            permissions:['ORDER_REVIEW','ORDER_CORRECTION'],
            pinVerifier:{
              algorithm:'PBKDF2-SHA256',
              iterations:120000,
              saltHex:'00112233445566778899aabbccddeeff',
              hashHex:'00'.repeat(32),
            },
          }],
        },
      },
    }));

    const html=renderToStaticMarkup(<StaffAuthGate><div>SMT_BACKGROUND_VISIBLE</div></StaffAuthGate>);
    expect(html).toContain('SMT_BACKGROUND_VISIBLE');
    expect(html).toContain('smt-gated-underlay');
    expect(html).toContain('smt-blocking-overlay');
    expect(html).toContain('smt-access-card--compact');
    expect(html).toContain('員工登入');
    expect(html).not.toContain('smt-access-brand-panel');
  });
});
