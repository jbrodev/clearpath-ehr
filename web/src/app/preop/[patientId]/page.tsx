import { PreOpPatientDetail } from "@/components/preop/preop-detail";

export const dynamic = "force-dynamic";

export default async function PreOpPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }> | { patientId: string };
}) {
  const resolved = await Promise.resolve(params);
  return <PreOpPatientDetail patientId={resolved.patientId} />;
}
