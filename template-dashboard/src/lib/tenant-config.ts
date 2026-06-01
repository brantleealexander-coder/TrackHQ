/**
 * Runtime configuration for a single TrackHQ deployment.
 *
 * Each customer deployment sets NEXT_PUBLIC_TENANT_CONFIG_JSON in Vercel.
 * The NEXT_PUBLIC_ prefix lets client components read it — the whole config
 * is non-secret (branding + feature toggles).
 *
 * Locations, categories, and statuses live in Supabase tables (Phase 2),
 * not in this file.
 */

export interface TenantConfig {
  business: {
    name: string;
    logo_url: string;
    brand_color: string;
    site_title: string;
  };
  features: {
    visionlink: boolean;
    samsara: boolean;
    quickbooks: boolean;
    chatbot: boolean;
  };
}

const DEFAULT_CONFIG: TenantConfig = {
  business: {
    name: "TrackHQ",
    logo_url: "",
    brand_color: "#1e40af",
    site_title: "TrackHQ",
  },
  features: {
    visionlink: false,
    samsara: false,
    quickbooks: false,
    chatbot: false,
  },
};

let cached: TenantConfig | null = null;

export function getTenantConfig(): TenantConfig {
  if (cached) return cached;
  const raw = process.env.NEXT_PUBLIC_TENANT_CONFIG_JSON;
  if (!raw) {
    cached = DEFAULT_CONFIG;
    return cached;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TenantConfig>;
    cached = {
      business: { ...DEFAULT_CONFIG.business, ...(parsed.business ?? {}) },
      features: { ...DEFAULT_CONFIG.features, ...(parsed.features ?? {}) },
    };
    return cached;
  } catch {
    cached = DEFAULT_CONFIG;
    return cached;
  }
}

/**
 * Convert a hex color "#f97316" to the space-separated rgb triple "249 115 22"
 * used by `rgb(var(--brand-rgb))` in tailwind.config.ts.
 */
export function brandColorToRgbTriple(hex: string): string {
  const normalized = hex.replace(/^#/, "").trim();
  // Fallback: TrackHQ steel/navy #1e40af = (30, 64, 175)
  if (normalized.length !== 6) return "30 64 175";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "30 64 175";
  return `${r} ${g} ${b}`;
}
