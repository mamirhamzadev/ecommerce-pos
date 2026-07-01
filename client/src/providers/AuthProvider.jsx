import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { getApi } from "../api";
import { publicRoutes } from "../constants/routes";
import Spinner from "../components/Spinner";
import { clearUser, setUser } from "../redux/actions/user";
import { AUTH_TOKEN_KEY } from "../session";

const PUBLIC_PATH_SET = new Set(publicRoutes.map((r) => r.path));
const SESSION_VALIDATE_TIMEOUT_MS = 15_000;

function isPublicPath(pathname) {
  return PUBLIC_PATH_SET.has(pathname);
}

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Session validation timed out."));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);
  const [bootstrapping, setBootstrapping] = useState(true);
  const validationEpochRef = useRef(0);

  const pathname = location.pathname;
  const onPublicRoute = isPublicPath(pathname);
  const showInitialSpinner = bootstrapping && !onPublicRoute;

  useEffect(() => {
    const epoch = ++validationEpochRef.current;
    let cancelled = false;

    (async () => {
      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
          dispatch(clearUser());
          return;
        }

        const api = getApi();
        const res = await withTimeout(api.getSession(token), SESSION_VALIDATE_TIMEOUT_MS);
        if (cancelled || epoch !== validationEpochRef.current) return;
        if (res?.ok === true && res.user) {
          dispatch(setUser(res.user, token));
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          dispatch(clearUser());
        }
      } catch {
        if (cancelled || epoch !== validationEpochRef.current) return;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        dispatch(clearUser());
      } finally {
        if (!cancelled && epoch === validationEpochRef.current) {
          setBootstrapping(false);
        }
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
