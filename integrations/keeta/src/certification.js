export const KEETA_EXTERNAL_EVIDENCE = Object.freeze([
  Object.freeze({
    evidenceId: 'KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH',
    status: 'BLOCKED_EXTERNAL',
    observed: 'OFFICIAL_CALCULATOR_SIGNATURE_ACCEPTED_BUT_LIVE_ORIGIN_CALLBACK_PREVIOUSLY_MISMATCHED',
    policy: 'FAIL_CLOSED_NO_PERMISSIVE_FALLBACK',
    resolved: false,
  }),
  Object.freeze({
    evidenceId: 'KEETA_SIT_1101_NO_DELIVERY',
    status: 'BLOCKED_EXTERNAL',
    observed: 'PROVIDER_ACCEPTED_BUSINESS_HOURS_UPDATE_BUT_ZERO_1101_CALLBACK_REQUESTS_OBSERVED_DURING_CONTROLLED_SIT',
    policy: 'PRESERVE_AS_PROVIDER_CLARIFICATION_REQUIRED_DO_NOT_FAKE_WEBHOOK_SUCCESS',
    resolved: false,
  }),
  Object.freeze({
    evidenceId: 'KEETA_PREPARING_OPERATION_NOT_DOCUMENTED',
    status: 'BLOCKED_EXTERNAL',
    observed: '/order/prepare means fully prepared READY, not generic PREPARING',
    policy: 'DO_NOT_INVENT_PREPARING_API',
    resolved: false,
  }),
]);

export const KEETA_CERTIFICATION_REGISTRY = Object.freeze([
  { caseId: 'SIT-SIGNATURE-CONTRACT', capability: 'SIGNATURE_CONTRACT', status: 'MIGRATED' },
  { caseId: 'SIT-MENU-FULL-SNAPSHOT', capability: 'MENU_SYNC_FULL_SNAPSHOT', status: 'NOT_WIRED' },
  { caseId: 'SIT-MENU-COMPLETION', capability: 'MENU_SYNC_READBACK', status: 'NOT_WIRED' },
  { caseId: 'SIT-ORDER-PLACEMENT', capability: 'ORDER_INTAKE_EVIDENCE', status: 'NOT_WIRED' },
  { caseId: 'SIT-MERCHANT-CONFIRM', capability: 'MERCHANT_DECISION_SHAPE', status: 'NOT_WIRED' },
  { caseId: 'SIT-MERCHANT-REJECT', capability: 'MERCHANT_DECISION_SHAPE', status: 'NOT_WIRED' },
  { caseId: 'SIT-FULFILLMENT-PREPARING', capability: 'FULFILLMENT_SHAPE', status: 'BLOCKED_EXTERNAL' },
  { caseId: 'SIT-FULFILLMENT-READY', capability: 'FULFILLMENT_SHAPE', status: 'NOT_WIRED' },
  { caseId: 'SIT-SELLABILITY', capability: 'SELLABILITY_SHAPE', status: 'READY_FOR_FUTURE_TEST' },
  { caseId: 'SIT-STORE-HOURS', capability: 'STORE_HOURS_SHAPE', status: 'READY_FOR_FUTURE_TEST' },
  { caseId: 'SIT-STORE-HOURS-WEBHOOK-1101', capability: 'STORE_CHANGE_WEBHOOK', status: 'BLOCKED_EXTERNAL' },
  { caseId: 'SIT-STORE-REST-OPEN', capability: 'STORE_OPERATIONAL_SHAPE', status: 'NOT_WIRED' },
  { caseId: 'SIT-AFTERSALE-EVIDENCE', capability: 'AFTERSALE_EVIDENCE', status: 'READY_FOR_FUTURE_TEST' },
  { caseId: 'SIT-AFTERSALE-DECISION', capability: 'AFTERSALE_DECISION_SHAPE', status: 'NOT_WIRED', blocker: 'BLOCKED_CANONICAL_AUTHORITY' },
  { caseId: 'SIT-LIVE-WEBHOOK-SIGNATURE', capability: 'WEBHOOK_SECURITY', status: 'BLOCKED_EXTERNAL' },
  { caseId: 'UAT-MENU', capability: 'MENU_SYNC_FULL_SNAPSHOT', status: 'UNKNOWN' },
  { caseId: 'UAT-ORDER', capability: 'ORDER_INTAKE_EVIDENCE', status: 'UNKNOWN' },
  { caseId: 'UAT-STABILITY', capability: 'WEBHOOK_SECURITY', status: 'UNKNOWN' },
].map(Object.freeze));

export const CERTIFICATION_NON_CLAIMS = Object.freeze([
  'SIT_NOT_EXECUTED',
  'UAT_NOT_EXECUTED',
  'KEETA_NOT_ACCEPTED',
  'PRODUCTION_NOT_ACTIVATED',
]);
