"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/utils/cn";

interface CodeVoteButtonsProps {
  upvotes: number;
  downvotes: number;
  disabled?: boolean;
  onVote?: (vote: "up" | "down") => string | void | Promise<string | void>;
  className?: string;
}

export function CodeVoteButtons({
  upvotes,
  downvotes,
  disabled = false,
  onVote,
  className,
}: CodeVoteButtonsProps) {
  const [pendingVote, setPendingVote] = useState<"up" | "down" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleVote(vote: "up" | "down") {
    if (disabled || pendingVote) {
      return;
    }

    if (!onVote) {
      setStatus("Voting is unavailable right now.");
      return;
    }

    setPendingVote(vote);
    setStatus(null);

    try {
      const result = await onVote(vote);
      setStatus(
        result ??
          (vote === "up"
            ? "Marked as still working."
            : "Marked as no longer working."),
      );
    } catch {
      setStatus("Could not save that vote right now.");
    } finally {
      setPendingVote(null);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Vote code up"
          disabled={disabled || pendingVote !== null}
          onClick={() => void handleVote("up")}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-brand-primary/10 bg-white/85 px-4 text-[0.78rem] font-semibold text-brand-primary-dark transition hover:-translate-y-0.5 hover:bg-brand-primary-soft/60 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ThumbsUp className="h-4 w-4" />
          {pendingVote === "up" ? "Saving..." : upvotes}
        </button>
        <button
          type="button"
          aria-label="Vote code down"
          disabled={disabled || pendingVote !== null}
          onClick={() => void handleVote("down")}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-brand-primary/10 bg-white/85 px-4 text-[0.78rem] font-semibold text-brand-primary-dark transition hover:-translate-y-0.5 hover:bg-brand-primary-soft/60 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ThumbsDown className="h-4 w-4" />
          {pendingVote === "down" ? "Saving..." : downvotes}
        </button>
      </div>

      {status ? (
        <p className="text-[0.78rem] text-text-secondary">{status}</p>
      ) : null}
    </div>
  );
}
