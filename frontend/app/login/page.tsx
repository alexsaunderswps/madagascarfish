import Link from "next/link";

import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in — Madagascar Freshwater Fish",
  description: "Sign in to access tier-restricted content.",
};

interface PageProps {
  searchParams?: Promise<{ callbackUrl?: string; verified?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const verified = params.verified === "1";

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Account
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">Sign in</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in to your account to access tier-restricted features.{" "}
          Anonymous browsing of species, the map, and public dashboards
          remains available without an account.
        </p>
      </header>

      {verified ? (
        <div
          role="status"
          className="mb-6 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Account verified. You can now sign in.
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-6 text-sm text-slate-600">
        New to the platform?{" "}
        <Link href="/signup" className="text-sky-700 hover:underline">
          Create an account
        </Link>
        .
      </p>
    </main>
  );
}
