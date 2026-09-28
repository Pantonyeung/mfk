import {describe,expect,it} from 'vitest';
import {LEGACY_MF01_ADMIN_DRAFT,LEGACY_MF01_MENU_SOURCE} from './admin-menu-seed-mf01-v2.ts';
import {validateAdminDraft} from './admin-draft.tsx';
import {buildAdminMenuIndexRevisionFromDraft} from './admin-menu-link.ts';

describe('Owner-selected legacy MF01 menu re-entry',()=>{
  it('copies the selected Morefun-v2 combined menu counts exactly',()=>{
    expect(LEGACY_MF01_MENU_SOURCE.snapshot).toBe('menu-combined-2026-09-05-v1');
    expect(LEGACY_MF01_MENU_SOURCE.categories).toBe(14);
    expect(LEGACY_MF01_MENU_SOURCE.canonicalProductRows).toBe(203);
    expect(LEGACY_MF01_MENU_SOURCE.directVisibleProducts).toBe(188);
    expect(LEGACY_MF01_MENU_SOURCE.hiddenProducts).toBe(15);
    expect(LEGACY_MF01_MENU_SOURCE.directPriceRows).toBe(188);

    expect(LEGACY_MF01_ADMIN_DRAFT.categories).toHaveLength(14);
    expect(LEGACY_MF01_ADMIN_DRAFT.products).toHaveLength(203);
    expect(LEGACY_MF01_ADMIN_DRAFT.products.filter(row=>row.active)).toHaveLength(188);
    expect(LEGACY_MF01_ADMIN_DRAFT.products.filter(row=>!row.active)).toHaveLength(15);
  });

  it('preserves donor names and uses donor direct-price source',()=>{
    const oneBite=LEGACY_MF01_ADMIN_DRAFT.products.find(row=>row.legacyBarcode==='mf1096');
    expect(oneBite?.name).toBe('臺灣一口腸');
    expect(oneBite?.basePrice).toBe('22.00');

    const saltChicken=LEGACY_MF01_ADMIN_DRAFT.products.find(row=>row.legacyBarcode==='mf1091');
    expect(saltChicken?.name).toBe('古早鹽酥雞');
    expect(saltChicken?.basePrice).toBe('25.00');

    const hidden=LEGACY_MF01_ADMIN_DRAFT.products.find(row=>row.id==='5cef7d6f-dfc0-521c-a5b2-de9cabe99f23');
    expect(hidden?.name).toBe('安格斯漢堡咖哩飯');
    expect(hidden?.active).toBe(false);
    expect(hidden?.categoryId).toBe('');
  });

  it('is valid as an Admin source draft without inventing hidden category assignments',()=>{
    expect(validateAdminDraft(LEGACY_MF01_ADMIN_DRAFT)).toEqual([]);
  });

  it('projects only the 188 donor-visible products into A2 Menu Index',()=>{
    const revision=buildAdminMenuIndexRevisionFromDraft(
      LEGACY_MF01_ADMIN_DRAFT,
      1,
      '2026-09-22T00:00:00.000Z',
    );
    expect(revision.categories).toHaveLength(14);
    expect(revision.products).toHaveLength(188);
    expect(revision.products.some(row=>row.id==='5cef7d6f-dfc0-521c-a5b2-de9cabe99f23')).toBe(false);
    expect(revision.products[0]?.position).toBeGreaterThanOrEqual(0);
  });
});
