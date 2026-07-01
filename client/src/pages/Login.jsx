import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { AuthSubmitButton } from '../components/AuthSubmitButton';
import { PasswordField } from '../components/PasswordField';
import { SUBSCRIPTION_BLOCKED_ROUTE } from '../constants/routes';
import { notifyError } from '../lib/notify';
import { setUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY } from '../session';
import AuthWrapper from '../wrappers/AuthWrapper';

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const api = getApi();
      const res = await api.login({ username, password });
      if (res.ok === true) {
        localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        dispatch(setUser(res.user, res.token));
        navigate('/', { replace: true });
        return;
      }
      if (res.code === 'SUBSCRIPTION_BLOCKED') {
        navigate(SUBSCRIPTION_BLOCKED_ROUTE, {
          replace: true,
          state: {
            blockReason: res.blockReason || res.error,
            contactEmail: res.contactEmail,
            contactPhone: res.contactPhone,
          },
        });
        return;
      }
      notifyError(res.error || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthWrapper title="Login">
      <p className="login-sub">
        Sign in with your account. An internet connection is required. On a new installation,
        the app will prompt you to create the first administrator before you can sign in.
      </p>
      <form
        className={`login-form${submitting ? ' is-submitting' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="field">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. jane.doe"
            required
            disabled={submitting}
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={submitting}
        />
        <div className="link-row">
          <Link to="/forgot-password" className="link-text" tabIndex={submitting ? -1 : undefined}>
            Forgot password?
          </Link>
        </div>
        <AuthSubmitButton loading={submitting} loadingLabel="Signing in…">
          Sign in
        </AuthSubmitButton>
      </form>
    </AuthWrapper>
  );
}

export default Login;
