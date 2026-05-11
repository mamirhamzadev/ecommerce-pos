/** @param {Window['api']} raw */
function wrapApi(raw) {
  const needsUserPatch = typeof raw.updateUser !== 'function';
  const needsPickerPatch = typeof raw.listProductsPicker !== 'function';
  const needsPasswordPatch = typeof raw.changePassword !== 'function';
  const needsAdminCodePatch = typeof raw.sendAdminInviteCode !== 'function';
  const needsPermPatch =
    typeof raw.getUserPermissions !== 'function' ||
    typeof raw.updateUserPermissions !== 'function';
  if (
    !needsUserPatch &&
    !needsPickerPatch &&
    !needsPasswordPatch &&
    !needsAdminCodePatch &&
    !needsPermPatch
  ) {
    return raw;
  }
  if (typeof raw.invoke === 'function') {
    return {
      ...raw,
      ...(needsUserPatch
        ? {
            updateUser: (payload) => raw.invoke('users:update', payload),
          }
        : {}),
      ...(needsPickerPatch
        ? {
            listProductsPicker: (payload) => raw.invoke('products:listPicker', payload),
          }
        : {}),
      ...(needsPasswordPatch
        ? {
            changePassword: (payload) => raw.invoke('auth:changePassword', payload),
          }
        : {}),
      ...(needsAdminCodePatch
        ? {
            sendAdminInviteCode: () => raw.invoke('users:sendAdminInviteCode'),
          }
        : {}),
      ...(needsPermPatch
        ? {
            getUserPermissions: (payload) =>
              raw.invoke('users:getPermissions', payload),
            updateUserPermissions: (payload) =>
              raw.invoke('users:updatePermissions', payload),
          }
        : {}),
    };
  }
  return {
    ...raw,
    ...(needsUserPatch
      ? {
          updateUser: () =>
            Promise.reject(
              new Error(
                'Contact update requires a newer app build. Quit every Electron window, stop the dev server (Ctrl+C), then run npm run dev again.',
              ),
            ),
        }
      : {}),
    ...(needsPickerPatch
      ? {
          listProductsPicker: () =>
            Promise.reject(
              new Error(
                'Product picker requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsPasswordPatch
      ? {
          changePassword: () =>
            Promise.reject(
              new Error(
                'Change password requires a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsAdminCodePatch
      ? {
          sendAdminInviteCode: () =>
            Promise.reject(
              new Error(
                'Admin verification requires a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsPermPatch
      ? {
          getUserPermissions: () =>
            Promise.reject(
              new Error(
                'User permissions require a newer app build. Restart the app after updating preload.',
              ),
            ),
          updateUserPermissions: () =>
            Promise.reject(
              new Error(
                'User permissions require a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
  };
}

export function getApi() {
  if (!window.api) {
    throw new Error('Preload bridge missing: run inside Electron.');
  }
  return wrapApi(window.api);
}
