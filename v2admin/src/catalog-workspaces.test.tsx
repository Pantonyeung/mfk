import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {AdminDraftProvider,useAdminDraft,validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {ProductOperationalDetail,ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {PRODUCT_MEDIA_BACKEND_CONTRACT,normalizeProductPrintRule} from './admin-product-operational-config.ts';
import {MfkAdminApp} from './App.tsx';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {applyProductSetLinksBulk,migrateLegacyDraftToOptionSetCenter,projectOptionSetsForProduct,useOptionSetCenter,validateOptionSetCenter,type OptionSetCenterState} from './admin-option-set-center.ts';
import {validateAdminConfig} from './admin-config-save.ts';
import {COMBO_R3_COMBOS,COMBO_R3_POOLS} from './admin-combo-pool-seed-r3.ts';
import {COMBO_R4_COMBOS,COMBO_R4_POOLS,applyComboR4NestedPoolSeed} from './admin-combo-pool-seed-r4.ts';


function ProductDetailHarness({productId}:{productId:string}){
  const {draft}=useAdminDraft();
  const optionCenter=useOptionSetCenter(draft);
  return <ProductOperationalDetail productId={productId} optionCenter={optionCenter}/>;
}

describe('MFK Admin complete catalog product',()=>{
  it('renders a bounded compact Product list by default',()=>{
    const html=renderToStaticMarkup(<AdminDraftProvider><ProductsWorkspace/></AdminDraftProvider>);
    for(const marker of ['商品資料','新增商品','搜尋商品名稱','找到 203 件','每頁最多 20 件','第 1 / 11 頁','編輯']) expect(html).toContain(marker);
    expect(html).toContain('203');
    expect(html).toContain('188');
    expect(html).toContain('保存');
    expect((html.match(/class="admin-product-row /g)??[]).length).toBe(20);
    expect(html).not.toContain('商品詳細資料');
    expect(html).not.toContain('商品描述</span>');
  });


  it('shows complete bounded Product operational sections on demand',()=>{
    const productId=LEGACY_MF01_ADMIN_DRAFT.products[0]!.id;
    const html=renderToStaticMarkup(<AdminDraftProvider><ProductDetailHarness productId={productId}/></AdminDraftProvider>);
    for(const marker of [
      '基本資料','價格','選項','先喺「選項中心」建立完整選項組',
      '打印','廚房製作單','打包單','堂食打印','外賣打印',
      '圖片／媒體','Canonical 圖片連結','Keeta 獨立圖片連結','R2 Object Key','D1 Media Ref',
    ])expect(html).toContain(marker);
    expect(html).toContain('MFK_R2_PRODUCT_MEDIA');
    expect(html).toContain('MFK_D1_PRODUCT_MEDIA');
  });

  it('keeps Product print defaults complete and media backend fail-closed until real wiring',()=>{
    const rule=normalizeProductPrintRule(undefined);
    expect(rule.receipt).toBe(true);
    expect(rule.production).toBe(true);
    expect(rule.packing).toBe(true);
    expect(rule.dineIn).toBe(true);
    expect(rule.takeaway).toBe(true);
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.currentExecution).toBe('NOT_WIRED');
    expect(PRODUCT_MEDIA_BACKEND_CONTRACT.browserDirectR2Credentials).toBe(false);
  });

  it('routes core catalog responsibilities to concrete editors',()=>{
    const pathsAndMarkers=[
      ['/admin/catalog/products','商品資料'],
      ['/admin/catalog/categories','商品分類'],
      ['/admin/catalog/modifiers','選項中心'],
      ['/admin/catalog/pricing','價格管理'],
      ['/admin/catalog/combos','套餐'],
      ['/admin/catalog/menu-display','菜單／顯示排序'],
    ] as const;
    for(const [path,marker] of pathsAndMarkers){
      const html=renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><MfkAdminApp/></MemoryRouter>);
      expect(html,path).toContain(marker);
      expect(html,path).not.toContain('class="mfk-admin-capability"');
    }
  });

  it('provides business-day and logical printer configuration as real Admin responsibilities',()=>{
    const businessDay=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/business-day']}><MfkAdminApp/></MemoryRouter>);
    expect(businessDay).toContain('營業日／交更');
    expect(businessDay).toContain('每日分界時間');
    expect(businessDay).toContain('日結後修改權限');
    expect(businessDay).toContain('永遠唔會阻止新交易');

    const print=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/print']}><MfkAdminApp/></MemoryRouter>);
    expect(print).toContain('打印中心');
    expect(print).toContain('新增打印用途');
    expect(print).toContain('唯一打印用途清單');
    expect(print).toContain('飯糰 Label');
  });

  it('has a concrete workspace for every Admin capability',()=>{
    for(const capability of ADMIN_CAPABILITIES){
      const html=renderToStaticMarkup(<MemoryRouter initialEntries={[capability.path]}><MfkAdminApp/></MemoryRouter>);
      expect(html,capability.id).not.toContain('class="mfk-admin-capability"');
    }
  });

  it('uses Save as the one catalog version boundary and retires publish workflow copy',()=>{
    const products=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/products']}><MfkAdminApp/></MemoryRouter>);
    expect(products).toContain('保存');
    expect(products).not.toContain('已自動保存草稿');
    expect(products).not.toContain('有待發布變更');

    const history=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/publish']}><MfkAdminApp/></MemoryRouter>);
    expect(history).toContain('設定版本歷史');
    expect(history).toContain('保存');
    expect(history).not.toContain('待發布變更');
    expect(history).not.toContain('確認影響範圍');
    expect(history).not.toContain('建立新設定版本');
    expect(history).not.toContain('建立新草稿');
  });

  it('validates catalog and Option Set together before Save',()=>{
    const catalog=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const optionCenter=migrateLegacyDraftToOptionSetCenter(catalog);
    expect(validateAdminConfig(catalog,optionCenter)).toEqual([]);
    const broken:OptionSetCenterState={
      sets:[{id:'bad',name:'',required:true,forceShow:true,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,options:[]}],
      productLinks:[],
    };
    expect(validateAdminConfig(catalog,broken).length).toBeGreaterThan(0);
  });

  it('keeps primary operator routes free of superseded manual transport copy',()=>{
    for(const path of ['/admin/publish','/admin/print/rules','/admin/channels/settlement','/admin/store/quick-reasons']){
      const html=renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><MfkAdminApp/></MemoryRouter>);
      const visible=html.replace(/<[^>]*>/g,' ');
      expect(visible,path).not.toMatch(/NOT_WIRED|MIGRATION_ONLY|SOURCE_INTENT|TARGET_OBSERVED|Transport Bundle|Readback Receipt|HUMAN CONTROLLED|NO CLOUD|NO HTTP|NO POLLING|建立並下載發布檔案|匯入門店回傳檔案/i);
    }
  });


  it('locks Option Center as group-first parent with child Options',()=>{
    const center=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/modifiers']}><MfkAdminApp/></MemoryRouter>);
    for(const marker of ['選項中心','新增選項組','一個選項組就係一個完整可重用單位','批量映射'])expect(center).toContain(marker);
    expect(center).toContain('飯量');
    expect(center).toContain('青瓜');
    expect(center).not.toContain('選項 Master');

    const detailProductId=LEGACY_MF01_ADMIN_DRAFT.products[0]!.id;
    const detail=renderToStaticMarkup(<AdminDraftProvider><ProductDetailHarness productId={detailProductId}/></AdminDraftProvider>);
    expect(detail).toContain('加入選項');
    expect(detail).toContain('先喺「選項中心」建立完整選項組');
    expect(detail).not.toContain('修改選項組名稱');
  });

  it('migrates legacy embedded Group with child Options without flattening',()=>{
    const legacy:AdminSessionDraft={
      categories:[],
      products:[
        {id:'product-a',name:'A',categoryId:'',active:false,basePrice:'',takeawayAdjustment:'',modifierGroupIds:['rice']},
        {id:'product-b',name:'B',categoryId:'',active:false,basePrice:'',takeawayAdjustment:'',modifierGroupIds:['rice']},
      ],
      modifierGroups:[{
        id:'rice',name:'飯量',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,allowQuantities:false,active:true,
        options:[
          {id:'more',name:'多飯',code:'RICE_MORE',priceAdjustment:'2.00',active:true,defaultSelected:false},
          {id:'small',name:'小飯',code:'RICE_SMALL',priceAdjustment:'0.00',active:true,defaultSelected:true},
          {id:'none',name:'走飯',code:'RICE_NONE',priceAdjustment:'-1.00',active:true,defaultSelected:false},
        ],
      }],
      combos:[],
    };
    const normalized=migrateLegacyDraftToOptionSetCenter(legacy);
    expect(normalized.sets).toHaveLength(1);
    expect(normalized.sets[0]?.name).toBe('飯量');
    expect(normalized.sets[0]?.options.map(option=>option.name)).toEqual(['多飯','小飯','走飯']);
    expect(normalized.productLinks).toHaveLength(2);
    expect(normalized.productLinks[0]?.defaultOptionIds).toEqual(['small']);
  });

  it('supports Product-specific default for same linked Option Set',()=>{
    const state:OptionSetCenterState={
      sets:[{
        id:'cucumber',name:'青瓜',required:false,forceShow:true,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,
        options:[
          {id:'more-cucumber',code:'CUC_MORE',name:'多青瓜',priceAdjustment:'1.00',active:true,position:10},
          {id:'less-cucumber',code:'CUC_LESS',name:'少青瓜',priceAdjustment:'0.00',active:true,position:20},
          {id:'no-cucumber',code:'CUC_NONE',name:'走青瓜',priceAdjustment:'0.00',active:true,position:30},
        ],
      }],
      productLinks:[
        {productId:'product-a',setId:'cucumber',defaultOptionIds:['less-cucumber']},
        {productId:'product-b',setId:'cucumber',defaultOptionIds:['more-cucumber']},
      ],
    };
    expect(validateOptionSetCenter(state)).toEqual([]);
    expect(state.productLinks[0]?.defaultOptionIds).toEqual(['less-cucumber']);
    expect(state.productLinks[1]?.defaultOptionIds).toEqual(['more-cucumber']);
  });

  it('bulk maps one Option Set without duplicating links or resetting Product defaults',()=>{
    const current=[
      {productId:'product-a',setId:'rice',defaultOptionIds:['small']},
      {productId:'product-b',setId:'cucumber',defaultOptionIds:['more']},
    ] as const;

    const added=applyProductSetLinksBulk(current,'rice',['product-a','product-b','product-b'],true);
    expect(added).toHaveLength(3);
    expect(added.filter(link=>link.productId==='product-a'&&link.setId==='rice')).toHaveLength(1);
    expect(added.find(link=>link.productId==='product-a'&&link.setId==='rice')?.defaultOptionIds).toEqual(['small']);
    expect(added.find(link=>link.productId==='product-b'&&link.setId==='rice')?.defaultOptionIds).toEqual([]);

    const replay=applyProductSetLinksBulk(added,'rice',['product-a','product-b'],true);
    expect(replay).toBe(added);

    const removed=applyProductSetLinksBulk(added,'rice',['product-a'],false);
    expect(removed.some(link=>link.productId==='product-a'&&link.setId==='rice')).toBe(false);
    expect(removed.some(link=>link.productId==='product-b'&&link.setId==='rice')).toBe(true);
    expect(removed.find(link=>link.productId==='product-b'&&link.setId==='cucumber')?.defaultOptionIds).toEqual(['more']);
  });

  it('projects only R2-linked Option Sets into Product menu truth',()=>{
    const state:OptionSetCenterState={
      sets:[{
        id:'cucumber',name:'青瓜',required:false,forceShow:true,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,
        options:[
          {id:'more',code:'CUC_MORE',name:'多青瓜',priceAdjustment:'1.00',active:true,position:20},
          {id:'less',code:'CUC_LESS',name:'少青瓜',priceAdjustment:'0.00',active:true,position:10},
          {id:'none',code:'CUC_NONE',name:'走青瓜',priceAdjustment:'0.00',active:false,position:30},
        ],
      }],
      productLinks:[{productId:'product-a',setId:'cucumber',defaultOptionIds:['less']}],
    };
    expect(projectOptionSetsForProduct(state,'product-b')).toEqual([]);
    const projected=projectOptionSetsForProduct(state,'product-a');
    expect(projected).toHaveLength(1);
    expect(projected[0]?.name).toBe('青瓜');
    expect(projected[0]?.options.map(option=>option.name)).toEqual(['少青瓜','多青瓜']);
    expect(projected[0]?.options[0]?.defaultSelected).toBe(true);
    expect(projected[0]?.options[0]?.priceAdjustment).toBe('0.00');
  });

  it('R2 ProductOptionSetLink wins even when legacy modifierGroupIds is empty',()=>{
    const state:OptionSetCenterState={
      sets:[{
        id:'rice',name:'飯量',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,allowQuantities:false,active:true,
        options:[{id:'more',code:'RICE_MORE',name:'多飯',priceAdjustment:'2.00',active:true,position:10}],
      }],
      productLinks:[{productId:'product-a',setId:'rice',defaultOptionIds:[]}],
    };
    const legacyProduct={modifierGroupIds:[] as string[]};
    expect(legacyProduct.modifierGroupIds).toEqual([]);
    expect(projectOptionSetsForProduct(state,'product-a').map(set=>set.name)).toEqual(['飯量']);
  });

  it('models A/B/C/D as four main pools plus separate shared Snack and Drink big pools',()=>{
    expect(COMBO_R4_COMBOS.map(combo=>combo.name)).toEqual([
      '自選飯糰 A 餐','自選飯糰 B 餐','自選飯糰 C 餐','自選飯糰 D 餐',
    ]);
    expect(COMBO_R4_COMBOS.map(combo=>combo.basePrice)).toEqual(['41.00','43.00','45.00','47.00']);
    expect(COMBO_R4_COMBOS.map(combo=>combo.mainPoolId)).toEqual([
      'combo-rice-pool-a','combo-rice-pool-b','combo-rice-pool-c','combo-rice-pool-d',
    ]);
    for(const combo of COMBO_R4_COMBOS){
      expect(combo.addonPoolIds).toEqual(['combo-snack-pool-shared','combo-drink-pool-shared']);
    }

    const mainPools=COMBO_R4_POOLS.filter(pool=>pool.kind==='MAIN_COURSE');
    const snackPools=COMBO_R4_POOLS.filter(pool=>pool.addonKind==='SNACK');
    const drinkPools=COMBO_R4_POOLS.filter(pool=>pool.addonKind==='DRINK');
    expect(mainPools.map(pool=>pool.name)).toEqual(['飯糰 Pool A','飯糰 Pool B','飯糰 Pool C','飯糰 Pool D']);
    expect(snackPools.map(pool=>pool.name)).toEqual(['共用小食 Pool']);
    expect(drinkPools.map(pool=>pool.name)).toEqual(['共用飲品 Pool']);
  });

  it('keeps every Combo R4 PRODUCT choice on a canonical catalog Product ID',()=>{
    const productIds=new Set(LEGACY_MF01_ADMIN_DRAFT.products.map(product=>product.id));
    const invalid=COMBO_R4_POOLS.flatMap(pool=>pool.groups).flatMap(group=>group.choices)
      .filter(choice=>(choice.choiceType??'PRODUCT')==='PRODUCT')
      .filter(choice=>!choice.productId||!productIds.has(choice.productId))
      .map(choice=>({id:choice.id,productId:choice.productId}));
    expect(invalid).toEqual([]);
    expect(COMBO_R4_POOLS.flatMap(pool=>pool.groups).flatMap(group=>group.choices).some(choice=>choice.productId==='b2888781-1a6d-529e-931b-aadd4ca74194')).toBe(true);
  });

  it('puts each Snack product inside its exact price child-pool',()=>{
    const snackPool=COMBO_R4_POOLS.find(pool=>pool.id==='combo-snack-pool-shared')!;
    const group=snackPool.groups[0]!;
    expect(group.bands.map(band=>[band.name,band.priceAdjustment])).toEqual([
      ['免費小食 Pool','0.00'],
      ['+$3 小食 Pool','3.00'],
      ['+$5 小食 Pool','5.00'],
    ]);
    const freeIds=new Set(group.choices.filter(choice=>choice.bandId==='snack-free').map(choice=>choice.productId));
    const plus3Ids=new Set(group.choices.filter(choice=>choice.bandId==='snack-plus-3').map(choice=>choice.productId));
    const plus5Ids=new Set(group.choices.filter(choice=>choice.bandId==='snack-plus-5').map(choice=>choice.productId));
    expect(freeIds.has('3a007232-991f-5da7-bbb2-71331c320a5a')).toBe(true);
    expect(plus3Ids.has('bb5da156-0b50-5201-9686-4b5919706543')).toBe(true);
    expect(plus5Ids.has('01c3ed11-3656-5786-a46b-2d90ce1413d5')).toBe(true);
    expect([...freeIds].some(id=>plus3Ids.has(id)||plus5Ids.has(id))).toBe(false);
  });

  it('locks Drink child-pools and exact Owner pricing',()=>{
    const drinkPool=COMBO_R4_POOLS.find(pool=>pool.id==='combo-drink-pool-shared')!;
    const group=drinkPool.groups[0]!;
    expect(group.bands.map(band=>[band.name,band.priceAdjustment])).toEqual([
      ['唔飲嘢 Pool','-1.00'],
      ['熱檸茶／熱檸水免費 Pool','0.00'],
      ['凍檸茶／凍檸水 +$3 Pool','3.00'],
      ['特飲 +$6 Pool','6.00'],
      ['特飲 +$8 Pool','8.00'],
      ['特飲 +$10 Pool','10.00'],
    ]);

    const noDrink=group.choices.filter(choice=>choice.bandId==='drink-no-drink');
    expect(noDrink).toHaveLength(1);
    expect(noDrink[0]?.choiceType).toBe('NONE');
    expect(noDrink[0]?.label).toBe('唔飲嘢');

    expect(group.choices.filter(choice=>choice.bandId==='drink-hot-free').map(choice=>choice.label)).toEqual(['熱檸茶','熱檸水']);
    expect(group.choices.filter(choice=>choice.bandId==='drink-cold-plus-3').map(choice=>choice.label)).toEqual(['凍檸茶','凍檸水']);

    expect(group.choices.filter(choice=>choice.bandId==='drink-special-plus-6').map(choice=>choice.productId)).toEqual([
      'ad3fe24f-2617-52d3-8416-031269e5f122',
      '02d54674-feb5-571d-b8ac-2668bd2fc1d5',
      '28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',
      'bf2334d9-5ffb-5d7d-b454-279cc640a23d',
    ]);
    expect(group.choices.filter(choice=>choice.bandId==='drink-special-plus-8').map(choice=>choice.productId)).toEqual([
      'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',
    ]);
    const handMade=group.choices.find(choice=>choice.bandId==='drink-special-plus-10');
    expect(handMade?.choiceType).toBe('LABEL');
    expect(handMade?.label).toBe('手打檸檬茶');
  });

  it('migrates R3 shared add-on Pool into separate Snack and Drink pools exactly once',()=>{
    const legacy=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const r3={
      ...legacy,
      combos:[...COMBO_R3_COMBOS],
      comboPools:[...COMBO_R3_POOLS],
    } as AdminSessionDraft;
    const migrated=applyComboR4NestedPoolSeed(r3);
    expect(migrated.comboPools?.some(pool=>pool.id==='combo-addon-pool-shared')).toBe(false);
    expect(migrated.comboPools?.filter(pool=>pool.id==='combo-snack-pool-shared')).toHaveLength(1);
    expect(migrated.comboPools?.filter(pool=>pool.id==='combo-drink-pool-shared')).toHaveLength(1);
    for(const combo of migrated.combos.filter(combo=>combo.id.startsWith('combo-rice-set-'))){
      expect(combo.addonPoolIds).toEqual(['combo-snack-pool-shared','combo-drink-pool-shared']);
    }
    const replay=applyComboR4NestedPoolSeed(migrated);
    expect(replay.comboPools?.filter(pool=>pool.id==='combo-snack-pool-shared')).toHaveLength(1);
    expect(replay.comboPools?.filter(pool=>pool.id==='combo-drink-pool-shared')).toHaveLength(1);
  });

  it('renders products inside child-pool cards instead of one flat add-on list',()=>{
    const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/combos']}><MfkAdminApp/></MemoryRouter>);
    for(const marker of [
      '共用小食 Pool','共用飲品 Pool',
      '免費小食 Pool','+$3 小食 Pool','+$5 小食 Pool',
      '唔飲嘢 Pool','熱檸茶／熱檸水免費 Pool','凍檸茶／凍檸水 +$3 Pool',
      '特飲 +$6 Pool','特飲 +$8 Pool','特飲 +$10 Pool',
      '熱檸茶','熱檸水','凍檸茶','凍檸水','手打檸檬茶',
      '每個子 Pool 自己有價錢同成員',
    ])expect(html).toContain(marker);
    expect(html).not.toContain('待 Owner 設定');
  });

  it('resolves a Combo pool Product through the same canonical ProductOptionSetLink truth',()=>{
    const ricePool=COMBO_R4_POOLS.find(pool=>pool.id==='combo-rice-pool-a')!;
    const productId=ricePool.groups[0]!.choices[0]!.productId!;
    const state:OptionSetCenterState={
      sets:[{
        id:'rice-adjust',name:'飯量',required:false,forceShow:true,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,
        options:[{id:'more-rice',code:'RICE_MORE',name:'多飯',priceAdjustment:'2.00',active:true,position:10}],
      }],
      productLinks:[{productId,setId:'rice-adjust',defaultOptionIds:[]}],
    };
    expect(projectOptionSetsForProduct(state,productId).map(set=>set.name)).toEqual(['飯量']);
  });

  it('validates category product pricing modifier and combo relationships',()=>{
    const invalid:AdminSessionDraft={
      categories:[{id:'category-001',name:'',position:10,active:true}],
      products:[{id:'product-001',productCode:'P001',name:'',categoryId:'missing',active:true,basePrice:'abc',takeawayAdjustment:'0.00',modifierGroupIds:['missing-group']}],
      modifierGroups:[{
        id:'modifier-001',name:'',required:true,forceShow:true,selection:'SINGLE',min:0,max:2,allowQuantities:false,active:true,
        options:[{id:'option-001',name:'',code:'',priceAdjustment:'',active:true,defaultSelected:false}],
      }],
      combos:[{
        id:'combo-001',name:'',active:true,basePrice:'bad',takeawayAdjustment:'0.00',
        sections:[{id:'section-001',name:'',required:true,min:2,max:1,childProductIds:['missing-product'],priceAdjustment:'bad'} as never],
      }],
    };
    const errors=validateAdminDraft(invalid);
    expect(errors.some(error=>error.includes('未填名稱'))).toBe(true);
    expect(errors.some(error=>error.includes('未選有效分類'))).toBe(true);
    expect(errors.some(error=>error.includes('基本價格式錯誤'))).toBe(true);
    expect(errors.some(error=>error.includes('最多選擇不可大過 1'))).toBe(true);
    expect(errors.some(error=>error.includes('未填選項 ID'))).toBe(true);
    expect(errors.some(error=>error.includes('未填價格'))).toBe(true);
    expect(errors.some(error=>error.includes('不存在商品'))).toBe(true);
  });
});
