import type {
  ChangeEvent,
  DocumentData,
  Feature,
  ProjectResponse,
  SearchResult,
} from '../../../src/core/model.ts';
import type { ConnectionState, DataSource } from './source.ts';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown>,
  ) {
    super(code);
  }
}

export class LocalSource implements DataSource {
  readonly mode = 'local' as const;
  constructor(readonly token: string) {}

  private async get<T>(url: string, allow404 = false): Promise<T | null> {
    const res = await fetch(url, { cache: 'no-store' });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new ApiRequestError(res.status, String(body.error ?? res.status), body);
    }
    return (await res.json()) as T;
  }

  /** POST with the per-process token (write endpoints). */
  async post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-speckit-web-token': this.token },
      body: JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new ApiRequestError(res.status, String(json.error ?? res.status), json);
    return json as T;
  }

  async getProject() {
    return (await this.get<ProjectResponse>('api/project'))!;
  }
  getFeature(id: string) {
    return this.get<Feature>(`api/features/${encodeURIComponent(id)}`, true);
  }
  getDoc(id: string, part = 0) {
    return this.get<DocumentData>(`api/docs/${encodeURIComponent(id)}${part ? `?part=${part}` : ''}`, true);
  }
  async search(q: string, limit = 50) {
    return (await this.get<SearchResult>(`api/search?q=${encodeURIComponent(q)}&limit=${limit}`))!;
  }

  subscribe(onChange: (e: ChangeEvent) => void, onConnection?: (s: ConnectionState) => void) {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      es = new EventSource('api/events');
      es.addEventListener('hello', () => onConnection?.('connected'));
      es.addEventListener('change', (msg) => onChange(JSON.parse((msg as MessageEvent).data) as ChangeEvent));
      es.onerror = () => {
        onConnection?.('disconnected');
        es?.close();
        if (!closed) retry = setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }
}
