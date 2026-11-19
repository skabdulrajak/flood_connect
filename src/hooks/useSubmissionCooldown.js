import { useCallback, useEffect, useState } from 'react';
import { checkSubmissionCooldown, recordSubmission } from '../utils/rateLimiter';

/**
 * React hook providing a live second-by-second countdown while a submission
 * cooldown or burst rate-limit is active.
 */
export function useSubmissionCooldown(actionKey, scopeId = 'public') {
  const [status, setStatus] = useState(() => checkSubmissionCooldown(actionKey, scopeId));

  const refresh = useCallback(() => {
    const next = checkSubmissionCooldown(actionKey, scopeId);
    setStatus(next);
    return next;
  }, [actionKey, scopeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status.allowed) return undefined;
    const timer = window.setInterval(() => {
      const next = checkSubmissionCooldown(actionKey, scopeId);
      setStatus(next);
      if (next.allowed) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [actionKey, scopeId, status.allowed]);

  const markSubmitted = useCallback(() => {
    recordSubmission(actionKey, scopeId);
    refresh();
  }, [actionKey, scopeId, refresh]);

  return {
    isLimited: !status.allowed,
    remainingSeconds: status.remainingSeconds,
    reason: status.reason,
    message: status.message,
    checkNow: refresh,
    markSubmitted,
  };
}
