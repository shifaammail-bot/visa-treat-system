import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Visa Treat Desk" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-2xl font-extrabold tracking-tight text-white">
          Visa Treat <span className="text-mint">Desk</span>
        </p>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h1 className="text-lg font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-navy/60">Staff accounts are created by an admin.</p>
          <LoginForm next={searchParams.next ?? "/"} />
        </div>
      </div>
    </main>
  );
}
