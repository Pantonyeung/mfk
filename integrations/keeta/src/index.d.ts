export type KeetaProvider = 'KEETA';
export type KeetaMarket = 'HONG_KONG';
export type KeetaExecutionGate = 'NOT_WIRED' | 'BLOCKED_CANONICAL_AUTHORITY' | 'BLOCKED_EXTERNAL';
export type KeetaProviderResultStatus = 'SUCCESS' | 'PROVIDER_REJECTED' | 'PARTIAL' | 'MALFORMED' | 'UNKNOWN';
export type KeetaCertificationStatus = 'MIGRATED' | 'NOT_WIRED' | 'BLOCKED_EXTERNAL' | 'UNKNOWN' | 'READY_FOR_FUTURE_TEST';
export type KeetaSellabilityState = 'AVAILABLE' | 'SOLD_OUT' | 'PAUSED';
export type KeetaWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type KeetaTokenLifecycleDisposition = 'VALID' | 'REFRESH_DUE' | 'EXPIRED';
export type KeetaAcceptanceMode = 'MANUAL' | 'AUTO' | 'STORM_AUTO';

export interface CredentialRef {
  readonly provider: 'KEETA';
  readonly kind: 'SECRET_REF';
  readonly name: string;
}

export interface SecretProvider {
  getSecret(ref: CredentialRef): Promise<string | null>;
}

export interface KeetaWebhookEnvelope {
  readonly eventId: number;
  readonly eventName: string;
  readonly appId: number;
  readonly messageId: string;
  readonly providerShopId: number;
  readonly message: string;
  readonly timestampSeconds: number;
  readonly signatureEvidence: {
    readonly providedSignature: string;
    readonly verificationState: 'REQUIRES_SECRET_PROVIDER_AT_FUTURE_RUNTIME';
    readonly failClosedOnMismatch: true;
  };
}

export interface KeetaMenuCategory {
  readonly openItemCode: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

export interface KeetaMenuSku {
  readonly openItemCode: string;
  readonly [key: string]: unknown;
}

export interface KeetaMenuSpu {
  readonly openItemCode: string;
  readonly name?: string;
  readonly shopCategoryOpenItemCodeList?: readonly string[];
  readonly skuList: readonly KeetaMenuSku[];
  readonly [key: string]: unknown;
}

export interface KeetaMenuOption {
  readonly openItemCode: string;
  readonly [key: string]: unknown;
}

export interface KeetaChoiceGroup {
  readonly openItemCode: string;
  readonly name?: string;
  readonly minNumber?: number;
  readonly maxNumber?: number;
  readonly repeatable?: 0 | 1;
  readonly choiceGroupSkuList: readonly KeetaMenuOption[];
  readonly [key: string]: unknown;
}

export interface KeetaFullMenuSnapshot {
  readonly shopCategoryList: readonly KeetaMenuCategory[];
  readonly choiceGroupList: readonly KeetaChoiceGroup[];
  readonly spuList: readonly KeetaMenuSpu[];
  readonly spuSequenceCodeMap?: Readonly<Record<string, readonly string[]>> | null;
}

export interface KeetaProviderRequestShape {
  readonly providerOperation: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly executionGate: 'NOT_WIRED';
}

export interface KeetaBusinessHour {
  readonly startTime: number;
  readonly endTime: number;
}

export type KeetaBusinessHourOfTheWeek = Readonly<Record<KeetaWeekday, readonly KeetaBusinessHour[]>>;

export interface KeetaCapabilityRecord {
  readonly CAP_ID: string;
  readonly DOMAIN: string;
  readonly PROVIDER_OPERATION: string;
  readonly KIND: string;
  readonly STATUS: string;
  readonly AUTHORITY: string;
  readonly EVIDENCE: string;
}

export interface KeetaTokenMaterial {
  readonly accessToken: string;
  readonly tokenType: 'bearer';
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly scope: string;
  readonly issuedAtTime: number;
}

export const KEETA_PROVIDER: Readonly<Record<string, string>>;
export const EXECUTION_GATE: Readonly<Record<string, KeetaExecutionGate>>;
export const PROVIDER_OPERATIONS: Readonly<Record<string, string>>;
export const KEETA_WEBHOOK_EVENTS: Readonly<Record<number, string>>;
export const KEETA_CAPABILITY_REGISTRY: readonly KeetaCapabilityRecord[];
export const KEETA_CAPABILITY_COUNT: number;
export const KEETA_CERTIFICATION_REGISTRY: readonly Readonly<Record<string, unknown>>[];
export const KEETA_EXTERNAL_EVIDENCE: readonly Readonly<Record<string, unknown>>[];
export const CERTIFICATION_NON_CLAIMS: readonly string[];
export const KEETA_STANDARD_OAUTH_MODE: string;
export const KEETA_STANDARD_OAUTH_AUTHORIZE_URL: string;
export const KEETA_TOKEN_URL: string;
export const KEETA_ACCEPTANCE_MODES: readonly string[];
export const KEETA_CONFIGURABLE_WEBHOOK_EVENTS: readonly number[];
export const KEETA_DONOR_EXCLUSIONS: readonly Readonly<Record<string, string>>[];
export const KEETA_COMPLETENESS_SCOPE: Readonly<Record<string, unknown>>;

export function buildKeetaSignaturePreimage(url: string, params: Readonly<Record<string, unknown>>, appSecret: string): string;
export function sha256HexUtf8(value: string): string;
export function signKeetaShape(url: string, params: Readonly<Record<string, unknown>>, appSecret: string): Readonly<Record<string, unknown>>;
export function verifyKeetaSignatureShape(url: string, signedParams: Readonly<Record<string, unknown>>, appSecret: string): Readonly<Record<string, unknown>>;
export function credentialRef(name?: string): CredentialRef;
export function missingSecretFailure(ref?: CredentialRef): Readonly<Record<string, unknown>>;

export function normalizeKeetaProviderResponse(rawBody: string): Readonly<Record<string, unknown>>;
export function unknownKeetaProviderResult(reason?: string): Readonly<Record<string, unknown>>;

export function validateKeetaFullMenuSnapshot(payload: KeetaFullMenuSnapshot | Readonly<Record<string, unknown>>): Readonly<{ok: boolean; issues: readonly string[]}>;
export function buildKeetaFullMenuSyncShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function parseKeetaMenuCompletion(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function parseKeetaPictureTaskCompletion(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function unknownKeetaMenuReadback(reason?: string): Readonly<Record<string, unknown>>;

export function parseKeetaWebhookEnvelope(body: Readonly<Record<string, unknown>>): KeetaWebhookEnvelope;
export function keetaWebhookUnsignedParameters(body: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaWebhookReplayIdentity(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function classifyKeetaReplay(existingFingerprint: string | null | undefined, incomingFingerprint: string): 'NEW'|'DUPLICATE'|'CONFLICT';
export function assertKeetaReplayCompatible(existingFingerprint: string | null | undefined, incomingFingerprint: string): 'NEW'|'DUPLICATE';

export function normalizeKeetaProviderEventEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function normalizeKeetaOrderLifecycleEventEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function normalizeKeetaDeliveryStatusEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function normalizeKeetaStoreChangeEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function normalizeKeetaObservedSystemCancellationEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;

export function normalizeKeetaOrderPlacementEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function buildKeetaOrderGetShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaOrderConfirmShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaOrderCancelShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaOrderReadyShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaOrderCollectShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaPartialRefundPreviewShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaPartialRefundApplyShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function parseKeetaAfterSaleEvidence(envelope: KeetaWebhookEnvelope): Readonly<Record<string, unknown>>;
export function presentKeetaAfterSaleStatus(evidence: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaAfterSaleDecisionShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function normalizeKeetaStandardProviderOrderFacts(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;

export function createKeetaStoreAliasBinding(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function toKeetaSellabilityShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function hhmmToSeconds(value: string): number;
export function validateKeetaBusinessHours(hours: KeetaBusinessHourOfTheWeek): true;
export function buildKeetaStoreHoursShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaStoreOperationalShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaStoreDetailsShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaStoreHoursGetShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaWebhookConfigurationShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;

export function buildKeetaOAuthAuthorizationShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function validateKeetaOAuthCallbackShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function parseKeetaTokenMaterial(rawBody: string): KeetaTokenMaterial;
export function assessKeetaTokenLifecycle(input: Readonly<Record<string, number>>): Readonly<Record<string, unknown>>;
export function buildKeetaAuthorizationCodeExchangeShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaRefreshTokenShape(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function classifyKeetaErrorCode(code: number): 'SIGNATURE'|'BUSINESS_PARAMETER'|'SERVER_EXCEPTION'|'OTHER_PROVIDER_ERROR';

export function keetaProviderOrderRef(providerOrderId: string | number): string;
export function validateKeetaProviderOrderRef(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaProductAliasRequest(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function buildKeetaOptionAliasRequest(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
export function resolveKeetaAcceptancePolicy(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;

export interface KeetaRuntimePlan {
  readonly trigger: 'WEBHOOK'|'CANONICAL_EVENT'|'OPERATOR_ACTION'|'SAFETY_SWEEP';
  readonly purpose: string;
  readonly maxBatch: number;
  readonly onePurposeOnly: true;
  readonly backgroundDiscoveryPoll?: boolean;
  readonly usesSleepDelay?: boolean;
  readonly ownsCanonicalTruth?: boolean;
  readonly trafficMode?: 'BUSINESS_HOURS'|'LOW_TRAFFIC_MODE';
  readonly intervalMinutes?: number;
  readonly expectedCpuMs: number;
  readonly providerCpuLimitMs: number;
  readonly stopCondition: string;
  readonly backoff: string;
}

export const KEETA_RUNTIME_POLICY: Readonly<Record<string, unknown>>;
export function estimateScheduledInvocationsPerDay(intervalMinutes: number, activeMinutes?: number): number;
export function assertKeetaRuntimePlan(plan: KeetaRuntimePlan): true;
