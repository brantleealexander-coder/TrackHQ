"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [faultCount, setFaultCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  });

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for active fault codes on mount
  useEffect(() => {
    fetch("/api/telematics")
      .then((r) => r.json())
      .then((data) => {
        if (data?.assets) {
          const faults = data.assets.filter((a: any) => a.faultCodes?.length > 0);
          setFaultCount(faults.length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 text-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm font-semibold">CrossMar Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-lg leading-none"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Fault alert banner */}
          {faultCount > 0 && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{faultCount} unit{faultCount !== 1 ? "s" : ""} with active fault codes — ask me about them</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <p className="text-2xl mb-2">👋</p>
                <p className="font-medium text-gray-600">Hi! I&apos;m your fleet assistant.</p>
                <p className="mt-1">Ask me anything about your equipment, rentals, or financials.</p>
                <div className="mt-4 space-y-2 text-left">
                  {[
                    "Which units are currently on rent?",
                    "What's our revenue this month?",
                    "Show me overdue rentals",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        handleInputChange({ target: { value: suggestion } } as never);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:border-orange-300 hover:text-orange-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-orange-500 text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-gray-100 bg-white flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about your fleet…"
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-colors"
        aria-label="Open fleet assistant"
        style={{ width: 52, height: 52 }}
      >
        {/* Fault alert badge */}
        {faultCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {faultCount}
          </span>
        )}
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
          </svg>
        )}
      </button>
    </>
  );
}
