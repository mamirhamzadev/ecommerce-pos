import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '../../api';
import { mergePermissions } from '../../permissions';
import { RelativeTime } from '../../RelativeTime';
import { FaIcon } from '../FaIcon';
import { PasswordField } from '../PasswordField';

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

const USER_PERM_SECTIONS = [
  {
    title: 'Products',
    items: [
      ['canCreateProduct', 'Can create product'],
      ['canEditProduct', 'Can edit product'],
      ['canRemoveProduct', 'Can remove product'],
    ],
  },
  {
    title: 'Orders',
    items: [
      ['canCreateOrder', 'Can create order'],
      ['canDeleteOrder', 'Can delete order'],
      ['canEditOrder', 'Can edit order'],
      ['canChangeOrderStatus', 'Can change status for order'],
    ],
  },
  {
    title: 'Users',
    items: [
      ['canCreateUser', 'Can create user'],
      ['canEditUser', 'Can edit user'],
      ['canDeleteUser', 'Can delete user'],
    ],
  },
];

function RoleBadge({ role }) {
  const cls = role === 'admin' ? 'badge badge-admin' : 'badge badge-user';
  return <span className={cls}>{role}</span>;
}

/**
 * @param {{
 *   onDirectoryChange?: () => void | Promise<void>,
 *   permissions: ReturnType<typeof mergePermissions>,
 * }} props
 */
export function UsersModule({ onDirectoryChange, permissions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterRole, setFilterRole] = useState('all');
  const [filterSearchInput, setFilterSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const lastSearchCommittedRef = useRef('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('user');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminInviteCode, setAdminInviteCode] = useState('');
  const [adminCodeHint, setAdminCodeHint] = useState('');
  const [sendingAdminCode, setSendingAdminCode] = useState(false);

  const [permTargetUser, setPermTargetUser] = useState(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permReady, setPermReady] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permForm, setPermForm] = useState(() => mergePermissions({}));
  const [permError, setPermError] = useState('');

  const closePermModal = useCallback(() => {
    setPermTargetUser(null);
    setPermLoading(false);
    setPermReady(false);
    setPermSaving(false);
    setPermError('');
    setPermForm(mergePermissions({}));
  }, []);

  const loadUsers = useCallback(
    async (p, ps) => {
      setListError('');
      setLoading(true);
      const res = await getApi().listUsersPaged({
        page: p,
        pageSize: ps,
        role: filterRole,
        q: filterSearch,
      });
      setLoading(false);
      if (res.ok === true) {
        setUsers(res.users);
        setTotal(res.total);
        if (res.page !== p) {
          setPage(res.page);
        }
        return;
      }
      setListError(res.error || 'Could not load users.');
    },
    [filterRole, filterSearch],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const next = filterSearchInput.trim();
      if (lastSearchCommittedRef.current !== next) {
        lastSearchCommittedRef.current = next;
        setPage(1);
      }
      setFilterSearch(next);
    }, 350);
    return () => clearTimeout(t);
  }, [filterSearchInput]);

  useEffect(() => {
    loadUsers(page, pageSize);
  }, [page, pageSize, loadUsers]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        closeModal();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!permTargetUser) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        closePermModal();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [permTargetUser, closePermModal]);

  async function notifyDirectoryChange() {
    await onDirectoryChange?.();
  }

  async function openUserPermissions(u) {
    setPermTargetUser(u);
    setPermReady(false);
    setPermLoading(true);
    setPermError('');
    const res = await getApi().getUserPermissions({ id: u.id });
    setPermLoading(false);
    if (res.ok !== true) {
      setPermError(res.error || 'Could not load settings.');
      return;
    }
    setPermForm(mergePermissions(res.permissions));
    setPermReady(true);
  }

  async function saveUserPermissions() {
    if (!permTargetUser) return;
    setPermSaving(true);
    setPermError('');
    const res = await getApi().updateUserPermissions({
      id: permTargetUser.id,
      permissions: permForm,
    });
    setPermSaving(false);
    if (res.ok !== true) {
      setPermError(res.error || 'Could not save settings.');
      return;
    }
    closePermModal();
    await loadUsers(page, pageSize);
    await onDirectoryChange?.();
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormUsername('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setFormError('');
    setAdminInviteCode('');
    setAdminCodeHint('');
    setSendingAdminCode(false);
  }

  function openCreate() {
    if (!permissions.canCreateUser) return;
    setEditingId(null);
    setFormUsername('');
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setFormError('');
    setAdminInviteCode('');
    setAdminCodeHint('');
    setModalOpen(true);
  }

  function openEdit(u) {
    if (!permissions.canEditUser) return;
    setEditingId(u.id);
    setFormUsername(u.username || '');
    setFormName(typeof u.name === 'string' ? u.name : '');
    setFormEmail(typeof u.email === 'string' ? u.email : '');
    setFormPassword('');
    setFormRole(u.role === 'admin' ? 'admin' : 'user');
    setFormError('');
    setAdminInviteCode('');
    setAdminCodeHint('');
    setModalOpen(true);
  }

  async function handleSendAdminInviteCode() {
    setFormError('');
    setAdminCodeHint('');
    setSendingAdminCode(true);
    try {
      const res = await getApi().sendAdminInviteCode();
      if (!res.ok) {
        setFormError(res.error || 'Could not send verification email.');
        return;
      }
      setAdminCodeHint('Check your email for the verification code (expires in 15 minutes).');
    } finally {
      setSendingAdminCode(false);
    }
  }

  async function handleModalSubmit(e) {
    e.preventDefault();
    setFormError('');
    const api = getApi();

    if (editingId) {
      setSaving(true);
      const res = await api.updateUser({
        id: editingId,
        name: formName.trim(),
        email: formEmail.trim(),
      });
      setSaving(false);
      if (res.ok !== true) {
        setFormError(res.error || 'Update failed.');
        return;
      }
      closeModal();
      await loadUsers(page, pageSize);
      await notifyDirectoryChange();
      return;
    }

    setSaving(true);
    const res = await api.createUser({
      username: formUsername.trim(),
      name: formName.trim(),
      email: formEmail.trim(),
      password: formPassword,
      role: formRole,
      ...(formRole === 'admin'
        ? { adminInviteCode: adminInviteCode.trim() }
        : {}),
    });
    setSaving(false);
    if (res.ok !== true) {
      setFormError(res.error || 'Could not create user.');
      return;
    }
    const listPage = 1;
    closeModal();
    setPage(1);
    await loadUsers(listPage, pageSize);
    await notifyDirectoryChange();
  }

  async function handleDelete(u) {
    if (!permissions.canDeleteUser) return;
    if (!window.confirm(`Remove user "${u.username}"?`)) return;
    setListError('');
    const api = getApi();
    const out = await api.deleteUser({ id: u.id });
    if (!out.ok) {
      setListError(out.error || 'Delete failed.');
      return;
    }
    await loadUsers(page, pageSize);
    await notifyDirectoryChange();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const hasActiveFilters =
    filterRole !== 'all' || filterSearchInput.trim() !== '';

  function clearUserFilters() {
    setFilterRole('all');
    setFilterSearchInput('');
    setFilterSearch('');
    lastSearchCommittedRef.current = '';
    setPage(1);
  }

  return (
    <div className="products-page users-page">
      <div className="products-page-header">
        <div>
          <h2 className="section-title">Users</h2>
          <p className="section-desc section-desc-tight">
            Manage staff accounts, roles, and contact details. Use + to add a user;
            password reset email needs a valid address.
          </p>
        </div>
        {permissions.canCreateUser ? (
          <button type="button" className="fab-plus" aria-label="New user" onClick={openCreate}>
            <FaIcon icon="plus" className="fab-plus-fa" />
          </button>
        ) : null}
      </div>

      {listError ? (
        <div className="alert alert-error" role="alert">
          {listError}
        </div>
      ) : null}

      <div className="card">
        <div className="users-table-head">
          <h3 className="section-title section-title-sm">Directory</h3>
          <div className="users-page-size">
            <span className="field-label">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              aria-label="Rows per page"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <p className="section-desc section-desc-tight">
          {total} account{total === 1 ? '' : 's'}
          {hasActiveFilters ? ' match your filters.' : ' total.'}
        </p>

        <div className="orders-filter-bar">
          <div className="orders-filter-field">
            <span className="field-label" id="users-filter-role-label">
              Role
            </span>
            <select
              id="users-filter-role"
              className="orders-filter-select"
              aria-labelledby="users-filter-role-label"
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
            >
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="orders-filter-field orders-filter-grow">
            <span className="field-label" id="users-filter-q-label">
              Search
            </span>
            <input
              id="users-filter-q"
              type="search"
              className="orders-filter-search"
              placeholder="Name, username, email, or ID"
              aria-labelledby="users-filter-q-label"
              autoComplete="off"
              value={filterSearchInput}
              onChange={(e) => setFilterSearchInput(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearUserFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          {loading ? (
            <p className="empty-hint">Loading…</p>
          ) : users.length === 0 ? (
            <p className="empty-hint">
              {hasActiveFilters
                ? 'No accounts match these filters.'
                : 'No other users to show. Your own account is omitted from this list.'}
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th className="table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="table-strong">
                        {u.name && String(u.name).trim() ? (
                          u.name.trim()
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                    </td>
                    <td className="cell-mono">{u.username}</td>
                    <td className="cell-mono">
                      {u.email && String(u.email).trim() ? (
                        u.email.trim()
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="cell-mono">
                      <RelativeTime value={u.created_at} />
                    </td>
                    <td className="table-actions">
                      {permissions.canEditUser || permissions.canDeleteUser ? (
                        <div
                          className="table-action-group"
                          role="group"
                          aria-label="User actions"
                        >
                          {permissions.canEditUser ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm table-action-icon-btn"
                              aria-label={`Access settings for ${u.username}`}
                              title="Access settings"
                              onClick={() => openUserPermissions(u)}
                              disabled={modalOpen || Boolean(permTargetUser)}
                            >
                              <FaIcon icon="gear" />
                            </button>
                          ) : null}
                          {permissions.canEditUser ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm table-action-icon-btn"
                              aria-label={`Edit user ${u.username}`}
                              onClick={() => openEdit(u)}
                              disabled={modalOpen || Boolean(permTargetUser)}
                            >
                              <FaIcon icon="pen-to-square" />
                            </button>
                          ) : null}
                          {permissions.canDeleteUser ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm table-action-icon-btn"
                              aria-label={`Remove user ${u.username}`}
                              onClick={() => handleDelete(u)}
                              disabled={Boolean(permTargetUser)}
                            >
                              <FaIcon icon="trash-can" />
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (totalPages > 1 || total > pageSize) ? (
          <div className="pagination-bar">
            <span className="pagination-meta">
              Page {page} of {totalPages}
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="user-modal-title" className="modal-title">
              {editingId ? 'Edit user' : 'New user'}
            </h2>
            <form className="modal-form" onSubmit={handleModalSubmit}>
              {editingId ? (
                <p className="section-desc section-desc-tight">
                  Username <span className="cell-mono">{formUsername}</span> (read-only).
                </p>
              ) : null}

              <div className="field">
                <span className="field-label">Display name</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  maxLength={120}
                />
              </div>
              <div className="field">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jane@store.com"
                  required
                  autoComplete="off"
                />
              </div>

              {!editingId ? (
                <>
                  <div className="field">
                    <span className="field-label">Username</span>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="new.staff"
                      required
                      minLength={2}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <span className="field-label">Role</span>
                    <select
                      value={formRole}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormRole(v);
                        if (v === 'user') {
                          setAdminInviteCode('');
                          setAdminCodeHint('');
                        }
                      }}
                      required
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {formRole === 'admin' ? (
                    <div className="admin-invite-block">
                      <p className="section-desc section-desc-tight">
                        New <strong>admin</strong> accounts need a one-time code sent to{' '}
                        <strong>your</strong> email (the account you are logged in with). Regular{' '}
                        <strong>user</strong> accounts do not need a code.
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm admin-invite-send"
                        disabled={sendingAdminCode || saving}
                        onClick={handleSendAdminInviteCode}
                      >
                        {sendingAdminCode ? 'Sending…' : 'Send code to my email'}
                      </button>
                      {adminCodeHint ? (
                        <p className="section-desc section-desc-tight admin-invite-hint" role="status">
                          {adminCodeHint}
                        </p>
                      ) : null}
                      <div className="field">
                        <span className="field-label" id="admin-invite-code-label">
                          Verification code
                        </span>
                        <input
                          type="text"
                          className="admin-invite-code-input cell-mono"
                          value={adminInviteCode}
                          onChange={(e) => setAdminInviteCode(e.target.value)}
                          placeholder="From your email"
                          autoComplete="one-time-code"
                          spellCheck={false}
                          aria-labelledby="admin-invite-code-label"
                        />
                      </div>
                    </div>
                  ) : null}
                  <PasswordField
                    label="Temporary password"
                    value={formPassword}
                    onChange={setFormPassword}
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    minLength={6}
                    required
                  />
                </>
              ) : null}

              {formError ? (
                <div className="alert alert-error" role="alert">
                  {formError}
                </div>
              ) : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {permTargetUser ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePermModal();
          }}
        >
          <div
            className="modal-dialog modal-dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-perm-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="user-perm-modal-title" className="modal-title">
              Access for <span className="cell-mono">{permTargetUser.username}</span>
            </h2>
            <p className="section-desc section-desc-tight">
              Choose what this account can do. Changes apply on the next action; your own session
              refreshes when you save your account.
            </p>
            {permLoading ? <p className="empty-hint">Loading…</p> : null}
            {!permLoading && permError ? (
              <div className="alert alert-error" role="alert">
                {permError}
              </div>
            ) : null}
            {permReady ? (
              <div className="perm-modal-body">
                {USER_PERM_SECTIONS.map((sec) => (
                  <section key={sec.title} className="perm-modal-section">
                    <h3 className="modal-section-label">{sec.title}</h3>
                    {sec.items.map(([key, label]) => (
                      <label key={key} className="perm-check-row">
                        <span>{label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(permForm[key])}
                          onChange={(e) =>
                            setPermForm((f) => ({ ...f, [key]: e.target.checked }))
                          }
                          disabled={permSaving}
                        />
                      </label>
                    ))}
                  </section>
                ))}
              </div>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closePermModal}
                disabled={permSaving}
              >
                Close
              </button>
              {permReady ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveUserPermissions}
                  disabled={permSaving}
                >
                  {permSaving ? 'Saving…' : 'Save access'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
