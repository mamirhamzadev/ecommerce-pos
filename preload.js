const { contextBridge, ipcRenderer } = require('electron');

const UPDATER_EVENT = 'app:updater-event';

const ALLOWED_CHANNELS = new Set([
  'auth:login',
  'auth:setupStatus',
  'auth:completeSetup',
  'auth:forgotRequest',
  'auth:forgotComplete',
  'auth:changePassword',
  'auth:logout',
  'auth:session',
  'subscription:checkStatus',
  'users:update',
  'dashboard:snapshot',
  'products:listPaged',
  'products:listPicker',
  'products:create',
  'products:update',
  'products:delete',
  'orders:listPaged',
  'orders:create',
  'orders:update',
  'orders:patchStatus',
  'orders:delete',
  'invoices:listPaged',
  'invoices:getForPrint',
  'invoices:deleteAll',
  'app:updaterInfo',
  'app:updaterCheck',
  'app:updaterQuitAndInstall',
  'backup:create',
  'backup:validate',
  'backup:restore',
]);

function invoke(channel, payload) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Forbidden IPC channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld('api', {
  invoke,
  login: (payload) => invoke('auth:login', payload),
  getSetupStatus: () => invoke('auth:setupStatus'),
  completeSetup: (payload) => invoke('auth:completeSetup', payload),
  forgotRequest: (payload) => invoke('auth:forgotRequest', payload),
  forgotComplete: (payload) => invoke('auth:forgotComplete', payload),
  changePassword: (payload) => invoke('auth:changePassword', payload),
  logout: (token) => invoke('auth:logout', token),
  getSession: (token) => invoke('auth:session', token),
  checkSubscriptionStatus: () => invoke('subscription:checkStatus'),
  updateUser: (payload) => invoke('users:update', payload),
  getDashboardSnapshot: () => invoke('dashboard:snapshot'),
  listProductsPaged: (payload) => invoke('products:listPaged', payload),
  listProductsPicker: (payload) => invoke('products:listPicker', payload),
  createProduct: (payload) => invoke('products:create', payload),
  updateProduct: (payload) => invoke('products:update', payload),
  deleteProduct: (payload) => invoke('products:delete', payload),
  listOrdersPaged: (payload) => invoke('orders:listPaged', payload),
  createOrder: (payload) => invoke('orders:create', payload),
  updateOrder: (payload) => invoke('orders:update', payload),
  patchOrderStatus: (payload) => invoke('orders:patchStatus', payload),
  deleteOrder: (payload) => invoke('orders:delete', payload),
  listInvoicesPaged: (payload) => invoke('invoices:listPaged', payload),
  getInvoiceForPrint: (payload) => invoke('invoices:getForPrint', payload),
  deleteAllInvoices: () => invoke('invoices:deleteAll'),
  getUpdaterInfo: () => invoke('app:updaterInfo'),
  checkAppUpdates: () => invoke('app:updaterCheck'),
  quitAndInstallUpdate: () => invoke('app:updaterQuitAndInstall'),
  createBackup: (payload) => invoke('backup:create', payload),
  validateBackupFile: () => invoke('backup:validate'),
  restoreBackup: (payload) => invoke('backup:restore', payload),
  onUpdaterEvent: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const handler = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on(UPDATER_EVENT, handler);
    return () => {
      ipcRenderer.removeListener(UPDATER_EVENT, handler);
    };
  },
});
