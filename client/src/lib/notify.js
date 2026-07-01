import { toast } from 'react-toastify';

const successDefaults = { autoClose: 4000 };
const errorDefaults = { autoClose: 6000 };
const infoDefaults = { autoClose: 5000 };

/**
 * @param {string} message
 * @param {Record<string, unknown>} [options]
 */
export function notifySuccess(message, options = {}) {
  toast.success(message, { ...successDefaults, ...options });
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [options]
 */
export function notifyError(message, options = {}) {
  toast.error(message, { ...errorDefaults, ...options });
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [options]
 */
export function notifyInfo(message, options = {}) {
  toast.info(message, { ...infoDefaults, ...options });
}
