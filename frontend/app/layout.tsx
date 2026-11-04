import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { AppHeader } from '@/components/AppHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AuthProvider } from '@/lib/auth';
import { THEME_BOOT_SCRIPT } from '@/lib/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Pavement Design', template: '%s · Pavement Design' },
  description: 'AASHTO 1993 flexible pavement layer-by-layer design — prepared by Abenezer Tilahun',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

/** Shown while the header (which reads the URL) is still loading on dynamic pages. */
function HeaderFallback() {
  return <div className="h-16 border-b border-line/70" />;
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is set by the boot script before React hydrates, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-ink">
        {/* First stop for keyboard users: jump past the announcement strip and the header. */}
        <a href="#main"
          className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
          Skip to main content
        </a>
        <AuthProvider>
          {/* Reads the URL (hidden on the calculator and design pages), so it streams in like the header. */}
          <Suspense fallback={null}>
            <AnnouncementBar />
          </Suspense>
          <Suspense fallback={<HeaderFallback />}>
            <AppHeader />
          </Suspense>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 focus:outline-none sm:px-6 sm:py-10">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
