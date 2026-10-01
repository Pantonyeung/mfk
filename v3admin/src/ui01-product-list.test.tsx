import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {MobileGroupedPager} from './mobile-grouped-list.tsx';
import {
  MOBILE_PRODUCT_PAGE_SIZE,
  ProductListPage,
  productFormCanSave,
  productRecordsFromSnapshot,
} from './product-list.tsx';

describe('Admin V3 Product Management mobile contract',()=>{
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

  it('renders the public preview with explicit non-production labelling',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('UI 公網預覽');
    expect(html).toContain('唔代表正式 Canonical 資料');
    expect(html).toContain('唔會寫入 Production');
    expect(html).toContain('v3-product-add-mobile');
    expect(html).toContain('v3-product-add-desktop');
  });

  it('keeps desktop full-width list while exposing the mobile grouped list separately',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('v3-product-desktop-content');
    expect(html).toContain('v3-product-table-wrap');
    expect(html).toContain('v3-product-mobile-groups');
    expect(html).not.toContain('v3-mobile-product-modal');
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
    expect(html).toContain('UI 公網預覽');
    expect(html).toContain('只供介面驗收');
  });
});
