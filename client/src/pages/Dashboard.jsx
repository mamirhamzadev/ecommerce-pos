import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { APP_NAME } from '../appName';
import { FaIcon } from '../components/FaIcon';
import { ProfileMenu } from '../components/dashboard/ProfileMenu';
import { clearUser, setUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY, getStoredAuthToken } from '../session';

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
  settings: {
    title: 'Settings',
    subtitle: 'Backup, restore, and data management.',
  },
  profile: {
    title: 'Profile',
    subtitle: 'Your account details and preferences.',
  },
};

function sidebarLinkClass(isActive) {
  return isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link';
}

/**
 * @param {{ pathname: string }} loc
 */
function metaFromPathname({ pathname }) {
  if (pathname === '/' || pathname === '') {
    return MODULE_COPY.dashboard;
  }
  if (pathname.startsWith('/profile')) {
    return MODULE_COPY.profile;
  }
  if (pathname.startsWith('/settings')) {
    return MODULE_COPY.settings;
  }
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && MODULE_COPY[seg]) {
    return MODULE_COPY[seg];
  }
  return MODULE_COPY.dashboard;
}

export function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);
  const meta = metaFromPathname(location);

  const handleLogout = useCallback(async () => {
    const token = getStoredAuthToken();
    try {
      if (token) {
        await getApi().logout(token);
      }
    } catch {
      /* best-effort server logout */
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    dispatch(clearUser());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  const handleSessionRefresh = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      dispatch(clearUser());
      navigate('/login', { replace: true });
      return;
    }
    const res = await getApi().getSession(token);
    if (res?.ok === true && res.user) {
      dispatch(setUser(res.user, token));
      return;
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    dispatch(clearUser());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  if (!user) {
    return null;
  }

  const displayName =
    typeof user.name === 'string' && user.name.trim()
      ? user.name.trim()
      : user.username;

  const profileNavActive =
    location.pathname === '/profile' || location.pathname.startsWith('/profile/');
  const settingsNavActive =
    location.pathname === '/settings' || location.pathname.startsWith('/settings/');

  const navItems = [
    { to: '/', end: true, label: 'Dashboard', icon: 'gauge-high' },
    { to: '/products', end: false, label: 'Products', icon: 'box' },
    { to: '/orders', end: false, label: 'Orders', icon: 'cart-shopping' },
    { to: '/invoices', end: false, label: 'Invoices', icon: 'file-invoice' },
  ];

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
            {navItems.map(({ to, end, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => sidebarLinkClass(isActive)}
              >
                <span className="sidebar-link-icon">
                  <FaIcon icon={icon} className="sidebar-fa" />
                </span>
                {label}
              </NavLink>
            ))}
            <NavLink to="/settings" className={sidebarLinkClass(settingsNavActive)}>
              <span className="sidebar-link-icon">
                <FaIcon icon="gear" className="sidebar-fa" />
              </span>
              Settings
            </NavLink>
            <NavLink to="/profile" className={sidebarLinkClass(profileNavActive)}>
              <span className="sidebar-link-icon">
                <FaIcon icon="user" className="sidebar-fa" />
              </span>
              Profile
            </NavLink>
          </nav>
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-link sidebar-link-logout"
              onClick={handleLogout}
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
                onViewProfile={() => navigate('/profile')}
                onEditProfile={() => navigate('/profile/edit')}
                onLogout={handleLogout}
              />
            </div>
          </header>

          <main className="dashboard-content dashboard-content-wide">
            <Outlet context={{ user, onSessionRefresh: handleSessionRefresh }} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
