import i18n from '../i18n';

/**
 * Client-side submission rate-limiter & cooldown guard persisted in localStorage.
 * Prevents accidental rapid duplicate floods and abusive spam bursts on public
 * and citizen forms. Production deployments should also enforce server/edge rate limits.
 */

const STORAGE_PREFIX = 'floodconnect_rl_v1_';

export const RATE_LIMIT_POLICIES = Object.freeze({
  contact_inquiry: {
    label: 'coordination inquiry',
    cooldownSeconds: 60,
    windowMs: 15 * 60 * 1000,
    maxInWindow: 3,
  },
  incident_report: {
    label: 'flood incident report',
    cooldownSeconds: 45,
    windowMs: 10 * 60 * 1000,
    maxInWindow: 5,
  },
  emergency_request: {
    label: 'emergency rescue request',
    cooldownSeconds: 30,
    windowMs: 10 * 60 * 1000,
    maxInWindow: 3,
  },
});

function buildKey(actionKey, scopeId = 'public') {
  return `${STORAGE_PREFIX}${actionKey}_${scopeId || 'public'}`;
}

function readTimestamps(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number' && Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function writeTimestamps(storageKey, list) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function checkSubmissionCooldown(actionKey, scopeId = 'public', now = Date.now()) {
  const policy = RATE_LIMIT_POLICIES[actionKey] || {
    label: 'submission',
    cooldownSeconds: 30,
    windowMs: 10 * 60 * 1000,
    maxInWindow: 5,
  };

  const storageKey = buildKey(actionKey, scopeId);
  const recent = readTimestamps(storageKey).filter((ts) => now - ts < policy.windowMs);

  if (recent.length > 0) {
    const lastTs = recent[recent.length - 1];
    const cooldownMs = policy.cooldownSeconds * 1000;
    const elapsed = now - lastTs;

    if (elapsed < cooldownMs) {
      const remainingSeconds = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      return {
        allowed: false,
        reason: 'cooldown',
        remainingSeconds,
        message: i18n.t('validation.cooldownActive', { seconds: remainingSeconds }),
      };
    }

    if (recent.length >= policy.maxInWindow) {
      const oldestTs = recent[0];
      const remainingSeconds = Math.max(1, Math.ceil((policy.windowMs - (now - oldestTs)) / 1000));
      return {
        allowed: false,
        reason: 'burst_limit',
        remainingSeconds,
        message: i18n.t('validation.burstLimitReached'),
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    remainingSeconds: 0,
    message: '',
  };
}

export function recordSubmission(actionKey, scopeId = 'public', now = Date.now()) {
  const policy = RATE_LIMIT_POLICIES[actionKey] || { windowMs: 10 * 60 * 1000 };
  const storageKey = buildKey(actionKey, scopeId);
  const recent = readTimestamps(storageKey).filter((ts) => now - ts < policy.windowMs);
  recent.push(now);
  writeTimestamps(storageKey, recent);
}
