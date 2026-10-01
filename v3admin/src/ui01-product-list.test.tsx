import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {productRecordsFromSnapshot} from './product-list.tsx';

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

  it('keeps product code presentation read-only and preview data explicitly non-canonical',()=>{
    const source=readFileSync(new URL('./product-list.tsx',import.meta.url),'utf8');
    expect(source).toContain('系統自動生成，不可 inline 修改');
    expect(source).toContain('介面示例，只用嚟驗 UI；唔代表正式 Canonical 資料');
    expect(source).not.toMatch(/localStorage|sessionStorage|Dexie|indexedDB/i);
    expect(source).not.toMatch(/<input[^>]+productCode/i);
  });

  it('uses full-width list as the default and only opens the product drawer after selection',()=>{
    const source=readFileSync(new URL('./product-list.tsx',import.meta.url),'utf8');
    expect(source).toContain("useState<'list'|'grid'>('list')");
    expect(source).toContain('openProduct?<ProductDrawer');
    expect(source).not.toContain('permanent right');
  });

  it('exposes a public isolated UI-01 review mode without enabling backend reads',()=>{
    const app=readFileSync(new URL('./App.tsx',import.meta.url),'utf8');
    expect(app).toContain("get('preview')==='ui-01'");
    expect(app).toContain('enabled:!uiPreview');
    expect(app).toContain('previewMode');
    expect(app).toContain('initialPath="/admin/catalog/products"');
  });

  it('routes the locked product destination to the UI-01 implementation',()=>{
    const shell=readFileSync(new URL('./admin-shell.tsx',import.meta.url),'utf8');
    expect(shell).toContain("path==='/admin/catalog/products'");
    expect(shell).toContain('<ProductListPage');
    expect(shell).toContain("if(!previewMode)window.history.pushState");
  });
});
