import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { PasswordField } from '../components/PasswordField';
import { notifyError } from '../lib/notify';
import { setUser } from '../redux/actions/user';
import { AUTH_TOKEN_KEY } from '../session';
import AuthWrapper from '../wrappers/AuthWrapper';

function FirstRunSetup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      notifyError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const api = getApi();
      const res = await api.completeSetup({
        username,
        password,
        name,
        email,
      });
      if (res.ok === true) {
        localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        dispatch(setUser(res.user, res.token));
        navigate('/', { replace: true });
        return;
      }
      notifyError(res.error || 'Setup failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthWrapper title="First-time setup">
      <p className="login-sub">
        Welcome. Create the administrator account for this installation. You can add
        more users later from the dashboard.
      </p>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. admin"
            required
          />
        </div>
        <div className="field">
          <span className="field-label">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Administrator"
          />
        </div>
        <div className="field">
          <span className="field-label">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          required
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repeat password"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create administrator'}
        </button>
      </form>
    </AuthWrapper>
  );
}

export default FirstRunSetup;
