import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default async function StaffPage() {
  const session = await getSession();
  if (session.status !== "ok" || session.staff.role !== "admin") notFound();

  return (
    <>
      <PageHeader title="Staff" description="Logins and roles. Admins only." />
      <ComingSoon step={2} what="Create staff logins and assign roles and brands." />
    </>
  );
}
