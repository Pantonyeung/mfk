export const OWNER_UI_STAGE01_DATA_MAPPING={
  screenId:'OA-TOD-001',
  route:'/today',
  source:'OwnerReadModelSnapshot',
  fields:{
    context:'store',
    kpi:'today',
    liveOrders:'liveOrders',
    dineInOpenChecks:'dineIn',
    actionSummary:'actions',
    readiness:'readiness',
    staffNow:'staff',
    trustedSummary:'reports',
  },
} as const;

export const OWNER_UI_STAGE01_AUTHORITY_RULES=[
  'Owner App is read/oversight first.',
  'Open Checks are not silently counted as Current Effective Sales.',
  'Pending / Draft / Pre-admission are not formal Sales or formal Order Count.',
  'Missing / stale / partial / unknown data must remain explicit.',
  'No direct network or second transaction authority belongs in Stage01.',
] as const;
