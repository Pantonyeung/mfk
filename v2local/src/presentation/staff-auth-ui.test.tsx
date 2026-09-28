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

function installStaffConfig(){
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
}

describe('Staff login presentation',()=>{
  it('keeps ordering inert underneath the Owner-approved full-screen Stage 0 gate',()=>{
    installStaffConfig();
    const html=renderToStaticMarkup(<StaffAuthGate><button>ORDERING_INTERACTION</button></StaffAuthGate>);

    expect(html).toContain('ORDERING_INTERACTION');
    expect(html).toContain('smt-gated-underlay');
    expect(html).toContain('class="s0"');
    expect(html).toContain('員工登入');
    expect(html).toContain('s0-keypad');
    expect(html).toContain('/assets/smt/stage0/stage0-logo.jpg');
    expect(html).toContain('/assets/smt/stage0/stage0-ip-boy.png');

    // Ordering remains rendered for continuity/readback but is inside the inert,
    // aria-hidden gated underlay until the existing Staff Auth authority opens it.
    expect(html.indexOf('smt-gated-underlay')).toBeLessThan(html.indexOf('ORDERING_INTERACTION'));

    // The superseded compact blocking-dialog contract must not return.
    expect(html).not.toContain('smt-blocking-overlay');
    expect(html).not.toContain('smt-access-card--compact');
  });

  it('renders a numeric PIN keypad while preserving the existing staff-auth gate',()=>{
    installStaffConfig();
    const html=renderToStaticMarkup(<StaffAuthGate><div>ORDERING</div></StaffAuthGate>);

    for(const digit of ['1','2','3','4','5','6','7','8','9','0']){
      expect(html).toContain('>'+digit+'</button>');
    }
    expect(html).toContain('aria-label="員工 PIN"');
    expect(html).toContain('type="password"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toContain('掃碼登入');
    expect(html).not.toContain('需要協助？');
    expect(html).not.toContain('關閉系統');
    expect(html).toContain('Admin Config R3');
  });
});
