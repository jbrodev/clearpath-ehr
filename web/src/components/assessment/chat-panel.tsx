"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { streamChat } from "@/lib/api";
import type { Role } from "@/lib/roles";
import type { ChatTurn, ClearanceOutput } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  bundle: Record<string, unknown>;
  assessment: ClearanceOutput;
  role: Role;
  /** Reset chat when this changes (e.g. after Re-run clearance). */
  resetKey?: string | number;
}

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  error?: string;
}

export function ChatPanel({ bundle, assessment, role, resetKey }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Wipe chat history when the clearance is regenerated.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setStreaming(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [resetKey]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming) return;

    // Build chat history in the {q, a} shape the backend expects, using all
    // previous fully-completed turns.
    const history: ChatTurn[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const next = messages[i + 1];
      if (m.role === "user" && next?.role === "assistant" && !next.pending) {
        history.push({ q: m.text, a: next.text });
        i++;
      }
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: "", pending: true },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(
      bundle,
      assessment as unknown as Record<string, unknown>,
      question,
      history,
      {
        signal: controller.signal,
        onChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              text: last.text + chunk,
              pending: true,
            };
            return updated;
          });
        },
        onDone: () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, pending: false };
            return updated;
          });
          setStreaming(false);
          abortRef.current = null;
        },
        onError: (err) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              pending: false,
              error: err.message,
            };
            return updated;
          });
          setStreaming(false);
          abortRef.current = null;
        },
      },
      role,
    );
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...last, pending: false };
      return updated;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const suggestions = SUGGESTIONS_BY_ROLE[role] ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ask a follow-up</CardTitle>
        <CardDescription>
          Drill into specifics — drug holds, guideline thresholds, prescriber scope. Answers
          stream from Claude with web-search grounding when needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollerRef}
          className="max-h-[420px] min-h-[120px] overflow-y-auto rounded-md border bg-muted/30 px-3 py-3 space-y-3"
        >
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Try one of these, or type your own question below.
              </p>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(s)}
                      className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} m={m} />)
          )}
        </div>

        <div className="flex items-start gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a follow-up question…"
            rows={2}
            disabled={streaming}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          {streaming ? (
            <Button variant="outline" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()}>
              Send
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ m }: { m: DisplayMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[85%] rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap",
          m.error && "border-red-300 bg-red-50 text-red-900",
        )}
      >
        {m.error ? (
          <span>Error: {m.error}</span>
        ) : m.text ? (
          <>
            <span>{m.text}</span>
            {m.pending && <span className="ml-1 inline-block h-2 w-1 animate-pulse bg-current align-middle" />}
          </>
        ) : (
          <span className="text-muted-foreground italic">Thinking…</span>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS_BY_ROLE: Record<Role, string[]> = {
  preop: [
    "Who do I need to coordinate with to clear this patient?",
    "What can be done today vs. before the procedure?",
    "What missing data should I chase first?",
  ],
  pcp: [
    "What specifically am I being asked to sign off on?",
    "Any drug-hold timing concerns I should flag?",
    "What would I document in my clearance note?",
  ],
  surgeon: [
    "Which letters should I draft and to whom?",
    "What clinical concern goes in each letter?",
    "Is anesthesia review required before scheduling?",
  ],
};
