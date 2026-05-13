/**
 * Vercel API client — just the operations provision-customer needs.
 * Docs: https://vercel.com/docs/rest-api/endpoints
 */

const API_BASE = "https://api.vercel.com";

export type VercelEnvTarget = "production" | "preview" | "development";

export interface VercelEnvVar {
  key: string;
  value: string;
  /** "encrypted" hides the value in the dashboard; "plain" leaves it readable. */
  type: "encrypted" | "plain";
  target: VercelEnvTarget[];
}

export interface VercelProject {
  id: string;
  name: string;
}

export class VercelError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "VercelError";
  }
}

export class VercelClient {
  constructor(
    private readonly token: string,
    private readonly teamId: string | null = null
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "content-type": "application/json",
    };
  }

  private teamQuery(prefix: string): string {
    return this.teamId ? `${prefix}teamId=${this.teamId}` : "";
  }

  /** Returns the project if it exists, null if 404. */
  async getProject(name: string): Promise<VercelProject | null> {
    const res = await fetch(
      `${API_BASE}/v9/projects/${name}${this.teamQuery("?")}`,
      { headers: this.headers() }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new VercelError(
        `GET /v9/projects/${name} failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as VercelProject;
    return { id: data.id, name: data.name };
  }

  /**
   * Create a project linked to a GitHub repo. Env vars go in via the
   * `environmentVariables` field so the first auto-triggered deploy has
   * everything it needs.
   */
  async createProject(opts: {
    name: string;
    gitRepository: { type: "github"; repo: string };
    rootDirectory: string;
    framework?: string;
    environmentVariables?: VercelEnvVar[];
  }): Promise<VercelProject> {
    const body = {
      name: opts.name,
      gitRepository: opts.gitRepository,
      rootDirectory: opts.rootDirectory,
      framework: opts.framework ?? "nextjs",
      environmentVariables: opts.environmentVariables ?? [],
    };
    const res = await fetch(
      `${API_BASE}/v9/projects${this.teamQuery("?")}`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      throw new VercelError(
        `POST /v9/projects failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as VercelProject;
    return { id: data.id, name: data.name };
  }

  /** Upsert env vars on an existing project (used on resume when project exists). */
  async upsertEnvVars(projectId: string, vars: VercelEnvVar[]): Promise<void> {
    if (vars.length === 0) return;
    // POST /v10/projects/{id}/env supports upsert=true to replace by key
    const url = `${API_BASE}/v10/projects/${projectId}/env${this.teamQuery("?")}${
      this.teamId ? "&" : "?"
    }upsert=true`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(vars),
    });
    if (!res.ok) {
      throw new VercelError(
        `POST /v10/projects/${projectId}/env failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
  }
}
