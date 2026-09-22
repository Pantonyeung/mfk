import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {AdminDraftProvider,validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {MfkAdminApp} from './App.tsx';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';

describe('MFK Admin complete catalog product',()=>{
  it('renders complete Product detail instead of a demo card',()=>{
    const html=renderToStaticMarkup(<AdminDraftProvider><ProductsWorkspace/></AdminDraftProvider>);
    for(const marker of ['商品資料','新增商品','商品名稱','商品編號','基本價 HK$','Barcode','圖片參考','商品描述','外賣價格規則','此商品外賣 +$1','選項組綁定']) expect(html).toContain(marker);
    expect(html).toContain('203');
    expect(html).toContain('188');
    expect(html).toContain('已自動保存草稿');
  });

  it('routes core catalog responsibilities to concrete editors',()=>{
    const pathsAndMarkers=[
      ['/admin/catalog/products','商品資料'],
      ['/admin/catalog/categories','商品分類'],
      ['/admin/catalog/modifiers','選項／加料'],
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

  it('validates category product pricing modifier and combo relationships',()=>{
    const invalid:AdminSessionDraft={
      categories:[{id:'category-001',name:'',position:10,active:true}],
      products:[{id:'product-001',productCode:'P001',name:'',categoryId:'missing',active:true,basePrice:'abc',takeawayAdjustment:'0.00',modifierGroupIds:['missing-group']}],
      modifierGroups:[{
        id:'modifier-001',name:'',required:true,selection:'SINGLE',min:0,max:2,active:true,
        options:[{id:'option-001',name:'',priceAdjustment:'bad',active:true,defaultSelected:false}],
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
    expect(errors.some(error=>error.includes('價格調整格式錯誤'))).toBe(true);
    expect(errors.some(error=>error.includes('不存在商品'))).toBe(true);
  });
});
