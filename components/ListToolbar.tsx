import Link from "next/link";
import { inputClass } from "@/components/ui";

type Tab = { label: string; value: string };

/** Search box plus optional filter tabs. Plain GET form, so it works without JS. */
export function ListToolbar({
  path,
  search,
  tabs,
  active,
}: {
  path: string;
  search?: string;
  tabs?: Tab[];
  active?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {tabs ? (
        <nav className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (tab.value) params.set("status", tab.value);
            if (search) params.set("q", search);
            const qs = params.toString();
            const href = qs ? `${path}?${qs}` : path;
            const on = (active ?? "") === tab.value;
            return (
              <Link
                key={tab.value || "all"}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  on ? "bg-navy text-white" : "text-navy/60 hover:bg-navy/5"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <span />
      )}
      <form action={path} className="w-full sm:w-72">
        {active && <input type="hidden" name="status" value={active} />}
        <input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search name, phone, ref, number…"
          className={inputClass}
        />
      </form>
    </div>
  );
}
