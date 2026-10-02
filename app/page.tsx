import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Issuer = {
  id: string;
  trade_name: string;
  legal_name: string | null;
  accent_colour: string | null;
};

export default async function Home() {
  // Internal staff tool: read with the service-role client on the server.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("issuers")
    .select("id, trade_name, legal_name, accent_colour")
    .order("sort_order");
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
          Connected, but the <code>issuers</code> table returned no rows.
        </div>
      ) : (
        <>
          <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            Connected — {issuers.length} issuer{issuers.length === 1 ? "" : "s"} found.
          </div>
          <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {issuers.map((issuer) => (
              <li key={issuer.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: issuer.accent_colour ?? "currentColor" }}
                />
                <div>
                  <p className="font-medium">{issuer.trade_name}</p>
                  {issuer.legal_name && (
                    <p className="text-sm opacity-70">{issuer.legal_name}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
