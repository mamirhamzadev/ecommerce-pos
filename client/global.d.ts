export {};

type UpdaterPushPayload =
  | { type: 'checking' }
  | { type: 'update-available'; info: UpdaterUpdateInfo | null }
  | { type: 'update-not-available'; info: UpdaterUpdateInfo | null }
  | { type: 'download-progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { type: 'update-downloaded'; info: UpdaterUpdateInfo | null }
  | { type: 'error'; message: string };

type UpdaterUpdateInfo = {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  path: string;
};

type UserPublic = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
};

export type InvoiceForPrint = {
  id: number;
  invoice_number: string;
  amount: number;
  status: string;
  order_id: number | null;
  user_id: number | null;
  created_at: string;
  order_number: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  customer_city: string | null;
  customer_address: string | null;
  note: string | null;
  delivery_charges: number | null;
  tracking_id: string | null;
  order_status: string | null;
  issued_by_username: string | null;
  issued_by_name: string | null;
  items: Array<{
    product_name: string;
    qty: number;
    weight_g: number;
    unit_price: number;
    line_total: number;
  }>;
};

type DashboardSnapshotSuccess = {
  ok: true;
  counts: {
    users: number;
    products: number;
    orders: number;
    invoices: number;
    ordersOpen: number;
    ordersDelivered: number;
    ordersCancelled: number;
    invoicesUnpaid: number;
  };
  recentOrders: Array<{
    id: number;
    order_number: string;
    line_count: number;
    customer_name: string;
    total: number;
    status: string;
    created_at: string;
    placed_by_username: string | null;
  }>;
  recentProducts: Array<{
    id: number;
    name: string;
    sku: string;
    price: number;
    weight_g: number;
    created_at: string;
  }>;
};

declare global {
  interface Window {
    api: {
      invoke: (
        channel:
          | 'auth:login'
          | 'auth:forgotRequest'
          | 'auth:forgotComplete'
          | 'auth:changePassword'
          | 'auth:logout'
          | 'auth:session'
          | 'users:update'
          | 'dashboard:snapshot'
          | 'products:listPaged'
          | 'products:listPicker'
          | 'products:create'
          | 'products:update'
          | 'products:delete'
          | 'orders:listPaged'
          | 'orders:create'
          | 'orders:update'
          | 'orders:patchStatus'
          | 'orders:delete'
          | 'invoices:listPaged'
          | 'invoices:getForPrint'
          | 'invoices:deleteAll'
          | 'app:updaterInfo'
          | 'app:updaterCheck'
          | 'app:updaterQuitAndInstall'
          | 'backup:create'
          | 'backup:validate'
          | 'backup:restore',
        payload?: unknown,
      ) => Promise<unknown>;
      login: (payload: { username: string; password: string }) => Promise<
        | { ok: true; token: string; user: UserPublic }
        | { ok: false; error?: string }
      >;
      forgotRequest: (payload: { username: string }) => Promise<
        | { ok: true; issued: true; code: string }
        | { ok: true; issued: false }
        | { ok: false; error?: string }
      >;
      forgotComplete: (payload: {
        username: string;
        code: string;
        newPassword: string;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      changePassword: (payload: {
        token: string;
        currentPassword: string;
        newPassword: string;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      logout: (token: string | null) => Promise<{ ok: boolean }>;
      getSession: (token: string | null) => Promise<
        | { ok: true; user: UserPublic }
        | { ok: false }
      >;
      updateUser: (payload: {
        id: number;
        name?: string;
        email: string;
        username: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      getDashboardSnapshot: () => Promise<DashboardSnapshotSuccess | { ok: false; error?: string }>;
      listProductsPicker: (payload: {
        search?: string;
      }) => Promise<
        | {
            ok: true;
            products: Array<{
              id: number;
              name: string;
              price: number;
              weight_g: number;
            }>;
          }
        | { ok: false; error?: string }
      >;
      listProductsPaged: (payload: {
        page: number;
        pageSize: number;
        /** Substring on name (case-insensitive), or on weight / price as text */
        q?: string;
      }) => Promise<
        | {
            ok: true;
            products: Array<{
              id: number;
              name: string;
              sku: string;
              price: number;
              weight_g: number;
              created_at: string;
            }>;
            total: number;
            page: number;
            pageSize: number;
          }
        | { ok: false; error?: string }
      >;
      createProduct: (payload: {
        name: string;
        weightG: number;
        unitPricePkr: number;
      }) => Promise<{ ok: boolean; error?: string }>;
      updateProduct: (payload: {
        id: number;
        name: string;
        weightG: number;
        unitPricePkr: number;
      }) => Promise<{ ok: boolean; error?: string }>;
      deleteProduct: (payload: { id: number }) => Promise<{ ok: boolean; error?: string }>;
      listOrdersPaged: (payload: {
        page: number;
        pageSize: number;
        /** Omit or `'all'` for every status */
        status?: string;
        /** Substring match on customer name or order #; exact match on internal id */
        q?: string;
      }) => Promise<
        | {
            ok: true;
            orders: Array<{
              id: number;
              order_number: string;
              line_count: number;
              total: number;
              customer_name: string;
              customer_contact: string;
              customer_city: string;
              customer_address: string;
              note: string;
              status: string;
              created_at: string;
              placed_by_user_id: number | null;
              placed_by_username: string | null;
              delivery_charges: number;
              tracking_id: string;
              items: Array<{
                id: number;
                order_id: number;
                sort_order: number;
                product_id: number | null;
                product_name: string;
                qty: number;
                weight_g: number;
                unit_price: number;
                line_total: number;
              }>;
            }>;
            total: number;
            page: number;
            pageSize: number;
          }
        | { ok: false; error?: string }
      >;
      createOrder: (payload: {
        lines: Array<{
          productId: number;
          productName: string;
          qty: number;
          weightG: number;
          unitPricePkr: number;
        }>;
        customerName: string;
        customerContact: string;
        customerCity: string;
        customerAddress: string;
        note: string;
        status: string;
        deliveryCharges: number;
        trackingId?: string;
      }) => Promise<{ ok: true; order: unknown } | { ok: false; error?: string }>;
      updateOrder: (payload: {
        id: number;
        lines: Array<{
          productId: number;
          productName: string;
          qty: number;
          weightG: number;
          unitPricePkr: number;
        }>;
        customerName: string;
        customerContact: string;
        customerCity: string;
        customerAddress: string;
        note: string;
        status: string;
        deliveryCharges: number;
        trackingId?: string;
      }) => Promise<{ ok: true; order: unknown } | { ok: false; error?: string }>;
      patchOrderStatus: (payload: {
        id: number;
        status: string;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      deleteOrder: (payload: { id: number }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      listInvoicesPaged: (payload: {
        page: number;
        pageSize: number;
      }) => Promise<
        | {
            ok: true;
            invoices: Array<{
              id: number;
              invoice_number: string;
              amount: number;
              status: string;
              order_id: number | null;
              user_id: number | null;
              created_at: string;
              order_number: string | null;
              user_username: string | null;
            }>;
            total: number;
            page: number;
            pageSize: number;
          }
        | { ok: false; error?: string }
      >;
      getInvoiceForPrint: (payload: { id?: number; orderId?: number }) => Promise<
        | {
            ok: true;
            invoice: InvoiceForPrint;
          }
        | { ok: false; error?: string }
      >;
      deleteAllInvoices: () => Promise<{ ok: true } | { ok: false; error?: string }>;
      getUpdaterInfo: () => Promise<
        | { ok: true; isPackaged: boolean; currentVersion: string }
        | { ok: false; error?: string }
      >;
      checkAppUpdates: () => Promise<
        | {
            ok: true;
            mode: 'dev';
            currentVersion: string;
            message: string;
          }
        | {
            ok: true;
            mode: 'packaged';
            currentVersion: string;
            isUpdateAvailable: boolean;
            updateInfo: UpdaterUpdateInfo | null;
          }
        | { ok: false; error?: string; currentVersion?: string }
      >;
      quitAndInstallUpdate: () => Promise<{ ok: true } | { ok: false; error?: string }>;
      createBackup: (payload: {
        selection: {
          logins?: boolean;
          products?: boolean;
          orders?: boolean;
          invoices?: boolean;
        };
        deleteAfterBackup?: boolean;
      }) => Promise<
        | { ok: true; filePath: string; deletedAfterBackup?: boolean }
        | { ok: false; error?: string; cancelled?: boolean }
      >;
      validateBackupFile: () => Promise<
        | {
            ok: true;
            filePath: string;
            meta: {
              formatVersion: number;
              appName: string;
              createdAt: string;
              selection: {
                logins: boolean;
                products: boolean;
                orders: boolean;
                invoices: boolean;
              };
            };
            counts: Record<string, number>;
          }
        | { ok: false; error?: string; cancelled?: boolean }
      >;
      restoreBackup: (payload: { filePath: string }) => Promise<
        | {
            ok: true;
            restored: Record<string, number>;
            meta: {
              formatVersion: number;
              appName: string;
              createdAt: string;
              selection: {
                logins: boolean;
                products: boolean;
                orders: boolean;
                invoices: boolean;
              };
            };
          }
        | { ok: false; error?: string }
      >;
      onUpdaterEvent: (callback: (payload: UpdaterPushPayload) => void) => () => void;
    };
  }
}
