export {};

type UserPermissions = {
  canCreateProduct: boolean;
  canEditProduct: boolean;
  canRemoveProduct: boolean;
  canCreateOrder: boolean;
  canDeleteOrder: boolean;
  canEditOrder: boolean;
  canChangeOrderStatus: boolean;
  canCreateUser: boolean;
  canEditUser: boolean;
  canDeleteUser: boolean;
};

type UserPublic = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  permissions?: UserPermissions;
};

type DashboardSnapshotSuccess = {
  ok: true;
  counts: {
    users: number;
    products: number;
    orders: number;
    invoices: number;
    ordersOpen: number;
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
  recentLogins: Array<{
    logged_in_at: string;
    user_id: number;
    username: string;
    name: string;
  }>;
  recentSignups: Array<{
    id: number;
    username: string;
    name: string;
    role: string;
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
          | 'users:list'
          | 'users:listPaged'
          | 'users:create'
          | 'users:sendAdminInviteCode'
          | 'users:update'
          | 'users:delete'
          | 'users:getPermissions'
          | 'users:updatePermissions'
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
          | 'orders:delete',
        payload?: unknown,
      ) => Promise<unknown>;
      login: (payload: { username: string; password: string }) => Promise<
        | { ok: true; token: string; user: UserPublic & { permissions: UserPermissions } }
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
        | { ok: true; user: UserPublic & { permissions: UserPermissions } }
        | { ok: false }
      >;
      listUsers: () => Promise<
        | {
            ok: true;
            users: Array<{
              id: number;
              username: string;
              name: string;
              email: string;
              role: string;
              created_at: string;
            }>;
          }
        | { ok: false; error?: string }
      >;
      listUsersPaged: (payload: {
        page: number;
        pageSize: number;
        /** Omit or `'all'` for every role */
        role?: string;
        /** Substring match on name, username, or email; exact match on internal id */
        q?: string;
      }) => Promise<
        | {
            ok: true;
            users: Array<{
              id: number;
              username: string;
              name: string;
              email: string;
              role: string;
              created_at: string;
            }>;
            total: number;
            page: number;
            pageSize: number;
          }
        | { ok: false; error?: string }
      >;
      createUser: (payload: {
        username: string;
        password: string;
        role: string;
        name?: string;
        email: string;
        /** Required when role is `admin` — code from the logged-in admin’s email */
        adminInviteCode?: string;
      }) => Promise<
        | { ok: true }
        | { ok: false; error?: string; needsAdminCode?: boolean }
      >;
      sendAdminInviteCode: () => Promise<{ ok: true } | { ok: false; error?: string }>;
      updateUser: (payload: {
        id: number;
        name?: string;
        email: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      deleteUser: (payload: { id: number }) => Promise<{ ok: boolean; error?: string }>;
      getUserPermissions: (payload: {
        id: number;
      }) => Promise<
        | {
            ok: true;
            username: string;
            role: string;
            permissions: UserPermissions;
          }
        | { ok: false; error?: string }
      >;
      updateUserPermissions: (payload: {
        id: number;
        permissions: Partial<UserPermissions>;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
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
      }) => Promise<
        | { ok: true; order: unknown; emailWarning?: string | null }
        | { ok: false; error?: string }
      >;
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
      }) => Promise<{ ok: true; order: unknown } | { ok: false; error?: string }>;
      patchOrderStatus: (payload: {
        id: number;
        status: string;
      }) => Promise<{ ok: true } | { ok: false; error?: string }>;
      deleteOrder: (payload: { id: number }) => Promise<{ ok: true } | { ok: false; error?: string }>;
    };
  }
}
