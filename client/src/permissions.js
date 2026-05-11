/** Default flags when session has no permissions object (legacy). */
export function defaultUserPermissions() {
  return {
    canCreateProduct: true,
    canEditProduct: true,
    canRemoveProduct: true,
    canCreateOrder: true,
    canDeleteOrder: true,
    canEditOrder: true,
    canChangeOrderStatus: true,
    canCreateUser: true,
    canEditUser: true,
    canDeleteUser: true,
  };
}

/** @param {Record<string, unknown> | null | undefined} raw */
export function mergePermissions(raw) {
  const base = defaultUserPermissions();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      out[key] = raw[key] === true;
    }
  }
  return out;
}
