import { dispositionStyle, prettyDisposition } from "@/lib/format";
import type { Disposition } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DispositionBadge({
  disposition,
  className,
}: {
  disposition: Disposition;
  className?: string;
}) {
  const style = dispositionStyle(disposition);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />
      {prettyDisposition(disposition)}
    </span>
  );
}
