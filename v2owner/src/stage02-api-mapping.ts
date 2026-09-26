export const OWNER_UI_STAGE02_ACTION_QUEUE_MAPPING={
  screenId:'OA-ACT-001',
  route:'/actions',
  source:'OwnerReadModelSnapshot.actions',
  historySource:'OwnerReadModelSnapshot.activity',
  scope:'OPEN_ACTIONABLE_ONLY',
  excludes:['SMT_PENDING_ORDER_QUEUE'],
  cardFields:[
    'title',
    'detail',
    'target',
    'severity',
    'elapsedLabel',
    'ownerDomain',
    'certainty',
    'safeNextStepLabel',
  ],
  detailFlow:[
    'LIST',
    'DETAIL',
    'ALLOWED_ACTION',
    'PENDING_READBACK',
    'CANONICAL_READBACK',
    'RESOLVED_OR_UNKNOWN',
    'HISTORY',
  ],
  severity:['URGENT','ATTENTION','INFO'],
  rules:[
    'Dismissed != Resolved',
    'Resolved requires canonical readback/proof',
    'UNKNOWN remains UNKNOWN',
    'Engineering code and raw correlation IDs are hidden from normal UI',
    'Same incident may be correlated internally without creating a second queue',
  ],
} as const;

export const OWNER_UI_STAGE02_AUTHORITY_RULES=[
  'Action Queue is projection only; it is not a second queue database.',
  'Bounded action continues through existing OwnerRuntimePort only.',
  'No direct network transport is added.',
  'No Order / Pricing / Payment / Print / Auth / Sync authority changes.',
] as const;
