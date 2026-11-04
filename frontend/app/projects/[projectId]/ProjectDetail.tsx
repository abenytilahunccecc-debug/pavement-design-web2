'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BackLink, Button, ButtonLink, Card, EmptyState, ErrorBox, inputClass, Loading, PageTitle, VerdictBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { fixed } from '@/lib/design-defaults';
import type { ProjectDetail as Project } from '@/lib/types';

export function ProjectDetail() {
  return <RequireAuth><ProjectContent /></RequireAuth>;
}

function ProjectContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const fail = (e: unknown) => setErrors(e instanceof ApiError ? e.messages : [String(e)]);

  const load = useCallback(() => api.projects.get(projectId).then((p) => {
    setProject(p);
    setName(p.name);
    setLocation(p.location ?? '');
  }).catch(fail), [projectId]);
  useEffect(() => { load(); }, [load]);

  const saveProject = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.projects.update(projectId, { name, location });
      setEditing(false);
      await load();
    } catch (e) { fail(e); }
  };

  const deleteProject = async () => {
    if (!project || !confirm(`Delete "${project.name}" and its ${project.designs.length} design(s)? This cannot be undone.`)) return;
    try {
      await api.projects.remove(projectId);
      router.replace('/projects');
    } catch (e) { fail(e); }
  };

  const deleteDesign = async (id: string, designName: string) => {
    if (!confirm(`Delete the design "${designName}"?`)) return;
    try {
      await api.designs.remove(id);
      await load();
    } catch (e) { fail(e); }
  };

  if (!project) return errors.length ? <ErrorBox messages={errors} title="Could not load the project" /> : <Loading label="Loading project…" />;

  return (
    <>
      <BackLink href="/projects">All projects</BackLink>
      {editing ? (
        <Card className="mb-6">
          <form onSubmit={saveProject} className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-sm text-muted">Name
              <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
            </label>
            <label className="min-w-48 flex-1 text-sm text-muted">Location
              <input className={`${inputClass} mt-1`} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={150} />
            </label>
            <Button type="submit">Save</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        </Card>
      ) : (
        <PageTitle title={project.name} subtitle={project.location || undefined}
          actions={<>
            <ButtonLink href={`/projects/${project.id}/designs/new`}>New design</ButtonLink>
            <Button variant="secondary" onClick={() => api.projects.export(project.id, 'xlsx').catch(fail)} disabled={!project.designs.length}>Export Excel</Button>
            <Button variant="secondary" onClick={() => api.projects.export(project.id, 'csv').catch(fail)} disabled={!project.designs.length}>Export CSV</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>Rename</Button>
            <Button variant="danger" onClick={deleteProject}>Delete</Button>
          </>} />
      )}

      <ErrorBox messages={errors} />
      {project.designs.length === 0 ? (
        <EmptyState title="No designs in this project yet">
          <ButtonLink href={`/projects/${project.id}/designs/new`}>Create the first design</ButtonLink>
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[13px] uppercase tracking-[0.08em] text-muted">
                <th className="px-5 py-3">Design</th><th className="px-3">Verdict</th><th className="px-3">Total SN</th>
                <th className="px-3">Required SN</th><th className="px-3">Thickness</th><th className="px-3">Layers</th>
                <th className="px-3">Updated</th><th className="px-5" />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {project.designs.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${project.id}/designs/${d.id}`} className="font-medium text-ink hover:underline underline-offset-4">{d.name}</Link>
                  </td>
                  <td className="px-3"><VerdictBadge adequate={d.adequate} /></td>
                  <td className="px-3">{fixed(d.totalSn)}</td>
                  <td className="px-3">{fixed(d.requiredSn)}</td>
                  <td className="px-3">{fixed(d.totalThicknessMm, 1)} mm</td>
                  <td className="px-3">{d.layerCount}</td>
                  <td className="px-3 text-muted">{new Date(d.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 text-right">
                    <button onClick={() => deleteDesign(d.id, d.name)} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium text-bad hover:bg-bad-soft">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
