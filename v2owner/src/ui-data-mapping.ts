export const OWNER_UI_DATA_MAPPING={
  today:{
    route:'/today',
    readModel:'OwnerReadModelSnapshot',
    fields:{
      kpi:'today',
      liveOrders:'liveOrders',
      dineInOpenChecks:'dineIn',
      actionQueue:'actions',
      readiness:'readiness',
      staff:'staff',
      reports:'reports',
    },
  },
  actions:{route:'/actions',readModel:'actions'},
  orders:{route:'/orders',readModel:'orders'},
  more:{route:'/more',readModel:'composed owner projections'},
} as const;

export const OWNER_UI_COMMAND_MAPPING={
  sellability:'requestBoundedAction',
  channelControl:'requestBoundedAction',
  acknowledge:'requestBoundedAction',
  adminNavigation:'requestAdminDeepLink',
} as const;

export const OWNER_UI_AUTHORITY_RULES=[
  'Owner App is projection plus bounded command surface only.',
  'Open Checks are not silently counted as Current Effective Sales.',
  'UNKNOWN requires readback and must not be rendered as success.',
  'No direct network or second transaction authority belongs in v2owner.',
] as const;
