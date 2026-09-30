export const MFK_WEB_STATE_AUTHORITY_SCHEMA='MFK_WEB_STATE_AUTHORITY_V1' as const;

export const MFK_WEB_STATE_AUTHORITY=Object.freeze({
  schema:MFK_WEB_STATE_AUTHORITY_SCHEMA,
  scope:Object.freeze(['ADMIN','SMM','CUSTOMER','OWNER','FUTURE_WEB_PORT'] as const),
  serverState:Object.freeze({
    standard:'TANSTACK_QUERY' as const,
    package:'@tanstack/react-query' as const,
    durableBrowserAuthority:false,
    mutationSuccess:'INVALIDATE_AND_REFETCH_CANONICAL' as const,
    doorbell:'INVALIDATE_ONLY' as const,
  }),
  durableCommand:Object.freeze({
    standard:'DEXIE_INDEXEDDB' as const,
    package:'dexie' as const,
    mayBeDurable:true,
    requiredEvidenceForQueuedState:'REAL_PENDING_COMMAND' as const,
    networkInsideTransaction:false,
  }),
  localDraft:Object.freeze({
    standard:'REACT_OR_ZUSTAND' as const,
    persistedStandard:'ZUSTAND_PERSIST' as const,
    requiresVersion:true,
    requiresMigration:true,
    requiresPartialize:true,
    formalAuthority:false,
  }),
  authentication:Object.freeze({
    separateSecurityLayer:true,
    genericStateStoreForbidden:true,
    preferredFutureSession:'SERVER_SESSION_HTTPONLY_COOKIE' as const,
  }),
  forbidden:Object.freeze([
    'DURABLE_DERIVED_SERVER_STATUS',
    'LOCALSTORAGE_FORMAL_OUTBOX',
    'BROWSER_VS_CLOUD_TIMESTAMP_AUTHORITY_ORDERING',
    'DOORBELL_AS_DATA_AUTHORITY',
    'PERSISTED_READ_MODEL_OVERRIDES_CANONICAL_NETWORK_READ',
  ] as const),
} as const);

export type MfkWebPort=typeof MFK_WEB_STATE_AUTHORITY.scope[number];
export type MfkWebStateStandard=
  |typeof MFK_WEB_STATE_AUTHORITY.serverState.standard
  |typeof MFK_WEB_STATE_AUTHORITY.durableCommand.standard
  |typeof MFK_WEB_STATE_AUTHORITY.localDraft.standard
  |typeof MFK_WEB_STATE_AUTHORITY.localDraft.persistedStandard;
