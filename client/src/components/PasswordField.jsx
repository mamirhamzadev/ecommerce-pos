import { useId, useState } from 'react';
import { FaIcon } from './FaIcon';

/** @param {{ label: string; value: string; onChange: (v: string) => void; autoComplete?: string; placeholder?: string; minLength?: number; required?: boolean }} props */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder,
  minLength,
  required,
}) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="input-adorned">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="input-adorned-btn"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? (
            <FaIcon icon="eye-slash" className="fa-password-toggle" />
          ) : (
            <FaIcon icon="eye" className="fa-password-toggle" />
          )}
        </button>
      </div>
    </div>
  );
}
