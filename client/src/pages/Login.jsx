import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { PasswordField } from '../components/PasswordField';
import { notifyError } from '../lib/notify';
import { setUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY } from '../session';
import AuthWrapper from '../wrappers/AuthWrapper';

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const api = getApi();
    const res = await api.login({ username, password });
    if (res.ok === true) {
      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      dispatch(setUser(res.user, res.token));
      navigate('/', { replace: true });
      return;
    }
    notifyError(res.error || 'Login failed.');
  }

  return (
    <AuthWrapper title="Login">
      <p className="login-sub">
        Sign in with credentials issued by your administrator. New accounts are not self‑service.
      </p>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. jane.doe"
            required
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
        <div className="link-row">
          <Link to="/forgot-password" className="link-text">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn btn-primary">
          Sign in
        </button>
      </form>
    </AuthWrapper>
  );
}

export default Login;
