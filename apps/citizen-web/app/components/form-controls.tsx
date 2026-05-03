'use client';

import type { ButtonHTMLAttributes, FieldsetHTMLAttributes, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  idleLabel: string;
  pendingLabel?: string;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  disabled,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      data-pending={pending ? 'true' : 'false'}
    >
      {pending ? pendingLabel ?? idleLabel : idleLabel}
    </button>
  );
}

type PendingFieldsetProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  children: ReactNode;
};

export function PendingFieldset({ children, style, ...props }: PendingFieldsetProps) {
  const { pending } = useFormStatus();

  return (
    <fieldset
      {...props}
      disabled={props.disabled || pending}
      aria-busy={pending}
      data-pending={pending ? 'true' : 'false'}
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0, ...style }}
    >
      {children}
    </fieldset>
  );
}
