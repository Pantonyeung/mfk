import { EXECUTION_GATE, PROVIDER_OPERATIONS } from './constants.js';

export const KEETA_CONFIGURABLE_WEBHOOK_EVENTS = Object.freeze([
  1001, 1002, 1003, 1004, 1005, 1006, 1007, 1101, 1102, 1201, 1202,
]);

const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};

function httpsUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) throw new Error('KEETA_WEBHOOK_CALLBACK_HTTPS_REQUIRED');
  if (/^https:\/\/[^/]*@/i.test(value)) throw new Error('KEETA_WEBHOOK_CALLBACK_URL_INVALID');
  return value;
}

export function buildKeetaWebhookConfigurationShape({
  appId,
  timestamp,
  eventId,
  callbackUrl,
  isTest,
}) {
  if (!KEETA_CONFIGURABLE_WEBHOOK_EVENTS.includes(eventId)) throw new Error('KEETA_WEBHOOK_EVENT_UNKNOWN');
  if (isTest !== 0 && isTest !== 1) throw new Error('KEETA_WEBHOOK_TEST_FLAG_INVALID');
  return Object.freeze({
    providerOperation: PROVIDER_OPERATIONS.webhookConfig,
    params: Object.freeze({
      appId: positive(appId, 'KEETA_APP_ID_INVALID'),
      timestamp: positive(timestamp, 'KEETA_TIMESTAMP_INVALID'),
      eventId,
      url: httpsUrl(callbackUrl),
      isTest,
    }),
    action: 'CONFIGURE_WEBHOOK_CALLBACK',
    signatureRequired: true,
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_CALLBACK_CONFIG_ONLY_NO_RUNTIME_ACTIVATION',
  });
}
