export const MFK_ADMIN_AUTHORITY=Object.freeze({
  product:'MFK_ADMIN',
  role:'CONTROL_PLANE',
  currentSystem:'MFK',
  domainWiring:'NOT_WIRED',
  liveMutationEnabled:false,
  liveReadEnabled:false,
  transactionExecutionAuthority:false,
  physicalPrintExecutionAuthority:false,
  authorityFlow:[
    'OWNER_DECISION',
    'ADMIN_DRAFT',
    'VALIDATE',
    'PUBLISH',
    'ACTIVE_REVISION',
    'SMT_EXECUTION',
  ] as const,
} as const);
