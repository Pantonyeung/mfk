import { EXECUTION_GATE } from './constants.js';

export const KEETA_ACCEPTANCE_MODES = Object.freeze(['MANUAL', 'AUTO', 'STORM_AUTO']);

export function resolveKeetaAcceptancePolicy({ mode, stormActive = false, autoAcceptDelayMs = 0 }) {
  if (!KEETA_ACCEPTANCE_MODES.includes(mode)) throw new Error('KEETA_ACCEPTANCE_MODE_REQUIRED');
  if (!Number.isSafeInteger(autoAcceptDelayMs) || autoAcceptDelayMs < 0 || autoAcceptDelayMs > 5000) {
    throw new Error('KEETA_AUTO_ACCEPT_DELAY_MS_INVALID');
  }
  const autoAccept = mode === 'AUTO' || (mode === 'STORM_AUTO' && stormActive === true);
  return Object.freeze({
    mode,
    autoAccept,
    autoAcceptDelayMs: autoAccept ? autoAcceptDelayMs : 0,
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'MFK_CONFIG_DECISION_REQUIRED_NO_PROVIDER_SIDE_DEFAULT',
  });
}
