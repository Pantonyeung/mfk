export const KEETA_RUNTIME_POLICY = Object.freeze({
  mode: 'EVENT_DRIVEN_FIRST',
  providerRole: 'THIN_EDGE_ADAPTER_ONLY',
  businessHours: Object.freeze({
    timeZone: 'Asia/Hong_Kong',
    startLocal: '10:00',
    endLocal: '20:30',
  }),
  offHoursMode: 'LOW_TRAFFIC_MODE',
  scheduledSafetySweep: Object.freeze({
    allowedOnlyWhenEventDrivenProofIsUnavailable: true,
    minBusinessHoursIntervalMinutes: 5,
    minOffHoursIntervalMinutes: 30,
  }),
  invocation: Object.freeze({
    onePurposeOnly: true,
    boundedBatchRequired: true,
    explicitStopConditionRequired: true,
    explicitBackoffRequired: true,
    cpuBudgetDeclarationRequired: true,
  }),
  forbiddenPatterns: Object.freeze([
    'ONE_MINUTE_GLOBAL_CRON',
    'FIVE_SECOND_LIVENESS_WATCHDOG',
    'MULTI_DOMAIN_SCHEDULED_DRAIN',
    'BACKGROUND_SCAN_TO_DISCOVER_WORK_WHEN_EVENT_EXISTS',
    'SLEEP_DELAY_INSIDE_REQUEST',
    'OAUTH_REFRESH_POLLING_CRON',
    'SECOND_CANONICAL_ORDER_TRUTH',
    'SECOND_PRICING_TRUTH',
    'SECOND_FULFILLMENT_TRUTH',
    'SECOND_REFUND_TRUTH',
    'PROVIDER_DB_AS_PARALLEL_BUSINESS_TRUTH',
    'GENERAL_PURPOSE_PROVIDER_ORCHESTRATOR',
  ]),
});

const ALLOWED_TRIGGERS = new Set(['WEBHOOK', 'CANONICAL_EVENT', 'OPERATOR_ACTION', 'SAFETY_SWEEP']);

export function estimateScheduledInvocationsPerDay(intervalMinutes, activeMinutes = 1440) {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) throw new Error('KEETA_INTERVAL_INVALID');
  if (!Number.isFinite(activeMinutes) || activeMinutes < 0 || activeMinutes > 1440) throw new Error('KEETA_ACTIVE_MINUTES_INVALID');
  if (activeMinutes === 0) return 0;
  return Math.ceil(activeMinutes / intervalMinutes);
}

export function assertKeetaRuntimePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('KEETA_RUNTIME_PLAN_REQUIRED');
  if (!ALLOWED_TRIGGERS.has(plan.trigger)) throw new Error('KEETA_RUNTIME_TRIGGER_FORBIDDEN');
  if (typeof plan.purpose !== 'string' || !plan.purpose.trim()) throw new Error('KEETA_RUNTIME_PURPOSE_REQUIRED');
  if (!Number.isSafeInteger(plan.maxBatch) || plan.maxBatch < 1) throw new Error('KEETA_RUNTIME_MAX_BATCH_REQUIRED');
  if (plan.onePurposeOnly !== true) throw new Error('KEETA_RUNTIME_ONE_PURPOSE_REQUIRED');
  if (plan.backgroundDiscoveryPoll === true) throw new Error('KEETA_BACKGROUND_DISCOVERY_POLL_FORBIDDEN');
  if (plan.usesSleepDelay === true) throw new Error('KEETA_SLEEP_DELAY_FORBIDDEN');
  if (plan.ownsCanonicalTruth === true) throw new Error('KEETA_PARALLEL_BUSINESS_TRUTH_FORBIDDEN');

  if (plan.trigger === 'SAFETY_SWEEP') {
    if (!Number.isFinite(plan.intervalMinutes) || plan.intervalMinutes <= 0) throw new Error('KEETA_SAFETY_SWEEP_INTERVAL_REQUIRED');
    const min = plan.trafficMode === 'LOW_TRAFFIC_MODE'
      ? KEETA_RUNTIME_POLICY.scheduledSafetySweep.minOffHoursIntervalMinutes
      : KEETA_RUNTIME_POLICY.scheduledSafetySweep.minBusinessHoursIntervalMinutes;
    if (plan.intervalMinutes < min) throw new Error('KEETA_SAFETY_SWEEP_TOO_FREQUENT');
  }

  if (!Number.isFinite(plan.expectedCpuMs) || plan.expectedCpuMs < 0) throw new Error('KEETA_EXPECTED_CPU_REQUIRED');
  if (!Number.isFinite(plan.providerCpuLimitMs) || plan.providerCpuLimitMs <= 0) throw new Error('KEETA_PROVIDER_CPU_LIMIT_REQUIRED');
  if (plan.expectedCpuMs >= plan.providerCpuLimitMs) throw new Error('KEETA_CPU_BUDGET_EXCEEDS_PROVIDER_LIMIT');
  if (typeof plan.stopCondition !== 'string' || !plan.stopCondition.trim()) throw new Error('KEETA_STOP_CONDITION_REQUIRED');
  if (typeof plan.backoff !== 'string' || !plan.backoff.trim()) throw new Error('KEETA_BACKOFF_REQUIRED');

  return true;
}
