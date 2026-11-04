// Small reusable UI pieces (Tailwind + the design tokens in globals.css), so every page looks consistent.
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Alert, ArrowLeft, CheckCircle, XCircle } from './icons';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`shadow-card rounded-xl border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
        <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-accent" />
        {subtitle && <div className="mt-2 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "← Back" link above a page title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="mb-3 text-sm">
      <Link href={href} className="inline-flex items-center gap-1.5 text-muted transition hover:text-ink">
        <ArrowLeft size={14} />{children}
      </Link>
    </p>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'danger-solid' | 'light' | 'ghost-light';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

const BASE = 'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed';
const BUTTON_STYLES: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-40',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-primary/50 hover:bg-primary-soft disabled:opacity-50',
  danger: 'border border-line-strong bg-surface text-bad hover:bg-bad-soft',
  // The final "Delete" in a confirmation dialog.
  'danger-solid': 'bg-bad text-surface hover:opacity-90',
  // For use on photos / dark panels.
  light: 'bg-on-photo text-scrim hover:bg-on-photo/90',
  'ghost-light': 'border border-on-photo/40 bg-on-photo/10 text-on-photo backdrop-blur hover:bg-on-photo/20',
};

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} {...props} className={`${BASE} ${BUTTON_STYLES[variant]} ${className}`} />;
}

export function ButtonLink({ href, children, variant = 'primary', className = '' }:
  { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return <Link href={href} className={`${BASE} ${BUTTON_STYLES[variant]} ${className}`}>{children}</Link>;
}

/** Shows one or more error messages from the API, optionally with an action such as "Try again". */
export function ErrorBox({ messages, title = 'Something went wrong', action }:
  { messages: string[] | string | null; title?: string; action?: ReactNode }) {
  if (!messages || (Array.isArray(messages) && messages.length === 0)) return null;
  const list = Array.isArray(messages) ? messages : [messages];
  return (
    <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
      <Alert size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <ul className="mt-1 list-disc pl-5">{list.map((m) => <li key={m}>{m}</li>)}</ul>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-center text-sm text-muted" aria-live="polite">
      <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-3 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function VerdictBadge({ adequate }: { adequate: boolean }) {
  return adequate
    ? <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-2 py-0.5 text-xs font-semibold tracking-[0.04em] text-ok"><CheckCircle size={13} />ADEQUATE</span>
    : <span className="inline-flex items-center gap-1 rounded-md bg-bad-soft px-2 py-0.5 text-xs font-semibold tracking-[0.04em] text-bad"><XCircle size={13} />NOT ADEQUATE</span>;
}

export const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-subtle sm:text-sm transition hover:border-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]';

export const selectClass = `${inputClass} appearance-auto`;

export const linkClass = 'font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary dark:text-ink';
