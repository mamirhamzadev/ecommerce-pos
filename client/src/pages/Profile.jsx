import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../api';
import { PasswordField } from '../components/PasswordField';
import { notifyError, notifySuccess } from '../lib/notify';
import { setUser } from '../redux/actions/user';
import { getStoredAuthToken } from '../session';

function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => /** @type {any} */ (state)?.auth?.user);

  const intent = location.pathname.endsWith('/edit') ? 'edit' : 'view';

  const [mode, setMode] = useState(intent === 'edit' ? 'edit' : 'view');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setMode(intent === 'edit' ? 'edit' : 'view');
  }, [intent, user?.id]);

  useEffect(() => {
    if (!user) return;
    setUsername(typeof user.username === 'string' ? user.username : '');
    setName(typeof user.name === 'string' ? user.name : '');
    setEmail(typeof user.email === 'string' ? user.email : '');
  }, [user?.name, user?.email, user?.username, user?.id]);

  async function refreshUser() {
    const token = getStoredAuthToken();
    if (!token) return;
    const res = await getApi().getSession(token);
    if (res?.ok === true && res.user) {
      dispatch(setUser(res.user, token));
    }
  }

  function leaveEditMode() {
    setMode('view');
    if (location.pathname.endsWith('/edit')) {
      navigate('/profile', { replace: true });
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!user) return;
    const u = String(username).trim();
    if (!u) {
      notifyError('Username is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await getApi().updateUser({
        id: user.id,
        name,
        email,
        username: u,
      });
      if (!res.ok) {
        notifyError(res.error || 'Could not save profile.');
        return;
      }
      notifySuccess('Profile updated.');
      await refreshUser();
      leaveEditMode();
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    const token = getStoredAuthToken();
    if (!token) {
      notifyError('You are not signed in.');
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
    setPwdSaving(true);
    try {
      const res = await getApi().changePassword({
        token,
        currentPassword,
        newPassword,
      });
      if (res.ok !== true) {
        notifyError(res.error || 'Could not change password.');
        return;
      }
      notifySuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setPwdSaving(false);
    }
  }

  if (!user) {
    return null;
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
              navigate('/profile/edit');
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
        </dl>
      ) : (
        <form className="profile-edit-form" onSubmit={handleSave}>
          <p className="section-desc section-desc-tight">
            Update your sign-in name, how you appear in the app, and where password-reset messages
            are sent.
          </p>
          <div className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={80}
              autoComplete="username"
              required
            />
          </div>
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
          <div className="form-footer profile-edit-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setUsername(typeof user.username === 'string' ? user.username : '');
                setName(typeof user.name === 'string' ? user.name : '');
                setEmail(typeof user.email === 'string' ? user.email : '');
                leaveEditMode();
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

export { Profile as ProfileSection };
export default Profile;
