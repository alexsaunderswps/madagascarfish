"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client-side wrapper for NextAuth's SessionProvider.
 *
 * Mounted at the top of the App Router tree so client components — chiefly
 * the auth-side items in `NavLinks` — can call `useSession()`. Kept as a
 * thin client island so the layout itself stays a server component and
 * static-rendered pages aren't pulled into dynamic rendering by a
 * cookies/session read in the layout.
 */
export default function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
