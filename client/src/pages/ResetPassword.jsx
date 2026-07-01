import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { AuthSubmitButton } from '../components/AuthSubmitButton';
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
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthWrapper title="Reset password">
      <p className="login-sub">
        Enter the verification code from your email and choose a new password.
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
            placeholder="Your username"
            required
            disabled={submitting}
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
            disabled={submitting}
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
          disabled={submitting}
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repeat password"
          minLength={6}
          required
          disabled={submitting}
        />
        <AuthSubmitButton loading={submitting} loadingLabel="Updating password…">
          Update password
        </AuthSubmitButton>
        <div className="link-row link-row-spaced">
          <Link to="/forgot-password" className="link-text" tabIndex={submitting ? -1 : undefined}>
            Request a new code
          </Link>
          <Link to="/login" className="link-text" tabIndex={submitting ? -1 : undefined}>
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ResetPassword;
