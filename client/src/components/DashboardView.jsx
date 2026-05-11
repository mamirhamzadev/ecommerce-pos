import { useState } from 'react';
import { mergePermissions } from '../permissions';
import { APP_NAME } from '../appName';
import { FaIcon } from './FaIcon';
import { DashboardHome } from './dashboard/DashboardHome';
import { ProfileMenu } from './dashboard/ProfileMenu';
import { ProfileSection } from './dashboard/ProfileSection';
import { ProductsModule } from './dashboard/ProductsModule';
import { OrdersModule } from './dashboard/OrdersModule';
import { PlaceholderPage } from './dashboard/PlaceholderPage';
import { UsersModule } from './dashboard/UsersModule';

function initialsFromDisplay(label) {
  const parts = String(label).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return String(label).slice(0, 2).toUpperCase() || '?';
}

const MODULE_COPY = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview, metrics, and recent activity.',
  },
  products: {
    title: 'Products',
    subtitle: 'Catalog, weight, and unit pricing.',
  },
  orders: {
    title: 'Orders',
    subtitle: 'Sales and checkout history.',
  },
  invoices: {
    title: 'Invoices',
    subtitle: 'Billing documents and exports.',
  },
  users: {
    title: 'Users',
    subtitle: 'Staff accounts and access control.',
  },
  profile: {
    title: 'Profile',
    subtitle: 'Your account details and preferences.',
  },
};

/**
 * @param {{
 *   user: { id: number, username: string, name?: string, email?: string, role: 'admin' | 'user', permissions?: Record<string, boolean> },
 *   onLogout: () => void,
 *   onSessionRefresh?: () => void | Promise<void>,
 * }} props
 */
export function DashboardView({ user, onLogout, onSessionRefresh }) {
  const isAdmin = user.role === 'admin';
  const permissions = mergePermissions(user.permissions);
  const [activeModule, setActiveModule] = useState(
    /** @type {'dashboard' | 'products' | 'orders' | 'invoices' | 'users' | 'profile'} */ (
      'dashboard'
    ),
  );
  const [profileIntent, setProfileIntent] = useState(
    /** @type {'view' | 'edit'} */ ('view'),
  );

  const displayName =
    typeof user.name === 'string' && user.name.trim()
      ? user.name.trim()
      : user.username;

  const meta = MODULE_COPY[activeModule];

  function goProfile(mode) {
    setProfileIntent(mode);
    setActiveModule('profile');
  }

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'gauge-high' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'orders', label: 'Orders', icon: 'cart-shopping' },
    { id: 'invoices', label: 'Invoices', icon: 'file-invoice' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'profile', label: 'Profile', icon: 'user' },
  ];

  const mainNav = isAdmin
    ? allNavItems
    : allNavItems.filter((item) => item.id !== 'users');

  return (
    <div className="shell shell-wide shell-app">
      <div className="app-layout">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden="true">
              {initialsFromDisplay(APP_NAME)}
            </span>
            <span className="sidebar-brand-text">{APP_NAME}</span>
          </div>
          <nav className="sidebar-nav">
            {mainNav.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={
                  activeModule === id ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
                }
                onClick={() => {
                  if (id === 'profile') {
                    goProfile('view');
                  } else {
                    setActiveModule(
                      /** @type {'dashboard' | 'products' | 'orders' | 'invoices' | 'users' | 'profile'} */ (
                        id
                      ),
                    );
                  }
                }}
              >
                <span className="sidebar-link-icon">
                  <FaIcon icon={icon} className="sidebar-fa" />
                </span>
                {label}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-link sidebar-link-logout"
              onClick={onLogout}
            >
              <span className="sidebar-link-icon">
                <FaIcon icon="right-from-bracket" className="sidebar-fa" />
              </span>
              Logout
            </button>
          </div>
        </aside>

        <div className="dashboard-main">
          <header className="topbar">
            <div className="topbar-titles">
              <h1 className="topbar-title">{meta.title}</h1>
              <p className="topbar-subtitle">{meta.subtitle}</p>
            </div>
            <div className="topbar-actions">
              <ProfileMenu
                displayName={displayName}
                onViewProfile={() => goProfile('view')}
                onEditProfile={() => goProfile('edit')}
                onLogout={onLogout}
              />
            </div>
          </header>

          <main className="dashboard-content dashboard-content-wide">
            {activeModule === 'dashboard' ? (
              <DashboardHome
                active={activeModule === 'dashboard'}
                isAdmin={isAdmin}
                onOpenModule={(id) =>
                  setActiveModule(
                    /** @type {'dashboard' | 'products' | 'orders' | 'invoices' | 'users' | 'profile'} */ (
                      id
                    ),
                  )
                }
              />
            ) : null}

            {activeModule === 'users' ? (
              isAdmin ? (
                <UsersModule
                  permissions={permissions}
                  onDirectoryChange={onSessionRefresh}
                />
              ) : (
                <section className="card module-card">
                  <p className="user-card-hint">
                    You need an <strong>admin</strong> role to manage users.
                  </p>
                </section>
              )
            ) : null}

            {activeModule === 'products' ? (
              <ProductsModule permissions={permissions} />
            ) : null}

            {activeModule === 'orders' ? (
              <OrdersModule permissions={permissions} />
            ) : null}

            {activeModule === 'invoices' ? (
              <PlaceholderPage
                title="Invoices"
                description="Generate and export invoices from completed orders in a future release."
              />
            ) : null}

            {activeModule === 'profile' ? (
              <ProfileSection
                key={profileIntent}
                user={user}
                intent={profileIntent}
                onSaved={async () => {
                  await onSessionRefresh?.();
                }}
              />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
