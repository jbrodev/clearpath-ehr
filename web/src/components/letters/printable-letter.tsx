"use client";

import { useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LetterMeta {
  date?: string;
  to: string;
  from: string;
  subject: string;
}

interface Props {
  meta: LetterMeta;
  /** HTML produced by the rich text editor. */
  bodyHtml: string;
  className?: string;
}

export function PrintableLetter({ meta, bodyHtml, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const printLetter = useCallback(() => {
    if (!ref.current) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const html = ref.current.innerHTML;
    win.document.open();
    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.subject)}</title>
<style>
  @page { margin: 0.75in; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; color: #111; line-height: 1.5; }
  .header { margin-bottom: 1.5em; }
  .meta { color: #555; font-size: 10pt; margin-bottom: 1em; }
  .meta div { margin-bottom: 0.25em; }
  .meta strong { color: #111; font-weight: 600; }
  h1, h2, h3 { font-family: Georgia, serif; }
  h2 { font-size: 13pt; margin-top: 1em; margin-bottom: 0.5em; }
  h3 { font-size: 11.5pt; margin-top: 0.8em; margin-bottom: 0.4em; }
  p { margin: 0.6em 0; }
  ul, ol { margin: 0.6em 0; padding-left: 1.5em; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1em; margin: 1em 0; color: #555; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 1.5em 0; }
  .draft-note { font-size: 9pt; color: #999; font-style: italic; margin-top: 2em; }
</style>
</head>
<body onload="window.print(); setTimeout(() => window.close(), 250);">
${html}
</body>
</html>`);
    win.document.close();
  }, [meta.subject]);

  const copyText = useCallback(async () => {
    if (!ref.current) return;
    const text = ref.current.innerText;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={copyText}>
          Copy text
        </Button>
        <Button variant="outline" size="sm" onClick={printLetter}>
          Print / Save as PDF
        </Button>
      </div>
      <div
        ref={ref}
        className={cn(
          "rounded-md border bg-white px-8 py-8 text-sm leading-relaxed text-slate-900 shadow-sm",
          className,
        )}
      >
        <div className="meta mb-6 space-y-1 text-xs text-slate-600">
          <div><strong>Date:</strong> {meta.date || "[Date]"}</div>
          <div><strong>To:</strong> {meta.to}</div>
          <div><strong>From:</strong> {meta.from}</div>
          <div><strong>RE:</strong> {meta.subject}</div>
        </div>
        <hr className="my-4 border-slate-200" />
        <div
          className="prose prose-sm max-w-none [&_p]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: bodyHtml || "<p><em>Letter body is empty.</em></p>" }}
        />
        <p className="draft-note mt-8 text-[10px] italic text-slate-400">
          Draft — for clinician review. Not a signed medical record entry.
        </p>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
