import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../api';

const HEARTBEAT_INTERVAL_MS = 60_000;
const CHECK_TIMEOUT_MS = 12_000;

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out.')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Background subscription gate: initial check + silent heartbeat every minute.
 * Offline / errors are ignored (app keeps running). Only a successful "blocked"
 * response from the server triggers the subscription screen.
 *
 * @param {boolean} active Run checks only when a user session exists.
 */
export function useSubscriptionHeartbeat(active) {
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const inFlightRef = useRef(false);

  const runCheck = useCallback(async (/** @type {{ initial?: boolean }} */ options = {}) => {
    if (!active) return;
    if (inFlightRef.current) {
      if (options.initial) {
        setSubscriptionBlocked(false);
        setInitialCheckDone(true);
      }
      return;
    }

    inFlightRef.current = true;
    try {
      const api = getApi();
      const res = await withTimeout(api.checkSubscriptionStatus(), CHECK_TIMEOUT_MS);

      if (res?.ok === false || res?.offline === true) {
        if (options.initial) {
          setSubscriptionBlocked(false);
        }
        return;
      }

      setSubscriptionBlocked(res?.blocked === true);
    } catch {
      if (options.initial) {
        setSubscriptionBlocked(false);
      }
    } finally {
      inFlightRef.current = false;
      if (options.initial) {
        setInitialCheckDone(true);
      }
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setSubscriptionBlocked(null);
      setInitialCheckDone(false);
      inFlightRef.current = false;
      return;
    }

    setInitialCheckDone(false);
    runCheck({ initial: true });

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      runCheck();
    }, HEARTBEAT_INTERVAL_MS);

    function onVisible() {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    }

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      inFlightRef.current = false;
    };
  }, [active, runCheck]);

  const checkingInitial = active && !initialCheckDone;

  return { subscriptionBlocked, checkingInitial };
}
