import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import './ui.css';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={clsx('ui-empty-state', className)} {...props}>
      {icon && <div className="ui-empty-state-icon">{icon}</div>}
      <h4 className="ui-empty-state-title">{title}</h4>
      {description && <p className="ui-empty-state-desc">{description}</p>}
      {action && <div className="ui-empty-state-action">{action}</div>}
    </div>
  );
}
