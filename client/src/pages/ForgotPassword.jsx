import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { AuthSubmitButton } from '../components/AuthSubmitButton';
import { notifyError, notifyInfo, notifySuccess } from '../lib/notify';
import AuthWrapper from '../wrappers/AuthWrapper';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [forgotUsername, setForgotUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleForgotRequest(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const api = getApi();
      const res = await api.forgotRequest({ username: forgotUsername });
      if (res.ok !== true) {
        notifyError(res.error || 'Could not start reset.');
        return;
      }
      if (res.issued === true) {
        notifySuccess(
          'If this username exists, a reset code was sent to the email on file. It expires in 15 minutes.',
        );
        navigate('/reset-password', {
          state: { username: forgotUsername.trim() },
        });
        return;
      }
      notifyInfo(
        'No user with that username was found on this device. Check spelling or ask an administrator.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthWrapper title="Reset password">
      <form
        className={`login-form${submitting ? ' is-submitting' : ''}`}
        onSubmit={handleForgotRequest}
      >
        <div className="field">
          <span className="field-label">Username</span>
          <input
            type="text"
            value={forgotUsername}
            onChange={(e) => setForgotUsername(e.target.value)}
            autoComplete="username"
            placeholder="Your username"
            required
            disabled={submitting}
          />
        </div>
        <AuthSubmitButton loading={submitting} loadingLabel="Sending code…">
          Send reset code
        </AuthSubmitButton>
        <div className="link-row link-row-spaced">
          <Link to="/login" className="link-text" tabIndex={submitting ? -1 : undefined}>
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthWrapper>
  );
}
