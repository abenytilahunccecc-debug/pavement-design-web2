// API client: every call to the NestJS backend goes through here.
// The backend address comes from NEXT_PUBLIC_API_URL (set in .env.local or on Vercel).
import type {
  AuthResponse, Dashboard, DesignInput, DesignResult, DesignSummary, Project, ProjectDetail, ProjectListItem,
  SavedDesign, User,
} from './types';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const TOKEN_KEY = 'pavement-design-token';

/** An error from the API, with the readable message(s) the backend sent. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly messages: string[]) {
    super(messages.join('\n'));
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable (private mode): the user just signs in again next time */ }
}

/** Listeners told when the API says the session is no longer valid (401). */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, [
      `Cannot reach the server (${API_URL}). It may be starting up — on Render's free plan this takes up to a minute. Try again shortly.`,
    ]);
  }

  if (response.status === 401 && options.auth !== false) unauthorizedListeners.forEach((listener) => listener());
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message ?? data?.error ?? response.statusText;
    throw new ApiError(response.status, Array.isArray(message) ? message : [String(message)]);
  }
  return data as T;
}

/** Download a file (CSV / Excel) from a protected endpoint. */
async function download(path: string, fallbackName: string) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError(response.status, ['Download failed']);
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  health: () => request<{ status: string; database: string }>('/health', { auth: false }),

  register: (body: { email: string; password: string; name?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request<User>('/auth/me'),

  projects: {
    list: () => request<ProjectListItem[]>('/projects'),
    create: (body: { name: string; location?: string; description?: string }) =>
      request<Project>('/projects', { method: 'POST', body }),
    get: (id: string) => request<ProjectDetail>(`/projects/${id}`),
    update: (id: string, body: { name?: string; location?: string; description?: string }) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
    export: (id: string, format: 'csv' | 'xlsx') => download(`/projects/${id}/export?format=${format}`, `designs.${format}`),
  },

  designs: {
    calculate: (inputs: Partial<DesignInput>) =>
      request<DesignResult>('/designs/calculate', { method: 'POST', body: inputs, auth: false }),
    list: (projectId: string) => request<DesignSummary[]>(`/projects/${projectId}/designs`),
    create: (projectId: string, body: { name: string; inputs: Partial<DesignInput> }) =>
      request<SavedDesign>(`/projects/${projectId}/designs`, { method: 'POST', body }),
    get: (id: string) => request<SavedDesign>(`/designs/${id}`),
    update: (id: string, body: { name?: string; inputs?: Partial<DesignInput> }) =>
      request<SavedDesign>(`/designs/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<{ deleted: boolean }>(`/designs/${id}`, { method: 'DELETE' }),
  },

  dashboard: () => request<Dashboard>('/dashboard'),
};
