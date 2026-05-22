import { PcpPatientReview } from "@/components/pcp/pcp-detail";

export const dynamic = "force-dynamic";

export default async function PcpPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }> | { patientId: string };
}) {
  const resolved = await Promise.resolve(params);
  return <PcpPatientReview patientId={resolved.patientId} />;
}
