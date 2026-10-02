import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { signOut } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (session.status === "signed-out") redirect("/login");

  if (session.status === "no-access") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold">No staff access</h1>
          <p className="mt-2 text-sm text-navy/70">
            You&apos;re signed in as <strong>{session.email}</strong>, but there&apos;s no active
            staff record for this email. Ask an admin to add you.
          </p>
          <form action={signOut} className="mt-5">
            <button
              type="submit"
              className="w-full rounded-lg bg-navy py-2.5 text-sm font-bold text-white hover:bg-navy-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { staff } = session;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        items={navFor(staff.role)}
        staff={{ full_name: staff.full_name, email: staff.email, role: staff.role }}
        canSell={can.editSale(staff.role)}
      />
      <main className="min-w-0 flex-1 bg-white">{children}</main>
    </div>
  );
}
