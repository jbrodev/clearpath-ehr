import { SurgeonPatientDetail } from "@/components/surgeon/surgeon-detail";

export const dynamic = "force-dynamic";

export default async function SurgeonPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }> | { patientId: string };
}) {
  const resolved = await Promise.resolve(params);
  return <SurgeonPatientDetail patientId={resolved.patientId} />;
}
