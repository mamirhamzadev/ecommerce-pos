import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { FaIcon } from '../components/FaIcon';
import { notifyError } from '../lib/notify';
import { clearUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY } from '../session';
import { LOGIN_ROUTE } from '../constants/routes';
import AuthWrapper from '../wrappers/AuthWrapper';

function InternetRequired() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState(
    'Internet connection is required. Please connect to the internet and try again.',
  );

  async function handleRetry() {
    setRetrying(true);
    try {
      const api = getApi();
      const res = await api.checkSubscriptionStatus();
      if (res?.ok === false || res?.offline) {
        setMessage(
          res?.error ||
            'Internet connection is required. Please connect to the internet and try again.',
        );
        notifyError(message);
        return;
      }
      if (res?.blocked === true) {
        navigate('/subscription-blocked', { replace: true });
        return;
      }
      window.location.reload();
    } finally {
      setRetrying(false);
    }
  }

  async function handleSignOut() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const api = getApi();
    await api.logout(token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    dispatch(clearUser());
    navigate(LOGIN_ROUTE, { replace: true });
  }

  return (
    <AuthWrapper title="Internet required">
      <div className="subscription-blocked">
        <div className="subscription-blocked-icon" aria-hidden>
          <FaIcon icon="wifi" />
        </div>
        <p className="login-sub">{message}</p>
        <p className="login-sub">
          This app needs an active internet connection to verify your account and subscription
          before you can use the system.
        </p>
        <div className="form-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? 'Checking…' : 'Try again'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </AuthWrapper>
  );
}

export default InternetRequired;
