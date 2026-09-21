import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {AdminDraftProvider,validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {MfkAdminApp} from './App.tsx';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';

describe('MFK Admin catalog migration slice',()=>{
  it('renders a real Product editor while keeping Publish disconnected',()=>{
    const html=renderToStaticMarkup(
      <AdminDraftProvider>
        <ProductsWorkspace/>
      </AdminDraftProvider>,
    );
    expect(html).toContain('商品資料');
    expect(html).toContain('新增商品');
    expect(html).toContain('Publish 未接駁');
    expect(html).toContain('SESSION DRAFT · NOT_WIRED');
  });

  it('routes Product to the real editor instead of the generic capability placeholder',()=>{
    const html=renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/catalog/products']}>
        <MfkAdminApp/>
      </MemoryRouter>,
    );
    expect(html).toContain('商品資料');
    expect(html).toContain('新增商品');
    expect(html).not.toContain('Live Mutation');
  });


  it('routes business-day and logical print configuration to real policy workspaces',()=>{
    const businessDay=renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/business-day']}>
        <MfkAdminApp/>
      </MemoryRouter>,
    );
    expect(businessDay).toContain('營業日／交更');
    expect(businessDay).toContain('每日分界時間');
    expect(businessDay).toContain('Publish 未接駁');

    const print=renderToStaticMarkup(
      <MemoryRouter initialEntries={['/admin/print']}>
        <MfkAdminApp/>
      </MemoryRouter>,
    );
    expect(print).toContain('打印中心');
    expect(print).toContain('新增 Logical Printer');
    expect(print).toContain('NOT_WIRED');
  });


  it('has a concrete workspace for every current NOT_WIRED Admin capability',()=>{
    for(const capability of ADMIN_CAPABILITIES.filter(item=>item.status==='NOT_WIRED')){
      const html=renderToStaticMarkup(
        <MemoryRouter initialEntries={[capability.path]}>
          <MfkAdminApp/>
        </MemoryRouter>,
      );
      expect(html,capability.id).not.toContain('Current MFK State');
    }
  });

  it('keeps migration-only governance surfaces disconnected',()=>{
    for(const path of ['/admin/publish','/admin/print/rules','/admin/channels/settlement','/admin/store/quick-reasons']){
      const html=renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <MfkAdminApp/>
        </MemoryRouter>,
      );
      expect(html).toContain('NOT_WIRED');
      expect(html).toContain('未接駁');
      expect(html).not.toContain('Live Mutation');
    }
  });

  it('validates required category/product/modifier/combo structure without pricing execution',()=>{
    const invalid:AdminSessionDraft={
      categories:[{id:'category-001',name:'',position:10,active:true}],
      products:[{id:'product-001',name:'',categoryId:'missing',active:true,basePrice:'abc',takeawayAdjustment:'0.00',modifierGroupIds:[]}],
      modifierGroups:[{
        id:'modifier-001',name:'',required:true,selection:'SINGLE',min:0,max:1,active:true,
        options:[{id:'option-001',name:'',priceAdjustment:'bad',active:true,defaultSelected:false}],
      }],
      combos:[{
        id:'combo-001',name:'',active:true,basePrice:'bad',takeawayAdjustment:'0.00',
        sections:[{id:'section-001',name:'',required:true,min:2,max:1}],
      }],
    };
    const errors=validateAdminDraft(invalid);
    expect(errors.some(error=>error.includes('未填名稱'))).toBe(true);
    expect(errors.some(error=>error.includes('未選有效分類'))).toBe(true);
    expect(errors.some(error=>error.includes('基本價格式錯誤'))).toBe(true);
    expect(errors.some(error=>error.includes('Min / Max 無效'))).toBe(true);
  });
});
