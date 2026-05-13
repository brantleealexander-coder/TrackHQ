/**
 * TS port of template-server/app/render_vapi.py.
 *
 * Substitutes `${field}` placeholders in vapi_assistant_config.example.json
 * with values from a vapi-config object. Single-brace `${...}` is ours;
 * double-brace `{{ ... }}` is VAPI's own runtime template syntax and is
 * left untouched.
 */

const PLACEHOLDER_RE = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

export interface VapiSubstitutions {
  [field: string]: string;
}

/**
 * Render the template string with the given substitutions, returning the
 * parsed assistant config object.
 *
 * Values are JSON-escaped (so embedded quotes/newlines stay valid inside
 * the surrounding JSON string).
 */
export function renderVapiTemplate(
  template: string,
  subs: VapiSubstitutions,
  webhookUrl?: string
): object {
  const all: VapiSubstitutions = { ...subs };
  if (webhookUrl !== undefined) all.webhook_url = webhookUrl;

  const missing: string[] = [];
  const rendered = template.replace(PLACEHOLDER_RE, (match, field: string) => {
    if (!(field in all)) {
      missing.push(field);
      return match;
    }
    // JSON.stringify wraps in quotes; strip them since the placeholder
    // already sits inside a quoted JSON string.
    const encoded = JSON.stringify(all[field]);
    return encoded.slice(1, -1);
  });

  if (missing.length > 0) {
    const unique = [...new Set(missing)].sort();
    throw new RenderError(
      `missing placeholder values for: ${unique.join(", ")}. Add them under \`vapi\` in business_config or pass via webhookUrl.`
    );
  }

  try {
    return JSON.parse(rendered);
  } catch (e) {
    throw new RenderError(
      `rendered config is not valid JSON: ${(e as Error).message}. Check that values don't contain unescaped control characters.`
    );
  }
}
