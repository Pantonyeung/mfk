import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

import {createMfpOrderingDomain,type MfpOrderingCatalog,type MfpOrderingDraft} from './ordering-domain.ts';
import {
  DEFAULT_MFP_DISPLAY_SETTINGS,
  MFP_DISPLAY_SETTINGS_KEY,
  assignMfpFastPair,
  buildMfpFastPairDraft,
  defaultMfpDraftDestination,
  loadMfpDisplaySettings,
  mfpDisplaySettingsStyle,
  mfpGuidanceTarget,
  mfpHoldEntryLabel,
  presentMfpCart,
  requiredTasksForMfpDraft,
  resolveMfpDraftDestination,
  saveMfpDisplaySettings,
  sequencePreviewForMfpLine,
  swapMfpFastPair,
} from './ordering-owner-closure.ts';
import {isMfpFrontlineSessionEligible,type MfpSecurityPort} from './security-port.ts';

const fact=(factId:string,amountMinor:number)=>({factId,amountMinor,currency:'HKD',revision:'MENU-7'});
const catalog:MfpOrderingCatalog={
  source:{storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,projectionHash:'projection-7',appliedAt:'2026-10-02T06:00:00.000Z'},
  categories:[{id:'rice',label:'飯糰',position:10},{id:'snack',label:'小食',position:20}],
  products:[
    {productId:'MAIN',categoryId:'rice',name:'紫米飯糰',sellable:true,priceReady:true,publishedUnitPrice:fact('MAIN',3000),serviceModeAdjustments:{},optionSets:[{
      id:'rice-choice',name:'飯類',required:true,selection:'SINGLE',min:1,max:1,options:[
        {id:'purple',name:'紫米',defaultSelected:false,sellable:true,position:10,priceAdjustment:fact('PURPLE',0)},
      ],
    }]},
    {productId:'SNACK',categoryId:'snack',name:'小食',sellable:true,priceReady:true,publishedUnitPrice:fact('SNACK',1800),serviceModeAdjustments:{},optionSets:[]},
  ],
  combos:[{id:'COMBO',name:'紫米套餐',sellable:true,priceReady:true,publishedBasePrice:fact('COMBO',4100),serviceModeAdjustments:{},mainPoolId:'MAIN-POOL',addonPoolIds:['SNACK-POOL']}],
  comboPools:[
    {id:'MAIN-POOL',name:'主餐',kind:'MAIN_COURSE',groups:[{id:'MAIN-GROUP',name:'飯糰',required:true,min:1,max:1,position:10,subPools:[{
      id:'MAIN-BAND',name:'飯糰',sellable:true,position:10,priceAdjustment:fact('MAIN-BAND',0),choices:[
        {id:'MAIN-CHOICE',type:'PRODUCT',productId:'MAIN',label:'紫米飯糰',sellable:true,position:10,priceAdjustment:fact('MAIN-CHOICE',0)},
      ],
    }]}]},
    {id:'SNACK-POOL',name:'小食',kind:'ADDON',addonKind:'SNACK',groups:[{id:'SNACK-GROUP',name:'小食',required:true,min:1,max:1,position:10,subPools:[{
      id:'SNACK-BAND',name:'小食',sellable:true,position:10,priceAdjustment:fact('SNACK-BAND',0),choices:[
        {id:'SNACK-CHOICE',type:'PRODUCT',productId:'SNACK',label:'小食',sellable:true,position:10,priceAdjustment:fact('SNACK-CHOICE',0)},
      ],
    }]}]},
  ],
};

function draft(lines:ReadonlyArray<Readonly<{id:string;productId:'MAIN'|'SNACK';mode?:'takeaway'|'dine-in';note?:string;quantity?:number;complete?:boolean}>>){
  const domain=createMfpOrderingDomain(catalog);
  return lines.reduce((current,line)=>domain.addProduct(current,{
    cartLineId:line.id,productId:line.productId,quantity:line.quantity??1,note:line.note,
    optionSelections:line.productId==='MAIN'&&line.complete!==false?{'rice-choice':['purple']}:{},
  },{allowIncomplete:line.complete===false}),domain.createDraft('takeaway'));
}

describe('MFP V3 A4 Owner FINAL closure',()=>{
  it('keeps Display Settings presentation-only and outside normalized intent',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const value=draft([{id:'L1',productId:'SNACK'}]);
    const before=domain.normalize(value);
    expect(mfpDisplaySettingsStyle({...DEFAULT_MFP_DISPLAY_SETTINGS,fontScale:1.25,densityScale:.85})).toEqual(expect.objectContaining({
      '--mfp-font-scale':'1.25','--mfp-density-scale':'0.85',
    }));
    expect(domain.normalize(value)).toEqual(before);
  });

  it('persists Display Settings across storage restore',()=>{
    const rows=new Map<string,string>();
    const storage={getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>void rows.set(key,value)};
    const settings={...DEFAULT_MFP_DISPLAY_SETTINGS,categoryRows:2,productColumns:5,showImages:false,fontScale:1.2,densityScale:.9};
    saveMfpDisplaySettings(storage,settings);
    expect(rows.has(MFP_DISPLAY_SETTINGS_KEY)).toBe(true);
    expect(loadMfpDisplaySettings(storage)).toEqual(settings);
  });

  it('falls back safely when persisted Display Settings are invalid',()=>{
    const storage={getItem:()=>'{"productColumns":99}',setItem:()=>undefined};
    expect(loadMfpDisplaySettings(storage)).toEqual(DEFAULT_MFP_DISPLAY_SETTINGS);
  });

  it('keeps ORIGINAL in original input order',()=>{
    expect(presentMfpCart(draft([{id:'S',productId:'SNACK'},{id:'M',productId:'MAIN'}]),catalog,'ORIGINAL').map(row=>row.cartLineIds[0])).toEqual(['S','M']);
  });

  it('sorts SORT view by canonical Product Category position',()=>{
    expect(presentMfpCart(draft([{id:'S',productId:'SNACK'},{id:'M',productId:'MAIN'}]),catalog,'SORT').map(row=>row.cartLineIds[0])).toEqual(['M','S']);
  });

  it('does not combine exact-equivalent lines in SORT view',()=>{
    const rows=presentMfpCart(draft([{id:'A',productId:'SNACK'},{id:'B',productId:'SNACK'}]),catalog,'SORT');
    expect(rows).toHaveLength(2);
    expect(rows.every(row=>!row.combined)).toBe(true);
  });

  it('combines only exact-equivalent configurations in COMBINE view',()=>{
    const rows=presentMfpCart(draft([{id:'A',productId:'SNACK'},{id:'B',productId:'SNACK'}]),catalog,'COMBINE');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({cartLineIds:['A','B'],quantity:2,combined:true});
  });

  it('keeps different notes as independent lines',()=>{
    expect(presentMfpCart(draft([{id:'A',productId:'SNACK',note:'少鹽'},{id:'B',productId:'SNACK',note:'走鹽'}]),catalog,'COMBINE')).toHaveLength(2);
  });

  it('keeps different service modes as independent lines',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const base=draft([{id:'A',productId:'SNACK'},{id:'B',productId:'SNACK'}]);
    const mixed=domain.setLineServiceMode(base,'B','dine-in');
    expect(presentMfpCart(mixed,catalog,'COMBINE')).toHaveLength(2);
  });

  it('updates every draft line with the whole-cart service-mode switch',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const changed=domain.setServiceMode(draft([{id:'A',productId:'SNACK'},{id:'B',productId:'SNACK'}]),'dine-in');
    expect(changed.serviceMode).toBe('dine-in');
    expect(changed.lines.map(line=>line.serviceMode)).toEqual(['dine-in','dine-in']);
  });

  it('updates one line service mode without changing sibling lines',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const changed=domain.setLineServiceMode(draft([{id:'A',productId:'SNACK'},{id:'B',productId:'SNACK'}]),'B','dine-in');
    expect(changed.lines.map(line=>line.serviceMode)).toEqual(['takeaway','dine-in']);
  });

  it('derives sequence preview without allocating formal Order identity',()=>{
    const value=draft([{id:'A',productId:'SNACK'},{id:'B',productId:'MAIN'}]);
    expect(sequencePreviewForMfpLine(value,'B')).toBe('002');
    expect(JSON.stringify(value)).not.toMatch(/orderId|displayNumber/);
  });

  it('defaults all-takeaway drafts to Hold',()=>{
    expect(defaultMfpDraftDestination(draft([{id:'A',productId:'SNACK'}]))).toBe('HOLD');
  });

  it('defaults any-dine-in draft to Dining',()=>{
    const domain=createMfpOrderingDomain(catalog);
    expect(defaultMfpDraftDestination(domain.setLineServiceMode(draft([{id:'A',productId:'SNACK'},{id:'B',productId:'MAIN'}]),'B','dine-in'))).toBe('DINING');
  });

  it('lets staff override Hold and Dining in both directions',()=>{
    const value=draft([{id:'A',productId:'SNACK'}]);
    expect(resolveMfpDraftDestination(value,'DINING')).toBe('DINING');
    expect(resolveMfpDraftDestination(value,'HOLD')).toBe('HOLD');
  });

  it('shows Retrieve for an empty draft',()=>{
    const domain=createMfpOrderingDomain(catalog);
    expect(mfpHoldEntryLabel(domain.createDraft('takeaway'))).toBe('Retrieve');
    expect(mfpHoldEntryLabel(draft([{id:'A',productId:'SNACK'}]))).toBe('Hold / Dining');
  });

  it('builds deterministic positional A/B/C Fast Pair slots from canonical combo pools',()=>{
    const plan=buildMfpFastPairDraft(catalog,draft([
      {id:'M',productId:'MAIN',quantity:2},{id:'S',productId:'SNACK',quantity:2},
    ]));
    expect(plan.slots.map(slot=>[slot.label,slot.mainUnitId,slot.defaultSnackUnitId])).toEqual([
      ['A','M::1','S::1'],['B','M::2','S::2'],
    ]);
  });

  it('swaps occupied Fast Pair assignments without duplication',()=>{
    const plan=buildMfpFastPairDraft(catalog,draft([{id:'M',productId:'MAIN',quantity:2},{id:'S',productId:'SNACK',quantity:2}]));
    const assigned=assignMfpFastPair(plan);
    const swapped=swapMfpFastPair(plan,assigned,plan.slots[0]!.id,assigned[plan.slots[1]!.id]!);
    expect(Object.values(swapped).sort()).toEqual(['S::1','S::2']);
    expect(swapped[plan.slots[0]!.id]).toBe('S::2');
    expect(swapped[plan.slots[1]!.id]).toBe('S::1');
  });

  it('leaves unequal Fast Pair quantities as residual singles',()=>{
    const extraMain=buildMfpFastPairDraft(catalog,draft([{id:'M',productId:'MAIN',quantity:2},{id:'S',productId:'SNACK'}]));
    const extraSnack=buildMfpFastPairDraft(catalog,draft([{id:'M',productId:'MAIN'},{id:'S',productId:'SNACK',quantity:2}]));
    expect(extraMain.residualMainUnitIds).toEqual(['M::2']);
    expect(extraSnack.residualSnackUnitIds).toEqual(['S::2']);
  });

  it('never auto-upgrades a single product into a combo',()=>{
    const value=draft([{id:'M',productId:'MAIN'}]);
    buildMfpFastPairDraft(catalog,value);
    expect(value.lines).toHaveLength(1);
    expect(value.lines[0]).toMatchObject({kind:'PRODUCT',comboId:null});
  });

  it('derives Required tasks only from canonical product option facts',()=>{
    const tasks=requiredTasksForMfpDraft(catalog,draft([{id:'M',productId:'MAIN',complete:false}]));
    expect(tasks).toEqual([{cartLineId:'M',productId:'MAIN',optionSetId:'rice-choice',label:'飯類',min:1,max:1}]);
  });

  it('keeps Quick-mode unresolved Required lines explicitly INCOMPLETE',()=>{
    const value=draft([{id:'M',productId:'MAIN',complete:false}]);
    expect(value.lines[0]).toMatchObject({state:'INCOMPLETE',issues:['MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED']});
    expect(createMfpOrderingDomain(catalog).normalize(value).checkoutReady).toBe(false);
  });

  it('uses Silent Guided Flow as focus only and never mutates the draft',()=>{
    const value=draft([{id:'M',productId:'MAIN',complete:false}]);
    const before=JSON.stringify(value);
    expect(mfpGuidanceTarget(catalog,value)).toBe('REQUIRED');
    expect(JSON.stringify(value)).toBe(before);
  });

  it('focuses an unresolved explicit combo as the Combo blocker',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const value=domain.addCombo(domain.createDraft('takeaway'),{cartLineId:'C',comboId:'COMBO',quantity:1},{allowIncomplete:true});
    expect(mfpGuidanceTarget(catalog,value)).toBe('COMBO_BLOCKER');
  });

  it('focuses a missing canonical DRINK pool before the remaining Combo blocker',()=>{
    const drinkPool={...catalog.comboPools[1]!,id:'DRINK-POOL',name:'飲品',addonKind:'DRINK' as const,groups:[{
      ...catalog.comboPools[1]!.groups[0]!,id:'DRINK-GROUP',name:'飲品',subPools:[{
        ...catalog.comboPools[1]!.groups[0]!.subPools[0]!,id:'DRINK-BAND',name:'飲品',choices:[{
          ...catalog.comboPools[1]!.groups[0]!.subPools[0]!.choices[0]!,id:'DRINK-CHOICE',label:'飲品',productId:'SNACK',
        }],
      }],
    }]};
    const drinkCatalog={...catalog,combos:[{...catalog.combos[0]!,addonPoolIds:['DRINK-POOL']}],comboPools:[catalog.comboPools[0]!,drinkPool]};
    const domain=createMfpOrderingDomain(drinkCatalog);
    const value=domain.addCombo(domain.createDraft('takeaway'),{cartLineId:'C',comboId:'COMBO',quantity:1},{allowIncomplete:true});
    expect(mfpGuidanceTarget(drinkCatalog,value)).toBe('QUICK_DRINK');
  });

  it('preserves cartLineId during same-line edit',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const before=draft([{id:'A',productId:'SNACK',note:'原本'}]);
    const after=domain.editProduct(before,{cartLineId:'A',productId:'SNACK',quantity:1,note:'修改',optionSelections:{}});
    expect(after.lines).toHaveLength(1);
    expect(after.lines[0]).toMatchObject({cartLineId:'A',note:'修改'});
  });

  it('keeps authenticated valid MFP staff eligible without a Manager-style permission assumption',()=>{
    const snapshot:ReturnType<MfpSecurityPort['getSnapshot']>={
      device:{deviceId:'D',storeId:'MF01',deviceClass:'PAD',installationId:'I',createdAt:'2026-10-02T04:00:00.000Z',lastSeenAt:'2026-10-02T06:00:00.000Z',status:'AUTHORIZED'},
      session:{state:'AUTHENTICATED',staffSessionRef:'S',staffId:'STAFF',displayName:'店員',role:'STAFF',scope:'STORE',permissions:[],issuedAt:'2026-10-02T04:00:00.000Z',expiresAt:'2026-10-02T10:00:00.000Z',deviceId:'D',storeId:'MF01'},
      sessionState:'AUTHENTICATED',
    };
    const now=Date.parse('2026-10-02T06:00:00.000Z');
    expect(isMfpFrontlineSessionEligible(snapshot,now)).toBe(true);
    expect(isMfpFrontlineSessionEligible({...snapshot,session:null,sessionState:'REVOKED'},now)).toBe(false);
  });

  it('locks the blue baseline and reserves red for destructive semantics',()=>{
    const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
    expect(css).toContain('--mfp-primary:#1f5fbf');
    expect(css).toContain('--mfp-danger:');
    expect(css).not.toContain('--mfp-accent:#e95d20');
  });

  it('locks the Pad 75% major-modal geometry and fixed action footer',()=>{
    const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
    expect(css).toMatch(/\.mfp-pad \.mfp-config\{[^}]*width:75%[^}]*height:75%/);
    expect(css).toMatch(/\.mfp-config>footer\{[^}]*flex-shrink:0/);
    expect(css).toContain('.mfp-config-scroll');
  });

  it('wires stable high-frequency navigation, More, three Fast Lanes and protected clear',()=>{
    const source=['./ordering-workspace.tsx','./ordering-owner-workspaces.tsx','./order-operations-workspace.tsx'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\n');
    for(const label of ['待處理','點單','訂單','堂食','設定','快速配對','必選項目','紫米套餐'])expect(source).toContain(label);
    expect(source).toContain('確認清除');
    expect(source).toContain('mfp-clear-secondary');
    expect(source).toContain('allowIncomplete:true');
    expect(source).not.toMatch(/下一步|上一步|submitFormalCommand/);
  });

  it('shows quantity steppers only for exact COMBINE presentation groups',()=>{
    const source=readFileSync(new URL('./ordering-owner-workspaces.tsx',import.meta.url),'utf8');
    expect(source).toContain("row.combined&&viewMode==='COMBINE'");
  });
});
