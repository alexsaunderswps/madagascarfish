import { redirect } from "next/navigation";

import { resolveBaseUrl } from "@/lib/api";
import { getServerDrfToken } from "@/lib/auth";

import LogoutButton from "./LogoutButton";

export const metadata = {
  title: "Account — Madagascar Freshwater Fish",
  description: "Your account profile and access tier.",
};

export const dynamic = "force-dynamic";

interface MeResponse {
  email: string;
  name: string;
  access_tier: number;
}

const TIER_LABELS: Record<number, string> = {
  1: "Public",
  2: "Researcher",
  3: "Conservation Coordinator",
  4: "Program Manager",
  5: "Administrator",
};

function tierBadge(tier: number): string {
  const label = TIER_LABELS[tier] ?? "Member";
  return `${label} · Tier ${tier}`;
}

export default async function AccountPage() {
  const drfToken = await getServerDrfToken();
  if (!drfToken) {
    redirect("/login?callbackUrl=/account");
  }

  let me: MeResponse | null = null;
  let transientError = false;
  try {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/me/`, {
      headers: { Authorization: `Token ${drfToken}` },
      cache: "no-store",
    });
    if (response.status === 401) {
      // Stale or revoked token; force re-login.
      redirect("/login?callbackUrl=/account");
    }
    if (response.ok) {
      me = (await response.json()) as MeResponse;
    } else {
      transientError = true;
    }
  } catch {
    transientError = true;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8">
        <p className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Account
        </p>
        <h1 className="mt-2 font-serif text-3xl text-slate-900">Your profile</h1>
      </header>

      {me ? (
        <dl className="space-y-4 rounded border border-slate-200 bg-white p-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Name
            </dt>
            <dd className="mt-1 text-slate-900">{me.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Email
            </dt>
            <dd className="mt-1 text-slate-900">{me.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Access tier
            </dt>
            <dd className="mt-1">
              <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                {tierBadge(me.access_tier)}
              </span>
            </dd>
          </div>
        </dl>
      ) : null}

      {transientError ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          We couldn&rsquo;t load your profile just now. Please refresh in a
          moment. If the problem persists, contact the platform team.
        </p>
      ) : null}

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}
