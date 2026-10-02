import type {MfpA9Status} from './a9-runtime.ts';

export const MFP_A9_PHYSICAL_GATES=Object.freeze([
  'IDENTITY_CARRIER_VERSION','IDENTITY_CANDIDATE_RELEASE','IDENTITY_DOWNLOAD_SIGNATURE_SHA','IDENTITY_ACTIVATE','IDENTITY_BOOT','IDENTITY_RUNTIME_READY','IDENTITY_CURRENT','IDENTITY_PREVIOUS','IDENTITY_CANDIDATE_CLEARED','IDENTITY_ROLLBACK_AVAILABLE',
  'SECURITY_DEVICE_REGISTERED','SECURITY_STAFF_LOGIN','SECURITY_INVALID_PROOF','SECURITY_EXPIRY_REVOCATION','SECURITY_RESTART_SESSION',
  'SYNC_STARTUP_LKG','SYNC_ADMIN_CHANGE_OPEN','SYNC_DOORBELL','SYNC_CANONICAL_ADVANCE','SYNC_ZERO_POLLING','SYNC_OFFLINE_LKG','SYNC_RECONNECT_DELTA',
  'ORDERING_VISUAL_LOCK','ORDERING_PRODUCT_OPTION_COMBO','ORDERING_HOLD_RETRIEVE_DINING','CHECKOUT_REQUIRED_BLOCK','CHECKOUT_PRICE_VALIDATION','CHECKOUT_STUDENT_DISCOUNT','CHECKOUT_CASH_CHANGE','CHECKOUT_PAYMENT_CONFIRM','CHECKOUT_DOUBLE_TAP',
  'ORDERS_SOURCE_LANES','ORDERS_READY_REVERT','ORDERS_PICKUP','DINING_DIRECT_SEAT','DINING_WAITING_TABLE','DINING_TRANSFER','DINING_ADDITION','DINING_SPLIT_CHECKOUT','DINING_SEATED_WARNING',
  'AVAILABILITY_SOLD_OUT_RESTORE','CAPACITY_DEDUCT','CAPACITY_CANCEL_REPLENISH_ONCE','CAPACITY_CHANNEL_THRESHOLDS','CAPACITY_FINITE_OVERRIDE','CAPACITY_BUSINESS_DAY_RESET',
  'MONEY_OPENING_CASH','MONEY_CASH_IN_OUT','MONEY_CASH_SALE','MONEY_REFUND_CORRECTION','MONEY_DAY_CLOSE_COUNT','MONEY_VARIANCE','MONEY_RETAINED_CASH','MONEY_IMMUTABLE_REPORT_ADJUSTMENT',
  'PRINT_RECEIPT','PRINT_PRODUCTION','PRINT_PACKING','PRINT_LABELS','PRINT_PARTIAL_LABEL_REPRINT','PRINT_REPRINT_NO_DRAWER','PRINT_CASH_DRAWER_ONCE','PRINT_OFFLINE_ATTENTION','PRINT_AMBIGUOUS_NO_BLIND_RETRY','PRINT_RESTART_RECOVERY',
  'CUSTOMER_PENDING_PAY_AT_STORE','CUSTOMER_PAYMENT_EVIDENCE','CUSTOMER_WHATSAPP','CUSTOMER_ACCEPT_ONCE','CUSTOMER_MODIFY_CONFIRMATION','CUSTOMER_CUTOFF_FUTURE_ONLY',
  'KEETA_MANUAL_IMMEDIATE','KEETA_LATER_0_1_2','KEETA_THIRD_LATER_BLOCKED','KEETA_AUTO_POLICY','KEETA_DEDUPE','KEETA_LIFECYCLE','KEETA_AFTER_SALE','KEETA_MAPPING_ATTENTION',
  'OFFLINE_WAN_LOCAL_TRADE','OFFLINE_APP_RESTART','OFFLINE_DEVICE_REBOOT','OFFLINE_NO_DUPLICATE_ORDER','OFFLINE_NO_DUPLICATE_PRINT','OFFLINE_NO_DOUBLE_CAPACITY','OFFLINE_NO_DOUBLE_MONEY',
  'MOBILE_SHARED_AUTHORITY','MOBILE_TOUCH_FLOWS','MOBILE_CANONICAL_STATE','MOBILE_CROSS_DEVICE_READBACK',
] as const);

export type MfpA9PhysicalGateId=typeof MFP_A9_PHYSICAL_GATES[number];
export type MfpA9PhysicalResult='PASS'|'FAIL'|'BLOCKED';
export interface MfpA9PhysicalEvidence{
  readonly gateId:MfpA9PhysicalGateId;
  readonly device:string;
  readonly sourceSha:string;
  readonly releaseId:string;
  readonly timestamp:string;
  readonly result:MfpA9PhysicalResult;
}

export function evaluateMfpA9PhysicalAcceptance(input:{expectedSourceSha:string;expectedReleaseId:string;records:readonly MfpA9PhysicalEvidence[]}):Readonly<{status:MfpA9Status;codes:readonly string[]}>{
  const codes:string[]=[];
  if(!/^[0-9a-f]{40}$/.test(input.expectedSourceSha))codes.push('MFP_PHYSICAL_EXPECTED_SOURCE_INVALID');
  if(!/^[A-Za-z0-9._-]{1,96}$/.test(input.expectedReleaseId))codes.push('MFP_PHYSICAL_EXPECTED_RELEASE_INVALID');
  const records=new Map<MfpA9PhysicalGateId,MfpA9PhysicalEvidence>();
  for(const record of input.records){
    if(records.has(record.gateId)){codes.push('MFP_PHYSICAL_DUPLICATE_GATE');continue;}
    records.set(record.gateId,record);
    if(!record.device.trim())codes.push('MFP_PHYSICAL_DEVICE_REQUIRED');
    if(record.sourceSha!==input.expectedSourceSha)codes.push('MFP_PHYSICAL_SOURCE_MISMATCH');
    if(record.releaseId!==input.expectedReleaseId)codes.push('MFP_PHYSICAL_RELEASE_MISMATCH');
    if(!Number.isFinite(Date.parse(record.timestamp)))codes.push('MFP_PHYSICAL_TIMESTAMP_INVALID');
    if(record.result==='FAIL')codes.push(`MFP_PHYSICAL_GATE_FAILED:${record.gateId}`);
    if(record.result==='BLOCKED')codes.push(`MFP_PHYSICAL_GATE_BLOCKED:${record.gateId}`);
  }
  for(const gate of MFP_A9_PHYSICAL_GATES)if(!records.has(gate))codes.push(`MFP_PHYSICAL_GATE_MISSING:${gate}`);
  const unique=Object.freeze([...new Set(codes)]);
  return Object.freeze({status:unique.some(value=>value.startsWith('MFP_PHYSICAL_GATE_FAILED:'))?'FAILED':unique.length?'BLOCKED':'PHYSICAL_VERIFIED',codes:unique});
}

export function evaluateMfpA9Cutover(input:Readonly<{
  ownerAuthorized:boolean;sourceVerified:boolean;builderVerified:boolean;productionBindingsAccepted:boolean;
  physicalVerified:boolean;publicReady:boolean;customerKeetaGreen:boolean;offlinePrintAuthGreen:boolean;
  smmRuntimeDependencyAbsent:boolean;
}>):Readonly<{status:MfpA9Status;codes:readonly string[]}>{
  const checks:ReadonlyArray<readonly [boolean,string]>=[
    [input.sourceVerified,'MFP_SOURCE_NOT_ACCEPTED'],[input.builderVerified,'MFP_BUILDER_NOT_ACCEPTED'],
    [input.productionBindingsAccepted,'MFP_PRODUCTION_BINDINGS_NOT_ACCEPTED'],[input.physicalVerified,'MFP_PHYSICAL_ACCEPTANCE_REQUIRED'],
    [input.publicReady,'MFP_PUBLIC_CUTOVER_NOT_READY'],[input.customerKeetaGreen,'MFP_EXTERNAL_ACCEPTANCE_NOT_GREEN'],
    [input.offlinePrintAuthGreen,'MFP_OFFLINE_PRINT_AUTH_NOT_GREEN'],[input.smmRuntimeDependencyAbsent,'MFP_SMM_RUNTIME_DEPENDENCY_PRESENT'],
    [input.ownerAuthorized,'MFP_OWNER_CUTOVER_AUTHORIZATION_REQUIRED'],
  ];
  const codes=Object.freeze(checks.filter(([ok])=>!ok).map(([,code])=>code));
  return Object.freeze({status:codes.length?'BLOCKED':'PHYSICAL_VERIFIED',codes});
}
