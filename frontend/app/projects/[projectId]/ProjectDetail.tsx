'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Trash } from '@/components/icons';
import { ActionMenu, ConfirmDialog, UndoBar } from '@/components/overlays';
import { BackLink, Button, ButtonLink, Card, EmptyState, ErrorBox, inputClass, Loading, PageTitle, VerdictBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { fixed } from '@/lib/design-defaults';
import type { ProjectDetail as Project } from '@/lib/types';

/** How long "Undo" is offered after a delete before it is sent to the server. */
const UNDO_SECONDS = 6;

type Deletion = { kind: 'design' | 'project'; id: string; name: string };

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
  const [confirming, setConfirming] = useState<Deletion | null>(null);
  const [pending, setPending] = useState<Deletion | null>(null);
  const pendingRef = useRef<Deletion | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const fail = (e: unknown) => setErrors(e instanceof ApiError ? e.messages : [String(e)]);

  const load = useCallback(() => api.projects.get(projectId).then((p) => {
    setProject(p);
    setName(p.name);
    setLocation(p.location ?? '');
  }).catch(fail), [projectId]);
  useEffect(() => { load(); }, [load]);

  /** Actually delete on the server (after the undo time, or straight away when leaving the page). */
  const commit = useCallback(async (deletion: Deletion, leaving = false) => {
    try {
      if (deletion.kind === 'design') {
        await api.designs.remove(deletion.id, leaving);
        if (mountedRef.current) await load();
      } else {
        await api.projects.remove(deletion.id, leaving);
        if (mountedRef.current) router.replace('/projects');
      }
    } catch (e) {
      if (mountedRef.current) { fail(e); await load(); }
    }
  }, [load, router]);

  const flush = useCallback((leaving = false) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const deletion = pendingRef.current;
    pendingRef.current = null;
    if (mountedRef.current && !leaving) setPending(null);
    if (deletion) void commit(deletion, leaving);
  }, [commit]);

  // A delete still waiting for its undo time goes through if the user leaves the page or closes the tab.
  useEffect(() => {
    mountedRef.current = true;
    const onHide = () => flush(true);
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); mountedRef.current = false; flush(true); };
  }, [flush]);

  const startDelete = (deletion: Deletion) => {
    setConfirming(null);
    if (pendingRef.current) flush();         // one undo at a time: finish the previous delete first
    pendingRef.current = deletion;
    setPending(deletion);
    timerRef.current = setTimeout(() => flush(), UNDO_SECONDS * 1000);
  };

  const undo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPending(null);
  };

  const saveProject = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.projects.update(projectId, { name, location });
      setEditing(false);
      await load();
    } catch (e) { fail(e); }
  };

  if (!project) return errors.length ? <ErrorBox messages={errors} title="Could not load the project" /> : <Loading label="Loading project…" />;

  const projectPending = pending?.kind === 'project';
  const designs = project.designs.filter((d) => !(pending?.kind === 'design' && pending.id === d.id));
  const designActions = (d: (typeof designs)[number]) => [
    { label: 'Open design', icon: <Pencil size={16} />, href: `/projects/${project.id}/designs/${d.id}` },
    { label: 'Delete design…', icon: <Trash size={16} />, danger: true,
      onSelect: () => setConfirming({ kind: 'design', id: d.id, name: d.name }) },
  ];

  return (
    <>
      {/* While a project delete can still be undone, the page is shown dimmed and can't be used. */}
      <div className={projectPending ? 'pointer-events-none opacity-40' : ''} inert={projectPending}>
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
              <Button variant="secondary" onClick={() => api.projects.export(project.id, 'xlsx').catch(fail)} disabled={!designs.length}>Export Excel</Button>
              <Button variant="secondary" onClick={() => api.projects.export(project.id, 'csv').catch(fail)} disabled={!designs.length}>Export CSV</Button>
              <ActionMenu label="More project actions" text="More" items={[
                { label: 'Rename project', icon: <Pencil size={16} />, onSelect: () => setEditing(true) },
                { label: 'Delete project…', icon: <Trash size={16} />, danger: true,
                  onSelect: () => setConfirming({ kind: 'project', id: project.id, name: project.name }) },
              ]} />
            </>} />
        )}

        <ErrorBox messages={errors} />
        {designs.length === 0 ? (
          <EmptyState title="No designs in this project yet">
            <ButtonLink href={`/projects/${project.id}/designs/new`}>Create the first design</ButtonLink>
          </EmptyState>
        ) : (
          <Card className="@container p-0 sm:p-0">
            {/* Narrow screens: one card per design, so nothing scrolls sideways. */}
            <ul className="divide-y divide-line @min-[46rem]:hidden">
              {designs.map((d) => (
                <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${project.id}/designs/${d.id}`}
                        className="inline-flex min-h-7 items-center font-medium break-words text-ink hover:underline underline-offset-4">{d.name}</Link>
                      <div className="mt-1"><VerdictBadge adequate={d.adequate} /></div>
                    </div>
                    <ActionMenu label={`Actions for ${d.name}`} items={designActions(d)} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm tabular-nums @md:grid-cols-5">
                    {[
                      ['Total SN', fixed(d.totalSn)],
                      ['Required SN', fixed(d.requiredSn)],
                      ['Thickness', `${fixed(d.totalThicknessMm, 1)} mm`],
                      ['Layers', String(d.layerCount)],
                      ['Updated', new Date(d.updatedAt).toLocaleDateString()],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[13px] text-muted">{label}</dt>
                        <dd className="text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto @min-[46rem]:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[13px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-5 py-3">Design</th><th className="px-3">Verdict</th><th className="px-3">Total SN</th>
                  <th className="px-3">Required SN</th><th className="px-3">Thickness</th><th className="px-3">Layers</th>
                  <th className="px-3">Updated</th><th className="relative px-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {designs.map((d) => (
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
                    <td className="px-3 py-1 text-right">
                      <ActionMenu label={`Actions for ${d.name}`} items={designActions(d)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog open={confirming !== null} onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && startDelete(confirming)}
        title={confirming?.kind === 'project' ? 'Delete this project?' : 'Delete this design?'}
        confirmLabel={confirming?.kind === 'project' ? 'Delete project' : 'Delete design'}>
        {confirming?.kind === 'project'
          ? <>“{confirming.name}” and its {project.designs.length} design{project.designs.length === 1 ? '' : 's'} will be deleted.</>
          : <>“{confirming?.name}” will be deleted.</>}
        {' '}You can undo this for {UNDO_SECONDS} seconds.
      </ConfirmDialog>

      {pending && (
        <UndoBar key={`${pending.kind}-${pending.id}`} seconds={UNDO_SECONDS} onUndo={undo}
          message={pending.kind === 'project' ? `Project “${pending.name}” deleted.` : `Design “${pending.name}” deleted.`} />
      )}
    </>
  );
}
