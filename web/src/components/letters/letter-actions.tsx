"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadLetterPdf,
  sendLetterEmail,
  type SendEmailResponse,
} from "@/lib/api";
import type { SentLetter } from "@/lib/workflow";

interface Props {
  patientId: string;
  letter: SentLetter;
  /** Default email pre-filled in the send dialog (e.g. from a clinician directory). */
  defaultEmail?: string | null;
  /** Default recipient display name pre-filled in the dialog. */
  defaultName?: string | null;
  /** Called when an email send completes so the parent can refresh workflow state. */
  onDelivered?: (response: SendEmailResponse) => void;
}

export function LetterActions({
  patientId,
  letter,
  defaultEmail,
  defaultName,
  onDelivered,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const downloadFilename =
    (letter.subject || "letter")
      .replace(/[^a-z0-9 _-]/gi, "_")
      .trim()
      .slice(0, 80) + ".pdf";

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadLetterPdf(patientId, letter.id, downloadFilename);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const lastDelivery = letter.deliveries && letter.deliveries.length > 0
    ? letter.deliveries[letter.deliveries.length - 1]
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? "Generating…" : "Download PDF"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
        Send via email
      </Button>
      {lastDelivery && <DeliveryBadge delivery={lastDelivery} />}
      {downloadError && (
        <span className="text-xs text-red-700">{downloadError}</span>
      )}

      <SendEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        patientId={patientId}
        letter={letter}
        defaultEmail={defaultEmail}
        defaultName={defaultName}
        onDelivered={onDelivered}
      />
    </div>
  );
}

function DeliveryBadge({
  delivery,
}: {
  delivery: NonNullable<SentLetter["deliveries"]>[number];
}) {
  const variant =
    delivery.status === "sent"
      ? ("success" as const)
      : delivery.status === "captured"
        ? ("warning" as const)
        : delivery.status === "queued"
          ? ("info" as const)
          : ("danger" as const);
  const label =
    delivery.status === "sent"
      ? `Emailed ${formatTime(delivery.sentAt)}`
      : delivery.status === "captured"
        ? "PDF generated (no SMTP configured)"
        : delivery.status === "queued"
          ? "Queued"
          : "Send failed";
  return <Badge variant={variant}>{label}</Badge>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function SendEmailDialog({
  open,
  onOpenChange,
  patientId,
  letter,
  defaultEmail,
  defaultName,
  onDelivered,
}: Props & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [toEmail, setToEmail] = useState(defaultEmail ?? "");
  const [toName, setToName] = useState(defaultName ?? letter.to ?? "");
  const [bodyText, setBodyText] = useState(
    "Please see the attached pre-operative clearance correspondence. This is a draft for clinician review.",
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendEmailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendLetterEmail({
        patientId,
        letterId: letter.id,
        toEmail: toEmail.trim(),
        toName: toName.trim() || undefined,
        bodyText,
      });
      setResult(res);
      onDelivered?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send letter via email</DialogTitle>
          <DialogDescription>
            Generates a clinical PDF of <em>{letter.subject}</em> and emails it to
            the recipient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recipient email
              </label>
              <Input
                type="email"
                placeholder="dr.marquez@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recipient name (optional)
              </label>
              <Input
                placeholder="Dr. Lisa Marquez"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cover note
            </label>
            <Textarea
              rows={3}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>

          {result && (
            <div
              className={
                "rounded-md border px-3 py-2 text-sm " +
                (result.delivery.status === "sent"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : result.delivery.status === "captured"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-900")
              }
            >
              <div className="font-medium">
                {result.delivery.status === "sent"
                  ? "Sent."
                  : result.delivery.status === "captured"
                    ? "Captured — SMTP not configured."
                    : "Send failed."}
              </div>
              {result.delivery.detail && (
                <div className="mt-1 text-xs">{result.delivery.detail}</div>
              )}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Close
          </Button>
          <Button
            onClick={send}
            disabled={sending || !toEmail.trim() || /@/.test(toEmail) === false}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
