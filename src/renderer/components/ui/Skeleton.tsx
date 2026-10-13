import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import './ui.css';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) {
  const customStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      className={clsx(
        'ui-skeleton',
        `ui-skeleton-${variant}`,
        className
      )}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

