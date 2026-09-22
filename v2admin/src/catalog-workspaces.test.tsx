import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {AdminDraftProvider,useAdminDraft,validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {ProductOperationalDetail,ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {PRODUCT_MEDIA_BACKEND_CONTRACT,normalizeProductPrintRule} from './admin-product-operational-config.ts';
import {MfkAdminApp} from './App.tsx';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {migrateLegacyOptionCenter,useOptionCenter,validateOptionCenter,type OptionCenterState} from './admin-option-center.ts';


function ProductDetailHarness({productId}:{productId:string}){
  const {draft}=useAdminDraft();
  const optionCenter=useOptionCenter(draft);
  return <ProductOperationalDetail productId={productId} optionCenter={optionCenter}/>;
}

describe('MFK Admin complete catalog product',()=>{
  it('renders a bounded compact Product list by default',()=>{
    const html=renderToStaticMarkup(<AdminDraftProvider><ProductsWorkspace/></AdminDraftProvider>);
    for(const marker of ['商品資料','新增商品','搜尋商品名稱','找到 203 件','每頁最多 20 件','第 1 / 11 頁','編輯']) expect(html).toContain(marker);
    expect(html).toContain('203');
    expect(html).toContain('188');
    expect(html).toContain('已自動保存草稿');
    expect((html.match(/class="admin-product-row /g)??[]).length).toBe(20);
    expect(html).not.toContain('商品詳細資料');
    expect(html).not.toContain('商品描述</span>');
  });


  it('shows complete bounded Product operational sections on demand',()=>{
    const productId=LEGACY_MF01_ADMIN_DRAFT.products[0]!.id;
    const html=renderToStaticMarkup(<AdminDraftProvider><ProductDetailHarness productId={productId}/></AdminDraftProvider>);
    for(const marker of [
      '基本資料','價格','選項','選項名稱、選項 ID 同價錢只喺「選項中心」維護一次',
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

  it('keeps primary operator routes free of superseded manual transport copy',()=>{
    for(const path of ['/admin/publish','/admin/print/rules','/admin/channels/settlement','/admin/store/quick-reasons']){
      const html=renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><MfkAdminApp/></MemoryRouter>);
      const visible=html.replace(/<[^>]*>/g,' ');
      expect(visible,path).not.toMatch(/NOT_WIRED|MIGRATION_ONLY|SOURCE_INTENT|TARGET_OBSERVED|Transport Bundle|Readback Receipt|HUMAN CONTROLLED|NO CLOUD|NO HTTP|NO POLLING|建立並下載發布檔案|匯入門店回傳檔案/i);
    }
  });


  it('locks Option Center as master and Product detail as link/default UI',()=>{
    const center=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/modifiers']}><MfkAdminApp/></MemoryRouter>);
    for(const marker of ['選項中心','唯一選項資料來源','新增選項','選項 Master','商品連結'])expect(center).toContain(marker);
    expect(center).toContain('Product Detail 唔會再複製另一份選項資料');

    const detailProductId=LEGACY_MF01_ADMIN_DRAFT.products[0]!.id;
    const detail=renderToStaticMarkup(<AdminDraftProvider><ProductDetailHarness productId={detailProductId}/></AdminDraftProvider>);
    expect(detail).toContain('只負責連結、套用同設定此商品嘅默認');
    expect(detail).toContain('前往選項中心');
    expect(detail).not.toContain('選項價錢</span><input');

    const pricing=renderToStaticMarkup(<MemoryRouter initialEntries={['/admin/catalog/pricing']}><MfkAdminApp/></MemoryRouter>);
    expect(pricing).toContain('商品價格');
    expect(pricing).toContain('選項價格');
    expect(pricing).toContain('Option Master');
  });

  it('normalizes legacy embedded Options into one master and per-Product defaults',()=>{
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
    const normalized=migrateLegacyOptionCenter(legacy);
    expect(normalized.options).toHaveLength(3);
    expect(normalized.groups[0]?.optionIds).toEqual(['more','small','none']);
    expect(normalized.productLinks).toHaveLength(2);
    expect(normalized.productLinks[0]?.defaultOptionIds).toEqual(['small']);
    expect('defaultSelected' in normalized.options[0]!).toBe(false);
  });

  it('supports different defaults for the same canonical Option group per Product',()=>{
    const state:OptionCenterState={
      options:[
        {id:'more',code:'RICE_MORE',name:'多飯',priceAdjustment:'2.00',active:true},
        {id:'small',code:'RICE_SMALL',name:'小飯',priceAdjustment:'0.00',active:true},
        {id:'none',code:'RICE_NONE',name:'走飯',priceAdjustment:'-1.00',active:true},
      ],
      groups:[{id:'rice',name:'飯量',optionIds:['more','small','none'],required:true,forceShow:true,selection:'SINGLE',min:1,max:1,allowQuantities:false,active:true}],
      productLinks:[
        {productId:'product-a',groupId:'rice',optionIds:['more','small','none'],defaultOptionIds:['small']},
        {productId:'product-b',groupId:'rice',optionIds:['more','small','none'],defaultOptionIds:['more']},
      ],
    };
    expect(validateOptionCenter(state)).toEqual([]);
    expect(state.productLinks[0]?.defaultOptionIds).toEqual(['small']);
    expect(state.productLinks[1]?.defaultOptionIds).toEqual(['more']);
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
        sections:[{id:'section-001',name:'',required:true,min:2,max:1,childProductIds:['missing-product'],priceAdjustment:'bad'}],
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
