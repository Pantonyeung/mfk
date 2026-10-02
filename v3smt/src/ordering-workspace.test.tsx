import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';

import type {MfpOrderingCatalog} from './ordering-domain.ts';
import {MfpOrderingWorkspace} from './ordering-workspace.tsx';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpSyncSnapshot} from './sync-port.ts';

const fact=(factId:string,amountMinor:number)=>({factId,amountMinor,currency:'HKD',revision:'MENU-7'});
const catalog:MfpOrderingCatalog={
  source:{storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,projectionHash:'projection-7',appliedAt:'2026-10-02T06:00:00.000Z'},
  categories:[{id:'rice',label:'飯糰',position:10}],
  products:[{
    productId:'P1',categoryId:'rice',name:'招牌飯糰',description:'即叫即製',imageUrl:'https://img.example/P1.webp',
    sellable:true,priceReady:true,publishedUnitPrice:fact('P1:BASE',3800),serviceModeAdjustments:{},optionSets:[],
  }],
  combos:[],comboPools:[],
};

const authenticatedSecurity:MfpSecurityPort={
  getSnapshot:()=>({
    device:{
      deviceId:'MFP-PAD-01',storeId:'MF01',deviceClass:'PAD',installationId:'INSTALL-01',
      createdAt:'2026-10-02T04:00:00.000Z',lastSeenAt:'2026-10-02T06:00:00.000Z',status:'AUTHORIZED',
    },
    session:{
      state:'AUTHENTICATED',staffSessionRef:'SESSION-NOT-RENDERED',staffId:'STAFF-01',displayName:'店員甲',
      role:'STAFF',scope:'STORE',permissions:['ORDER_CREATE'],issuedAt:'2026-10-02T04:00:00.000Z',
      expiresAt:'2026-10-02T10:00:00.000Z',deviceId:'MFP-PAD-01',storeId:'MF01',
    },
    sessionState:'AUTHENTICATED',
  }),
  loadDevice:async()=>{throw new Error('UNUSED');},refreshDeviceAuthorization:async()=>{throw new Error('UNUSED');},
  loginStaff:async()=>({state:'UNAUTHORIZED'}),refreshStaffSession:async()=> 'AUTHENTICATED',logoutStaff:async()=>undefined,
  precheckAction:()=>undefined,precheckFrontlineAction:()=>undefined,
  submitFormalCommand:async()=>{throw new Error('A4_DRAFT_ONLY');},
  submitFrontlineFormalCommand:async()=>{throw new Error('A5_BINDING_UNAVAILABLE');},
};

const sync=(state:MfpSyncSnapshot['state']):MfpSyncSnapshot=>({
  connection:state==='OFFLINE'?'OFFLINE':'CONNECTED',state,headSeq:7,appliedSeq:7,lkgAvailable:true,
  lastDoorbellAt:null,lastHeadReadAt:null,lastAppliedAt:'2026-10-02T06:00:00.000Z',lastAckAt:null,lastError:null,
});

describe('MFP V3 A4 formal ordering workspaces',()=>{
  it('renders the high-density Pad catalog and visible draft cart',()=>{
    const html=renderToStaticMarkup(<MfpOrderingWorkspace
      surface="MFP_PAD" catalog={catalog} security={authenticatedSecurity} syncSnapshot={sync('READY')}
    />);
    expect(html).toContain('data-ordering-surface="MFP_PAD"');
    expect(html).toContain('商品目錄');
    expect(html).toContain('招牌飯糰');
    expect(html).toContain('Cart Draft');
    expect(html).toContain('LOCAL_PREVIEW_FROM_PUBLISHED_FACTS');
    expect(html).not.toContain('SESSION-NOT-RENDERED');
  });

  it('renders a touch-first Mobile browse flow instead of scaled Pad markup',()=>{
    const html=renderToStaticMarkup(<MfpOrderingWorkspace
      surface="MFP_MOBILE" catalog={catalog} security={authenticatedSecurity} syncSnapshot={sync('READY')}
    />);
    expect(html).toContain('data-ordering-surface="MFP_MOBILE"');
    expect(html).toContain('mfp-mobile-nav');
    expect(html).toContain('查看購物車');
    expect(html).toContain('招牌飯糰');
    expect(html).not.toContain('mfp-pad-layout');
  });

  it('keeps the LKG usable while truthfully labelled offline',()=>{
    const html=renderToStaticMarkup(<MfpOrderingWorkspace
      surface="MFP_MOBILE" catalog={catalog} security={authenticatedSecurity} syncSnapshot={sync('OFFLINE')}
    />);
    expect(html).toContain('OFFLINE / LOCAL_LKG');
    expect(html).toContain('招牌飯糰');
  });

  it('shows no products when the A3 active projection is missing',()=>{
    const html=renderToStaticMarkup(<MfpOrderingWorkspace
      surface="MFP_PAD" catalog={null} security={authenticatedSecurity}
      syncSnapshot={{...sync('UNINITIALIZED'),lkgAvailable:false,appliedSeq:null,headSeq:null}}
    />);
    expect(html).toContain('暫時未有可用菜單');
    expect(html).not.toContain('招牌飯糰');
  });
});
