/**
 * VAPI API client — create, get, patch assistants.
 * Docs: https://docs.vapi.ai/api-reference/assistants/create-assistant
 */

const API_BASE = "https://api.vapi.ai";

export interface VapiAssistantSummary {
  id: string;
  name?: string;
}

export class VapiError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "VapiError";
  }
}

export class VapiClient {
  constructor(private readonly token: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "content-type": "application/json",
    };
  }

  /**
   * Create an assistant from a full config object.
   * Returns the new assistant including its `id` (the UUID we store in state).
   */
  async createAssistant(config: object): Promise<{ id: string; [k: string]: unknown }> {
    const res = await fetch(`${API_BASE}/assistant`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      throw new VapiError(
        `POST /assistant failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as { id: string };
    if (!data.id) {
      throw new VapiError(
        "VAPI create response missing `id`",
        res.status,
        JSON.stringify(data)
      );
    }
    return data as { id: string; [k: string]: unknown };
  }

  /** PATCH an existing assistant with the given fields. */
  async patchAssistant(
    id: string,
    patch: object
  ): Promise<{ id: string; [k: string]: unknown }> {
    const res = await fetch(`${API_BASE}/assistant/${id}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      throw new VapiError(
        `PATCH /assistant/${id} failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    return (await res.json()) as { id: string; [k: string]: unknown };
  }

  /**
   * List assistants, used for idempotency: if a previous run created an
   * assistant named `trackhq-<slug>-receptionist` but didn't persist the id
   * (e.g. network failure between POST and saveState), we can find it again.
   */
  async listAssistants(limit = 100): Promise<VapiAssistantSummary[]> {
    const res = await fetch(`${API_BASE}/assistant?limit=${limit}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new VapiError(
        `GET /assistant failed: ${res.status}`,
        res.status,
        await res.text()
      );
    }
    const data = (await res.json()) as Array<{ id: string; name?: string }>;
    return data.map((a) => ({ id: a.id, name: a.name }));
  }
}
