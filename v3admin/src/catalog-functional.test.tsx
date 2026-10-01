import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CombosPage,ModifiersPage} from './catalog-functional-pages.tsx';
import {DiningTablesPage} from './dining-tables-page.tsx';
import {PRODUCT_MEDIA_STORAGE_POLICY} from './product-media-api.ts';
import {usePreviewCatalog} from './preview-catalog-store.ts';

describe('Admin V3 functional catalog correction',()=>{
  it('renders real option-set management surface',()=>{
    const html=renderToStaticMarkup(<ModifiersPage/>);
    expect(html).toContain('選項／口味管理');
    expect(html).toContain('新增選項組');
    expect(html).toContain('飯量');
    expect(html).toContain('個子選項');
  });

  it('renders real combo management surface',()=>{
    const html=renderToStaticMarkup(<CombosPage/>);
    expect(html).toContain('套餐管理');
    expect(html).toContain('新增套餐');
    expect(html).toContain('磨飯午市套餐');
    expect(html).toContain('個可選成員');
  });

  it('restores dining table management with actual table state',()=>{
    const html=renderToStaticMarkup(<DiningTablesPage/>);
    expect(html).toContain('餐桌管理');
    expect(html).toContain('新增餐桌');
    expect(html).toContain('1號枱');
    expect(usePreviewCatalog.getState().diningTables.length).toBeGreaterThan(0);
  });

  it('locks product images to R2-only storage with separate customer and Keeta surfaces',()=>{
    expect(PRODUCT_MEDIA_STORAGE_POLICY.binaryStore).toBe('R2_ONLY');
    expect(PRODUCT_MEDIA_STORAGE_POLICY.surfaces).toEqual(['CUSTOMER','KEETA']);
    expect(PRODUCT_MEDIA_STORAGE_POLICY.externalUrlAuthority).toBe(false);
  });
});
