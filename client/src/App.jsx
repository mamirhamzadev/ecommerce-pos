import { useCallback, useEffect, useState } from 'react';
import { getApi } from './api';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { AUTH_TOKEN_KEY } from './session';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  const readToken = () => localStorage.getItem(AUTH_TOKEN_KEY);
  const saveToken = (t) => {
    if (t) localStorage.setItem(AUTH_TOKEN_KEY, t);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const logout = useCallback(async () => {
    const api = getApi();
    await api.logout(readToken());
    saveToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = readToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setBooting(false);
        }
        return;
      }
      const api = getApi();
      const session = await api.getSession(token);
      if (cancelled) return;
      if (!session.ok) {
        saveToken(null);
        setUser(null);
      } else {
        setUser(session.user);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoginSuccess = (token, u) => {
    saveToken(token);
    setUser(u);
  };

  const refreshSession = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const api = getApi();
    const session = await api.getSession(token);
    if (session.ok) {
      setUser(session.user);
    }
  }, []);

  if (booting) {
    return (
      <div className="boot">
        <div className="spinner" aria-hidden="true" />
        <p className="muted">Restoring session…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView onSuccess={onLoginSuccess} />;
  }

  return (
    <DashboardView
      user={user}
      onLogout={logout}
      onSessionRefresh={refreshSession}
    />
  );
}
