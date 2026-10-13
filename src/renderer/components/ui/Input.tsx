import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import './ui.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  isError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ isError, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx('ui-input', isError && 'ui-input-error', className)}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  isError?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ isError, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={clsx('ui-select', isError && 'ui-select-error', className)}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  isError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ isError, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={clsx('ui-textarea', isError && 'ui-input-error', className)}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
