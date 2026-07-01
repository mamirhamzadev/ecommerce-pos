/**
 * Remote subscription / customer registry (Vercel license-api).
 * All calls run in the Electron main process only.
 */

const REQUEST_TIMEOUT_MS = 20_000;

const INTERNET_REQUIRED_ERROR =
  "Internet connection is required. Please connect to the internet and try again.";

/** @param {string} raw */
function normalizeLicenseApiBaseUrl(raw) {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "");
}

function getLicenseApiBaseUrl() {
  const raw = process.env.LICENSE_API_URL?.trim();
  if (!raw) return null;
  return normalizeLicenseApiBaseUrl(raw);
}

/**
 * Supports both:
 * - LICENSE_API_URL=https://license-manager-apis.vercel.app/api
 * - LICENSE_API_URL=https://license-manager-apis.vercel.app
 *
 * @param {string} resourcePath e.g. "/installations/register"
 */
function resolveLicenseEndpoint(resourcePath) {
  const base = getLicenseApiBaseUrl();
  if (!base) return null;
  const resource = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
  if (base.endsWith("/api")) {
    return `${base}${resource}`;
  }
  return `${base}/api${resource}`;
}

/**
 * @param {string} resourcePath
 * @param {RequestInit} [init]
 */
async function licenseFetch(resourcePath, init = {}) {
  const url = resolveLicenseEndpoint(resourcePath);
  if (!url) {
    return {
      ok: false,
      error: "License service is not configured. Set LICENSE_API_URL in .env.",
      offline: true,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    /** @type {Record<string, unknown>} */
    let body = {};
    try {
      body = /** @type {Record<string, unknown>} */ (await res.json());
    } catch {
      body = {};
    }

    if (!res.ok) {
      const message =
        typeof body.error === "string" && body.error
          ? body.error
          : `License service returned ${res.status}.`;
      return { ok: false, error: message, status: res.status };
    }

    return { ok: true, data: body };
  } catch (err) {
    const offline =
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err.name === "AbortError" ||
        err.name === "TypeError" ||
        err.code === "ENOTFOUND" ||
        err.code === "ECONNREFUSED");
    return {
      ok: false,
      error: INTERNET_REQUIRED_ERROR,
      offline: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

function mapBlockedPayload(data) {
  return {
    ok: true,
    blocked: data.blocked === true,
    blockReason:
      typeof data.blockReason === "string" && data.blockReason
        ? data.blockReason
        : "Your subscription has expired. Please contact the administrator to renew.",
    contactEmail:
      typeof data.contactEmail === "string" ? data.contactEmail : "",
    contactPhone:
      typeof data.contactPhone === "string" ? data.contactPhone : "",
  };
}

/**
 * @param {{
 *   installationId: string,
 *   username: string,
 *   password: string,
 *   name?: string,
 *   email?: string,
 *   role?: string,
 *   appName?: string,
 * }} payload
 */
async function registerInstallation(payload) {
  const result = await licenseFetch("/installations/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Registration failed.",
      offline: result.offline === true,
    };
  }

  return { ok: true };
}

/**
 * Upsert customer in MongoDB on login (creates if missing).
 * @param {{
 *   installationId: string,
 *   username: string,
 *   password: string,
 *   name?: string,
 *   email?: string,
 *   role?: string,
 *   appName?: string,
 * }} payload
 */
async function syncCustomerOnLogin(payload) {
  const result = await licenseFetch("/installations/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || INTERNET_REQUIRED_ERROR,
      offline: result.offline === true,
    };
  }

  const data = /** @type {Record<string, unknown>} */ (result.data || {});
  return {
    ok: true,
    created: data.created === true,
    ...mapBlockedPayload(data),
  };
}

/**
 * @param {string} installationId
 */
async function fetchSubscriptionStatus(installationId) {
  const q = new URLSearchParams({ installationId });
  const result = await licenseFetch(`/installations/status?${q.toString()}`, {
    method: "GET",
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || INTERNET_REQUIRED_ERROR,
      offline: result.offline === true,
    };
  }

  const data = /** @type {Record<string, unknown>} */ (result.data || {});
  return {
    ok: true,
    ...mapBlockedPayload(data),
  };
}

module.exports = {
  registerInstallation,
  syncCustomerOnLogin,
  fetchSubscriptionStatus,
  getLicenseApiBaseUrl,
  resolveLicenseEndpoint,
  INTERNET_REQUIRED_ERROR,
};
