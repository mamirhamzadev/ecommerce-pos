import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { getApi } from "../api";
import { publicRoutes } from "../constants/routes";
import Spinner from "../components/Spinner";
import { clearUser, setUser } from "../redux/actions/user";
import { AUTH_TOKEN_KEY } from "../session";

const PUBLIC_PATH_SET = new Set(publicRoutes.map((r) => r.path));

function isPublicPath(pathname) {
  return PUBLIC_PATH_SET.has(pathname);
}

function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);
  const [bootstrapping, setBootstrapping] = useState(true);

  const pathname = location.pathname;
  const onPublicRoute = isPublicPath(pathname);
  const showInitialSpinner = bootstrapping && !onPublicRoute;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        dispatch(clearUser());
        if (!cancelled) setBootstrapping(false);
        return;
      }

      try {
        const api = getApi();
        const res = await api.getSession(token);
        if (cancelled) return;
        if (res?.ok === true && res.user) {
          dispatch(setUser(res.user, token));
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          dispatch(clearUser());
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          dispatch(clearUser());
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, pathname]);

  if (showInitialSpinner) {
    return <Spinner label="Restoring session…" />;
  }

  if (!user && !onPublicRoute) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export default AuthProvider;
