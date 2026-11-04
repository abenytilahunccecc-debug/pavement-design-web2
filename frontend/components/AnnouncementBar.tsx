'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ANNOUNCEMENT_STORAGE_KEY as KEY } from '@/lib/theme-script';
import { ChevronRight, Close, LogoMark } from './icons';

const ITEMS = ['AASHTO 1993 structural number method', 'Layer-by-layer checks', 'Report-ready cross-sections', 'Excel & CSV export'];

const listeners = new Set<() => void>();
function readClosed() {
  try { return localStorage.getItem(KEY) === 'closed'; } catch { return false; }
}
function close() {
  try { localStorage.setItem(KEY, 'closed'); } catch { /* storage unavailable: closed for this page only */ }
  document.documentElement.dataset.announcement = 'closed';
  listeners.forEach((listener) => listener());
}

/** Pages where the strip would only distract from the work: the calculator and the design editors. */
const isWorkPage = (pathname: string) => pathname === '/calculator' || pathname.includes('/designs/');

/** Thin dark strip above the header. Once closed it stays closed (remembered in this browser). */
export function AnnouncementBar() {
  const pathname = usePathname();
  const closed = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    readClosed,
    () => false,
  );
  if (closed || isWorkPage(pathname)) return null;
  return (
    <div className="announcement-bar print-hidden border-b border-panel-line bg-panel text-on-panel">
      <div className="mx-auto flex h-10 max-w-7xl items-center gap-4 px-4 text-[13px] sm:px-6">
        <LogoMark size={16} className="shrink-0 text-on-panel" />
        <p className="shrink-0 font-medium">Free during beta</p>
        <ul className="no-scrollbar hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap text-on-panel-muted md:flex">
          {ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-5">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-on-panel-muted" />{item}
            </li>
          ))}
        </ul>
        <span className="flex-1 md:hidden" />
        <Link href="/calculator"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-on-panel px-3 text-xs font-semibold text-panel transition hover:opacity-90">
          Try the calculator <ChevronRight size={13} strokeWidth={2.4} />
        </Link>
        <button type="button" onClick={close} aria-label="Close announcement (it stays closed)"
          className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-panel-muted transition hover:bg-panel-line hover:text-on-panel">
          <Close size={16} />
        </button>
      </div>
    </div>
  );
}
