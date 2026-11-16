"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        readOnly
        value={url}
        aria-label="Invitation link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-xs text-fg"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
