import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Visa Treat Desk" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <BrandLogo slug="visatreat" tradeName="Visa Treat" accentColour="#2FE0C2" on="light" className="h-12" />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-navy/40">Desk</p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-navy/60">Staff accounts are created by an admin.</p>
          <LoginForm next={searchParams.next ?? "/"} />
        </div>
      </div>
    </main>
  );
}
