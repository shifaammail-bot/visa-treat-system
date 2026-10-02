"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signIn } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-mint py-2.5 text-sm font-bold text-navy hover:bg-mint-600 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [error, action] = useFormState(signIn, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-semibold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/30"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/30"
        />
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
