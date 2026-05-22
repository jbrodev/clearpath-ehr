import { Badge } from "@/components/ui/badge";
import { statusLabel, statusVariant, type ClearanceStatus } from "@/lib/workflow";

export function StatusBadge({ status }: { status: ClearanceStatus }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}
