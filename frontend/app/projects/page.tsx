'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, EmptyState, ErrorBox, inputClass, Loading, PageTitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import type { ProjectListItem } from '@/lib/types';

export default function ProjectsPage() {
  return <RequireAuth><ProjectsContent /></RequireAuth>;
}

function ProjectsContent() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.projects.list().then(setProjects)
    .catch((e) => setErrors(e instanceof ApiError ? e.messages : [String(e)]));
  useEffect(() => { load(); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      await api.projects.create({ name, location: location || undefined });
      setName('');
      setLocation('');
      await load();
    } catch (e) {
      setErrors(e instanceof ApiError ? e.messages : [String(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Projects" subtitle="Group your designs by road or section." />
      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-ink">New project</h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm text-muted">Name
            <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={150}
              placeholder="e.g. Addis–Adama road" />
          </label>
          <label className="min-w-48 flex-1 text-sm text-muted">Location (optional)
            <input className={`${inputClass} mt-1`} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150}
              placeholder="e.g. km 12–18" />
          </label>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create project'}</Button>
        </form>
      </Card>

      <ErrorBox messages={errors} />
      {!projects ? <Loading label="Loading projects…" /> : projects.length === 0 ? (
        <EmptyState title="No projects yet">Create your first project above.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}
              className="shadow-card rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
              <p className="font-semibold text-ink">{p.name}</p>
              {p.location && <p className="text-sm text-muted">{p.location}</p>}
              <p className="mt-3 text-sm text-muted">
                {p.designCount} design{p.designCount === 1 ? '' : 's'}
                {p.designCount > 0 && <> · <span className="text-ok">{p.adequateCount} adequate</span></>}
              </p>
              <p className="mt-1 text-xs text-subtle">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
