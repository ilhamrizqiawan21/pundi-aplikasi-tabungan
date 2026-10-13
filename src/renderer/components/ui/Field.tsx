import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import './ui.css';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
}

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={clsx('ui-field', className)} {...props}>
      {label && (
        <label
          htmlFor={htmlFor || (props as { id?: string }).id}
          className={clsx('ui-label', required && 'ui-label-required')}
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="ui-error-msg" role="alert">{error}</span>
      ) : hint ? (
        <span className="ui-hint">{hint}</span>
      ) : null}
    </div>
  );
}
