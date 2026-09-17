import type { ComponentProps, ReactNode } from 'react';

function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx('rounded-xl bg-surface-raised border border-white/5 p-5', className)}
    >
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-muted/60 outline-none focus:border-accent/60',
        'disabled:opacity-50',
        className,
      )}
    />
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-surface font-medium hover:brightness-110',
    ghost: 'border border-white/10 text-ink hover:bg-white/5',
    danger: 'text-warn hover:bg-warn/10',
  }[variant];

  return (
    <button
      {...props}
      className={cx(
        'rounded-lg px-3.5 py-2 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed',
        styles,
        className,
      )}
    />
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
}) {
  const styles = {
    error: 'border-warn/40 text-warn',
    info: 'border-white/10 text-ink-muted',
    success: 'border-accent/40 text-accent',
  }[tone];

  return (
    <p className={cx('rounded-lg border px-3 py-2 text-sm', styles)}>{children}</p>
  );
}
