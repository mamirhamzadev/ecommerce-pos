/** @param {Window['api']} raw */
function wrapApi(raw) {
  const needsInvoicesPatch = typeof raw.listInvoicesPaged !== 'function';
  const needsInvoiceIdsPatch = typeof raw.listInvoiceIds !== 'function';
  const needsInvoicesByIdsPatch = typeof raw.listInvoicesByIds !== 'function';
  const needsInvoicePrintPatch = typeof raw.getInvoiceForPrint !== 'function';
  const needsDeleteAllInvoicesPatch = typeof raw.deleteAllInvoices !== 'function';
  const needsPickerPatch = typeof raw.listProductsPicker !== 'function';
  const needsTagPatch = typeof raw.setCustomerTag !== 'function';
  const needsPasswordPatch = typeof raw.changePassword !== 'function';
  const needsUserPatch = typeof raw.updateUser !== 'function';
  const needsUpdaterPatch =
    typeof raw.getUpdaterInfo !== 'function' ||
    typeof raw.checkAppUpdates !== 'function' ||
    typeof raw.quitAndInstallUpdate !== 'function' ||
    typeof raw.onUpdaterEvent !== 'function';
  const needsBackupPatch =
    typeof raw.createBackup !== 'function' ||
    typeof raw.validateBackupFile !== 'function' ||
    typeof raw.restoreBackup !== 'function';
  const needsSetupPatch =
    typeof raw.getSetupStatus !== 'function' || typeof raw.completeSetup !== 'function';
  const needsSubscriptionPatch = typeof raw.checkSubscriptionStatus !== 'function';
  if (
    !needsInvoicesPatch &&
    !needsInvoiceIdsPatch &&
    !needsInvoicesByIdsPatch &&
    !needsInvoicePrintPatch &&
    !needsDeleteAllInvoicesPatch &&
    !needsPickerPatch &&
    !needsTagPatch &&
    !needsPasswordPatch &&
    !needsUserPatch &&
    !needsUpdaterPatch &&
    !needsBackupPatch &&
    !needsSetupPatch &&
    !needsSubscriptionPatch
  ) {
    return raw;
  }
  if (typeof raw.invoke === 'function') {
    return {
      ...raw,
      ...(needsInvoicesPatch
        ? {
            listInvoicesPaged: (payload) => raw.invoke('invoices:listPaged', payload),
          }
        : {}),
      ...(needsInvoiceIdsPatch
        ? {
            listInvoiceIds: (payload) => raw.invoke('invoices:listIds', payload),
          }
        : {}),
      ...(needsInvoicesByIdsPatch
        ? {
            listInvoicesByIds: (payload) => raw.invoke('invoices:listByIds', payload),
          }
        : {}),
      ...(needsInvoicePrintPatch
        ? {
            getInvoiceForPrint: (payload) => raw.invoke('invoices:getForPrint', payload),
          }
        : {}),
      ...(needsDeleteAllInvoicesPatch
        ? {
            deleteAllInvoices: () => raw.invoke('invoices:deleteAll'),
          }
        : {}),
      ...(needsSetupPatch
        ? {
            getSetupStatus: () => raw.invoke('auth:setupStatus'),
            completeSetup: (payload) => raw.invoke('auth:completeSetup', payload),
          }
        : {}),
      ...(needsSubscriptionPatch
        ? {
            checkSubscriptionStatus: () => raw.invoke('subscription:checkStatus'),
          }
        : {}),
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
      ...(needsTagPatch
        ? {
            setCustomerTag: (payload) => raw.invoke('tags:set', payload),
          }
        : {}),
      ...(needsPasswordPatch
        ? {
            changePassword: (payload) => raw.invoke('auth:changePassword', payload),
          }
        : {}),
      ...(needsUpdaterPatch
        ? {
            getUpdaterInfo: () => raw.invoke('app:updaterInfo'),
            checkAppUpdates: () => raw.invoke('app:updaterCheck'),
            quitAndInstallUpdate: () => raw.invoke('app:updaterQuitAndInstall'),
            onUpdaterEvent:
              typeof raw.onUpdaterEvent === 'function'
                ? (cb) => raw.onUpdaterEvent(cb)
                : () => () => {},
          }
        : {}),
      ...(needsBackupPatch
        ? {
            createBackup: (payload) => raw.invoke('backup:create', payload),
            validateBackupFile: () => raw.invoke('backup:validate'),
            restoreBackup: (payload) => raw.invoke('backup:restore', payload),
          }
        : {}),
    };
  }
  return {
    ...raw,
    ...(needsInvoicesPatch
      ? {
          listInvoicesPaged: () =>
            Promise.reject(
              new Error(
                'Invoices list requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsInvoiceIdsPatch
      ? {
          listInvoiceIds: () =>
            Promise.reject(
              new Error(
                'Select-all invoices requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsInvoicesByIdsPatch
      ? {
          listInvoicesByIds: () =>
            Promise.reject(
              new Error(
                'Invoice summary print requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsInvoicePrintPatch
      ? {
          getInvoiceForPrint: () =>
            Promise.reject(
              new Error(
                'Invoice print requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsDeleteAllInvoicesPatch
      ? {
          deleteAllInvoices: () =>
            Promise.reject(
              new Error(
                'Delete all invoices requires a full app restart after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsSetupPatch
      ? {
          getSetupStatus: () =>
            Promise.reject(
              new Error(
                'First-time setup requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          completeSetup: () =>
            Promise.reject(
              new Error(
                'First-time setup requires a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsSubscriptionPatch
      ? {
          checkSubscriptionStatus: () =>
            Promise.reject(
              new Error(
                'Subscription check requires a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
    ...(needsUserPatch
      ? {
          updateUser: () =>
            Promise.reject(
              new Error(
                'Profile update requires a newer app build. Quit every Electron window, stop the dev server (Ctrl+C), then run npm run dev again.',
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
    ...(needsTagPatch
      ? {
          setCustomerTag: () =>
            Promise.reject(
              new Error(
                'Customer tagging requires a full app restart after updating preload.',
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
    ...(needsUpdaterPatch
      ? {
          getUpdaterInfo: () =>
            Promise.reject(
              new Error(
                'Updater requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          checkAppUpdates: () =>
            Promise.reject(
              new Error(
                'Updater requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          quitAndInstallUpdate: () =>
            Promise.reject(
              new Error(
                'Updater requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          onUpdaterEvent: () => () => {},
        }
      : {}),
    ...(needsBackupPatch
      ? {
          createBackup: () =>
            Promise.reject(
              new Error(
                'Backup requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          validateBackupFile: () =>
            Promise.reject(
              new Error(
                'Backup requires a newer app build. Restart the app after updating preload.',
              ),
            ),
          restoreBackup: () =>
            Promise.reject(
              new Error(
                'Backup requires a newer app build. Restart the app after updating preload.',
              ),
            ),
        }
      : {}),
  };
}

/** @returns {Window['api']} */
export function getApi() {
  if (!window.api) {
    throw new Error('Preload bridge missing: run inside Electron.');
  }
  return /** @type {Window['api']} */ (wrapApi(window.api));
}
