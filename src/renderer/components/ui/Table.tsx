import type { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import clsx from 'clsx';
import './ui.css';

export function TableContainer({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('ui-table-container', className)} {...props}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={clsx('ui-table', className)} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={clsx('ui-table-head', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={clsx('ui-table-body', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={clsx('ui-table-footer', className)} {...props}>
      {children}
    </tfoot>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
}

export function TableRow({ isSelected, className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={clsx(
        'ui-table-row',
        isSelected && 'ui-table-row-selected',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}
