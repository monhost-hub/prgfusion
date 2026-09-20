"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client wrapper around next-auth's SessionProvider.
 *
 * Accepts an optional `session` prop to avoid the initial network request
 * to /api/auth/session. When provided, the client immediately has the
 * session data without polling.
 */
export function AuthProvider({
  children,
  session,
}: {
  children: ReactNode;
  session?: any;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
