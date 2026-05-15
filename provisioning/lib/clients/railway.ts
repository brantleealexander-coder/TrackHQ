/**
 * Railway GraphQL API client.
 *
 * Endpoint: https://backboard.railway.app/graphql/v2
 * Auth: Bearer token (account-scoped PAT)
 *
 * Only the operations provision-customer needs are exposed. Railway's
 * schema changes occasionally — if a real run fails with "unknown field"
 * errors, the field names below are the first place to look.
 */

const ENDPOINT = "https://backboard.railway.app/graphql/v2";

export class RailwayError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "RailwayError";
  }
}

export type DeploymentStatus =
  | "INITIALIZING"
  | "BUILDING"
  | "DEPLOYING"
  | "SUCCESS"
  | "FAILED"
  | "CRASHED"
  | "REMOVED"
  | "SKIPPED";

export interface RailwayDeployment {
  id: string;
  status: DeploymentStatus;
  staticUrl?: string | null;
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class RailwayClient {
  constructor(private readonly token: string) {}

  private async gql<T>(query: string, variables: object = {}): Promise<T> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new RailwayError(`Railway GraphQL ${res.status}`, res.status, text);
    }
    let parsed: GqlResponse<T>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new RailwayError("Railway returned non-JSON", res.status, text);
    }
    if (parsed.errors && parsed.errors.length > 0) {
      throw new RailwayError(
        `Railway: ${parsed.errors.map((e) => e.message).join("; ")}`,
        res.status,
        text
      );
    }
    if (!parsed.data) {
      throw new RailwayError("Railway response had no data", res.status, text);
    }
    return parsed.data;
  }

  /** Creates a new project and returns id + production environment id. */
  async createProject(opts: {
    name: string;
    teamId?: string | null;
  }): Promise<{ projectId: string; productionEnvironmentId: string }> {
    const query = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          environments {
            edges { node { id name } }
          }
        }
      }
    `;
    const input: Record<string, unknown> = { name: opts.name };
    if (opts.teamId) input.teamId = opts.teamId;
    const data = await this.gql<{
      projectCreate: {
        id: string;
        environments: { edges: Array<{ node: { id: string; name: string } }> };
      };
    }>(query, { input });
    const envs = data.projectCreate.environments.edges.map((e) => e.node);
    const prod = envs.find((e) => e.name === "production") ?? envs[0];
    if (!prod) {
      throw new RailwayError(
        "project has no environments",
        200,
        JSON.stringify(data)
      );
    }
    return { projectId: data.projectCreate.id, productionEnvironmentId: prod.id };
  }

  /** Create a service inside a project, sourced from a GitHub repo. */
  async createServiceFromRepo(opts: {
    projectId: string;
    name: string;
    repo: string; // "owner/name"
    branch?: string;
  }): Promise<{ serviceId: string }> {
    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
        }
      }
    `;
    const input: Record<string, unknown> = {
      projectId: opts.projectId,
      name: opts.name,
      source: { repo: opts.repo },
    };
    if (opts.branch) input.branch = opts.branch;
    const data = await this.gql<{ serviceCreate: { id: string } }>(query, { input });
    return { serviceId: data.serviceCreate.id };
  }

  /**
   * Update service-level config in a given environment.
   * Used to set rootDirectory = "template-server" so Railway only watches
   * + builds that path of the monorepo.
   */
  async updateServiceInstance(opts: {
    serviceId: string;
    environmentId: string;
    rootDirectory?: string;
    buildCommand?: string;
    startCommand?: string;
  }): Promise<void> {
    const query = `
      mutation ServiceInstanceUpdate(
        $serviceId: String!
        $environmentId: String
        $input: ServiceInstanceUpdateInput!
      ) {
        serviceInstanceUpdate(
          serviceId: $serviceId
          environmentId: $environmentId
          input: $input
        )
      }
    `;
    const input: Record<string, unknown> = {};
    if (opts.rootDirectory !== undefined) input.rootDirectory = opts.rootDirectory;
    if (opts.buildCommand !== undefined) input.buildCommand = opts.buildCommand;
    if (opts.startCommand !== undefined) input.startCommand = opts.startCommand;
    await this.gql(query, {
      serviceId: opts.serviceId,
      environmentId: opts.environmentId,
      input,
    });
  }

  /** Bulk-upsert a key→value map of environment variables on a service. */
  async upsertVariables(opts: {
    projectId: string;
    environmentId: string;
    serviceId: string;
    variables: Record<string, string>;
  }): Promise<void> {
    const query = `
      mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `;
    await this.gql(query, {
      input: {
        projectId: opts.projectId,
        environmentId: opts.environmentId,
        serviceId: opts.serviceId,
        variables: opts.variables,
      },
    });
  }

  /**
   * Generate the public *.up.railway.app domain for a service.
   * Idempotent on Railway's side: if a default domain already exists, this
   * either returns it or errors with a "domain exists" message we can
   * ignore.
   */
  async createServiceDomain(opts: {
    serviceId: string;
    environmentId: string;
  }): Promise<{ domain: string }> {
    const query = `
      mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) {
          domain
        }
      }
    `;
    const data = await this.gql<{ serviceDomainCreate: { domain: string } }>(
      query,
      {
        input: {
          serviceId: opts.serviceId,
          environmentId: opts.environmentId,
        },
      }
    );
    return { domain: data.serviceDomainCreate.domain };
  }

  /** Latest deployment for a service in an environment (or null if none yet). */
  async latestDeployment(opts: {
    serviceId: string;
    environmentId: string;
  }): Promise<RailwayDeployment | null> {
    const query = `
      query LatestDeployment($input: DeploymentListInput!) {
        deployments(input: $input, first: 1) {
          edges {
            node { id status staticUrl }
          }
        }
      }
    `;
    const data = await this.gql<{
      deployments: { edges: Array<{ node: RailwayDeployment }> };
    }>(query, {
      input: { serviceId: opts.serviceId, environmentId: opts.environmentId },
    });
    return data.deployments.edges[0]?.node ?? null;
  }

  /** Poll latestDeployment until status is SUCCESS or a terminal failure. */
  async waitForDeployment(opts: {
    serviceId: string;
    environmentId: string;
    timeoutMs?: number;
    intervalMs?: number;
    onPoll?: (d: RailwayDeployment | null) => void;
  }): Promise<RailwayDeployment> {
    const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
    const intervalMs = opts.intervalMs ?? 10_000;
    const deadline = Date.now() + timeoutMs;
    const terminalFailure: DeploymentStatus[] = ["FAILED", "CRASHED", "REMOVED"];

    while (Date.now() < deadline) {
      const d = await this.latestDeployment({
        serviceId: opts.serviceId,
        environmentId: opts.environmentId,
      });
      opts.onPoll?.(d);
      if (d) {
        if (d.status === "SUCCESS") return d;
        if (terminalFailure.includes(d.status)) {
          throw new RailwayError(
            `deployment ${d.id} reached terminal status ${d.status}`,
            200,
            JSON.stringify(d)
          );
        }
      }
      await sleep(intervalMs);
    }
    throw new RailwayError(
      `deployment did not succeed within ${timeoutMs}ms`,
      200,
      ""
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
