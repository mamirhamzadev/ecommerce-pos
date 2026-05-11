import { useEffect, useState } from 'react';
import { getApi } from '../../api';
import { getStoredAuthToken } from '../../session';
import { PasswordField } from '../PasswordField';

/**
 * @param {{
 *   user: { id: number, username: string, name?: string, email?: string, role: string },
 *   intent: 'view' | 'edit',
 *   onSaved: () => void | Promise<void>,
 * }} props
 */
export function ProfileSection({ user, intent, onSaved }) {
  const [mode, setMode] = useState(intent === 'edit' ? 'edit' : 'view');
  const [name, setName] = useState(
    typeof user.name === 'string' ? user.name : '',
  );
  const [email, setEmail] = useState(
    typeof user.email === 'string' ? user.email : '',
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setMode(intent === 'edit' ? 'edit' : 'view');
  }, [intent, user.id]);

  useEffect(() => {
    setName(typeof user.name === 'string' ? user.name : '');
    setEmail(typeof user.email === 'string' ? user.email : '');
  }, [user.name, user.email, user.id]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await getApi().updateUser({
        id: user.id,
        name,
        email,
      });
      if (!res.ok) {
        setError(res.error || 'Could not save profile.');
        return;
      }
      setSuccess('Profile updated.');
      setMode('view');
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    const token = getStoredAuthToken();
    if (!token) {
      setPwdError('You are not signed in.');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match.');
      return;
    }
    setPwdSaving(true);
    try {
      const res = await getApi().changePassword({
        token,
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        setPwdError(res.error || 'Could not change password.');
        return;
      }
      setPwdSuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setPwdSaving(false);
    }
  }

  const displayName =
    typeof user.name === 'string' && user.name.trim()
      ? user.name.trim()
      : user.username;

  return (
    <section className="card module-card">
      <div className="profile-section-head">
        <h2 className="section-title section-title-sm">Profile</h2>
        {mode === 'view' ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setError('');
              setSuccess('');
              setMode('edit');
            }}
          >
            Edit
          </button>
        ) : null}
      </div>

      {mode === 'view' ? (
        <dl className="profile-dl">
          <div>
            <dt>Display name</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd className="cell-mono">@{user.username}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd className="cell-mono">
              {user.email && String(user.email).trim()
                ? user.email.trim()
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              <span
                className={
                  user.role === 'admin' ? 'badge badge-admin' : 'badge badge-user'
                }
              >
                {user.role}
              </span>
            </dd>
          </div>
        </dl>
      ) : (
        <form className="profile-edit-form" onSubmit={handleSave}>
          <p className="section-desc section-desc-tight">
            Update how you appear in the app and where password-reset messages are
            sent.
          </p>
          <div className="field">
            <span className="field-label">Display name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {error ? (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="alert alert-success" role="status">
              {success}
            </div>
          ) : null}
          <div className="form-footer profile-edit-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setError('');
                setSuccess('');
                setName(typeof user.name === 'string' ? user.name : '');
                setEmail(typeof user.email === 'string' ? user.email : '');
                setMode('view');
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      <div className="profile-password-block">
        <h3 className="section-title section-title-sm profile-password-heading">
          Change password
        </h3>
        <p className="section-desc section-desc-tight">
          Use your current password, then choose a new one (at least 6 characters).
        </p>
        <form className="profile-password-form" onSubmit={handleChangePassword}>
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <div className="field">
            <span className="field-label">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {pwdError ? (
            <div className="alert alert-error" role="alert">
              {pwdError}
            </div>
          ) : null}
          {pwdSuccess ? (
            <div className="alert alert-success" role="status">
              {pwdSuccess}
            </div>
          ) : null}
          <div className="form-footer profile-edit-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={pwdSaving}
            >
              {pwdSaving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
