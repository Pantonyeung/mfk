import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {ProductListPage,productRecordsFromSnapshot} from './product-list.tsx';

describe('Admin V3 UI-01 Product List',()=>{
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

  it('renders the locked preview with explicit non-canonical labelling and read-only product codes',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('UI-01 公網預覽');
    expect(html).toContain('唔代表正式 Canonical 資料');
    expect(html).toContain('PRD000123');
    expect(html).toContain('＋ 新增產品');
    expect(html).toContain('<code>PRD000123</code>');
  });

  it('uses full-width list as the default instead of a permanent right editor',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('v3-product-table-wrap');
    expect(html).not.toContain('v3-product-drawer-backdrop');
    expect(html).not.toContain('v3-product-drawer"');
  });

  it('renders search, filters, sort, view toggle and Draft Bar in the review surface',()=>{
    const html=renderToStaticMarkup(<ProductListPage previewMode/>);
    expect(html).toContain('搜尋商品名稱、商品編號、關鍵字');
    expect(html).toContain('最近更新');
    expect(html).toContain('列表');
    expect(html).toContain('卡片');
    expect(html).toContain('2</strong> 項未發佈變更');
  });

  it('routes the isolated shell directly to Product Management for Owner review',()=>{
    const html=renderToStaticMarkup(<AdminShell
      storeId="PREVIEW"
      displayName="介面驗收"
      releaseStatus={<div>UI-01</div>}
      canonicalState="fresh"
      previewMode
      initialPath="/admin/catalog/products"
      onRefresh={()=>{}}
      onDiagnostics={()=>{}}
      onSignOut={()=>{}}
    />);
    expect(html).toContain('產品管理');
    expect(html).toContain('UI-01 公網預覽');
    expect(html).toContain('只供介面驗收');
  });
});
