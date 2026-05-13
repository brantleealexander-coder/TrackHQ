/**
 * Tiny fetch mocker for provisioning tests.
 *
 * Usage:
 *   const mock = new FetchMock();
 *   mock.expect("POST", /api\.github\.com\/repos\/.+\/forks/, {
 *     status: 202,
 *     body: { full_name: "user/trackhq-acme", clone_url: "...", html_url: "..." },
 *   });
 *   const oldFetch = globalThis.fetch;
 *   globalThis.fetch = mock.fn as typeof globalThis.fetch;
 *   try {
 *     await stepUnderTest.execute(ctx);
 *   } finally {
 *     globalThis.fetch = oldFetch;
 *   }
 *   mock.assertAllConsumed();
 *
 * The matcher must be hit in the exact order expectations were registered.
 * If a fetch arrives that doesn't match the next expectation, the test fails
 * with a descriptive error.
 */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ExpectedResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedCall {
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

interface Expectation {
  method: Method;
  urlMatch: string | RegExp;
  response: ExpectedResponse | ((call: RecordedCall) => ExpectedResponse);
  assertBody?: (body: unknown) => void;
}

export class FetchMock {
  private queue: Expectation[] = [];
  public calls: RecordedCall[] = [];

  expect(
    method: Method,
    urlMatch: string | RegExp,
    response: ExpectedResponse | ((call: RecordedCall) => ExpectedResponse),
    assertBody?: (body: unknown) => void
  ): this {
    this.queue.push({ method, urlMatch, response, assertBody });
    return this;
  }

  fn = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    let body: unknown = null;
    if (init?.body && typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    }
    const call: RecordedCall = { method, url, body, headers };
    this.calls.push(call);

    const expected = this.queue.shift();
    if (!expected) {
      throw new Error(
        `Unexpected fetch: ${method} ${url}\nNo more expectations queued.`
      );
    }
    if (expected.method !== method) {
      throw new Error(
        `Method mismatch: expected ${expected.method}, got ${method} for ${url}`
      );
    }
    const matches =
      typeof expected.urlMatch === "string"
        ? url === expected.urlMatch
        : expected.urlMatch.test(url);
    if (!matches) {
      throw new Error(
        `URL mismatch: expected ${expected.urlMatch}, got ${url}`
      );
    }
    if (expected.assertBody) {
      expected.assertBody(body);
    }

    const resolved =
      typeof expected.response === "function"
        ? expected.response(call)
        : expected.response;
    const status = resolved.status ?? 200;
    const respBody =
      resolved.body === undefined
        ? ""
        : typeof resolved.body === "string"
          ? resolved.body
          : JSON.stringify(resolved.body);
    const respHeaders = new Headers({
      "content-type": typeof resolved.body === "object" ? "application/json" : "text/plain",
      ...(resolved.headers ?? {}),
    });
    return new Response(respBody, { status, headers: respHeaders });
  };

  assertAllConsumed(): void {
    if (this.queue.length > 0) {
      const remaining = this.queue
        .map((e) => `${e.method} ${e.urlMatch}`)
        .join("\n  - ");
      throw new Error(
        `${this.queue.length} expected fetches not consumed:\n  - ${remaining}`
      );
    }
  }
}

/**
 * Convenience wrapper that swaps globalThis.fetch for the duration of `fn`
 * and restores it afterwards even on throw.
 */
export async function withMockedFetch<T>(
  mock: FetchMock,
  fn: () => Promise<T>
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = mock.fn as typeof globalThis.fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}
