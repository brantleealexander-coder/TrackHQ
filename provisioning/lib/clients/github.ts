/**
 * Minimal GitHub API client — just the operations provision-customer needs.
 *
 * Uses bare fetch + the v3 REST API. We don't pull in @octokit/rest because
 * we make exactly three call types: get-authenticated-user, repo-exists,
 * and create-fork.
 */

export interface GitHubRepo {
  full_name: string;
  html_url: string;
  clone_url: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

const API_BASE = "https://api.github.com";

export class GitHubClient {
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /** Login of the user the PAT belongs to. */
  async authenticatedUserLogin(): Promise<string> {
    const res = await fetch(`${API_BASE}/user`, { headers: this.headers() });
    if (!res.ok) {
      throw new GitHubError(
        `GET /user failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as { login: string };
    return data.login;
  }

  /** Returns null if the repo doesn't exist (404), otherwise the repo info. */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
      headers: this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new GitHubError(
        `GET /repos/${owner}/${repo} failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as GitHubRepo;
    return {
      full_name: data.full_name,
      html_url: data.html_url,
      clone_url: data.clone_url,
    };
  }

  /**
   * Fork upstream into `target_owner/target_name`.
   *
   * If `target_owner` is the authenticated user's login, the fork lands in
   * their personal account. Otherwise `target_owner` is treated as an org
   * and passed in the `organization` field.
   *
   * GitHub's fork endpoint is async: it returns 202 with the new repo
   * metadata, but the repo may not be fully usable for a few seconds.
   * That's a runbook concern, not a code concern — the metadata returned
   * is correct and stable.
   */
  async forkRepo(opts: {
    upstream_owner: string;
    upstream_repo: string;
    target_owner: string;
    target_name: string;
  }): Promise<GitHubRepo> {
    const authedLogin = await this.authenticatedUserLogin();
    const body: { name: string; organization?: string; default_branch_only: boolean } = {
      name: opts.target_name,
      default_branch_only: true,
    };
    if (opts.target_owner !== authedLogin) {
      body.organization = opts.target_owner;
    }

    const res = await fetch(
      `${API_BASE}/repos/${opts.upstream_owner}/${opts.upstream_repo}/forks`,
      {
        method: "POST",
        headers: { ...this.headers(), "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (res.status !== 202 && !res.ok) {
      throw new GitHubError(
        `POST /repos/${opts.upstream_owner}/${opts.upstream_repo}/forks failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as GitHubRepo;
    return {
      full_name: data.full_name,
      html_url: data.html_url,
      clone_url: data.clone_url,
    };
  }
}
