import { useEffect, useRef, useState } from 'react';
import { FaIcon } from '../FaIcon';

function initialsFromDisplay(label) {
  const parts = String(label).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return String(label).slice(0, 2).toUpperCase() || '?';
}

/**
 * @param {{
 *   displayName: string,
 *   onViewProfile: () => void,
 *   onEditProfile: () => void,
 *   onLogout: () => void,
 * }} props
 */
export function ProfileMenu({ displayName, onViewProfile, onEditProfile, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="profile-menu-root" ref={rootRef}>
      <button
        type="button"
        className="profile-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="profile-menu-avatar" aria-hidden="true">
          {initialsFromDisplay(displayName)}
        </span>
        <span className="profile-menu-chevron" aria-hidden="true">
          <FaIcon icon="chevron-down" className="fa-profile-chevron" />
        </span>
      </button>
      {open ? (
        <div className="profile-menu-dropdown" role="menu">
          <button
            type="button"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onViewProfile();
            }}
          >
            <FaIcon icon="user" className="profile-menu-item-icon" />
            View profile
          </button>
          <button
            type="button"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEditProfile();
            }}
          >
            <FaIcon icon="pen-to-square" className="profile-menu-item-icon" />
            Edit profile
          </button>
          <div className="profile-menu-sep" role="separator" />
          <button
            type="button"
            className="profile-menu-item profile-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <FaIcon icon="right-from-bracket" className="profile-menu-item-icon" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
