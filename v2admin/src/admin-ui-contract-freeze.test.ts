import {describe,expect,it} from 'vitest';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {MFK_ADMIN_AUTHORITY} from './admin-authority.ts';

const FROZEN_ROUTES=[
  '/admin/overview','/admin/action-queue','/admin/orders/open','/admin/orders/history','/admin/orders/exceptions','/admin/availability',
  '/admin/catalog/products','/admin/catalog/categories','/admin/catalog/modifiers','/admin/catalog/pricing','/admin/catalog/combos','/admin/catalog/menu-display','/admin/publish',
  '/admin/presentation/customer-home','/admin/presentation/owner-home','/admin/presentation/frontline-ordering','/admin/channels','/admin/channels/net-estimate',
  '/admin/channels/store-binding','/admin/channels/product-mapping','/admin/channels/mapping-failure','/admin/channels/accept-policy','/admin/channels/sync-policy',
  '/admin/channels/settlement','/admin/devices','/admin/print','/admin/print/templates','/admin/print/rules','/admin/ota','/admin/staff','/admin/access',
  '/admin/reports/sales','/admin/reports/products','/admin/reports/channels','/admin/reports/refunds','/admin/reports/operations','/admin/reports/export','/admin/reports/rfm',
  '/admin/business-day','/admin/cash-close','/admin/operations/capacity','/admin/operations/inventory','/admin/store/settings','/admin/store/quick-reasons',
  '/admin/store/announcements','/admin/members/customer360','/admin/members/loyalty','/admin/members/coupons','/admin/system/audit','/admin/system/diagnostics',
  '/admin/system/integrations','/admin/system/advanced',
] as const;

describe('Admin UI contract freeze',()=>{
  it('recomposes navigation without changing or dropping a capability route',()=>{
    expect(new Set(ADMIN_CAPABILITIES.map(item=>item.path))).toEqual(new Set(FROZEN_ROUTES));
  });

  it('does not acquire transaction or physical print execution authority',()=>{
    expect(MFK_ADMIN_AUTHORITY.transactionExecutionAuthority).toBe(false);
    expect(MFK_ADMIN_AUTHORITY.physicalPrintExecutionAuthority).toBe(false);
  });
});
