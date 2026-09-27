export const OWNER_STAGE04_API_MAPPING=Object.freeze({
  stage:'OA-CHN-001',
  route:'/channels',
  source:'OwnerReadModelSnapshot.channels',
  authority:'CHANNEL_DOMAIN_PROJECTION_ONLY',
  requiredFields:Object.freeze([
    'acceptingOrders','desiredState','observedState','health','mode','cause',
    'observedAt','freshness','lastCommand','readback',
  ]),
  invariants:Object.freeze([
    'STORE_OPEN_NE_CHANNEL_ACCEPTING_ORDERS',
    'BUSY_NE_PAUSE',
    'HEALTH_NE_AVAILABILITY',
    'INTERNET_HEALTHY_NE_PROVIDER_HEALTHY',
    'PAUSE_MUST_NOT_MUTATE_EXISTING_ORDERS',
    'UNKNOWN_REQUIRES_READBACK_BEFORE_RETRY',
    'OWNER_APP_MUST_NOT_OWN_CHANNEL_TRUTH',
  ]),
  mutation:'BOUNDED_ONLY_WHEN_RUNTIME_EXPLICITLY_ADVERTISES_ACTION',
} as const);
