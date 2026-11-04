'use client';
// Confirmation dialog, "⋯" action menu and the undo bar used when deleting.
import Link from 'next/link';
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { More } from './icons';
import { Button } from './ui';

/**
 * Modal confirmation (native <dialog>: focus stays inside, Esc and a click outside cancel).
 * Focus starts on Cancel, so pressing Enter by accident never deletes anything.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }:
  { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onCancel}
      onClick={(e) => { if (e.target === ref.current) onCancel(); }}
      className="shadow-float m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-scrim/50">
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
          <div className="mt-2 text-sm text-muted">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={onCancel}>Cancel</Button>
            <Button variant="danger-solid" onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
}

/**
 * "⋯" button with a small menu. The menu is positioned on screen (not inside the table), so a scrolling
 * table can never cut it off. Arrow keys move between items; Esc or a click outside closes it.
 */
export function ActionMenu({ label, items, text }: { label: string; items: MenuItem[]; text?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    menuRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close();
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); buttonRef.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const list = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
      const i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keys);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keys);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const itemClass = (danger?: boolean) =>
    `flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition hover:bg-raised focus:bg-raised focus:outline-none ${danger ? 'text-bad' : 'text-ink'}`;

  return (
    <>
      <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full text-muted transition hover:bg-raised hover:text-ink ${text ? 'border border-line-strong bg-surface px-4 text-sm font-medium text-ink' : ''}`}>
        <More size={18} />{text}
      </button>
      {open && position && (
        <div ref={menuRef} role="menu" aria-label={label} style={{ position: 'fixed', top: position.top, right: position.right }}
          className="shadow-float z-50 min-w-48 rounded-xl border border-line bg-surface p-1">
          {items.map((item) => item.href ? (
            <Link key={item.label} href={item.href} role="menuitem" className={itemClass(item.danger)} onClick={() => setOpen(false)}>
              {item.icon}{item.label}
            </Link>
          ) : (
            <button key={item.label} type="button" role="menuitem" className={itemClass(item.danger)}
              onClick={() => { setOpen(false); item.onSelect?.(); }}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Bottom bar after a delete: "… deleted · Undo (5 s)". Announced politely; it never takes the focus. */
export function UndoBar({ message, seconds, onUndo }: { message: string; seconds: number; onUndo: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);
  return (
    <div className="print-hidden fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div className="shadow-float flex w-full max-w-md items-center gap-3 rounded-2xl border border-panel-line bg-panel px-4 py-3 text-on-panel">
        <p className="min-w-0 flex-1 text-sm">{message}</p>
        <button type="button" onClick={onUndo}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-on-panel px-4 text-sm font-semibold text-panel transition hover:opacity-90">
          Undo <span className="num ml-1.5 text-[13px] font-normal opacity-70">{left}s</span>
        </button>
      </div>
    </div>
  );
}
