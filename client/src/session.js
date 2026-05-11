export const AUTH_TOKEN_KEY = 'pos_auth_token';

export function getStoredAuthToken() {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(AUTH_TOKEN_KEY)
      : null;
  } catch {
    return null;
  }
}
