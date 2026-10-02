import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Issuer = { id: string | number; name?: string | null } & Record<string, unknown>;

export default async function Home() {
  const supabase = createClient();
  const { data, error } = await supabase.from("issuers").select("*");
  const issuers = (data ?? []) as Issuer[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Visa Treat Desk</h1>
      <p className="mt-2 text-sm opacity-70">Supabase connection check — issuers table</p>

      {error ? (
        <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Could not query issuers</p>
          <p className="mt-1 font-mono">{error.message}</p>
        </div>
      ) : issuers.length === 0 ? (
        <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connected, but no rows were returned. If the table has data, check the RLS
          policies on <code>issuers</code> for the anon role.
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            Connected — {issuers.length} issuer{issuers.length === 1 ? "" : "s"} found.
          </div>
          <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {issuers.map((issuer) => (
              <li key={String(issuer.id)} className="px-4 py-3">
                {issuer.name ?? JSON.stringify(issuer)}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
