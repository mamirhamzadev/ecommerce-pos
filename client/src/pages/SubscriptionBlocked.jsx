import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { FaIcon } from '../components/FaIcon';
import { notifyError } from '../lib/notify';
import { clearUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY } from '../session';
import { DASHBOARD_ROUTE } from '../constants/routes';
import AuthWrapper from '../wrappers/AuthWrapper';

function SubscriptionBlocked() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state && typeof location.state === 'object' ? location.state : {};
  const [checking, setChecking] = useState(false);
  const [details, setDetails] = useState({
    blockReason:
      routeState.blockReason ||
      'Your subscription has expired. Please contact the administrator to renew your subscription.',
    contactEmail: routeState.contactEmail || '',
    contactPhone: routeState.contactPhone || '',
  });

  useEffect(() => {
    if (routeState.blockReason) return;
    loadStatus().catch(() => {});
  }, []);

  async function loadStatus() {
    const api = getApi();
    const res = await api.checkSubscriptionStatus();
    if (res?.blockReason) {
      setDetails({
        blockReason: res.blockReason,
        contactEmail: res.contactEmail || '',
        contactPhone: res.contactPhone || '',
      });
    }
    return res;
  }

  async function handleCheckAgain() {
    setChecking(true);
    try {
      const res = await loadStatus();
      if (res?.blocked !== true) {
        navigate(DASHBOARD_ROUTE, { replace: true });
        return;
      }
      notifyError('Your account is still blocked. Contact the administrator.');
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const api = getApi();
    await api.logout(token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    dispatch(clearUser());
    navigate('/login', { replace: true });
  }

  return (
    <AuthWrapper title="Subscription required">
      <div className="subscription-blocked">
        <div className="subscription-blocked-icon" aria-hidden>
          <FaIcon icon="lock" />
        </div>
        <p className="login-sub">{details.blockReason}</p>
        <p className="login-sub">
          Please contact the administrator to update your subscription and restore access.
        </p>
        {(details.contactEmail || details.contactPhone) && (
          <div className="subscription-contact card">
            <p className="field-label">Contact administrator</p>
            {details.contactEmail ? (
              <p>
                <a href={`mailto:${details.contactEmail}`} className="link-text">
                  {details.contactEmail}
                </a>
              </p>
            ) : null}
            {details.contactPhone ? <p>{details.contactPhone}</p> : null}
          </div>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCheckAgain}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Check again'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>
    </AuthWrapper>
  );
}

export default SubscriptionBlocked;
