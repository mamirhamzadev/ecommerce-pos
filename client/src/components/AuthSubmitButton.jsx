/**
 * Primary submit button for auth forms with inline loading spinner.
 */
export function AuthSubmitButton({
  loading = false,
  loadingLabel = 'Please wait…',
  children,
  className = '',
  disabled,
  ...rest
}) {
  return (
    <button
      type="submit"
      className={`btn btn-primary auth-submit-btn ${className}`.trim()}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="auth-submit-btn-inner">
          <span className="auth-submit-spinner" aria-hidden="true" />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
