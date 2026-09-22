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
import {COMBO_R3_COMBOS,COMBO_R3_POOLS,applyComboR3PoolSeed} from './admin-combo-pool-seed-r3.ts';


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

  it('models A/B/C/D as four main-course pools and one shared snack/drink add-on pool',()=>{
    expect(COMBO_R3_COMBOS.map(combo=>combo.name)).toEqual([
      '自選飯糰 A 餐','自選飯糰 B 餐','自選飯糰 C 餐','自選飯糰 D 餐',
    ]);
    expect(COMBO_R3_COMBOS.map(combo=>combo.basePrice)).toEqual(['41.00','43.00','45.00','47.00']);
    expect(COMBO_R3_COMBOS.map(combo=>combo.mainPoolId)).toEqual([
      'combo-rice-pool-a','combo-rice-pool-b','combo-rice-pool-c','combo-rice-pool-d',
    ]);
    for(const combo of COMBO_R3_COMBOS)expect(combo.addonPoolIds).toEqual(['combo-addon-pool-shared']);

    const mainPools=COMBO_R3_POOLS.filter(pool=>pool.kind==='MAIN_COURSE');
    const addonPools=COMBO_R3_POOLS.filter(pool=>pool.kind==='ADDON');
    expect(mainPools.map(pool=>pool.name)).toEqual(['飯糰 Pool A','飯糰 Pool B','飯糰 Pool C','飯糰 Pool D']);
    expect(addonPools).toHaveLength(1);
    expect(addonPools[0]?.groups.map(group=>group.name)).toEqual(['選擇小食','選擇飲品']);
  });

  it('locks snack and drink upgrade tiers without inventing the no-drink discount',()=>{
    const addon=COMBO_R3_POOLS.find(pool=>pool.id==='combo-addon-pool-shared')!;
    const snack=addon.groups.find(group=>group.id==='combo-addon-snack')!;
    const drink=addon.groups.find(group=>group.id==='combo-addon-drink')!;
    expect(snack.bands.map(band=>band.priceAdjustment)).toEqual(['0.00','3.00','5.00']);
    expect(drink.bands.map(band=>band.name)).toEqual([
      '唔飲嘢 · 減價',
      '熱飲 · $0',
      '熱檸茶／熱檸水轉凍 · +$3',
      '特飲 · +$6',
      '特飲 · +$8',
      '特飲 · +$10',
    ]);
    const noDrink=drink.bands[0]!;
    expect(noDrink.priceAdjustment).toBe('');
    expect(noDrink.priceStatus).toBe('OWNER_VALUE_REQUIRED');
    expect(drink.choices.find(choice=>choice.choiceType==='NONE')?.label).toBe('唔飲嘢');
  });

  it('migrates the wrong single poster Combo into the R3 pool model exactly once',()=>{
    const legacy=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const withWrongCombo={
      ...legacy,
      combos:[{
        id:'combo-poster-purple-rice-20260530',name:'自選紫米套餐',active:true,basePrice:'41.00',takeawayAdjustment:'0.00',sections:[],
      }],
    } as AdminSessionDraft;
    const migrated=applyComboR3PoolSeed(withWrongCombo);
    expect(migrated.combos.some(combo=>combo.id==='combo-poster-purple-rice-20260530')).toBe(false);
    expect(migrated.combos.filter(combo=>combo.id.startsWith('combo-rice-set-'))).toHaveLength(4);
    expect(migrated.comboPools?.filter(pool=>pool.id.startsWith('combo-rice-pool-'))).toHaveLength(4);
    expect(migrated.comboPools?.filter(pool=>pool.id==='combo-addon-pool-shared')).toHaveLength(1);
    const replay=applyComboR3PoolSeed(migrated);
    expect(replay.combos.filter(combo=>combo.id==='combo-rice-set-a')).toHaveLength(1);
    expect(replay.comboPools?.filter(pool=>pool.id==='combo-addon-pool-shared')).toHaveLength(1);
  });

  it('renders the R3 pool model and pending no-drink price explicitly',()=>{
    const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/combos']}><MfkAdminApp/></MemoryRouter>);
    for(const marker of [
      '自選飯糰 A 餐','自選飯糰 B 餐','自選飯糰 C 餐','自選飯糰 D 餐',
      '飯糰 Pool A','飯糰 Pool B','飯糰 Pool C','飯糰 Pool D',
      '共用小食／飲品 Pool','免費小食','升級 +$3','升級 +$5',
      '唔飲嘢 · 減價','熱飲 · $0','熱檸茶／熱檸水轉凍 · +$3',
      '特飲 · +$6','特飲 · +$8','特飲 · +$10',
      '待 Owner 設定','非商品選擇',
    ])expect(html).toContain(marker);
  });

  it('resolves a Combo pool Product through the same canonical ProductOptionSetLink truth',()=>{
    const ricePool=COMBO_R3_POOLS.find(pool=>pool.id==='combo-rice-pool-a')!;
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
