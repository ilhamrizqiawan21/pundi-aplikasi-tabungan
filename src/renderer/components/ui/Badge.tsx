import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import './ui.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
}

export function Badge({
  variant = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={clsx('ui-badge', `ui-badge-${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
