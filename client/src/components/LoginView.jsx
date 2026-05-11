import { useState } from 'react';
import { APP_NAME } from '../appName';
import { getApi } from '../api';
import { FaIcon } from './FaIcon';
import { PasswordField } from './PasswordField';

export function LoginView({ onSuccess }) {
  const [view, setView] = useState('login');
  const [forgotStep, setForgotStep] = useState(1);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNew, setForgotNew] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [issuedResetCode, setIssuedResetCode] = useState(null);

  function goLogin() {
    setView('login');
    setForgotStep(1);
    setForgotError('');
    setForgotInfo('');
    setForgotCode('');
    setForgotNew('');
    setForgotConfirm('');
    setIssuedResetCode(null);
  }

  function goForgot() {
    setView('forgot');
    setForgotStep(1);
    setForgotUsername(username.trim());
    setError('');
    setInfo('');
    setForgotError('');
    setForgotInfo('');
    setForgotCode('');
    setForgotNew('');
    setForgotConfirm('');
    setIssuedResetCode(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    const api = getApi();
    const res = await api.login({ username, password });
    if (res.ok === true) {
      onSuccess(res.token, res.user);
      return;
    }
    setError(res.error || 'Login failed.');
  }

  async function handleForgotRequest(e) {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');
    setIssuedResetCode(null);
    const api = getApi();
    const res = await api.forgotRequest({ username: forgotUsername });
    if (res.ok !== true) {
      setForgotError(res.error || 'Could not start reset.');
      return;
    }
    if (res.issued === true) {
      setIssuedResetCode(true);
      setForgotInfo(
        'This code expires in 15 minutes. You can change it below if needed, then set a new password.'
      );
      setForgotStep(2);
      return;
    }
    setForgotInfo(
      'No user with that username was found on this device. Ask an administrator to create your account or check the spelling.'
    );
  }

  async function handleForgotComplete(e) {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');
    if (forgotNew !== forgotConfirm) {
      setForgotError('New password and confirmation do not match.');
      return;
    }
    const api = getApi();
    const res = await api.forgotComplete({
      username: forgotUsername.trim(),
      code: forgotCode.trim(),
      newPassword: forgotNew,
    });
    if (res.ok === true) {
      setUsername(forgotUsername.trim());
      setPassword('');
      setInfo('Password updated. Sign in with your new password.');
      goLogin();
      return;
    }
    setForgotError(res.error || 'Reset failed.');
  }

  async function copyIssuedCode() {
    if (!issuedResetCode) return;
    try {
      await navigator.clipboard.writeText(issuedResetCode);
      setForgotInfo('Code copied to the clipboard.');
    } catch {
      setForgotError('Could not access the clipboard.');
    }
  }

  return (
    <div className="shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <FaIcon icon="store" className="login-logo-fa" />
          </div>
          <div>
            <p className="login-eyebrow">{APP_NAME}</p>
            <h1 className="login-title">
              {view === 'login' ? 'Welcome back' : 'Reset password'}
            </h1>
          </div>
        </div>

        {view === 'login' ? (
          <>
            <p className="login-sub">
              Sign in with credentials issued by your administrator. New accounts
              are not self‑service.
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
                <button type="button" className="link-text" onClick={goForgot}>
                  Forgot password?
                </button>
              </div>
              {info ? (
                <div className="alert alert-success" role="status">
                  {info}
                </div>
              ) : null}
              {error ? (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              ) : null}
              <button type="submit" className="btn btn-primary">
                Sign in
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="login-sub">
              {forgotStep === 1
                ? 'Enter your username. If it exists on this register, you will get a short code to set a new password.'
                : 'Enter the verification code (editable if you pasted a copy) and choose a new password.'}
            </p>

            {forgotStep === 1 ? (
              <form className="login-form" onSubmit={handleForgotRequest}>
                <div className="field">
                  <span className="field-label">Username</span>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Your username"
                    required
                  />
                </div>
                {forgotInfo ? (
                  <div className="alert alert-success" role="status">
                    {forgotInfo}
                  </div>
                ) : null}
                {forgotError ? (
                  <div className="alert alert-error" role="alert">
                    {forgotError}
                  </div>
                ) : null}
                <button type="submit" className="btn btn-primary">
                  Send reset code
                </button>
                <div className="link-row link-row-spaced">
                  <button type="button" className="link-text" onClick={goLogin}>
                    Back to sign in
                  </button>
                </div>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleForgotComplete}>

                <div className="field">
                  <span className="field-label">Verification code</span>
                  <input
                    type="text"
                    className="input-mono"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    autoComplete="one-time-code"
                    placeholder="8-character code"
                    required
                  />
                </div>
                <PasswordField
                  label="New password"
                  value={forgotNew}
                  onChange={setForgotNew}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
                <PasswordField
                  label="Confirm new password"
                  value={forgotConfirm}
                  onChange={setForgotConfirm}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  minLength={6}
                  required
                />
                {forgotInfo ? (
                  <div className="alert alert-success" role="status">
                    {forgotInfo}
                  </div>
                ) : null}
                {forgotError ? (
                  <div className="alert alert-error" role="alert">
                    {forgotError}
                  </div>
                ) : null}
                <button type="submit" className="btn btn-primary">
                  Update password
                </button>
                <div className="link-row link-row-spaced">
                  <button
                    type="button"
                    className="link-text"
                    onClick={() => {
                      setForgotStep(1);
                      setIssuedResetCode(null);
                      setForgotCode('');
                      setForgotNew('');
                      setForgotConfirm('');
                      setForgotError('');
                      setForgotInfo('');
                    }}
                  >
                    Request a new code
                  </button>
                  <button type="button" className="link-text" onClick={goLogin}>
                    Back to sign in
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
