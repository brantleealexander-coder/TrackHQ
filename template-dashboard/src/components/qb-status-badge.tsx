"use client";

import { useState } from "react";

interface QBStatusBadgeProps {
  companyName: string;
}

export default function QBStatusBadge({ companyName }: QBStatusBadgeProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Disconnect QuickBooks? You can reconnect anytime.")) return;
    setDisconnecting(true);
    await fetch("/api/quickbooks/disconnect", { method: "POST" });
    window.location.reload();
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetch("/api/quickbooks/cache/clear", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-5 py-3 shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-gray-700">
          Connected to <span className="font-semibold text-gray-900">{companyName}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </div>
  );
}
