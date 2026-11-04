'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ArrowRight, Calculator, CheckCircle, ChevronRight, Folder, Layers, LinkedInIcon, LogoMark, Mail, Table } from '@/components/icons';
import { LayerStack, TextureFill } from '@/components/design/LayerStack';
import { ResponsivePicture } from '@/components/ResponsivePicture';
import { ButtonLink } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { mailto, SITE } from '@/lib/site';

/** Landing page: signed-in users go straight to their dashboard. */
export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'signed-in') router.replace('/dashboard');
  }, [status, router]);

  return (
    <div className="-mt-2 sm:-mt-4">
      {/* ---------- Hero: headline left, dark photo card right ---------- */}
      <section className="grid items-center gap-10 py-6 lg:min-h-[560px] lg:grid-cols-[1fr_1.12fr] lg:gap-14 lg:py-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />Free during beta
          </p>
          <h1 className="mt-5 text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">
            Pavement design,<br />layer by layer.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
            AASHTO 1993 flexible pavement design. Find the required structural number for every layer, choose layer
            thicknesses, check each layer and the whole pavement, and keep your designs organised by project.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/calculator" className="h-12 px-6 text-[15px]">
              Try the calculator <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/register" variant="secondary" className="h-12 px-6 text-[15px]">Create a free account</ButtonLink>
          </div>
          <p className="mt-4 text-sm text-muted">
            No account needed for the calculator. Already registered?{' '}
            <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Sign in</Link>
          </p>
        </div>

        <HeroCard />
      </section>

      {/* ---------- Card rail ---------- */}
      <section aria-label="What you can do" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <RailTile href="/calculator" title="Quick calculator" className="col-span-2 lg:col-span-1"
          background={<ResponsivePicture name="paving-rollers" decorative sizes="(min-width: 1024px) 20vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover" />}
          icon={<Calculator size={18} />} />
        <RailTile href="/register" title="Projects & dashboard" icon={<Folder size={18} />}
          background={<div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_0%,var(--panel-line)_0%,var(--panel)_60%)]" />} />
        <RailTile href="#layer-checks" title="Layer-by-layer checks" icon={<CheckCircle size={18} />}
          background={<TextureFill material="base" className="absolute inset-0 h-full w-full" />} />
        <RailTile href="/calculator#cross-section" title="Report-ready cross-sections" icon={<Layers size={18} />}
          background={<div className="absolute inset-0 flex items-center justify-center bg-panel p-4">
            <LayerStack className="h-[92%] w-auto" />
          </div>} />
        <RailTile href="#exports" title="Excel & CSV export" icon={<Table size={18} />}
          background={<div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_100%,color-mix(in_srgb,var(--accent)_32%,var(--panel))_0%,var(--panel)_65%)]" />} />
      </section>

      {/* ---------- What it does ---------- */}
      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        {[
          ['layers', '01', '3, 4 or 5 layers', 'AC course, optional DBM, base, subbase and optional capping layer.'],
          ['layer-checks', '02', 'Checked layer by layer', 'Each layer must reach the SN required on the layer below it.'],
          ['exports', '03', 'Projects & exports', 'Save designs per project, see a dashboard, export to CSV or Excel.'],
        ].map(([id, number, title, text]) => (
          <div key={id} id={id} className="shadow-card scroll-mt-24 rounded-2xl border border-line bg-surface p-6 target:ring-2 target:ring-accent">
            <p className="num text-xs text-subtle">{number}</p>
            <p className="mt-6 text-lg font-semibold tracking-[-0.02em] text-ink">{title}</p>
            <p className="mt-1.5 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>

      {/* ---------- About / contact banner ---------- */}
      <section className="relative mt-20 overflow-hidden rounded-3xl bg-panel text-on-photo">
        <ResponsivePicture name="paving-rollers" sizes="(min-width: 1280px) 1232px, 100vw"
          className="absolute inset-0 h-full w-full object-cover" />
        {/* Overlay keeps the text readable over any part of the photo. */}
        <div className="absolute inset-0 bg-gradient-to-r from-scrim/90 via-scrim/70 to-scrim/25" />
        <div className="relative max-w-xl px-6 py-14 sm:px-12 sm:py-20">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-photo/65">About</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Built by a practising pavement engineer.</h2>
          <p className="mt-4 text-on-photo/80">
            Prepared by {SITE.author}, {SITE.authorRole}. Questions, feedback or a feature you need for your next
            project? Get in touch.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={mailto(`${SITE.name} — feedback`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-on-photo px-5 text-sm font-semibold text-scrim transition hover:bg-on-photo/90">
              <Mail size={16} />Email {SITE.author.split(' ')[0]}
            </a>
            {SITE.linkedin && (
              <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-on-photo/40 bg-on-photo/10 px-5 text-sm font-semibold text-on-photo backdrop-blur transition hover:bg-on-photo/20">
                <LinkedInIcon size={15} />LinkedIn
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** The dark feature card on the right of the hero: photo, overlay, wordmark and layer stack. */
function HeroCard() {
  return (
    <div className="shadow-float relative isolate overflow-hidden rounded-3xl bg-panel text-on-photo">
      <ResponsivePicture name="paving-sunset" priority sizes="(min-width: 1024px) 55vw, 100vw"
        className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-scrim/90 via-scrim/55 to-scrim/35" />
      <div className="flex min-h-[380px] flex-col p-6 sm:min-h-[460px] sm:p-8">
        <div className="flex items-center justify-between text-xs text-on-photo/70">
          <span>AASHTO 1993 · structural number method</span>
          <span className="num hidden sm:inline">SN = a₁D₁ + a₂D₂m₂ + …</span>
        </div>
        <div className="my-auto flex items-center justify-between gap-4 py-8">
          <p className="flex items-center gap-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            <LogoMark size={40} className="text-on-photo" />Design
          </p>
          <LayerStack labels className="hidden w-72 drop-shadow-2xl sm:block xl:w-80" />
        </div>
        <ul className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
          {[['Size', 'every layer'], ['Check', 'against the layer below'], ['Export', 'PNG, SVG, Excel']].map(([title, text]) => (
            <li key={title} className="rounded-xl border border-on-photo/15 bg-on-photo/10 px-3 py-3 backdrop-blur-md">
              <p className="font-semibold">{title}</p>
              <p className="mt-0.5 text-on-photo/70">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RailTile({ href, title, background, icon, className = '' }:
  { href: string; title: string; background: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <Link href={href}
      className={`group relative isolate flex aspect-[16/10] overflow-hidden rounded-2xl bg-panel text-on-photo shadow-card transition hover:-translate-y-0.5 lg:aspect-[4/3] ${className}`}>
      <div className="absolute inset-0 -z-10 transition duration-500 group-hover:scale-105">{background}</div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-scrim/85 via-scrim/30 to-transparent" />
      {icon && <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-on-photo/15 backdrop-blur">{icon}</span>}
      <span className="mt-auto flex w-full items-end justify-between gap-2 p-4">
        <span className="text-[15px] font-semibold leading-tight">{title}</span>
        <ChevronRight size={16} className="shrink-0 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
    </Link>
  );
}
