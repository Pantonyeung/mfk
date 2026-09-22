export const KEETA_PROVIDER = Object.freeze({
  provider: 'KEETA',
  market: 'HONG_KONG',
  role: 'THIRD_PARTY_PROVIDER_INTEGRATION',
  currentAuthority: 'MFK',
  integrationState: 'MIGRATED_NOT_WIRED',
});

export const EXECUTION_GATE = Object.freeze({
  NOT_WIRED: 'NOT_WIRED',
  BLOCKED_CANONICAL_AUTHORITY: 'BLOCKED_CANONICAL_AUTHORITY',
  BLOCKED_EXTERNAL: 'BLOCKED_EXTERNAL',
});

export const PROVIDER_OPERATIONS = Object.freeze({
  menuSync: '/api/open/product/menu/sync',
  orderGet: '/api/open/order/get',
  orderConfirm: '/api/open/order/confirm',
  orderCancel: '/api/open/order/cancel',
  orderReady: '/api/open/order/prepare',
  orderCollect: '/api/open/order/collect',
  refundAgree: '/api/open/order/agree',
  refundReject: '/api/open/order/reject',
  partialRefundPreview: '/api/open/order/refund/part/products/preview',
  partialRefundApply: '/api/open/order/refund/part/apply',
  webhookConfig: '/api/open/base/callback/url/set',
  storeDetails: '/api/open/scm/shop/base/get',
  storeHoursGet: '/api/open/scm/shop/business/hour/effective/get',
  storeHoursUpdate: '/api/open/scm/shop/business/hour/effective/update',
  storeRest: '/api/open/scm/shop/status/rest',
  storeOpen: '/api/open/scm/shop/status/open',
});

export const KEETA_WEBHOOK_EVENTS = Object.freeze({
  1001: 'ORDER_PLACEMENT',
  1002: 'ORDER_ACCEPTANCE',
  1003: 'ORDER_COMPLETION',
  1004: 'ORDER_CANCELLATION',
  1005: 'REFUND_INITIATION',
  1006: 'DELIVERY_STATUS_UPDATE',
  1007: 'PARTIAL_REFUND_INITIATION',
  1008: 'OBSERVED_SYSTEM_ORDER_CANCELLATION',
  1101: 'STORE_BUSINESS_HOURS_CHANGE',
  1102: 'STORE_STATUS_CHANGE',
  1201: 'PICTURE_BIND_TASK_COMPLETION',
  1202: 'MENU_SYNC_TASK_COMPLETION',
});
