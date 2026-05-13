"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Periodically re-runs the server render so live data (Samsara, VisionLink)
// stays fresh without the user having to hit reload. Pauses when the tab is
// hidden so we don't burn API calls in background tabs.
export default function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
