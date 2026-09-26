export const OWNER_UI_STAGE03_ORDER_OVERSIGHT_MAPPING={
  screenId:'OA-ORD-001',
  route:'/orders',
  mode:'READ_OVERSIGHT_FIRST',
  source:'OwnerReadModelSnapshot.orders',
  searchFields:[
    'displayCode',
    'customerName',
    'customerPhone',
    'externalRef',
  ],
  filters:[
    'businessDate',
    'source',
    'activeCompleted',
    'paymentState',
    'fulfillmentMode',
  ],
  scopes:{
    default:'DEFAULT',
    activeFromToday:'ACTIVE',
    dineInOpenFromToday:'DINE_IN_OPEN',
  },
  cardFields:[
    'displayCode',
    'source',
    'workflowStatusLabel',
    'elapsedLabel',
    'promisedTimeLabel',
    'currentEffectiveAmountLabel',
    'currentTenderLabel',
    'fulfillmentLabel',
    'exceptionBadges',
  ],
  detailSections:[
    'IDENTITY',
    'ITEMS_OPTIONS_MODIFIERS_REMARK',
    'MONEY',
    'FULFILLMENT',
    'EXTERNAL',
    'SIDE_EFFECTS',
    'TIMELINE_AUDIT',
  ],
  prohibitedMutations:[
    'CREATE_ORDER',
    'EDIT_ORDER',
    'CANCEL_ORDER',
    'REFUND',
    'TENDER_CORRECTION',
  ],
  normalUiHidden:[
    'orderId',
    'rawEngineeringFailure',
    'rawTimeline',
    'rawPrintPayload',
  ],
} as const;

export const OWNER_UI_STAGE03_AUTHORITY_RULES=[
  'Order Oversight consumes canonical read projection only.',
  'No order mutation command is exposed in Stage03.',
  'Raw UUID and engineering payloads stay outside normal UI.',
  'No second Order / Pricing / Payment / Print / Auth / Sync authority is created.',
] as const;
