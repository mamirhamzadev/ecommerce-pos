import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { PasswordField } from '../components/PasswordField';
import { notifyError, notifySuccess } from '../lib/notify';
import AuthWrapper from '../wrappers/AuthWrapper';

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const usernameFromState =
    typeof location.state?.username === 'string' ? location.state.username : '';

  const [username, setUsername] = useState(usernameFromState);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const u = username.trim();
    const c = code.trim();
    if (!u) {
      notifyError('Username is required.');
      return;
    }
    if (newPassword.length < 6) {
      notifyError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notifyError('New password and confirmation do not match.');
      return;
    }

    const api = getApi();
    const res = await api.forgotComplete({
      username: u,
      code: c,
      newPassword,
    });
    if (res.ok === true) {
      notifySuccess('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
      return;
    }
    notifyError(res.error || 'Reset failed.');
  }

  return (
    <AuthWrapper title="Reset password">
      <p className="login-sub">
        Enter the verification code from your email and choose a new password.
      </p>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Your username"
            required
          />
        </div>
        <div className="field">
          <span className="field-label">Verification code</span>
          <input
            type="text"
            className="input-mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            placeholder="8-character code"
            required
          />
        </div>
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repeat password"
          minLength={6}
          required
        />
        <button type="submit" className="btn btn-primary">
          Update password
        </button>
        <div className="link-row link-row-spaced">
          <Link to="/forgot-password" className="link-text">
            Request a new code
          </Link>
          <Link to="/login" className="link-text">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ResetPassword;
