import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Botão só com ícone: obrigatório indicar `aria-label`. */
  iconOnly?: boolean;
}

function classes({ variant = 'secondary', size = 'md', block, iconOnly }: StyleProps, extra?: string) {
  return ['ui-btn', `ui-btn--${variant}`, size !== 'md' && `ui-btn--${size}`, block && 'ui-btn--block', iconOnly && 'ui-btn--icon', extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, iconOnly, icon, loading, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block, iconOnly }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="ui-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, StyleProps {
  icon?: ReactNode;
}

export function ButtonLink({ variant, size, block, iconOnly, icon, children, className, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block, iconOnly }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Link externo com aspeto de botão (abre noutro separador). */
export function ButtonAnchor({
  variant, size, block, icon, children, className, ...rest
}: StyleProps & { icon?: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classes({ variant, size, block }, className)} target="_blank" rel="noopener noreferrer" {...rest}>
      {icon}
      {children}
    </a>
  );
}
