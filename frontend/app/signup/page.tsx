import Link from "next/link";

import SignupForm from "./SignupForm";

export const metadata = {
  title: "Create an account — Madagascar Freshwater Fish",
  description:
    "Create a researcher account to access tier-restricted occurrence data and submit observations.",
};

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Account
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">
          Create an account
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Researchers join as Tier 2, which unlocks occurrence datasets and
          observation submission. Anonymous browsing of species, the map, and
          public dashboards remains available without an account.
        </p>
      </header>

      <SignupForm />

      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="text-sky-700 hover:underline">
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}
