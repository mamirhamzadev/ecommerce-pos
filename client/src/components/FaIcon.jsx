/**
 * Font Awesome 6 Free icon (solid by default).
 * @param {{
 *   icon: string,
 *   variant?: 'solid' | 'regular' | 'brands',
 *   className?: string,
 * } & import('react').HTMLAttributes<HTMLElement>} props
 */
export function FaIcon({ icon, variant = 'solid', className = '', ...rest }) {
  const prefix =
    variant === 'brands' ? 'fab' : variant === 'regular' ? 'far' : 'fas';
  const hasAria = Boolean(rest['aria-label']);
  return (
    <i
      className={`${prefix} fa-${icon} ${className}`.trim()}
      aria-hidden={hasAria ? undefined : true}
      {...rest}
    />
  );
}
