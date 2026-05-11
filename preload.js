const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CHANNELS = new Set([
  'auth:login',
  'auth:forgotRequest',
  'auth:forgotComplete',
  'auth:changePassword',
  'auth:logout',
  'auth:session',
  'users:list',
  'users:listPaged',
  'users:create',
  'users:sendAdminInviteCode',
  'users:update',
  'users:delete',
  'users:getPermissions',
  'users:updatePermissions',
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
  forgotRequest: (payload) => invoke('auth:forgotRequest', payload),
  forgotComplete: (payload) => invoke('auth:forgotComplete', payload),
  changePassword: (payload) => invoke('auth:changePassword', payload),
  logout: (token) => invoke('auth:logout', token),
  getSession: (token) => invoke('auth:session', token),
  listUsers: () => invoke('users:list'),
  listUsersPaged: (payload) => invoke('users:listPaged', payload),
  createUser: (payload) => invoke('users:create', payload),
  sendAdminInviteCode: () => invoke('users:sendAdminInviteCode'),
  updateUser: (payload) => invoke('users:update', payload),
  deleteUser: (payload) => invoke('users:delete', payload),
  getUserPermissions: (payload) => invoke('users:getPermissions', payload),
  updateUserPermissions: (payload) =>
    invoke('users:updatePermissions', payload),
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
});
