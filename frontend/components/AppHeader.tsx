'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { mailto, SITE } from '@/lib/site';
import { useIsClient } from '@/lib/use-is-client';
import { Close, HelpCircle, LogoMark, Menu } from './icons';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/calculator', label: 'Quick calculator' },
];

const pill = 'inline-flex h-10 items-center rounded-lg px-3.5 text-sm font-medium transition';
// Current page: navy underline sitting on the header's bottom border.
const activeBar = 'relative text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary';

export function AppHeader() {
  const { status: authStatus, user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // The server cannot know whether the browser holds a sign-in token, so the first render must be
  // the neutral "loading" header on both sides; the real links appear once mounted in the browser.
  // (Without this React reports a hydration mismatch and rebuilds the page, losing typed input.)
  const status = useIsClient() ? authStatus : 'loading';
  const close = () => setMenuOpen(false);

  const links = status === 'signed-in' ? NAV
    : status === 'signed-out' ? [{ href: '/calculator', label: 'Quick calculator' }] : [];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" onClick={close} className="flex shrink-0 items-center gap-2.5 text-ink">
          <LogoMark size={24} />
          <span className="border-l border-line pl-2.5 leading-tight">
            <span className="block text-[17px] font-semibold tracking-[-0.02em]">{SITE.name}</span>
            <span className="hidden text-[13px] text-muted lg:block">{SITE.tagline}</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                className={`${pill} ${active ? activeBar : 'text-muted hover:bg-raised hover:text-ink'}`}>
                {item.label}
              </Link>
            );
          })}
          {status === 'signed-in' && (
            <>
              <span className="max-w-40 truncate px-2 text-sm text-subtle" title={user?.email}>{user?.name || user?.email}</span>
              <button onClick={logout} className={`${pill} cursor-pointer text-muted hover:bg-raised hover:text-ink`}>Sign out</button>
            </>
          )}
          {status === 'signed-out' && (
            <>
              <Link href="/login" className={`${pill} text-muted hover:bg-raised hover:text-ink`}>Sign in</Link>
              <Link href="/register" className={`${pill} ml-1 bg-primary font-semibold text-on-primary shadow-card hover:bg-primary-hover`}>Create free account</Link>
            </>
          )}
          {/* Help lives in the header (and the phone menu) so it never covers the page content. */}
          <a href={mailto(`${SITE.name} — help`)} className={`${pill} gap-1.5 px-3 text-muted hover:bg-raised hover:text-ink`}>
            <HelpCircle size={16} />Help
          </a>
          <ThemeToggle className="ml-1" />
        </nav>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink transition hover:bg-raised">
            {menuOpen ? <Close size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden">
          <ul className="flex flex-col">
            {links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close}
                  className={`flex h-12 items-center border-b border-line text-[15px] ${pathname.startsWith(item.href) ? 'border-l-2 border-l-primary pl-3 font-semibold text-ink' : 'text-muted'}`}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={mailto(`${SITE.name} — help`)} className="flex h-12 items-center border-b border-line text-[15px] text-muted">Help &amp; contact</a>
            </li>
          </ul>
          {status === 'signed-in' && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="truncate text-sm text-subtle">{user?.name || user?.email}</span>
              <button onClick={() => { close(); logout(); }} className={`${pill} border border-line-strong text-ink`}>Sign out</button>
            </div>
          )}
          {status === 'signed-out' && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/login" onClick={close} className={`${pill} justify-center border border-line-strong text-ink`}>Sign in</Link>
              <Link href="/register" onClick={close} className={`${pill} justify-center bg-primary font-semibold text-on-primary`}>Create account</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
