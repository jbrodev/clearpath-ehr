import { riskLevelStyle, titleCase } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  riskLevel: RiskLevel;
  riskScore: number;
  rcriScore: number;
  confidence: number;
}

export function RiskSummary({ riskLevel, riskScore, rcriScore, confidence }: Props) {
  const style = riskLevelStyle(riskLevel);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Risk Level">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium",
            style.bg,
            style.text,
            style.border,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
          {titleCase(riskLevel)}
        </span>
      </Tile>
      <Tile label="Risk Score">
        <span className="text-lg font-semibold tabular-nums">{riskScore}</span>
        <span className="text-xs text-muted-foreground"> / 15</span>
      </Tile>
      <Tile label="RCRI">
        <span className="text-lg font-semibold tabular-nums">{rcriScore}</span>
        <span className="text-xs text-muted-foreground"> / 6</span>
      </Tile>
      <Tile label="Confidence">
        <span className="text-lg font-semibold tabular-nums">
          {Math.round(confidence * 100)}%
        </span>
      </Tile>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
