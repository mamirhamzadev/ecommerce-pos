import DashboardHomePage from "../pages/DashboardHomePage";
import FirstRunSetup from "../pages/FirstRunSetup";
import ForgotPassword from "../pages/ForgotPassword";
import Invoices from "../pages/Invoices";
import Login from "../pages/Login";
import Orders from "../pages/Orders";
import Products from "../pages/Products";
import Profile from "../pages/Profile";
import ResetPassword from "../pages/ResetPassword";
import SubscriptionBlocked from "../pages/SubscriptionBlocked";
import InternetRequired from "../pages/InternetRequired";
import Settings from "../pages/Settings";

export const SETUP_ROUTE = "/setup";
export const LOGIN_ROUTE = "/login";
export const FORGOT_PASSWORD_ROUTE = "/forgot-password";
export const RESET_PASSWORD_ROUTE = "/reset-password";
export const SUBSCRIPTION_BLOCKED_ROUTE = "/subscription-blocked";
export const INTERNET_REQUIRED_ROUTE = "/internet-required";
export const DASHBOARD_ROUTE = "/";
export const PROFILE_ROUTE = "/profile";
export const PROFILE_EDIT_ROUTE = "/profile/edit";
export const PRODUCTS_ROUTE = "/products";
export const ORDERS_ROUTE = "/orders";
export const INVOICES_ROUTE = "/invoices";
export const SETTINGS_ROUTE = "/settings";

/** Auth pages (no app shell / sidebar). */
export const publicRoutes = [
  {
    path: SETUP_ROUTE,
    component: FirstRunSetup,
    title: "First-time setup",
  },
  {
    path: LOGIN_ROUTE,
    component: Login,
    title: "Login",
  },
  {
    path: FORGOT_PASSWORD_ROUTE,
    component: ForgotPassword,
    title: "Forgot Password",
  },
  {
    path: RESET_PASSWORD_ROUTE,
    component: ResetPassword,
    title: "Reset Password",
  },
];

/** Shown after login when remote subscription check reports blocked. */
export const gatedRoutes = [
  {
    path: SUBSCRIPTION_BLOCKED_ROUTE,
    component: SubscriptionBlocked,
    title: "Subscription required",
  },
  {
    path: INTERNET_REQUIRED_ROUTE,
    component: InternetRequired,
    title: "Internet required",
  },
];

/** Nested under Dashboard layout (sidebar + topbar). */
export const shellRoutes = [
  {
    index: true,
    component: DashboardHomePage,
    title: "Dashboard",
  },
  {
    path: "products",
    component: Products,
    title: "Products",
  },
  {
    path: "orders",
    component: Orders,
    title: "Orders",
  },
  {
    path: "invoices",
    component: Invoices,
    title: "Invoices",
  },
  {
    path: "settings",
    component: Settings,
    title: "Settings",
  },
  {
    path: "profile/edit",
    component: Profile,
    title: "Profile",
  },
  {
    path: "profile",
    component: Profile,
    title: "Profile",
  },
];

/** @deprecated Use publicRoutes / shellRoutes. Kept for AuthProvider path checks. */
export default [
  ...publicRoutes.map((r) => ({ ...r, isProtected: false })),
  { path: DASHBOARD_ROUTE, isProtected: true },
  { path: PRODUCTS_ROUTE, isProtected: true },
  { path: ORDERS_ROUTE, isProtected: true },
  { path: INVOICES_ROUTE, isProtected: true },
  { path: SETTINGS_ROUTE, isProtected: true },
  { path: PROFILE_EDIT_ROUTE, isProtected: true },
  { path: PROFILE_ROUTE, isProtected: true },
];
