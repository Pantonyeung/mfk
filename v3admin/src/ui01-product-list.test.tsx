import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {PRODUCT_MEDIA_STORAGE_POLICY} from './product-media-api.ts';
import {
  MOBILE_PRODUCT_PAGE_SIZE,
  ProductListPage,
  productFormCanSave,
  productPrintSummary,
  productPrintTargetsFromRule,
  productPrintConfigCanSave,
  PRODUCT_PRINT_TARGET_OPTIONS,
  productRecordsFromSnapshot,
} from './product-list.tsx';
import {usePreviewCatalog} from './preview-catalog-store.ts';

describe('Admin V3 Product Management contract',()=>{
  it('projects canonical catalog facts into presentation rows without creating another authority',()=>{
    const rows=productRecordsFromSnapshot({
      catalog:{
        categories:[{id:'cat-rice',name:'飯類'}],
        products:[{
          id:'prd-1',
          name:'紫米飯',
          productCode:'PRD000001',
          categoryId:'cat-rice',
          basePriceMinor:5200,
          updatedAt:'2026-10-01T00:00:00.000Z',
        }],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id:'prd-1',
      name:'紫米飯',
      code:'PRD000001',
      category:'飯類',
      priceMinor:5200,
      status:'已發佈',
    });
  });

  it('locks mobile high-volume pages to ten items per category page',()=>{
    expect(MOBILE_PRODUCT_PAGE_SIZE).toBe(10);
    const items=Array.from({length:12},(_,index)=>({id:'p-'+index,group:'飯糰',name:'商品 '+index}));
    const html=renderToStaticMarkup(<MobileGroupedPager
      items={items}
      pageSize={MOBILE_PRODUCT_PAGE_SIZE}
      renderItem={item=><div>{item.name}</div>}
    />);
    expect(html).toContain('12 項');
    expect(html).toContain('第 1 / 2 頁');
    expect(html).toContain('商品 9');
    expect(html).not.toContain('商品 10');
  });

  it('requires complete product data before Save Draft can become available',()=>{
    expect(productFormCanSave({name:'',category:'飯糰',price:'42'})).toBe(false);
    expect(productFormCanSave({name:'紫米飯糰',category:'',price:'42'})).toBe(false);
    expect(productFormCanSave({name:'紫米飯糰',category:'飯糰',price:''})).toBe(false);
    expect(productFormCanSave({name:'紫米飯糰',category:'飯糰',price:'42'})).toBe(true);
  });

  it('supports independent multi-select product print outputs',()=>{
    expect(PRODUCT_PRINT_TARGET_OPTIONS.map(option=>option.label)).toEqual(['製作單','打包單','標籤','小票']);
    expect(productPrintSummary(['PRODUCTION','PACKING','LABEL','RECEIPT'])).toBe('製作單＋打包單＋標籤＋小票');
    expect(productPrintSummary(['PACKING','LABEL'])).toBe('打包單＋標籤');
    expect(productPrintSummary([])).toBe('不打印');
  });

  it('requires each selected print output to resolve to at least one logical printer',()=>{
    expect(productPrintConfigCanSave(['LABEL'],{LABEL:['logical-label-1']},{LABEL:'tpl-label'})).toBe(true);
    expect(productPrintConfigCanSave(['LABEL'],{LABEL:[]},{LABEL:'tpl-label'})).toBe(false);
    expect(productPrintConfigCanSave(['PRODUCTION','PACKING','LABEL'],{
      PRODUCTION:['logical-production'],
      PACKING:['logical-packing'],
      LABEL:['logical-label-2'],
    },{
      PRODUCTION:'tpl-production',
      PACKING:'tpl-packing',
      LABEL:'tpl-label',
    })).toBe(true);
    expect(productPrintConfigCanSave(['PRODUCTION','LABEL'],{
      PRODUCTION:['logical-production'],
      LABEL:[],
    },{
      PRODUCTION:'tpl-production',
      LABEL:'tpl-label',
    })).toBe(false);
    expect(productPrintConfigCanSave(['LABEL'],{LABEL:['logical-label-1']},{LABEL:''})).toBe(false);
  });

  it('migrates existing single/composite print summaries into independent targets',()=>{
    expect(productPrintTargetsFromRule('製作單＋標籤')).toEqual(['PRODUCTION','LABEL']);
    expect(productPrintTargetsFromRule('製作單＋打包單')).toEqual(['PRODUCTION','PACKING']);
    expect(productPrintTargetsFromRule('標籤')).toEqual(['LABEL']);
    expect(productPrintTargetsFromRule('小票')).toEqual(['RECEIPT']);
  });

  it('locks all product image binary storage to R2 only',()=>{
    expect(PRODUCT_MEDIA_STORAGE_POLICY.binaryStore).toBe('R2_ONLY');
    expect(PRODUCT_MEDIA_STORAGE_POLICY.externalUrlAuthority).toBe(false);
    expect(PRODUCT_MEDIA_STORAGE_POLICY.browserDirectR2Credentials).toBe(false);
    expect(PRODUCT_MEDIA_STORAGE_POLICY.surfaces).toEqual(['CUSTOMER','KEETA']);
  });

  it('has real option-set and combo relationship preview state',()=>{
    const state=usePreviewCatalog.getState();
    expect(state.optionSets.length).toBeGreaterThan(0);
    expect(state.combos.length).toBeGreaterThan(0);
    expect(state.products.some(product=>product.optionSetIds.length>0)).toBe(true);
    expect(state.combos.some(combo=>combo.groups.some(group=>group.choices.some(choice=>Boolean(choice.productId))))).toBe(true);
  });

  it('renders the public product list as functional preview state, not placeholder copy',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('產品管理已接實際 Preview State');
    expect(html).toContain('選項／套餐');
    expect(html).toContain('新增產品');
    expect(html).not.toContain('尚未接駁');
  });

  it('routes the isolated shell directly to Product Management for Owner review',()=>{
    const html=renderToStaticMarkup(<AdminShell
      storeId="PREVIEW"
      displayName="介面驗收"
      releaseStatus={<div>UI</div>}
      canonicalState="fresh"
      previewMode
      initialPath="/admin/catalog/products"
      onRefresh={()=>{}}
      onDiagnostics={()=>{}}
      onSignOut={()=>{}}
    />);
    expect(html).toContain('產品管理');
    expect(html).toContain('產品管理已接實際 Preview State');
    expect(html).toContain('只供介面驗收');
  });
});
