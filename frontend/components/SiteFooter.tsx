import Link from 'next/link';
import { mailto, SITE } from '@/lib/site';
import { LinkedInIcon, LogoMark, Mail } from './icons';

/** Footer with contact details. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink"><LogoMark size={20} />{SITE.name}</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            AASHTO 1993 flexible pavement design. Prepared by {SITE.author}, {SITE.authorRole}.
          </p>
        </div>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-subtle">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/calculator" className="inline-block py-1 text-muted transition hover:text-ink">Quick calculator</Link></li>
            <li><Link href="/register" className="inline-block py-1 text-muted transition hover:text-ink">Create free account</Link></li>
            <li><Link href="/login" className="inline-block py-1 text-muted transition hover:text-ink">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-subtle">Contact</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={mailto()} className="inline-flex min-h-7 items-center gap-2 break-all text-muted transition hover:text-ink">
                <Mail size={15} className="shrink-0" />{SITE.email}
              </a>
            </li>
            {SITE.linkedin && (
              <li>
                <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-7 items-center gap-2 text-muted transition hover:text-ink">
                  <LinkedInIcon size={15} className="shrink-0" />LinkedIn
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-[13px] text-subtle sm:px-6">
          © {SITE.copyrightYear} {SITE.author}. Results are for preliminary design; check them against the governing
          specification before use.
        </p>
      </div>
    </footer>
  );
}
