'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ButtonLink, Card, EmptyState, ErrorBox, Loading, PageTitle, VerdictBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { fixed } from '@/lib/design-defaults';
import type { Dashboard } from '@/lib/types';

export default function DashboardPage() {
  return <RequireAuth><DashboardContent /></RequireAuth>;
}

function DashboardContent() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErrors(e instanceof ApiError ? e.messages : [String(e)]));
  }, []);

  if (errors.length) return <ErrorBox messages={errors} title="Could not load the dashboard" />;
  if (!data) return <Loading label="Loading your dashboard…" />;

  const { totals, perProject, recent } = data;
  const maxDesigns = Math.max(1, ...perProject.map((p) => p.designs));

  return (
    <>
      <PageTitle title={`Welcome${user?.name ? `, ${user.name}` : ''}`} subtitle="Your projects and designs at a glance."
        actions={<><ButtonLink href="/projects">New project</ButtonLink><ButtonLink href="/calculator" variant="secondary">Quick calculator</ButtonLink></>} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[['Projects', totals.projects, 'text-ink'], ['Designs', totals.designs, 'text-ink'],
          ['Adequate', totals.adequate, 'text-ok'], ['Not adequate', totals.notAdequate, 'text-bad']]
          .map(([label, value, color]) => (
            <Card key={label as string}>
              <p className="text-[13px] uppercase tracking-[0.08em] text-muted">{label}</p>
              <p className={`mt-1 num text-3xl font-semibold ${color}`}>{value}</p>
            </Card>
          ))}
      </div>

      {totals.projects === 0 ? (
        <div className="mt-6">
          <EmptyState title="No projects yet">
            Create a project (for example a road section), then add designs to it.
            <div className="mt-4"><ButtonLink href="/projects">Create your first project</ButtonLink></div>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold text-ink">Designs per project</h2>
            <div className="mt-2 flex gap-4 text-[13px] text-muted">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-ok-solid" />Adequate</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-bad-solid" />Not adequate</span>
            </div>
            <ul className="mt-4 space-y-3">
              {perProject.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:underline underline-offset-4">{p.name}</Link>
                    <span className="text-muted">
                      {p.designs} design{p.designs === 1 ? '' : 's'}
                      {p.averageThicknessMm !== null && ` · avg ${fixed(p.averageThicknessMm, 0)} mm`}
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-raised" role="img"
                    aria-label={`${p.adequate} adequate, ${p.notAdequate} not adequate`}>
                    <div className="bg-ok-solid" style={{ width: `${(p.adequate / maxDesigns) * 100}%` }} />
                    <div className="bg-bad-solid" style={{ width: `${(p.notAdequate / maxDesigns) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold text-ink">Recent designs</h2>
            {recent.length === 0 ? <p className="mt-3 text-sm text-muted">No designs yet — open a project and add one.</p> : (
              <ul className="mt-3 divide-y divide-line">
                {recent.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/projects/${d.project.id}/designs/${d.id}`} className="block truncate font-medium text-ink hover:underline underline-offset-4">{d.name}</Link>
                      <span className="text-[13px] text-muted">{d.project.name} · {d.layerCount} layers · {fixed(d.totalThicknessMm, 0)} mm</span>
                    </div>
                    <VerdictBadge adequate={d.adequate} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
