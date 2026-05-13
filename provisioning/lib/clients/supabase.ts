/**
 * Supabase Management API client.
 *
 * Docs: https://api.supabase.com/api/v1
 *
 * Auth: account-scoped personal access token (PAT). Not the same as a
 * project's anon/service_role keys — those don't exist until after the
 * project is created.
 */

const API_BASE = "https://api.supabase.com";

export interface SupabaseProject {
  id: string;
  /** Short stable ref like "abcdefghijklmnop" — used in URLs and as the project ID. */
  ref: string;
  name: string;
  organization_id: string;
  /** "COMING_UP", "INACTIVE", "ACTIVE_HEALTHY", etc. */
  status: string;
  region: string;
}

export interface SupabaseApiKeys {
  anon: string;
  service_role: string;
}

export class SupabaseError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

export class SupabaseTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseTimeoutError";
  }
}

export class SupabaseManagementClient {
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };
  }

  async createProject(opts: {
    name: string;
    organization_id: string;
    region: string;
    db_pass: string;
    plan?: "free" | "pro";
  }): Promise<SupabaseProject> {
    const res = await fetch(`${API_BASE}/v1/projects`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({
        name: opts.name,
        organization_id: opts.organization_id,
        region: opts.region,
        db_pass: opts.db_pass,
        plan: opts.plan ?? "free",
      }),
    });
    if (!res.ok) {
      throw new SupabaseError(
        `POST /v1/projects failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    return (await res.json()) as SupabaseProject;
  }

  async getProject(ref: string): Promise<SupabaseProject> {
    const res = await fetch(`${API_BASE}/v1/projects/${ref}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new SupabaseError(
        `GET /v1/projects/${ref} failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    return (await res.json()) as SupabaseProject;
  }

  /**
   * Poll getProject every `intervalMs` until status is "ACTIVE_HEALTHY"
   * or `timeoutMs` elapses. Default 5min timeout, 5s interval.
   */
  async waitUntilHealthy(
    ref: string,
    opts: { timeoutMs?: number; intervalMs?: number; onPoll?: (status: string) => void } = {}
  ): Promise<SupabaseProject> {
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
    const intervalMs = opts.intervalMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const project = await this.getProject(ref);
      opts.onPoll?.(project.status);
      if (project.status === "ACTIVE_HEALTHY") return project;
      await sleep(intervalMs);
    }
    throw new SupabaseTimeoutError(
      `project ${ref} did not reach ACTIVE_HEALTHY within ${timeoutMs}ms`
    );
  }

  async getApiKeys(ref: string): Promise<SupabaseApiKeys> {
    const res = await fetch(`${API_BASE}/v1/projects/${ref}/api-keys`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new SupabaseError(
        `GET /v1/projects/${ref}/api-keys failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const keys = (await res.json()) as Array<{ name: string; api_key: string }>;
    const anon = keys.find((k) => k.name === "anon")?.api_key;
    const service_role = keys.find((k) => k.name === "service_role")?.api_key;
    if (!anon || !service_role) {
      throw new SupabaseError(
        `api-keys response missing anon or service_role: ${JSON.stringify(keys)}`,
        200,
        JSON.stringify(keys)
      );
    }
    return { anon, service_role };
  }

  /**
   * Run arbitrary SQL against the project's database via the Management API.
   * Used to apply the dashboard's supabase_schema.sql.
   */
  async runSql(ref: string, sql: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      throw new SupabaseError(
        `POST /v1/projects/${ref}/database/query failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    return await res.json();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
